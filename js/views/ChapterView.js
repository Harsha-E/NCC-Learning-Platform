import AbstractView from '../core/AbstractView.js';
import Store from '../core/store.js';
import ContentService from '../services/content.service.js';
import ProgressService from '../services/progress.service.js';
import Router from '../core/router.js';

export default class ChapterView extends AbstractView {
  constructor(params) {
    super(params);
    const queryParams = this.params?.queryParams || Object.fromEntries(new URLSearchParams(window.location.search));
    this.moduleId = queryParams.module || null;
    this.chapterId = queryParams.chapter || null;

    this.contentData = null;
    this.pages = []; 
    this.activePageIndex = 0;
    this.highestScrollScored = 0;
    this.isTicking = false;
  }

  async getHtml() {
    return `
      <style>
        .reader-layout {
            display: flex; flex-direction: column; 
            height: 100dvh; 
            /* CLEAR THE FLOATING NAVBAR (2rem top + 4.5rem height) */
            padding-top: 7.5rem; 
            box-sizing: border-box;
            background: #020617; color: #E2E8F0; font-family: 'Inter', system-ui, sans-serif;
            overflow: hidden; position: relative;
        }

        /* --- GLOBAL MISSION UNDERLAY --- */
        .reader-layout::before {
            content: ""; position: fixed; inset: 0;
            background-image: url('assets/images/tactical-grid-bg.jpg');
            background-size: cover; background-position: center;
            opacity: 0.1; z-index: 0; pointer-events: none;
            mask-image: radial-gradient(circle at center, transparent 20%, black 100%);
            -webkit-mask-image: radial-gradient(circle at center, transparent 20%, black 100%);
        }

        .reader-layout::after {
            content: ""; position: fixed; inset: 0; pointer-events: none;
            background-image: radial-gradient(rgba(255,255,255,0.08) 0.7px, transparent 0.7px);
            background-size: 4px 4px;
            opacity: 0.04; z-index: 9999; mix-blend-mode: overlay;
        }

        /* --- THE GLASS BLADE PROGRESS BAR --- */
        #readingProgressContainer {
            position: fixed; 
            top: 7.5rem; /* Anchored just below the navbar */
            left: 0; right: 0; height: 3px; 
            background: rgba(255, 255, 255, 0.02); z-index: 5000; 
            backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
        }
        #readingProgress {
            height: 100%; width: 0%; will-change: width;
            background: linear-gradient(90deg, #60A5FA, #8B5CF6, #F472B6);
            transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 0 15px rgba(139, 92, 246, 0.4);
        }

        /* --- ULTRA-SLIM NAVIGATION HEADER --- */
        .reader-header {
            height: 80px; width: 100%; position: relative;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0; z-index: 10;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            background: rgba(2, 6, 23, 0.7);
            backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
        }

        .header-content {
            display: flex; align-items: center; gap: 1rem;
            opacity: 0; transform: translateY(5px);
            transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .header-content.reveal { opacity: 1; transform: translateY(0); }

        .chapter-badge {
            font-size: 0.65rem; font-weight: 900; color: #38BDF8;
            text-transform: uppercase; letter-spacing: 3px;
            background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.2);
            padding: 4px 12px; border-radius: 4px;
        }

        .chapter-title {
            font-family: 'Poppins', sans-serif; font-size: 1.1rem; font-weight: 700;
            color: white; margin: 0; letter-spacing: -0.2px;
        }

        .btn-menu {
            position: absolute; left: 1.5rem;
            z-index: 20; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08);
            color: white; width: 38px; height: 38px; border-radius: 8px;
            cursor: pointer; display: flex; align-items: center; justify-content: center;
            backdrop-filter: blur(5px); transition: 0.2s;
        }
        .btn-menu:hover { background: #38BDF8; color: #020617; border-color: #38BDF8; transform: scale(1.05); }

        /* --- IMMERSIVE READING AREA --- */
        .reader-content-wrapper {
            flex: 1; overflow-y: auto; scroll-behavior: smooth;
            padding: 4rem 1.5rem 10rem 1.5rem; position: relative; z-index: 1;
        }

        .article-body { max-width: 720px; margin: 0 auto; font-size: 1.15rem; line-height: 1.95; color: #CBD5E1; }
        .article-body h2 { font-family: 'Poppins', sans-serif; font-size: 2rem; margin: 4rem 0 1.5rem 0; color: #F8FAFC; letter-spacing: -0.5px; }

        /* --- FLOATING CONTROLS --- */
        .page-nav-bar {
            position: fixed !important; bottom: 2rem !important; left: 50% !important; transform: translateX(-50%) !important;
            display: flex; align-items: center; justify-content: center; gap: 12px !important; z-index: 100;
            background: rgba(15, 23, 42, 0.8) !important; backdrop-filter: blur(20px) !important;
            border: 1px solid rgba(255,255,255,0.08) !important; padding: 0.6rem 1.4rem !important; border-radius: 100px !important;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5) !important;
        }
        
        .page-tab {
            width: 8px !important; height: 8px !important; border-radius: 50% !important; 
            background: rgba(255,255,255,0.1) !important; border: none !important; cursor: pointer; transition: 0.3s;
        }
        .page-tab.active { background: #38BDF8 !important; transform: scale(1.5) !important; box-shadow: 0 0 12px rgba(56,189,248,0.5) !important; }

        /* --- SIDEBAR FIXES --- */
        .sidebar-overlay { position: fixed; inset: 0; top: 0; background: rgba(2, 6, 23, 0.8); backdrop-filter: blur(8px); z-index: 10000; opacity: 0; pointer-events: none; transition: 0.4s; }
        .sidebar-overlay.active { opacity: 1; pointer-events: all; }
        .chapter-sidebar { position: fixed; left: 0; top: 0; bottom: 0; width: 340px; background: #020617; border-right: 1px solid #1E293B; z-index: 10001; transform: translateX(-100%); transition: 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .chapter-sidebar.active { transform: translateX(0); }

        /* --- MOBILE SAFE CLEARANCES --- */
        @media (max-width: 768px) { 
            .chapter-title { display: none; } 
            .reader-header { height: 60px; } 
            .reader-layout { padding-bottom: 6rem; } /* Clears the mobile dock */
            .page-nav-bar { bottom: 6.5rem !important; } /* Sits safely above the mobile dock */
        }
      </style>

      <div id="readingProgressContainer"><div id="readingProgress"></div></div>
      
      <div class="sidebar-overlay" id="sidebarOverlay"></div>
      <div class="chapter-sidebar" id="chapterSidebar">
          <div class="sidebar-header" style="padding:1.5rem; border-bottom:1px solid #1E293B; display:flex; justify-content:space-between; align-items:center;">
              <h3 style="color:white; margin:0; font-family:'Poppins'; font-size:0.9rem; text-transform:uppercase; letter-spacing:1px;">Mission Directory</h3>
              <button id="btnCloseSidebar" style="background:none; border:none; color:#64748B; font-size:1.5rem; cursor:pointer;">&times;</button>
          </div>
          <div class="sidebar-content" id="sidebarContent" style="flex:1; overflow-y:auto; padding:1.5rem;"></div>
      </div>

      <div class="reader-layout" id="readerLayout">
         <div class="reader-header">
            <button class="btn-menu" id="btnMenuToggle">☰</button>
            <div class="header-content" id="headerReveal">
                <span class="chapter-badge" id="chapterBadge">Loading...</span>
                <h1 class="chapter-title" id="mainTitle">...</h1>
            </div>
         </div>
         <div class="reader-content-wrapper" id="contentWrapper">
            <div class="article-body" id="articleBody"></div>
            <div class="reader-footer" style="max-width:720px; margin:6rem auto 2rem auto; padding-top:2rem; border-top:1px dashed #1E293B; display:flex; justify-content:space-between; align-items:center;">
                <button id="btnPrevPage" style="background:transparent; border:1px solid #1E293B; color:#64748B; padding:0.6rem 1.2rem; border-radius:8px; cursor:pointer; font-weight:700; font-size:0.85rem;">◀ Previous</button>
                <div id="footerActionArea"></div>
            </div>
         </div>
         <div class="page-nav-bar" id="pageBar"></div>
      </div>

      <div id="quizRipple" style="position:fixed; top:50%; left:50%; width:10px; height:10px; background:#8B5CF6; border-radius:50%; transform:translate(-50%,-50%) scale(0); z-index:999998; pointer-events:none; transition:transform 2.5s cubic-bezier(0.64, 0, 0.78, 0);"></div>
      <div id="quizRippleText" style="position:fixed; inset:0; z-index:999999; display:flex; flex-direction:column; align-items:center; justify-content:center; pointer-events:none; opacity:0; transition:opacity 0.6s ease 0.5s;">
          <h1 id="rippleChapterTitle" style="font-family:'Poppins'; font-size:3rem; font-weight:900; color:white; text-align:center;"></h1>
          <p style="color:white; letter-spacing:6px; font-weight:900; margin-top:1.5rem; font-size:0.8rem;">INITIATING ASSESSMENT MODE</p>
      </div>
    `;
  }

