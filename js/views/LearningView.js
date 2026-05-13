import AbstractView from '../core/AbstractView.js';
import Store from '../core/store.js';
import ContentService from '../services/content.service.js';
import ProgressService from '../services/progress.service.js';
import Router from '../core/router.js';

export default class LearningView extends AbstractView {
  constructor(params) {
    super(params);
    this.curriculumTree = [];
    this.userProgress = {};
    this.expandedModules = new Set();
    this.globalStats = { totalChapters: 0, completedChapters: 0, quizzesPassed: 0 };
  }

  async getHtml() {
    return `
      <style>
        /* ==========================================================================
           REFINED TACTICAL ACCORDION - PROGRESS ALIGNED
           ========================================================================== */
        :root {
            --bg-base: #000000; 
            --bg-elevated: rgba(28, 28, 30, 0.6); 
            --bg-hover: rgba(44, 44, 46, 0.8);
            --bg-card-active: rgba(36, 36, 38, 0.95);
            --text-primary: #F5F5F7; 
            --text-secondary: #EBEBF5; 
            --text-tertiary: rgba(235, 235, 245, 0.6);
            --accent-blue: #0A84FF; --accent-blue-glow: rgba(10, 132, 255, 0.2);
            --border-subtle: rgba(255, 255, 255, 0.05);
            --border-highlight: rgba(255, 255, 255, 0.12);
            --radius-lg: 16px; --radius-md: 12px;
            --spring-soft: 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .dash-viewport {
            background-color: var(--bg-base); color: var(--text-primary);
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
            box-sizing: border-box; width: 100%; height: 100dvh;
            overflow-y: auto; overflow-x: hidden;
            padding-top: 8rem !important; /* Strict clearance for Navbar */
            padding-bottom: 6rem !important; /* Strict clearance for Dock */
        }

        .dash-container { max-width: 860px; margin: 0 auto; width: 100%; padding: 0 1.5rem; position: relative; z-index: 2; }
        .view-layer { transition: opacity 0.4s ease; }
        .hidden-layer { display: none; }

        @keyframes shimmer-flow { 0% { background-position: -800px 0; } 100% { background-position: 800px 0; } }
        .skeleton { background: #1C1C1E; background-image: linear-gradient(90deg, rgba(255,255,255,0) 0, rgba(255,255,255,0.03) 20%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 80%, rgba(255,255,255,0) 100%); background-size: 800px 100%; animation: shimmer-flow 2s infinite linear; border-radius: var(--radius-lg); }

        .dash-header { margin-bottom: 2.5rem; }
        .greeting-time { color: var(--accent-blue); font-size: 0.85rem; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 0.25rem; }
        .greeting-name { font-size: 2.5rem; font-weight: 800; margin: 0; letter-spacing: -0.03em; }

        /* STRICT VERTICAL LIST */
        .module-list { display: flex !important; flex-direction: column !important; gap: 1.25rem !important; }

        .mod-card { 
            background: var(--bg-elevated); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
            border-radius: var(--radius-lg); border: 1px solid var(--border-subtle); overflow: hidden; transition: var(--spring-soft); 
        }
        .mod-card.open { border-color: rgba(10, 132, 255, 0.4); background: var(--bg-card-active); }

        .mod-header { padding: 1.5rem 2rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none; }
        .mod-header-content { flex: 1; padding-right: 1.5rem; }
        .mod-title { font-size: 1.3rem; font-weight: 700; margin: 0 0 0.75rem 0; color: var(--text-primary); }
        .mod-stats-row { display: flex; gap: 1rem; font-size: 0.85rem; color: var(--text-secondary); font-weight: 600; margin-bottom: 0.75rem; }
        
        .prog-track { width: 100%; height: 5px; background: rgba(255,255,255,0.06); border-radius: 10px; position: relative; overflow: hidden; }
        .prog-fill { position: absolute; left: 0; top: 0; height: 100%; background: var(--text-secondary); border-radius: 10px; width: 0%; transition: width 1s cubic-bezier(0.16, 1, 0.3, 1); }
        .mod-card.open .prog-fill { background: var(--accent-blue); box-shadow: 0 0 10px var(--accent-blue-glow); }

        .mod-chevron { width: 32px; height: 32px; border-radius: 50%; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; transition: 0.3s; }
        .mod-card.open .mod-chevron { transform: rotate(180deg); background: var(--accent-blue); color: #FFF; }

        .mod-body-wrapper { display: grid; grid-template-rows: 0fr; transition: grid-template-rows var(--spring-soft); }
        .mod-card.open .mod-body-wrapper { grid-template-rows: 1fr; }
        .mod-body-inner { overflow: hidden; }

        .chapter-list { padding: 0 2rem 2rem 2rem; display: flex; flex-direction: column; gap: 8px; }
        .chap-row { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; background: rgba(0,0,0,0.3); border-radius: var(--radius-md); border: 1px solid var(--border-subtle); transition: 0.2s; }
        .chap-row:hover { background: rgba(255,255,255,0.05); transform: translateX(4px); }

        .chap-title { font-weight: 600; font-size: 1rem; color: var(--text-primary); }
        .badge { padding: 4px 10px; border-radius: 6px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 4px; }
        .badge.read { background: var(--accent-green-glow); color: var(--accent-green); }
        .badge.unread { background: transparent; color: var(--text-tertiary); border: 1px solid var(--border-subtle); }

        .btn { padding: 0.6rem 1.25rem; border-radius: 50px; font-weight: 700; font-size: 0.85rem; cursor: pointer; border: none; text-decoration: none; display: inline-flex; align-items: center; }
        .btn-primary { background: var(--text-primary); color: #000; }
        .btn-ghost { background: rgba(255,255,255,0.03); color: var(--text-secondary); border: 1px solid var(--border-highlight); }
        .btn-ghost:hover {
            background: #F8FAFC;
            color: #000;
        }

        @media (max-width: 768px) {
            .dash-viewport { padding-top: 6.5rem !important; }
            .mod-header { padding: 1.5rem; position: relative; }
            .mod-chevron { position: absolute; right: 1.5rem; top: 1.5rem; }
            .chap-row { flex-direction: column; align-items: flex-start; gap: 1rem; }
            .btn { width: 100%; justify-content: center; }
        }
      </style>

      <div class="dash-viewport">
          <div class="dash-container">
              <div id="skeletonLayer" class="view-layer">
                  <div class="dash-header">
                      <div class="skeleton" style="height: 16px; width: 120px; margin-bottom: 0.5rem;"></div>
                      <div class="skeleton" style="height: 44px; width: 280px;"></div>
                  </div>
                  <div class="module-list">
                      <div class="skeleton" style="height: 120px; width: 100%;"></div>
                      <div class="skeleton" style="height: 120px; width: 100%;"></div>
                  </div>
              </div>
              
              <div id="dataLayer" class="view-layer hidden-layer">
                  <div id="curriculumContent"></div>
              </div>
          </div>
      </div>
    `;
  }

