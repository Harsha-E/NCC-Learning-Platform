import AbstractView from '../core/AbstractView.js';
import { getDbInstance, doc, getDoc, setDoc, collection, getDocs } from '../core/firebase-init.js';
import Toast from '../components/toast.js';

export default class AdminDashboardView extends AbstractView {
  constructor(params) {
    super(params);
    this.pdfDoc = null;
    this.pageRenderTask = null;
    this.currentPage = 1;
    this.currentFileName = 'Assessment'; 
    this.quill = null;
    
    // State
    this.pageData = {}; 
    this.quizData = {}; 
    this.openTabs = ['Page 1']; 
    this.activeTab = 'Page 1';
    this.tabNames = {}; 
    this.processedPages = new Set(); 
    this.pageToTabMap = {};
    
    // Engine Flags
    this.isAutoExtracting = false;
    this.workspaceMode = 'content'; 
    
    // Spatial Masking State
    this.masks = [];
    this.isDragging = false;
    this.startX = 0; 
    this.startY = 0;
    
    this.handleKeyDown = this.handleKeyDown.bind(this);
    
    window._renameTab = (tabId, newName) => {
        if(newName.trim() === '') return;
        this.tabNames[tabId] = newName.trim();
        this.renderTabs();
    };
  }

  async getHtml() {
    return `
      <style>
        :root {
            /* Core Slate Palette */
            --bg-base: #020617;
            --bg-surface: #0F172A;
            --bg-elevated: #1E293B;
            --bg-hover: #334155;
            
            /* Typography */
            --text-main: #F8FAFC;
            --text-muted: #94A3B8;
            --text-dark: #cbd5e1;
            
            /* Accents */
            --accent-primary: #3B82F6;
            --accent-quiz: #8B5CF6;
            --accent-success: #10B981;
            --accent-warning: #F59E0B;
            --accent-danger: #EF4444;
            
            /* Borders & Shadows */
            --border-color: #334155;
            --border-light: rgba(255,255,255,0.05);
            --radius-sm: 6px;
            --radius-md: 10px;
            --radius-lg: 16px;
            --shadow-float: 0 8px 24px -4px rgba(0, 0, 0, 0.4);
            --shadow-glow: 0 0 12px rgba(59, 130, 246, 0.3);
        }

        /* =========================================
           GLOBAL ANIMATIONS
           ========================================= */
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideInRight { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes pulseGlow { 0% { box-shadow: 0 0 0 0 rgba(16,185,129,0.4); } 70% { box-shadow: 0 0 0 6px rgba(16,185,129,0); } 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); } }

        /* =========================================
           BASE LAYOUT & SCROLLBARS
           ========================================= */
        .workstation { display:flex; flex-direction:column; height:calc(100vh - 4.5rem); background:var(--bg-surface); color:var(--text-main); font-family:'Inter', system-ui, sans-serif; overflow:hidden; animation: fadeIn 0.4s ease-out; box-sizing: border-box !important; padding-top: 8rem !important; min-height: 100dvh !important; }
        .workspace-container { display:flex; flex:1; min-height:0; width:100%; overflow:hidden; }
        .pane { display:flex; flex-direction:column; background:var(--bg-surface); min-width:0; }
        :root { --left-w:32%; --right-w:400px; }
        .pane-left { width:var(--left-w); flex-shrink:0; background:var(--bg-base); border-right: 1px solid var(--border-color); }
        .pane-mid { flex:1; flex-shrink:1; min-width:0; position:relative; }
        .pane-right { width:var(--right-w); flex-shrink:0; background:var(--bg-base); border-left: 1px solid var(--border-color); }
        .pane-left.hidden, .pane-right.hidden { display:none; }
        
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--bg-hover); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #475569; }

        .resizer { width:4px; background:transparent; cursor:col-resize; flex-shrink:0; z-index:100; transition: background 0.2s; }
        .resizer:hover, .resizer.active { background:var(--accent-primary); }

        /* =========================================
           HEADERS & TOOLBARS (GLASSMORPHISM)
           ========================================= */
        .master-toolbar { 
            background: rgba(2, 6, 23, 0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
            border-bottom: 1px solid var(--border-color); padding: 0.85rem 1.5rem; 
            display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; z-index: 50; 
        }
        .pane-header { 
            padding: 1rem 1.25rem; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(8px); 
            font-weight: 700; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; 
            display: flex; justify-content: space-between; align-items: center; 
            border-bottom: 1px solid var(--border-color); flex-shrink: 0; color: var(--text-muted); 
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); z-index: 10;
        }

        /* Segmented Control (Apple Style) */
        .segmented-control { display:flex; background:var(--bg-base); border-radius:12px; padding:4px; gap:4px; border: 1px solid var(--border-light); }
        .mode-btn { padding:0.6rem 1.5rem; border-radius:8px; font-weight:600; font-size:0.85rem; cursor:pointer; border:none; background:transparent; color:var(--text-muted); transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .mode-btn:hover { color: var(--text-main); }
        .mode-btn.active { background:var(--accent-primary); color:white; box-shadow: var(--shadow-glow); }
        .mode-btn.active.quiz { background:var(--accent-quiz); box-shadow: 0 0 12px rgba(139,92,246,0.3); }

        /* Buttons */
        .btn-action { padding:0.6rem 1.2rem; border-radius:var(--radius-md); font-weight:600; cursor:pointer; border:none; font-size:0.85rem; transition:all 0.2s; display:inline-flex; align-items:center; gap:0.5rem; justify-content: center; }
        .btn-success { background:var(--accent-success); color:white; box-shadow: 0 2px 8px rgba(16,185,129,0.2); }
        .btn-success:hover { background:#059669; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(16,185,129,0.3); }
        .btn-ghost { background:transparent; border:1px solid var(--border-color); color:var(--text-muted); }
        .btn-ghost:hover { background:var(--bg-hover); color:var(--text-main); border-color: var(--text-muted); }
        .win-btn { background:transparent; border:none; color:var(--text-muted); cursor:pointer; padding:6px; border-radius:var(--radius-md); display:flex; align-items:center; justify-content:center; transition: 0.2s; }
        .win-btn:hover { background:var(--bg-elevated); color:var(--text-main); transform: scale(1.05); }

        /* =========================================
           PDF EXTRACTOR & CANVAS
           ========================================= */
        .pdf-wrapper { flex:1; overflow-y:auto; padding:1.5rem; background:var(--bg-base); text-align:center; position: relative; }
        #canvasWrapper { position:relative; display:inline-block; margin:0 auto; box-shadow: var(--shadow-float); border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--border-light); }
        #pdfCanvas { max-width:100%; display:block; }
        
        #selectionBox { position:absolute; border:2px dashed var(--accent-primary); background:rgba(59,130,246,0.15); pointer-events:none; display:none; z-index:30; box-shadow: 0 0 0 9999px rgba(0,0,0,0.5); backdrop-filter: brightness(1.1); }
        #maskContainer { position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:20; }
        .mask-persistent { position:absolute; pointer-events:none; border-width:2px; border-style:dashed; border-radius: 4px; }
        .mask-persistent.clip { border-color:var(--accent-success); background:rgba(16,185,129,0.1); }
        .mask-persistent.exclude { border-color:var(--accent-danger); background:rgba(239,68,68,0.15); }
        
        /* =========================================
           TABS UI
           ========================================= */
        .tab-bar-container { display:flex; width:100%; background:var(--bg-surface); border-bottom:1px solid var(--border-color); flex-shrink:0; padding: 10px 10px 0 10px; }
        .tab-bar { display:flex; overflow-x:auto; flex-wrap:nowrap; gap: 6px; width:100%; padding-bottom: 0; }
        .tab-node { display:flex; align-items:center; background:var(--bg-base); border-radius:12px 12px 0 0; padding:0.6rem 1rem; border:1px solid var(--border-color); border-bottom:none; flex-shrink:0; max-width:200px; min-width:120px; transition: 0.2s; opacity: 0.7; }
        .tab-node:hover { opacity: 1; background: var(--bg-hover); }
        .tab-node.active { background:var(--bg-elevated); border-color:var(--border-color); opacity: 1; box-shadow: 0 -4px 12px rgba(0,0,0,0.1); padding-bottom: 0.7rem; margin-bottom: -1px; }
        .tab-title-input { background:transparent; border:none; color:var(--text-muted); font-weight:600; font-size:0.85rem; outline:none; flex:1; width:100%; cursor:pointer; text-overflow:ellipsis; overflow:hidden; }
        .tab-title-input:not([readonly]) { background:var(--bg-base); color:white; cursor:text; padding:4px; border-radius:4px; border:1px solid var(--accent-primary); }
        .tab-node.active .tab-title-input { color:var(--accent-primary); }
        .tab-close { color:var(--text-muted); background:transparent; border:none; font-size:1.1rem; cursor:pointer; border-radius:50%; width:22px; height:22px; display:flex; align-items:center; justify-content:center; margin-left:8px; transition:0.2s; }
        .tab-close:hover { color:white; background:var(--accent-danger); transform: rotate(90deg); }
        
        /* =========================================
           QUIZ BUILDER
           ========================================= */
        #quiz-builder-container { flex:1; overflow-y:auto; padding:2rem; background:var(--bg-base); display:none; flex-direction:column; }
        .qb-question-card { background:var(--bg-surface); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:1.5rem; margin-bottom:1.5rem; position:relative; flex-shrink:0; box-shadow: 0 4px 15px rgba(0,0,0,0.2); transition: 0.3s; animation: slideInUp 0.3s ease-out; }
        .qb-question-card:hover { border-color: var(--accent-quiz); transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.4); }
        .qb-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; }
        .qb-label { color:var(--accent-quiz); font-weight:800; font-size:0.95rem; letter-spacing:1px; background: rgba(139,92,246,0.1); padding: 4px 10px; border-radius: 6px; }
        .qb-delete { background:rgba(239,68,68,0.1); color:var(--accent-danger); border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.8rem; font-weight:bold; transition: 0.2s; }
        .qb-delete:hover { background:var(--accent-danger); color:white; }
        .qb-textarea { width:100%; background:var(--bg-base); border:1px solid var(--border-color); color:var(--text-main); padding:1rem; border-radius:var(--radius-md); font-size:1rem; font-family:inherit; margin-bottom:1.5rem; resize:vertical; min-height:80px; outline:none; transition:0.2s; }
        .qb-textarea:focus { border-color: var(--accent-quiz); box-shadow: 0 0 0 3px rgba(139,92,246,0.15); }
        .qb-option-row { display:flex; align-items:center; gap:12px; margin-bottom:0.85rem; }
        .qb-option-radio { width:22px; height:22px; accent-color:var(--accent-success); cursor:pointer; }
        .qb-option-input { flex:1; background:var(--bg-base); border:1px solid var(--border-color); color:var(--text-main); padding:0.85rem; border-radius:var(--radius-md); font-size:0.95rem; outline:none; transition:0.2s; }
        .qb-option-input:focus { border-color: var(--accent-quiz); }
        .qb-correct-label { color:var(--accent-success); font-size:0.8rem; font-weight:bold; width:70px; text-align:center; opacity:0; transition:0.3s; background:rgba(16,185,129,0.1); padding: 6px; border-radius: 6px; transform: translateX(-10px); }
        .qb-option-row:has(input[type="radio"]:checked) .qb-correct-label { opacity:1; transform: translateX(0); }
        .qb-option-row:has(input[type="radio"]:checked) .qb-option-input { border-color:var(--accent-success); background: rgba(16,185,129,0.05); }
        
        .qb-add-btn { width:100%; border:2px dashed var(--border-color); background:transparent; color:var(--text-muted); font-weight:bold; padding:1.5rem; border-radius:var(--radius-lg); cursor:pointer; transition:0.3s; font-size:1rem; margin-bottom: 2rem; flex-shrink:0; }
        .qb-add-btn:hover { border-color: var(--accent-quiz); color: var(--accent-quiz); background: rgba(139,92,246,0.05); }
        
        /* FEATURE 7: AI Panel Accordion */
        details.ai-panel { background:var(--bg-surface); border:1px solid var(--border-color); border-radius:var(--radius-lg); margin-top:auto; flex-shrink:0; box-shadow: var(--shadow-float); overflow: hidden; transition: 0.3s; }
        details.ai-panel summary { padding: 1.25rem 1.5rem; font-weight: 700; color: var(--accent-primary); cursor: pointer; list-style: none; display: flex; align-items: center; justify-content: space-between; user-select: none; background: var(--bg-elevated); }
        details.ai-panel summary::-webkit-details-marker { display: none; }
        details.ai-panel summary::after { content: '▼'; font-size: 0.8rem; transition: transform 0.3s; }
        details[open].ai-panel summary::after { transform: rotate(180deg); }
        .ai-panel-content { padding: 1.5rem; border-top: 1px solid var(--border-color); animation: fadeIn 0.3s; }
        
        /* Quill Editor Adjustments */
        #editor-container { flex:1; overflow-y:auto; color:var(--text-main); font-size:16px; border:none; display:flex; flex-direction:column; background: var(--bg-elevated); }
        .ql-toolbar { background:var(--bg-base); border:none !important; border-bottom:1px solid var(--border-color) !important; flex-shrink:0; padding: 12px !important; }
        .ql-container { border:none !important; display:flex; flex-direction:column; flex:1; font-family: 'Inter', sans-serif; }
        .ql-editor { flex:1; padding:2.5rem; min-height:100%; max-width: 850px; margin: 0 auto; width: 100%; background: var(--bg-surface); box-shadow: 0 0 20px rgba(0,0,0,0.2); }

        /* =========================================
           TREE BUILDER (CURRICULUM DATABASE)
           ========================================= */
        .target-list { flex: 1; overflow-y: auto; padding: 1.5rem; font-size: 0.9rem; scroll-behavior: smooth; }
        
        .tree-node { 
            margin-bottom: 8px; position: relative;
            animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) backwards; 
        }
        
        /* Strict Flex Row to prevent Squishing */
        .tree-row { 
            display: flex; align-items: center; background: var(--bg-elevated); 
            padding: 8px 12px; border-radius: var(--radius-md); 
            border: 1px solid var(--border-color); gap: 10px; flex-wrap: nowrap; /* CRITICAL */
            position: relative; z-index: 2; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); 
            box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden;
        }
        .tree-row:hover { 
            border-color: var(--accent-primary); 
            box-shadow: 0 4px 12px rgba(0,0,0,0.3); 
            transform: translateX(4px); 
        }
        .tree-row.dragging { opacity: 0.5; border: 2px dashed var(--accent-primary); transform: scale(0.98); }
        
        /* Connector Lines */
        .tree-level { 
            margin-left: 22px; border-left: 2px solid var(--border-color); 
            padding-left: 18px; margin-top: 8px; position: relative;
        }
        .tree-level .tree-node::before {
            content: ''; position: absolute; left: -18px; top: 22px;
            width: 16px; height: 2px; background: var(--border-color);
            z-index: 1; transition: 0.2s;
        }
        .tree-level .tree-node:hover::before { background: var(--accent-primary); }

        .drag-handle { flex: 0 0 auto; cursor: grab; color: var(--text-muted); font-size: 1.1rem; padding-right: 4px; user-select: none; transition: 0.2s; opacity: 0.5; }
        .tree-row:hover .drag-handle { opacity: 1; color: var(--text-main); }
        
        /* Inputs */
        .tree-input { 
            flex: 1 1 auto; min-width: 0; /* CRITICAL: Allows flex to shrink without blowing out container */
            background: rgba(2, 6, 23, 0.4); border: 1px solid transparent; 
            color: var(--text-main); font-size: 0.9rem; padding: 8px 10px; 
            border-radius: 6px; outline: none; transition: all 0.2s; text-overflow: ellipsis;
        }
        .tree-input:focus { background: var(--bg-base); border-color: var(--accent-primary); box-shadow: 0 0 0 3px rgba(59,130,246,0.15); }
        
        .tree-input.cert-name { font-weight: 800; color: var(--accent-warning); font-size: 1rem; background: rgba(245, 158, 11, 0.05); }
        .tree-input.mod-name { font-weight: 700; color: var(--accent-primary); background: rgba(59, 130, 246, 0.05); }
        
        /* Controls (Strict no-shrink) */
        .mod-wing { 
            flex: 0 0 auto; width: 100px; /* Fixed width */
            background: var(--bg-base); color: var(--accent-primary); 
            border: 1px solid var(--border-color); border-radius: 6px; 
            padding: 8px 24px 8px 8px; font-size: 0.75rem; font-weight: 700; 
            outline: none; cursor: pointer; transition: 0.2s;
            appearance: none; background-image: url('data:image/svg+xml;utf8,<svg fill="%2338BDF8" height="20" viewBox="0 0 24 24" width="20" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/><path d="M0 0h24v24H0z" fill="none"/></svg>');
            background-repeat: no-repeat; background-position: right 2px center;
        }
        .mod-wing:focus { border-color: var(--accent-primary); box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
        
        .tree-btn { 
            flex: 0 0 auto; white-space: nowrap; /* CRITICAL */
            background: var(--bg-base); border: 1px solid var(--border-color); 
            color: var(--text-muted); cursor: pointer; font-size: 0.85rem; 
            padding: 8px 12px; border-radius: 6px; font-weight: 600; transition: all 0.2s; 
        }
        .tree-btn:hover { background: var(--bg-hover); color: var(--text-main); border-color: var(--text-muted); box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        
        .tree-btn.del { flex: 0 0 auto; background: transparent; border: none; padding: 6px; font-size: 1.2rem; color: var(--text-muted); }
        .tree-btn.del:hover { color: white; background: var(--accent-danger); transform: rotate(90deg); }
        
        .edit-btn { color: var(--accent-quiz) !important; border-color: rgba(139,92,246,0.3) !important; background: rgba(139,92,246,0.05); }
        .edit-btn:hover { background: var(--accent-quiz) !important; color: white !important; }
        
        /* Publish Footer */
        .global-sync-box { padding:1.5rem; background:var(--bg-elevated); border-top:1px solid var(--border-color); }
        .sync-select { width:100%; background:var(--bg-base); border:1px solid var(--accent-primary); color:white; padding:12px; border-radius:var(--radius-md); font-size:0.9rem; outline:none; margin-bottom:10px; font-weight:600; cursor: pointer; box-shadow: inset 0 2px 4px rgba(0,0,0,0.2); }
        .publish-footer { padding:1.5rem; background:var(--bg-elevated); border-top:1px dashed var(--border-color); flex-shrink:0; }
        .btn-publish { background:linear-gradient(135deg, var(--accent-warning), #EA580C); color:#020617; width:100%; padding:1.2rem; font-size:1.05rem; border:none; font-weight:800; border-radius:var(--radius-md); cursor:pointer; box-shadow: 0 4px 15px rgba(234, 88, 12, 0.2); transition: 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        .btn-publish:hover { transform: translateY(-3px) scale(1.02); box-shadow: 0 8px 25px rgba(234, 88, 12, 0.4); }
        
        /* Loaders & Indicators */
        .loader-overlay { position:absolute; inset:0; background:rgba(2,6,23,0.85); z-index:99; flex-direction:column; align-items:center; justify-content:center; color:white; display:none; backdrop-filter: blur(4px); }
        .loader-overlay.active { display:flex; animation: fadeIn 0.2s; }
        .spinner { width:40px; height:40px; border:4px solid var(--border-color); border-top-color:var(--accent-success); border-radius:50%; animation:spin 1s linear infinite; }
        
        #pageIndicator { cursor: pointer; padding: 6px 16px; background: var(--bg-elevated); border-radius: var(--radius-md); transition: 0.2s; font-weight: 600; color: white; border: 1px solid var(--border-color); }
        #pageIndicator:hover { background: var(--accent-primary); border-color: var(--accent-primary); box-shadow: var(--shadow-glow); }
      </style>
      
      <link href="https://cdn.quilljs.com/1.3.7/quill.snow.css" rel="stylesheet">
      
      <div class="workstation">
        <div class="master-toolbar">
          <div style="font-weight:900; color:white; letter-spacing:1px; font-size: 1.2rem;">
            NCC <span style="color:var(--accent-warning);">COMMAND</span>
          </div>
          
          <div class="segmented-control">
            <button class="mode-btn active" id="modeContentBtn">📘 Content Editor</button>
            <button class="mode-btn" id="modeQuizBtn">📝 Assessment Builder</button>
          </div>
          
          <div class="window-controls">
            <button class="win-btn" id="toggleLeftBtn" title="Toggle Source Engine">
              <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7"/></svg>
            </button>
            <button class="win-btn" id="toggleRightBtn" title="Toggle Curriculum Database">
              <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7"/></svg>
            </button>
          </div>
        </div>

        <div class="workspace-container" id="workspaceContainer">
          
          <div class="pane pane-left" id="paneLeft">
            <div class="pane-header">
              <span>Source Engine</span>
              <div style="display:flex;gap:0.5rem;">
                <input type="file" id="fileInput" accept="application/pdf,.docx,image/*" style="display:none">
                <button class="btn-action btn-ghost" onclick="document.getElementById('fileInput').click()">Load File</button>
                <button id="autoBotBtn" class="btn-action btn-success" style="display:none; animation: pulseGlow 2s infinite;">🤖 Auto-Bot</button>
              </div>
            </div>
            
            <div class="pdf-wrapper" id="pdfContainer">
              <div class="loader-overlay" id="ocrLoader">
                  <div class="spinner"></div>
                  <h4 style="margin-top:1rem; font-family:'Poppins', sans-serif;" id="ocrStatusText">Engine Running...</h4>
              </div>
              <div id="pdfPlaceholder" style="color:var(--text-muted); margin-top:40%; display:flex; flex-direction:column; align-items:center; gap:1rem;">
                  <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                  <span>Load a PDF, DOCX, or Scanned Image to begin.</span>
              </div>
              
              <div id="canvasWrapper" style="display:none;">
                <canvas id="pdfCanvas"></canvas>
                <div id="maskContainer"></div>
                <div id="selectionBox"></div> 
              </div>
            </div>
            
            <div style="padding:1rem; background:var(--bg-elevated); border-top:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
              <button id="prevPage" class="btn-action btn-ghost" style="padding:0.5rem 0.8rem;">◀</button>
              <span id="pageIndicator" title="Click to Jump to Page">Ready</span>
              <button id="nextPage" class="btn-action btn-ghost" style="padding:0.5rem 0.8rem;">▶</button>
              <button id="openTabBtn" class="btn-action btn-ghost" style="display:none; color:var(--accent-primary); border-color:var(--accent-primary);">+ Extract Page</button>
            </div>
          </div>
          
          <div class="resizer" id="resizerLeft"></div>
          
          <div class="pane pane-mid" id="paneMid">
            <div class="pane-header">
              <span id="boardTitle">Content Drafting Board</span>
              <div style="display:flex; gap:8px; align-items:center;">
                <button id="clearTabBtn" class="btn-action btn-ghost" style="color:var(--accent-danger); border-color:var(--accent-danger); padding:6px 12px;">🧹 Clear Tab</button>
                <div style="width:1px; height:16px; background:var(--border-color); margin:0 4px;"></div>
                <button class="color-btn" style="width:18px;height:18px;border-radius:50%;background:#FF9933;border:2px solid var(--border-color);cursor:pointer; transition:0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'"></button>
                <button class="color-btn" style="width:18px;height:18px;border-radius:50%;background:#FFFFFF;border:2px solid var(--border-color);cursor:pointer; transition:0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'"></button>
                <button class="color-btn" style="width:18px;height:18px;border-radius:50%;background:#138808;border:2px solid var(--border-color);cursor:pointer; transition:0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'"></button>
              </div>
            </div>
            
            <div class="tab-bar-container"><div class="tab-bar" id="tabBar"></div></div>
            
            <div id="editor-container"></div>
            
            <div id="quiz-builder-container">
                <div id="qb-questions-list"></div>
                <button class="qb-add-btn" id="qbAddBtn">+ Add Question Manually</button>
                
                <details class="ai-panel">
                   <summary>
                      <div style="display:flex; align-items:center; gap:10px;">
                          🤖 Smart AI JSON Importer
                      </div>
                   </summary>
                   <div class="ai-panel-content">
                       <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                           <p style="font-size:0.85rem; color:var(--text-muted); margin:0;">Convert raw text to structured Quiz Cards using an external LLM.</p>
                           <button id="aiPromptBtn" class="btn-action btn-ghost" title="Copy Master AI Prompt">💡 Get Prompt</button>
                       </div>
                       <textarea id="aiJsonInput" placeholder='Paste JSON array here... e.g. [{"text": "Question?", "options": ["A","B","C","D"], "correct": 0}]' style="width:100%; height:140px; background:var(--bg-base); color:var(--accent-success); border:1px solid var(--border-color); padding:12px; border-radius:var(--radius-md); font-family:monospace; outline:none; resize:vertical;"></textarea>
                       <button id="aiParseBtn" class="btn-action btn-success" style="width:100%; margin-top:12px; padding:1rem;">Inject JSON into Assessment</button>
                   </div>
                </details>
            </div>
          </div>
          
          <div class="resizer" id="resizerRight"></div>

          <div class="pane pane-right" id="paneRight">
            <div class="pane-header">
              <span>Curriculum Database</span>
              <button class="btn-action btn-ghost" id="addCertBtn" style="padding:6px 12px;">+ Add Cert</button>
            </div>
            
            <div class="target-list" id="targetList">
              <div id="loadingTree" style="color:var(--text-muted); text-align:center; margin-top:2rem; font-weight: 600;">Fetching Database... ⏳</div>
            </div>
            
            <div class="global-sync-box">
              <select id="globalTargetMapping" class="sync-select">
                <option value="">-- Select Target Chapter --</option>
              </select>
            </div>
            
            <div class="publish-footer">
              <button id="publishBtn" class="btn-publish">Deploy Entire Workspace 🚀</button>
            </div>
          </div>
          
        </div>
      </div>
    `;
  }