  async mount() {
    const profile = Store.get('profile');
    if (!profile) return Router.navigateTo('./login');

    try {
        const data = await ContentService.getChapter(profile.certificate || 'A', this.moduleId, this.chapterId);
        if (!data) return;

        this.contentData = data;
        this.pages = this.extractPages(data.contentHtml);
        
        document.getElementById('mainTitle').textContent = data.title;
        document.getElementById('chapterBadge').textContent = `PHASE ${this.chapterId.split('_').pop()}`;
        
        this.renderUI();
        this.renderPageContent();
        this.loadSidebar(profile.certificate || 'A', profile.wing);

        setTimeout(() => {
            const el = document.getElementById('headerReveal');
            if(el) el.classList.add('reveal');
        }, 1600);

    } catch (e) { console.error(e); }
  }

  renderUI() {
      const pageBar = document.getElementById('pageBar');
      if(pageBar) {
          pageBar.innerHTML = this.pages.map((_, idx) => `<button class="page-tab" data-idx="${idx}"></button>`).join('');
          pageBar.querySelectorAll('.page-tab').forEach(btn => {
              btn.onclick = () => {
                  this.activePageIndex = parseInt(btn.dataset.idx);
                  this.renderPageContent();
              };
          });
      }

      document.getElementById('btnMenuToggle').onclick = () => this.toggleSidebar(true);
      document.getElementById('btnCloseSidebar').onclick = () => this.toggleSidebar(false);
      document.getElementById('sidebarOverlay').onclick = () => this.toggleSidebar(false);
      
      const wrapper = document.getElementById('contentWrapper');
      if(wrapper) wrapper.onscroll = () => this.requestTick(wrapper);
  }