  async mount() {
    const user = Store.get('user');
    const profile = Store.get('profile') || {};
    if (!user) return Router.navigateTo('./login');

    const safeCert = String(profile.certificate || 'A').toUpperCase();
    const safeWing = String(profile.wing || 'army').toLowerCase();
    
    // FETCH DATA
    const [modules, userProgress] = await Promise.all([
        ContentService.getModules(safeCert, safeWing).catch(() => []),
        ProgressService.getUserProgress(user.uid).catch(() => ({ modules: {} }))
    ]);

    this.userProgress = userProgress;

    const fullTree = await Promise.all(modules.map(async (mod) => {
        const chapters = await ContentService.getChapters(safeCert, mod.id).catch(() => []);
        chapters.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

        let chaptersReadCount = 0;
        const histReads = this.userProgress.modules?.[mod.id]?.chaptersRead || {};
        const histQuizzes = this.userProgress.modules?.[mod.id]?.quizzes || {};

        const enrichedChapters = chapters.map(chap => {
            const rData = histReads[chap.id];
            const isRead = rData?.completed === true || (rData?.percentScrolled >= 90);
            if (isRead) chaptersReadCount++;
            
            const qData = histQuizzes[chap.id];
            return { ...chap, isRead, quizScore: qData?.score || qData?.highestScore || null };
        });

        const percent = chapters.length > 0 ? Math.floor((chaptersReadCount / chapters.length) * 100) : 0;
        
        return {
            ...mod,
            chapters: enrichedChapters,
            percentComplete: percent,
            readCount: chaptersReadCount
        };
    }));
    
    this.curriculumTree = fullTree.sort((a, b) => (a.order || 0) - (b.order || 0));
    this.renderReality();
  }