  // ==========================================
  // INITIALIZATION & SCRIPT LOADING
  // ==========================================
  async mount() {
    await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    await this.loadScript('https://cdn.quilljs.com/1.3.7/quill.min.js');
    await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.4.21/mammoth.browser.min.js');
    await this.loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
    
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    this.initResizers();
    this.initPaneToggles();

    if (!window._quillVideoRegistered) {
        const BlockEmbed = window.Quill.import('blots/block/embed');
        class VideoBlot extends BlockEmbed {
            static create(url) {
                let node = super.create();
                let embedUrl = url;
                if(url.includes('youtube.com/watch')) {
                    const urlParams = new URL(url).searchParams;
                    embedUrl = `https://www.youtube.com/embed/${urlParams.get('v')}?rel=0`;
                } else if (url.includes('youtu.be/')) {
                    const id = url.split('youtu.be/')[1].split('?')[0];
                    embedUrl = `https://www.youtube.com/embed/${id}?rel=0`;
                }
                node.setAttribute('src', embedUrl);
                node.setAttribute('frameborder', '0');
                node.setAttribute('allowfullscreen', true);
                node.setAttribute('style', 'width:100%; aspect-ratio:16/9; border-radius:8px; margin: 1.5rem 0; box-shadow: 0 4px 15px rgba(0,0,0,0.3);');
                return node;
            }
            static value(node) { return node.getAttribute('src'); }
        }
        VideoBlot.blotName = 'video';
        VideoBlot.tagName = 'iframe';
        window.Quill.register(VideoBlot);
        window._quillVideoRegistered = true;
    }

    this.quill = new window.Quill('#editor-container', {
      theme: 'snow',
      placeholder: 'Draft content or paste links here...',
      modules: { 
          toolbar: [
              [{ size: ['small', false, 'large', 'huge'] }], 
              ['bold', 'italic', 'underline'], 
              [{ list: 'ordered' }, { list: 'bullet' }], 
              ['image', 'video'], ['clean']
          ] 
      }
    });

    this.quill.on('text-change', () => {
      if (this.activeTab && this.workspaceMode === 'content') {
          this.pageData[this.activeTab] = this.quill.root.innerHTML;
      }
    });

    document.getElementById('clearTabBtn').onclick = () => {
      if (!this.activeTab) return;
      if (this.workspaceMode === 'content') {
          this.pageData[this.activeTab] = '';
          this.quill.setText('');
          if (this.activeTab.toString().startsWith('Page')) {
            this.processedPages.delete(parseInt(this.activeTab.replace('Page ', '')));
          }
      } else {
          this.quizData[this.activeTab] = [];
          this.renderQuizBuilder();
      }
      Toast.show('Tab Cleared.', 'default');
    };

    document.getElementById('qbAddBtn').onclick = () => {
        if (!this.quizData[this.activeTab]) this.quizData[this.activeTab] = [];
        this.quizData[this.activeTab].push({ text: '', options: ['', '', '', ''], correct: 0, type: 'mcq' });
        this.renderQuizBuilder();
    };

    // FEATURE 7: AI JSON Importer Buttons
    document.getElementById('aiPromptBtn').onclick = () => {
        const promptText = `I am going to provide you with raw text containing multiple-choice questions. I need you to parse them into a strict JSON array of objects. Do NOT output any markdown, intro text, or explanations. Only output the raw JSON array. The JSON schema must be exactly this:\n\n[\n  {\n    "text": "The actual question text",\n    "options": ["Option A", "Option B", "Option C", "Option D"],\n    "correct": 0 \n  }\n]\n\n(Note: 'correct' is an integer 0-3 indicating the index of the correct option).`;
        navigator.clipboard.writeText(promptText);
        alert("Master Prompt copied to clipboard!\n\nPaste this into ChatGPT or Gemini along with your raw PDF text.");
    };

    document.getElementById('aiParseBtn').onclick = () => {
        try {
            const val = document.getElementById('aiJsonInput').value.trim();
            if (!val) return Toast.show('Paste JSON first', 'error');
            const arr = JSON.parse(val);
            if (!Array.isArray(arr)) throw new Error("Root is not an array");
            
            arr.forEach(q => {
                if(typeof q.text !== 'string' || !Array.isArray(q.options) || typeof q.correct !== 'number') throw new Error("Invalid object schema");
                q.type = 'mcq';
            });

            if (!this.quizData[this.activeTab]) this.quizData[this.activeTab] = [];
            this.quizData[this.activeTab] = this.quizData[this.activeTab].concat(arr);
            this.renderQuizBuilder();
            document.getElementById('aiJsonInput').value = '';
            Toast.show(`Successfully imported ${arr.length} questions!`, 'success');
        } catch(e) {
            Toast.show('Invalid JSON format. Make sure it is a valid array.', 'error');
            console.error("AI JSON Parse Error:", e);
        }
    };

    window._dragStart = e => { e.dataTransfer.setData('text/plain', e.target.closest('.tree-node').id); e.target.closest('.tree-row').classList.add('dragging'); };
    window._dragEnd = e => { e.target.closest('.tree-row').classList.remove('dragging'); this.updateSyncDropdown(); };
    window._dragOver = e => e.preventDefault();
    window._drop = (e, type) => {
      e.preventDefault();
      const dragId = e.dataTransfer.getData('text/plain');
      const target = e.target.closest('.tree-node');
      if (dragId && target && dragId !== target.id && document.getElementById(dragId)?.dataset.type === type) {
        target.parentNode.insertBefore(document.getElementById(dragId), target.nextSibling);
      }
    };
    
    window._addMod = btn => { this.injectTreeNode(btn.closest('.cert-node').querySelector('.tree-level'), 'mod'); this.updateSyncDropdown(); };
    window._addChap = btn => { this.injectTreeNode(btn.closest('.module-node').querySelector('.chapter-container'), 'chap'); this.updateSyncDropdown(); };
    window._checkTree = () => this.updateSyncDropdown();
    window._editChap = btn => this.fetchAndEditPublished(btn);
    document.getElementById('addCertBtn').onclick = () => { this.injectTreeNode(document.getElementById('targetList'), 'cert'); this.updateSyncDropdown(); };

    window.addEventListener('keydown', this.handleKeyDown);

    this.bindModes();
    this.bindFileEvents();
    
    this.renderTabs();
    await this.fetchCloudDatabase();
    document.getElementById('publishBtn').onclick = () => this.executePublish();
  }