  requestTick(wrapper) {
      if (!this.isTicking) {
          requestAnimationFrame(() => {
              this.updateProgress(wrapper);
              this.isTicking = false;
          });
          this.isTicking = true;
      }
  }

  updateProgress(wrapper) {
      const { scrollTop, scrollHeight, clientHeight } = wrapper;
      let pageScroll = (scrollTop / (scrollHeight - clientHeight)) * 100 || 0;
      const total = Math.round(((this.activePageIndex / this.pages.length) * 100) + (pageScroll / this.pages.length));
      
      if (total > this.highestScrollScored) {
          this.highestScrollScored = Math.min(total, 100);
          const bar = document.getElementById('readingProgress');
          if (bar) bar.style.width = `${this.highestScrollScored}%`;
          
          const user = Store.get('user');
          if (user) {
              ProgressService.updateChapterScroll(user.uid, this.moduleId, this.chapterId, this.highestScrollScored);
          }
      }
  }

  async loadSidebar(certId, wing) {
      const modules = await ContentService.getModules(certId, wing);
      let html = '';
      for (const mod of modules) {
          html += `<div style="color:#475569; font-size:0.6rem; font-weight:900; text-transform:uppercase; letter-spacing:2px; margin:1rem 0 0.5rem 0;">${mod.title}</div>`;
          const chapters = await ContentService.getChapters(certId, mod.id);
          chapters.forEach(chap => {
              const isActive = (chap.id === this.chapterId && mod.id === this.moduleId) ? 'background:rgba(56,189,248,0.1); color:#38BDF8; font-weight:800; border-left:2px solid #38BDF8;' : '';
              html += `<a href="./chapter?module=${mod.id}&chapter=${chap.id}" style="display:block; padding:8px 12px; color:#94A3B8; text-decoration:none; border-radius:6px; margin-bottom:2px; font-size:0.85rem; transition:0.2s; ${isActive}">${chap.title}</a>`;
          });
      }
      const el = document.getElementById('sidebarContent');
      if(el) el.innerHTML = html;
  }