  renderReality() {
      const contentDiv = document.getElementById('curriculumContent');
      let html = `
          <div class="dash-header">
              <div class="greeting-time">Training Matrix</div>
              <h1 class="greeting-name">Curriculum</h1>
          </div>
          <div class="module-list">
      `;

      this.curriculumTree.forEach(mod => {
          const isOpen = this.expandedModules.has(mod.id) ? 'open' : '';
          
          let chapHtml = mod.chapters.map(chap => `
              <div class="chap-row">
                  <div class="chap-info">
                      <div class="chap-title">${chap.title}</div>
                      <div class="badge-container">
                          <span class="badge ${chap.isRead ? 'read' : 'unread'}">${chap.isRead ? 'Complete' : 'Pending'}</span>
                          ${chap.quizScore !== null ? `<span class="badge" style="background:rgba(10,132,255,0.1); color:var(--accent-blue);">Score: ${chap.quizScore}%</span>` : ''}
                      </div>
                  </div>
                  <a href="./chapter?module=${mod.id}&chapter=${chap.id}" class="btn ${chap.isRead ? 'btn-ghost' : 'btn-primary'}" data-nav>
                      ${chap.isRead ? 'Review' : 'Start'}
                  </a>
              </div>
          `).join('');

          html += `
              <div class="mod-card ${isOpen}" id="mod-card-${mod.id}">
                  <div class="mod-header" data-modid="${mod.id}">
                      <div class="mod-header-content">
                          <h2 class="mod-title">${mod.title}</h2>
                          <div class="mod-stats-row">
                              <span>${mod.readCount}/${mod.chapters.length} Chapters</span>
                              <span style="color:var(--border-highlight)">|</span>
                              <span>${mod.percentComplete}% Complete</span>
                          </div>
                          <div class="prog-track"><div class="prog-fill" data-target-width="${mod.percentComplete}"></div></div>
                      </div>
                      <div class="mod-chevron">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                      </div>
                  </div>
                  <div class="mod-body-wrapper"><div class="mod-body-inner"><div class="chapter-list">${chapHtml}</div></div></div>
              </div>
          `;
      });

      contentDiv.innerHTML = html + `</div>`;
      this.bindEvents();
      this.triggerPostRenderAnimations();
  }

  bindEvents() {
      document.querySelectorAll('.mod-header').forEach(header => {
          header.onclick = () => {
              const modId = header.dataset.modid;
              const card = document.getElementById(`mod-card-${modId}`);
              if (card.classList.contains('open')) {
                  card.classList.remove('open');
                  this.expandedModules.delete(modId);
              } else {
                  document.querySelectorAll('.mod-card.open').forEach(c => c.classList.remove('open'));
                  card.classList.add('open');
                  this.expandedModules.clear();
                  this.expandedModules.add(modId);
              }
          };
      });

      document.querySelectorAll('[data-nav]').forEach(link => {
          link.onclick = (e) => {
              e.preventDefault();
              Router.navigateTo(link.getAttribute('href'));
          };
      });
  }

  triggerPostRenderAnimations() {
      setTimeout(() => {
          document.getElementById('skeletonLayer')?.classList.add('hidden-layer');
          document.getElementById('dataLayer')?.classList.remove('hidden-layer');
          
          // NESTED TIMEOUT ensures the progress bars animate after visibility change
          setTimeout(() => {
              document.querySelectorAll('.prog-fill').forEach(bar => {
                  bar.style.width = bar.getAttribute('data-target-width') + '%';
              });
          }, 200);
      }, 500); 
  }
}