  async destroy() {
    window.removeEventListener('keydown', this.handleKeyDown);
    delete window._dragStart; delete window._dragEnd; delete window._dragOver; delete window._drop;
    delete window._addMod; delete window._addChap; delete window._checkTree; delete window._editChap;
    delete window._renameTab;
  }

  loadScript(src) {
    return new Promise(r => {
      if (document.querySelector(`script[src="${src}"]`)) return r();
      const s = document.createElement('script'); s.src = src; s.onload = r; document.head.appendChild(s);
    });
  }

  // ==========================================
  // SPATIAL MASKING & CONTEXTUAL ENTER LOGIC
  // ==========================================
  handleKeyDown(e) {
    if (!this.pdfDoc || e.target.classList.contains('ql-editor') || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    const sel = document.getElementById('selectionBox');
    const isSelecting = sel && sel.style.display === 'block' && parseFloat(sel.style.width) > 5;
    
    if (e.key === 'Enter') {
        e.preventDefault();
        if (isSelecting) {
            this.addMask('clip');
            try { this.executeSpatialExtraction(this.currentPage); } catch(err) { console.error(err); }
        } else {
            try { this.executeSpatialExtraction(this.currentPage); } catch(err) { console.error(err); }
        }
    }
    else if (e.key.toLowerCase() === 'c' && isSelecting) {
        this.addMask('clip');
        Toast.show('Image Masked', 'success');
    }
    else if ((e.key.toLowerCase() === 'x' || e.key === 'Delete') && isSelecting) {
        this.addMask('exclude');
        Toast.show('Area Excluded', 'default');
    }
    else if (e.key === 'Escape') { 
        this.masks = []; 
        document.getElementById('maskContainer').innerHTML = ''; 
        if(sel) sel.style.display = 'none'; 
    }
    else if (e.key === 'ArrowLeft') {
        if (this.currentPage > 1 && !this.isAutoExtracting) { this.currentPage--; this.renderPdfPage(this.currentPage); }
    }
    else if (e.key === 'ArrowRight') {
        if (this.pdfDoc && this.currentPage < this.pdfDoc.numPages && !this.isAutoExtracting) { this.currentPage++; this.renderPdfPage(this.currentPage); }
    }
  }

  addMask(type) {
    const sel = document.getElementById('selectionBox');
    const canvas = document.getElementById('pdfCanvas');
    
    if(!sel || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    const cssX = parseFloat(sel.style.left); 
    const cssY = parseFloat(sel.style.top);
    const cssW = parseFloat(sel.style.width); 
    const cssH = parseFloat(sel.style.height);
    
    const mask = { type, x: cssX, y: cssY, w: cssW, h: cssH, yTop: cssY };

    if (type === 'clip') {
      try {
          const scaleX = canvas.width / rect.width;
          const scaleY = canvas.height / rect.height;
          
          const tmp = document.createElement('canvas'); 
          tmp.width = cssW * scaleX; 
          tmp.height = cssH * scaleY;
          const ctx = tmp.getContext('2d');
          
          ctx.drawImage(canvas, cssX * scaleX, cssY * scaleY, cssW * scaleX, cssH * scaleY, 0, 0, tmp.width, tmp.height);
          mask.dataUrl = tmp.toDataURL('image/png');
      } catch (e) { console.error("Masking Error:", e); }
    }

    this.masks.push(mask);
    
    const div = document.createElement('div'); 
    div.className = `mask-persistent ${type}`;
    div.style.cssText = `left:${cssX}px;top:${cssY}px;width:${cssW}px;height:${cssH}px;`;
    document.getElementById('maskContainer').appendChild(div);
    
    sel.style.display = 'none';
  }

  // ==========================================
  // SPATIAL PDF PARSER & OCR ENGINE
  // ==========================================
  async extractPdfPageTextWithOCR(pageNum) {
      const page = await this.pdfDoc.getPage(pageNum);
      const content = await page.getTextContent();
      
      const viewport = page.getViewport({ scale: 1.0 });
      let mappedItems = content.items.map(item => {
          const [dx, dy] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
          const estimatedWidth = item.width || (item.transform[0] * item.str.length);
          return { str: item.str, x: dx, y: dy, width: estimatedWidth, height: item.transform[3] || 10 };
      });
      
      // Sort with strict Y-axis line locking
      mappedItems.sort((a, b) => {
          if (Math.abs(a.y - b.y) < a.height * 0.5) return a.x - b.x;
          return a.y - b.y;
      });

      let rawText = "";
      let lastItem = null;

      if (mappedItems.length > 0) {
          mappedItems.forEach(item => {
              if (!lastItem) {
                  rawText += item.str;
              } else {
                  if (Math.abs(lastItem.y - item.y) > lastItem.height * 0.5) {
                      rawText += '\n' + item.str;
                  } else {
                      const expectedNextX = lastItem.x + lastItem.width;
                      const gap = item.x - expectedNextX;
                      
                      if (gap > item.height * 0.3 && !rawText.endsWith(' ') && !rawText.endsWith('\n')) {
                          rawText += ' ' + item.str;
                      } else {
                          if (rawText.endsWith(' ') && gap <= item.height * 0.3) rawText = rawText.slice(0, -1);
                          rawText += item.str;
                      }
                  }
              }
              lastItem = item;
          });
      }

      return rawText;
  }

  // ==========================================
  // UNIVERSAL NOISE SANITIZER
  // ==========================================
  sanitizeContentText(rawText) {
      const noiseWords = ["SCANNED BY", "CAMSCANNER", "THE MASTERMINDS", "P T O", "SIGNATURE"];
      
      let cleaned = rawText
          .replace(/ {2,}/g, ' ')       
          .replace(/\.\s\./g, '..');    

      const lines = cleaned.split('\n');
      const validLines = lines.filter(line => {
          const trimmed = line.trim();
          if (trimmed.length < 2) return false;
          if (/^\d+$/.test(trimmed)) return false; 
          if (/^(page|-)?\s*\d+\s*(-)?$/i.test(trimmed)) return false; 
          if (noiseWords.some(w => trimmed.toUpperCase().includes(w))) return false;
          return true;
      });
      
      return validLines.join('\n');
  }

  // ==========================================
  // QUIZ PARSER 
  // ==========================================
  runSmartParser(rawText) {
      let cleanText = rawText
          .replace(/©/gi, '(c)')
          .replace(/@/gi, '(a)')
          .replace(/\(¢\)/gi, '(c)')
          .replace(/o_o/gi, '(c)')
          .replace(/o-o/gi, '(c)')
          .replace(/\(0\)/gi, '(b)')
          .replace(/\(6\)/gi, '(b)')
          .replace(/\|\s*(?=\d)/g, '') 
          .replace(/(_{2,}|\.{3,}|\-{3,})/g, ' _______ ')
          .replace(/(?:^|\s)[\(\[\{][aA][\)\}\]]\s*/g, ' |||A||| ')
          .replace(/(?:^|\s)[aA][\)\.\:]\s+/g, ' |||A||| ')
          .replace(/(?:^|\s)[\(\[\{][bB][\)\}\]]\s*/g, ' |||B||| ')
          .replace(/(?:^|\s)[bB][\)\.\:]\s+/g, ' |||B||| ')
          .replace(/(?:^|\s)[\(\[\{][cC][\)\}\]]\s*/g, ' |||C||| ')
          .replace(/(?:^|\s)[cC][\)\.\:]\s+/g, ' |||C||| ')
          .replace(/(?:^|\s)[\(\[\{][dD][\)\}\]]\s*/g, ' |||D||| ')
          .replace(/(?:^|\s)[dD][\)\.\:]\s+/g, ' |||D||| ')
          .replace(/(?:\r\n|\r|\n)/g, '\n');

      const lines = cleanText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const noiseWords = ["SCANNED BY CAMSCANNER", "THE MASTERMINDS", "PAGE ", "P T O", "SIGNATURE"];
      let gatheredBlocks = [];
      let currentBlock = null;
      let expectedQNum = 1;

      for (let line of lines) {
          if (noiseWords.some(w => line.toUpperCase().includes(w))) continue;
          if (/^\d+$/.test(line)) continue; 

          const qMatch = line.match(/^(?:Q\s*)?(\d+)(?:[\.\-\)\]\”\"\'\:\,]+|\s+)(.*)/i);
          let isNewQuestion = false;
          let extractedNum = expectedQNum;
          let extractedText = line;

          if (qMatch) {
              isNewQuestion = true;
              extractedNum = parseInt(qMatch[1]);
              extractedText = qMatch[2];
              expectedQNum = extractedNum + 1;
          } else if (currentBlock) {
              let hasLateOption = currentBlock.rawString.includes('|||D|||') || currentBlock.rawString.includes('|||C|||');
              let lineStartsOption = line.trim().startsWith('|||');
              
              if (hasLateOption && !lineStartsOption && line.length > 15) {
                  isNewQuestion = true;
                  extractedNum = expectedQNum; 
                  extractedText = line;
                  expectedQNum++;
              }
          }

          if (isNewQuestion) {
              if (currentBlock) gatheredBlocks.push(currentBlock);
              currentBlock = { qNum: extractedNum, rawString: extractedText };
          } else if (currentBlock) {
              currentBlock.rawString += " " + line;
          }
      }
      if (currentBlock) gatheredBlocks.push(currentBlock);
      
      let parsedQuestions = gatheredBlocks.map(block => {
          let raw = block.rawString;
          let correct = 0;
          let hasExplicit = false;

          let ansMatch = raw.match(/Ans(?:wer)?\s*[\:\-\=]?\s*[\(\[\{]?([a-d])[\)\}\]]?/i);
          if (ansMatch) {
              correct = ['a','b','c','d'].indexOf(ansMatch[1].toLowerCase());
              hasExplicit = true;
              raw = raw.replace(ansMatch[0], ''); 
          }

          let idxA = raw.indexOf('|||A|||');
          let idxB = raw.indexOf('|||B|||');
          let idxC = raw.indexOf('|||C|||');
          let idxD = raw.indexOf('|||D|||');

          let text = raw;
          let optionsMap = ['', '', '', ''];

          if (idxA !== -1 || idxB !== -1 || idxC !== -1 || idxD !== -1) {
              let firstMarker = Math.min(...[idxA, idxB, idxC, idxD].filter(x => x !== -1));
              text = raw.substring(0, firstMarker).trim();

              let endA = Math.min(...[idxB, idxC, idxD, raw.length].filter(x => x !== -1 && x > idxA));
              let endB = Math.min(...[idxC, idxD, raw.length].filter(x => x !== -1 && x > idxB));
              let endC = Math.min(...[idxD, raw.length].filter(x => x !== -1 && x > idxC));

              if(idxA !== -1) optionsMap[0] = raw.substring(idxA + 7, endA).trim();
              if(idxB !== -1) optionsMap[1] = raw.substring(idxB + 7, endB).trim();
              if(idxC !== -1) optionsMap[2] = raw.substring(idxC + 7, endC).trim();
              if(idxD !== -1) optionsMap[3] = raw.substring(idxD + 7).trim();
          }

          optionsMap = optionsMap.map((optText, idx) => {
              if (/[✓]|\(\s*[✓]\s*\)/.test(optText)) {
                  correct = idx;
                  hasExplicit = true;
                  return optText.replace(/[✓]|\(\s*[✓]\s*\)/g, '').trim();
              }
              return optText;
          });

          return {
              qNum: block.qNum,
              text: text,
              options: optionsMap, 
              correct: correct,
              hasExplicitAnswer: hasExplicit,
              type: optionsMap.some(o => o.length > 0) ? 'mcq' : 'short_answer'
          };
      });

      const fullTextJoined = lines.join(' ');
      const answerKeyRegex = /\b(\d{1,3})[\.\-\:\s]+[\(\[\{]?([a-d])[\)\}\]]?\b/gi;
      let match;
      
      while ((match = answerKeyRegex.exec(fullTextJoined)) !== null) {
          const qTarget = parseInt(match[1]);
          const targetIndex = ['a','b','c','d'].indexOf(match[2].toLowerCase());
          
          const matchedQ = parsedQuestions.find(q => q.qNum === qTarget);
          if (matchedQ && targetIndex !== -1 && targetIndex < 4) {
              if (!matchedQ.hasExplicitAnswer) matchedQ.correct = targetIndex;
          }
      }

      parsedQuestions.forEach(q => { delete q.qNum; delete q.hasExplicitAnswer; });
      return parsedQuestions;
  }

  parseAndMapQuestions(rawText, sourceName = 'Draft Assessment', append = false) {
      try {
          const parsedQs = this.runSmartParser(rawText);
          let tabId = 'Tab:Assessment';
          let finalTabName = sourceName.replace(/\.[^/.]+$/, ""); 

          if (!append || !this.openTabs.includes(tabId)) {
              this.quizData = {}; 
              this.openTabs = [tabId];
              this.tabNames[tabId] = finalTabName;
              this.quizData[tabId] = parsedQs;
          } else {
              this.quizData[tabId] = this.quizData[tabId].concat(parsedQs);
          }
          
          this.switchTab(tabId);
      } catch (err) { console.error('[ParserBridge] Critical Failure:', err); }
  }

  // ==========================================
  // DOM EVENTS & RENDERING
  // ==========================================
  bindFileEvents() {
    document.getElementById('fileInput').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;

      this.currentFileName = file.name; 
      const isDocx = file.name.toLowerCase().endsWith('.docx');
      const isImage = file.type.startsWith('image/');
      Toast.show(`Processing Upload...`, 'default');

      try {
        if (isDocx) {
          const arrayBuffer = await new Promise((res, rej) => {
             const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsArrayBuffer(file);
          });
          const result = await window.mammoth.extractRawText({ arrayBuffer });
          document.getElementById('pdfPlaceholder').style.display = 'block';
          document.getElementById('pdfPlaceholder').innerHTML = `<div style="font-size:3rem">📄</div><br>DOCX Processed.`;
          document.getElementById('canvasWrapper').style.display = 'none';
          
          if(this.workspaceMode === 'quiz') {
              this.parseAndMapQuestions(result.value, this.currentFileName);
              Toast.show('Extraction Complete!', 'success');
          } else {
              const cleanDocText = this.sanitizeContentText(result.value);
              this.pageData['DOCX Import'] = cleanDocText.replace(/\n/g, '<br>');
              this.tabNames['DOCX Import'] = file.name;
              this.openTabs = ['DOCX Import'];
              this.switchTab('DOCX Import');
              Toast.show('Extraction Complete!', 'success');
          }
        } 
        else if (isImage) {
            document.getElementById('pdfPlaceholder').style.display = 'block';
            document.getElementById('pdfPlaceholder').innerHTML = `<div style="font-size:3rem">🖼️</div><br>Scanned Image Processed.`;
            document.getElementById('canvasWrapper').style.display = 'none';
            
            const worker = await window.Tesseract.createWorker('eng');
            const ret = await worker.recognize(file);
            await worker.terminate();
            const rawText = ret.data.text;

            if(this.workspaceMode === 'quiz') {
                this.parseAndMapQuestions(rawText, this.currentFileName);
                Toast.show('N-Bits Extraction Complete!', 'success');
            } else {
                const cleanImgText = this.sanitizeContentText(rawText);
                this.pageData['Scanned Image'] = cleanImgText.replace(/\n/g, '<br>');
                this.tabNames['Scanned Image'] = file.name;
                this.openTabs = ['Scanned Image'];
                this.switchTab('Scanned Image');
                Toast.show('Text Extracted!', 'success');
            }
        }
        else {
          const arrayBuffer = await new Promise((res, rej) => {
             const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsArrayBuffer(file);
          });
          this.pdfDoc = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          document.getElementById('pdfPlaceholder').style.display = 'none';
          document.getElementById('canvasWrapper').style.display = 'inline-block';
          document.getElementById('autoBotBtn').style.display = 'inline-flex';
          document.getElementById('openTabBtn').style.display = 'inline-flex';
          
          this.pageData = {}; this.quizData = {}; this.tabNames = {}; this.openTabs = []; this.processedPages.clear();
          this.pageToTabMap = {}; 
          
          this.switchTab('Page 1');
          await this.renderPdfPage(1);
          Toast.show('PDF Ready!', 'success');
        }
      } catch (err) { Toast.show(`File Read Error`, 'error'); } 
      finally { e.target.value = ''; }
    });

    document.getElementById('prevPage').onclick = () => { if (this.currentPage > 1) { this.currentPage--; this.renderPdfPage(this.currentPage); } };
    document.getElementById('nextPage').onclick = () => { if (this.pdfDoc && this.currentPage < this.pdfDoc.numPages) { this.currentPage++; this.renderPdfPage(this.currentPage); } };
    
    document.getElementById('pageIndicator').onclick = () => {
        if (!this.pdfDoc) return;
        const p = prompt(`Jump to page (1 - ${this.pdfDoc.numPages}):`, this.currentPage);
        if (p) {
            const parsed = parseInt(p, 10);
            if (parsed >= 1 && parsed <= this.pdfDoc.numPages) this.renderPdfPage(parsed);
        }
    };
    
    document.getElementById('openTabBtn').onclick = async () => {
        if(this.processedPages.has(this.currentPage)) return Toast.show('Already extracted. Clear tab to redo.', 'warning');
        try { await this.executeSpatialExtraction(this.currentPage); } catch(e) { console.error(e); }
    };
    
    document.getElementById('autoBotBtn').onclick = async () => {
      const btn = document.getElementById('autoBotBtn');
      if (this.isAutoExtracting) { 
          this.isAutoExtracting = false; 
          btn.innerHTML = '▶ Resume Bot'; 
          return; 
      }
      this.isAutoExtracting = true;
      btn.innerHTML = '⏸ Halt Bot';
      Toast.show(`Scanning pages...`, 'default');
      
      if (!this.pageToTabMap) this.pageToTabMap = {}; 
      
      try {
          let quizTextBuffer = "";
          for (let i = this.currentPage; i <= this.pdfDoc.numPages; i++) {
              if (!this.isAutoExtracting) break;
              if (this.processedPages.has(i)) { this.currentPage = i; continue; }

              const page = await this.pdfDoc.getPage(i);
              
              if (this.workspaceMode === 'content') {
                  const opList = await page.getOperatorList();
                  const hasImages = opList.fnArray.some(fn => fn === window.pdfjsLib.OPS.paintImageXObject || fn === window.pdfjsLib.OPS.paintJpegXObject);
                  
                  if (hasImages) {
                      this.isAutoExtracting = false;
                      btn.innerHTML = '▶ Resume Bot';
                      this.currentPage = i;
                      await this.renderPdfPage(i);
                      Toast.show(`Bot paused on Page ${i} (Images). Draw masks, press Enter to extract.`, 'warning');
                      return; 
                  }
              }

              const pageText = await this.extractPdfPageTextWithOCR(i);
              const cleanText = this.sanitizeContentText(pageText);

              if(this.workspaceMode === 'quiz') {
                  quizTextBuffer += cleanText + "\n\n";
                  this.processedPages.add(i);
              } else {
                  let tabId = this.pageToTabMap[i];
                  if (!tabId) {
                      const nextNum = Object.keys(this.pageToTabMap).length + 1;
                      tabId = `Page ${nextNum}`;
                      this.pageToTabMap[i] = tabId;
                  }

                  if (!this.pageData[tabId]) this.pageData[tabId] = '';
                  this.pageData[tabId] += `<p style="color:#E2E8F0;">${cleanText.replace(/\n/g, '<br>')}</p>`;
                  this.processedPages.add(i);
                  
                  if (!this.openTabs.includes(tabId)) {
                      this.openTabs.push(tabId);
                  }
                  this.switchTab(tabId);
              }
              this.currentPage = i;
          }
          
          if(this.workspaceMode === 'quiz' && quizTextBuffer.trim().length > 0) {
              this.parseAndMapQuestions(quizTextBuffer, this.currentFileName, true);
              Toast.show('Assessment Extracted ✅', 'success');
          } else if (this.workspaceMode === 'content' && this.isAutoExtracting) {
              Toast.show('Extraction Complete ✅', 'success');
          }
          
      } catch (e) { Toast.show('Auto-Bot crashed.', 'error'); } 
      finally {
          if (this.isAutoExtracting) {
              this.isAutoExtracting = false;
              btn.innerHTML = '🤖 Auto-Bot';
          }
      }
    };

    const wrapper = document.getElementById('canvasWrapper');
    const selection = document.getElementById('selectionBox');

    wrapper.onmousedown = e => {
      this.isDragging = true;
      const rect = wrapper.getBoundingClientRect();
      this.startX = e.clientX - rect.left; this.startY = e.clientY - rect.top;
      selection.style.left = this.startX + 'px'; selection.style.top = this.startY + 'px';
      selection.style.width = '0'; selection.style.height = '0'; selection.style.display = 'block';
    };
    window.onmousemove = e => {
      if (!this.isDragging) return;
      const rect = wrapper.getBoundingClientRect();
      const cx = e.clientX - rect.left; const cy = e.clientY - rect.top;
      selection.style.left = Math.min(cx, this.startX) + 'px'; selection.style.top = Math.min(cy, this.startY) + 'px';
      selection.style.width = Math.abs(cx - this.startX) + 'px'; selection.style.height = Math.abs(cy - this.startY) + 'px';
    };
    window.onmouseup = () => { 
      if (this.isDragging) { 
          this.isDragging = false; 
          if (parseInt(selection.style.width) < 10) selection.style.display = 'none'; 
      } 
    };
  }

  async renderPdfPage(num) {
    if (!this.pdfDoc) return;
    this.currentPage = num;
    this.masks = []; 
    document.getElementById('maskContainer').innerHTML = ''; 
    document.getElementById('selectionBox').style.display = 'none';

    if (this.pageRenderTask) {
        this.pageRenderTask.cancel();
        try { await this.pageRenderTask.promise; } catch (e) {} 
        this.pageRenderTask = null;
    }

    try {
        const page = await this.pdfDoc.getPage(num);
        
        const oldCanvas = document.getElementById('pdfCanvas');
        const newCanvas = oldCanvas.cloneNode(true);
        oldCanvas.parentNode.replaceChild(newCanvas, oldCanvas);
        const canvas = newCanvas;

        const containerWidth = document.getElementById('pdfContainer').clientWidth - 32;
        const viewport = page.getViewport({ scale: (containerWidth / page.getViewport({ scale: 1 }).width) * 1.5 });
        canvas.height = viewport.height; canvas.width = viewport.width; canvas.style.width = `${containerWidth}px`;

        this.pageRenderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport });
        await this.pageRenderTask.promise;
        document.getElementById('pageIndicator').textContent = `Page ${num} / ${this.pdfDoc.numPages}`;
    } catch(err) {
        if (err.name !== 'RenderingCancelledException') console.error("Render Error:", err);
    }
  }

  async executeSpatialExtraction(pageNum) {
    if (!this.pageToTabMap) this.pageToTabMap = {}; 
    if (this.processedPages.has(pageNum)) return Toast.show('Already extracted. Clear tab to redo.', 'warning');
    
    const page = await this.pdfDoc.getPage(pageNum);
    const content = await page.getTextContent();
    const containerWidth = document.getElementById('pdfContainer').clientWidth - 32;
    const cssScale = containerWidth / page.getViewport({ scale: 1 }).width;
    const rv = page.getViewport({ scale: cssScale });

    let spatialItems = []; let sizeFreq = {};
    
    content.items.forEach(item => {
      const [dx, dy] = rv.convertToViewportPoint(item.transform[4], item.transform[5]);
      const fSize = item.transform[0] * cssScale;
      let excluded = dy < rv.height * 0.10 || dy > rv.height * 0.90;
      
      for (const m of this.masks) { 
          if (m.type === 'exclude' || m.type === 'clip') {
              let inYBounds = dy >= (m.y - 5) && (dy - fSize) <= (m.y + m.h + 5);
              let inXBounds = dx >= (m.x - 5) && dx <= (m.x + m.w + 5);
              if (inYBounds && inXBounds) { excluded = true; break; }
          } 
      }
      
      if (!excluded && item.str.trim()) {
          spatialItems.push({ text: item.str, yTop: dy - fSize, size: fSize, domY: dy, domX: dx });
          sizeFreq[Math.round(fSize)] = (sizeFreq[Math.round(fSize)] || 0) + item.str.length;
      }
    });

    spatialItems.sort((a, b) => {
        if (Math.abs(a.domY - b.domY) < 10) return a.domX - b.domX;
        return a.domY - b.domY;
    });

    spatialItems = spatialItems.filter(item => {
        const t = item.text.trim();
        if (/^\d+$/.test(t)) return false;
        if (/^(page|-)?\s*\d+\s*(-)?$/i.test(t)) return false;
        if (["SCANNED BY CAMSCANNER", "THE MASTERMINDS", "P T O"].some(w => t.toUpperCase().includes(w))) return false;
        return true;
    });

    if (this.workspaceMode === 'quiz') {
        const rawText = spatialItems.map(i => i.text).join(' ');
        this.parseAndMapQuestions(rawText, this.currentFileName, true);
        this.processedPages.add(pageNum);
        Toast.show(`Extracted Qs from Page ${pageNum}`, 'success');
    } else {
        const baseSize = Object.keys(sizeFreq).length > 0 ? parseInt(Object.keys(sizeFreq).reduce((a, b) => sizeFreq[a] > sizeFreq[b] ? a : b)) : 12;
        let textLines = [];
        if (spatialItems.length > 0) {
            
            let currentLine = { text: spatialItems[0].text, domY: spatialItems[0].domY, yTop: spatialItems[0].yTop, size: spatialItems[0].size };
            
            for (let i = 1; i < spatialItems.length; i++) {
                const item = spatialItems[i];
                if (Math.abs(currentLine.domY - item.domY) < 10) {
                    currentLine.text += ' ' + item.text;
                } else {
                    const t = currentLine.text.trim();
                    const tag = currentLine.size >= baseSize * 1.5 ? `<h2 style="color:var(--accent-warning);margin-top:15px;font-family:'Poppins',sans-serif;">${t}</h2>`
                    : currentLine.size >= baseSize * 1.2 ? `<h3 style="color:white;margin-top:10px;">${t}</h3>`
                    : `<p style="color:var(--text-main);">${t}</p>`;
                    
                    textLines.push({ html: tag, yTop: currentLine.yTop });
                    currentLine = { text: item.text, domY: item.domY, yTop: item.yTop, size: item.size };
                }
            }
            const t = currentLine.text.trim();
            const tag = currentLine.size >= baseSize * 1.5 ? `<h2 style="color:var(--accent-warning);margin-top:15px;font-family:'Poppins',sans-serif;">${t}</h2>`
            : currentLine.size >= baseSize * 1.2 ? `<h3 style="color:white;margin-top:10px;">${t}</h3>`
            : `<p style="color:var(--text-main);">${t}</p>`;
            
            textLines.push({ html: tag, yTop: currentLine.yTop });
        }
        
        const clips = this.masks.filter(m => m.type === 'clip').map(m => {
            return { html: `<p style="text-align: center;"><img src="${m.dataUrl}" style="max-width:90%; border-radius:8px; box-shadow:0 4px 15px rgba(0,0,0,0.3); margin: 15px auto; display: block;"/></p>`, yTop: m.yTop };
        });

        const combined = [...textLines, ...clips].sort((a, b) => a.yTop - b.yTop);
        let html = combined.map(x => x.html).join('').replace(/<p style="color:var\(--text-main\);">\s*<\/p>/g, '').replace(/(<br\s*\/?>\s*)+/g, '<br>').trim();

        let tabId = this.pageToTabMap[pageNum];
        if (!tabId) {
            const nextNum = Object.keys(this.pageToTabMap).length + 1;
            tabId = `Page ${nextNum}`;
            this.pageToTabMap[pageNum] = tabId;
        }

        if (!this.pageData[tabId]) this.pageData[tabId] = '';
        if (this.pageData[tabId].length > 10 && html.length > 0) this.pageData[tabId] += `<hr style="border:1px dashed var(--border-color);margin:15px 0;">`;
        this.pageData[tabId] += html;
        
        this.processedPages.add(pageNum);
        
        if (!this.openTabs.includes(tabId)) {
            this.openTabs.push(tabId);
        }
        
        this.switchTab(tabId);
        Toast.show(`Extracted Content to ${tabId}`, 'success');
    }

    this.masks = []; document.getElementById('maskContainer').innerHTML = '';
  }

  // ==========================================
  // QUILL & TAB RENDERING
  // ==========================================
  renderQuizBuilder() {
      const container = document.getElementById('qb-questions-list');
      try {
          const questions = this.quizData[this.activeTab] || [];
          let html = '';
          questions.forEach((q, qIndex) => {
              html += `
                <div class="qb-question-card">
                    <div class="qb-header">
                        <span class="qb-label">Q${qIndex + 1}</span>
                        <button class="qb-delete" data-idx="${qIndex}">Delete</button>
                    </div>
                    <textarea class="qb-textarea qb-input-q" data-idx="${qIndex}">${q.text}</textarea>
              `;
              q.options.forEach((opt, oIndex) => {
                  const isChecked = q.correct === oIndex ? 'checked' : '';
                  html += `
                    <div class="qb-option-row">
                        <input type="radio" name="q_${this.activeTab.replace(/\s+/g,'_')}_${qIndex}" class="qb-option-radio" data-qidx="${qIndex}" data-oidx="${oIndex}" ${isChecked}>
                        <input type="text" class="qb-option-input" data-qidx="${qIndex}" data-oidx="${oIndex}" value="${opt}" placeholder="Option ${['A','B','C','D'][oIndex]}">
                        <div class="qb-correct-label">✓ Correct</div>
                    </div>
                  `;
              });
              html += `</div>`;
          });
          container.innerHTML = html;
          container.querySelectorAll('.qb-delete').forEach(btn => { btn.onclick = () => { this.quizData[this.activeTab].splice(btn.dataset.idx, 1); this.renderQuizBuilder(); }; });
          container.querySelectorAll('.qb-input-q').forEach(ta => { ta.oninput = (e) => { this.quizData[this.activeTab][e.target.dataset.idx].text = e.target.value; }; });
          container.querySelectorAll('.qb-option-input').forEach(inp => { inp.oninput = (e) => { this.quizData[this.activeTab][e.target.dataset.qidx].options[e.target.dataset.oidx] = e.target.value; }; });
          container.querySelectorAll('.qb-option-radio').forEach(rad => { rad.onchange = (e) => { if(e.target.checked) this.quizData[this.activeTab][e.target.dataset.qidx].correct = parseInt(e.target.dataset.oidx); }; });
      } catch (err) { container.innerHTML = `<div style="color:var(--accent-danger); padding:2rem; text-align:center;">Failed to render questions. Check console.</div>`; }
  }

  bindModes() {
    const btnC = document.getElementById('modeContentBtn');
    const btnQ = document.getElementById('modeQuizBtn');
    const editor = document.getElementById('editor-container');
    const qb = document.getElementById('quiz-builder-container');
    const boardTitle = document.getElementById('boardTitle');

    btnC.onclick = () => { 
        this.workspaceMode = 'content'; 
        btnC.classList.add('active'); btnQ.classList.remove('active', 'quiz'); 
        editor.style.display = 'flex'; qb.style.display = 'none';
        boardTitle.innerText = "Content Drafting Board";
        this.quill.clipboard.dangerouslyPasteHTML(this.pageData[this.activeTab] || '');
    };

    btnQ.onclick = () => { 
        this.workspaceMode = 'quiz'; 
        btnQ.classList.add('active', 'quiz'); btnC.classList.remove('active'); 
        editor.style.display = 'none'; qb.style.display = 'flex';
        boardTitle.innerText = "Assessment Builder";
        this.renderQuizBuilder();
    };
  }

  renderTabs() {
    const tabBar = document.getElementById('tabBar');
    let tabsHtml = this.openTabs.map(tabId => {
      const isActive = tabId === this.activeTab ? 'active' : '';
      const tabTitle = this.tabNames[tabId] || tabId.replace('Tab:', '');
      return `
      <div class="tab-node ${isActive}" data-page="${tabId}">
        <input type="text" class="tab-title-input" value="${tabTitle}" readonly title="Double-click to rename" 
            ondblclick="this.removeAttribute('readonly'); this.focus(); this.select();" 
            onblur="this.setAttribute('readonly', true); window._renameTab('${tabId}', this.value);"
            onkeydown="if(event.key==='Enter'){ this.blur(); }">
        <button class="tab-close" data-close="${tabId}">×</button>
      </div>`;
    }).join('');

    // Inject the + Button at the end
    tabBar.innerHTML = tabsHtml + `
        <button id="addNewTabBtn" style="background:var(--bg-elevated); border:1px dashed var(--border-color); color:var(--accent-primary); width:36px; height:36px; border-radius:8px; cursor:pointer; font-size:1.4rem; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-left:8px; transition:0.2s;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='var(--bg-elevated)'">+</button>
    `;

    // Re-bind listeners
    tabBar.querySelectorAll('.tab-node').forEach(tab => { 
        tab.onclick = e => { if (!e.target.classList.contains('tab-close') && e.target.tagName !== 'INPUT') this.switchTab(tab.dataset.page); }; 
    });
    tabBar.querySelectorAll('.tab-close').forEach(btn => { 
        btn.onclick = e => { e.stopPropagation(); this.closeTab(btn.dataset.close); }; 
    });
    
    document.getElementById('addNewTabBtn').onclick = () => {
        const newId = `Page ${this.openTabs.length + 1}`;
        this.openTabs.push(newId);
        this.pageData[newId] = '';
        this.switchTab(newId);
    };
  }

  switchTab(tabId) {
    if (!this.openTabs.includes(tabId)) this.openTabs.push(tabId);
    this.activeTab = tabId;
    if(this.workspaceMode === 'content') this.quill.clipboard.dangerouslyPasteHTML(this.pageData[tabId] || '');
    else this.renderQuizBuilder();
    this.renderTabs();
  }

  closeTab(tabId) {
    this.openTabs = this.openTabs.filter(p => p !== tabId);
    if (this.activeTab === tabId) {
      if (this.openTabs.length > 0) this.switchTab(this.openTabs[this.openTabs.length - 1]);
      else { this.activeTab = null; this.quill.setText(''); this.quizData = {}; }
    }
    this.renderTabs();
  }

  // ==========================================
  // FIREBASE TREE & DEPLOYMENT
  // ==========================================
  async fetchCloudDatabase() {
    const db = getDbInstance();
    const targetList = document.getElementById('targetList');
    try {
      const certsSnap = await getDocs(collection(db, 'content'));
      targetList.innerHTML = '';
      if (certsSnap.empty) { this.injectTreeNode(targetList, 'cert', 'Certificate A'); this.updateSyncDropdown(); return; }
      for (const certDoc of certsSnap.docs) {
        const certNodeId = this.injectTreeNode(targetList, 'cert', certDoc.data().title || certDoc.id);
        document.getElementById(certNodeId).dataset.fsId = certDoc.id;
        const certLvl = document.getElementById(certNodeId).querySelector('.tree-level');
        const modsSnap = await getDocs(collection(db, 'content', certDoc.id, 'modules'));
        for (const modDoc of modsSnap.docs) {
          const modData = modDoc.data();
          let wingVal = 'all';
          if (modData.isWingSpecific && modData.applicableWings && modData.applicableWings.length === 1) wingVal = modData.applicableWings[0];
          const modNodeId = this.injectTreeNode(certLvl, 'mod', modData.title || modDoc.id, wingVal);
          document.getElementById(modNodeId).dataset.fsId = modDoc.id;
          const modLvl = document.getElementById(modNodeId).querySelector('.chapter-container');
          const chapsSnap = await getDocs(collection(db, 'content', certDoc.id, 'modules', modDoc.id, 'chapters'));
          for (const chapDoc of chapsSnap.docs) {
            const chapNodeId = this.injectTreeNode(modLvl, 'chap', chapDoc.data().title || chapDoc.id);
            document.getElementById(chapNodeId).dataset.fsId = chapDoc.id;
          }
        }
      }
      this.updateSyncDropdown();
    } catch (e) { targetList.innerHTML = ''; this.injectTreeNode(targetList, 'cert', 'Certificate A'); this.updateSyncDropdown(); }
  }

  titleToId(title) { return title.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'untitled'; }

  updateSyncDropdown() {
    const select = document.getElementById('globalTargetMapping');
    const currentVal = select.value;
    let html = '<option value="">-- Select Target Chapter --</option>';

    document.querySelectorAll('.chapter-node').forEach(chapNode => {
      const chapTitle = chapNode.querySelector('.chap-name').value.trim() || 'Untitled Chapter';
      const modNode = chapNode.closest('.module-node');
      const modTitle = modNode ? modNode.querySelector('.mod-name').value.trim() : 'Untitled Mod';
      const modWing = modNode ? (modNode.querySelector('.mod-wing')?.value || 'all') : 'all';
      const certNode = chapNode.closest('.cert-node');
      const certTitle = certNode ? certNode.querySelector('.cert-name').value.trim() : 'Untitled Cert';

      const certId = certNode?.dataset.fsId || this.titleToId(certTitle);
      const modId = modNode?.dataset.fsId || this.titleToId(modTitle);
      const chapId = chapNode.dataset.fsId || this.titleToId(chapTitle);

      const val = `${certId}||${modId}||${chapId}`;
      html += `<option value="${val}" data-cert="${certTitle}" data-mod="${modTitle}" data-chap="${chapTitle}" data-wing="${modWing}" data-cert-id="${certId}" data-mod-id="${modId}" data-chap-id="${chapId}">${certTitle} > ${modTitle} > ${chapTitle}</option>`;
    });
    select.innerHTML = html;
    if (currentVal && select.querySelector(`option[value="${currentVal}"]`)) select.value = currentVal;
    else select.value = '';
  }

  async executePublish() {
    const select = document.getElementById('globalTargetMapping');
    if (!select.value) return Toast.show('Select a Target Chapter first.', 'error');
    const option = select.options[select.selectedIndex];
    const btn = document.getElementById('publishBtn');
    btn.disabled = true; btn.textContent = 'Deploying... ⏳';

    const db = getDbInstance();
    let payload = { title: option.dataset.chap, updatedAt: new Date().toISOString() };

    if (this.workspaceMode === 'content') {
        let combinedHtml = '';
        this.openTabs.forEach(tabId => {
          if (this.pageData[tabId] && this.pageData[tabId].trim().length > 10) {
              combinedHtml += `<hr data-tab-title="${this.tabNames[tabId] || tabId}" style="border:1px dashed var(--border-color); margin:15px 0;">` + this.pageData[tabId] + '<br><br>';
          }
        });
        if (combinedHtml.length < 10) { btn.disabled = false; btn.textContent = 'Deploy Entire Workspace 🚀'; return Toast.show('No content to deploy.', 'error'); }
        payload.contentHtml = combinedHtml;
    } else {
        let combinedQuizData = [];
        this.openTabs.forEach(tabId => {
            if(this.quizData[tabId]) combinedQuizData = combinedQuizData.concat(this.quizData[tabId].filter(q => q.text.trim() !== ''));
        });
        if (combinedQuizData.length === 0) { btn.disabled = false; btn.textContent = 'Deploy Entire Workspace 🚀'; return Toast.show('No valid quiz questions found.', 'error'); }
        payload.assessmentData = combinedQuizData; 
    }

    try {
      const isWingSpecific = option.dataset.wing !== 'all';
      const applicableWings = option.dataset.wing === 'all' ? ['army', 'navy', 'airforce'] : [option.dataset.wing];
      
      await setDoc(doc(db, 'content', option.dataset.certId), { title: option.dataset.cert }, { merge: true });
      await setDoc(doc(db, 'content', option.dataset.certId, 'modules', option.dataset.modId), { title: option.dataset.mod, isWingSpecific: isWingSpecific, applicableWings: applicableWings }, { merge: true });
      await setDoc(doc(db, 'content', option.dataset.certId, 'modules', option.dataset.modId, 'chapters', option.dataset.chapId), payload, { merge: true }); 
      await setDoc(doc(db, 'metadata', 'contentVersion'), { version: Date.now() }, { merge: true });
      
      Toast.show(`Deployed to ${option.dataset.chap} ✅`, 'success');
    } catch (e) { Toast.show('Deploy failed. Check Firestore rules.', 'error'); }

    btn.disabled = false; btn.textContent = 'Deploy Entire Workspace 🚀';
  }

  async fetchAndEditPublished(btn) {
    const chapNode = btn.closest('.chapter-node');
    const chapTitle = chapNode.querySelector('.chap-name').value.trim();
    const modNode = chapNode.closest('.module-node');
    const certNode = chapNode.closest('.cert-node');

    const certId = certNode?.dataset.fsId || this.titleToId(certNode?.querySelector('.cert-name').value.trim() || '');
    const modId = modNode?.dataset.fsId || this.titleToId(modNode?.querySelector('.mod-name').value.trim() || '');
    const chapId = chapNode.dataset.fsId || this.titleToId(chapTitle);

    Toast.show(`Decrypting ${chapTitle}...`, 'default');

    try {
      const db = getDbInstance();
      const snap = await getDoc(doc(db, 'content', certId, 'modules', modId, 'chapters', chapId));

      if (snap.exists()) {
        const data = snap.data();
        
        if (this.workspaceMode === 'content' && data.contentHtml) {
            // --- THE REVERSE PARSER ENGINE ---
            const temp = document.createElement('div');
            temp.innerHTML = data.contentHtml;
            const markers = temp.querySelectorAll('hr[data-tab-title]');
            
            if (markers.length > 0) {
                this.openTabs = []; // Wipe current workspace for incoming edit
                markers.forEach((marker, idx) => {
                    const title = marker.getAttribute('data-tab-title') || `Part ${idx+1}`;
                    const tabId = `Edit:${chapTitle}:${idx}`;
                    this.tabNames[tabId] = title;
                    
                    // Extract content between this marker and the next
                    let content = "";
                    let curr = marker.nextSibling;
                    while (curr && curr.tagName !== 'HR') {
                        content += curr.outerHTML || curr.textContent;
                        curr = curr.nextSibling;
                    }
                    
                    this.pageData[tabId] = content;
                    this.openTabs.push(tabId);
                });
            } else {
                // Fallback for older single-page content
                const tabId = `Edit:${chapTitle}`;
                this.tabNames[tabId] = chapTitle;
                this.pageData[tabId] = data.contentHtml;
                this.openTabs = [tabId];
            }
        } else {
            // Handling Assessment Mode Edit
            const tabId = `Edit:${chapTitle}`;
            this.tabNames[tabId] = chapTitle;
            this.quizData[tabId] = data.assessmentData || [];
            this.openTabs = [tabId];
        }

        // Auto-link to sync dropdown
        const val = `${certId}||${modId}||${chapId}`;
        document.getElementById('globalTargetMapping').value = val;
        
        this.switchTab(this.openTabs[0]);
        Toast.show(`Workspace Reconstructed ✅`, 'success');
      } else { 
          Toast.show('No published data found.', 'error'); 
      }
    } catch (e) { 
        console.error(e);
        Toast.show('Reconstruction failed.', 'error'); 
    }
  }

  initResizers() {
    const root = document.documentElement;
    const setup = (resizerId, cssVar, getVal) => {
      document.getElementById(resizerId).onmousedown = e => {
        e.preventDefault(); document.body.style.cursor = 'col-resize';
        const mm = me => root.style.setProperty(cssVar, `${getVal(me)}px`);
        const mu = () => { document.body.style.cursor = 'default'; document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); };
        document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu);
      };
    };
    setup('resizerLeft', '--left-w', e => Math.max(200, Math.min(e.clientX, window.innerWidth * 0.5)));
    setup('resizerRight', '--right-w', e => Math.max(250, Math.min(window.innerWidth - e.clientX, window.innerWidth * 0.5)));
  }

  initPaneToggles() {
    const toggle = (btnId, paneId, resizerId) => {
      document.getElementById(btnId).onclick = () => {
        document.getElementById(paneId).classList.toggle('hidden');
        document.getElementById(resizerId).classList.toggle('hidden');
        document.getElementById(btnId).style.color = document.getElementById(paneId).classList.contains('hidden') ? 'var(--accent-danger)' : 'var(--text-muted)';
      };
    };
    toggle('toggleLeftBtn', 'paneLeft', 'resizerLeft');
    toggle('toggleRightBtn', 'paneRight', 'resizerRight');
  }

  injectTreeNode(container, type, initValue = null, modWing = 'all') {
    const id = `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const labels = { cert: ['cert-name', 'New Cert', 'cert-node'], mod: ['mod-name', 'New Mod', 'module-node'], chap: ['chap-name', 'New Chap', 'chapter-node'] };
    const [cls, def, nodeCls] = labels[type];
    const dragType = type;
    
    let innerBtns = '';
    if (type === 'cert') innerBtns = `<button class="tree-btn" onclick="window._addMod(this)">+ Mod</button>`;
    if (type === 'mod') innerBtns = `
      <select class="tree-btn mod-wing" onchange="window._checkTree()" title="Select Wing" style="outline:none;">
        <option value="all" ${modWing === 'all' ? 'selected' : ''}>ALL Wings</option>
        <option value="army" ${modWing === 'army' ? 'selected' : ''}>Army</option>
        <option value="navy" ${modWing === 'navy' ? 'selected' : ''}>Navy</option>
        <option value="airforce" ${modWing === 'airforce' ? 'selected' : ''}>Air Force</option>
      </select>
      <button class="tree-btn" onclick="window._addChap(this)">+ Chap</button>`;
    if (type === 'chap') innerBtns = `<button class="tree-btn edit-btn" onclick="window._editChap(this)">✏️</button>`;

    const html = `<div class="${nodeCls} tree-node" id="${id}" data-type="${type}" draggable="true" ondragstart="window._dragStart(event)" ondragend="window._dragEnd(event)" ondragover="window._dragOver(event)" ondrop="window._drop(event,'${dragType}')">
      <div class="tree-row"><span class="drag-handle">⋮⋮</span><input type="text" class="tree-input ${cls}" value="${initValue || def}" onchange="window._checkTree()">${innerBtns}<button class="tree-btn del" onclick="this.closest('.${nodeCls}').remove();window._checkTree()">×</button></div>${type !== 'chap' ? `<div class="tree-level ${type==='mod'?'chapter-container':''}"></div>` : ''}</div>`;
    container.insertAdjacentHTML('beforeend', html);
    return id;
  }
}