  renderPageContent() {
      const body = document.getElementById('articleBody');
      if(body) body.innerHTML = this.pages[this.activePageIndex].html;
      
      const wrapper = document.getElementById('contentWrapper');
      if(wrapper) wrapper.scrollTo(0,0);
      
      document.querySelectorAll('.page-tab').forEach((t, i) => t.classList.toggle('active', i === this.activePageIndex));
      
      const btnPrev = document.getElementById('btnPrevPage');
      if(btnPrev) {
          btnPrev.style.visibility = this.activePageIndex > 0 ? 'visible' : 'hidden';
          btnPrev.onclick = () => { this.activePageIndex--; this.renderPageContent(); };
      }

      const actionArea = document.getElementById('footerActionArea');
      if (actionArea) {
          if (this.activePageIndex < this.pages.length - 1) {
              actionArea.innerHTML = `<button style="background:#F8FAFC; color:#020617; border:none; padding:0.8rem 1.8rem; border-radius:50px; font-weight:800; cursor:pointer; font-size:0.85rem;" id="btnNextPageNative">Next Objective ▶</button>`;
              document.getElementById('btnNextPageNative').onclick = () => this.nextPage();
          } else {
              actionArea.innerHTML = `<button id="btnTakeExam" style="background:linear-gradient(135deg, #10B981, #059669); color:white; border:none; padding:0.8rem 1.8rem; border-radius:50px; font-weight:800; cursor:pointer; font-size:0.85rem;">Initiate Assessment ✓</button>`;
              const btn = document.getElementById('btnTakeExam');
              if(btn) btn.onclick = (e) => this.startRipple(e);
          }
      }
  }

  nextPage() { this.activePageIndex++; this.renderPageContent(); }

  startRipple(e) {
      const ripple = document.getElementById('quizRipple');
      const rippleText = document.getElementById('quizRippleText');
      if(!ripple || !rippleText) return;

      const colors = ['#4338CA', '#BE185D', '#047857', '#6D28D9'];
      ripple.style.left = `${e.clientX}px`;
      ripple.style.top = `${e.clientY}px`;
      ripple.style.background = colors[Math.floor(Math.random() * colors.length)];
      
      document.getElementById('rippleChapterTitle').textContent = this.contentData.title;
      ripple.style.transform = 'translate(-50%,-50%) scale(600)';
      rippleText.style.opacity = '1';
      
      const user = Store.get('user');
      if (user) {
          ProgressService.updateChapterScroll(user.uid, this.moduleId, this.chapterId, 100);
      }
      
      setTimeout(() => {
          Router.navigateTo(`./quiz?module=${this.moduleId}&chapter=${this.chapterId}`);
      }, 3100);
  }

  toggleSidebar(state) {
      const sb = document.getElementById('chapterSidebar');
      const ov = document.getElementById('sidebarOverlay');
      if(sb) sb.classList.toggle('active', state);
      if(ov) ov.classList.toggle('active', state);
  }

  extractPages(rawHtml) {
      const temp = document.createElement('div');
      temp.innerHTML = rawHtml;
      const breaks = temp.querySelectorAll('hr[data-tab-title]');
      if (breaks.length === 0) return [{ title: 'Page 1', html: rawHtml }];
      let pages = [], currentHtml = '', currentTitle = 'Introduction';
      Array.from(temp.childNodes).forEach(node => {
          if (node.tagName === 'HR' && node.hasAttribute('data-tab-title')) {
              if (currentHtml.trim()) pages.push({ title: currentTitle, html: currentHtml });
              currentTitle = node.getAttribute('data-tab-title');
              currentHtml = '';
          } else currentHtml += node.outerHTML || node.textContent;
      });
      pages.push({ title: currentTitle, html: currentHtml });
      return pages;
  }
}
