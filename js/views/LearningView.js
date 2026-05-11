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
  }

  async getHtml() {
    return `
      <style>
        /* ==========================================================================
           REFINED APPLE HIG - STRICT VERTICAL ACCORDION
           ========================================================================== */
        :root {
            --bg-base: #000000; --bg-elevated: rgba(28, 28, 30, 0.6); --bg-hover: rgba(44, 44, 46, 0.8); --bg-card-active: rgba(36, 36, 38, 0.95);
            --text-primary: #F5F5F7; --text-secondary: #EBEBF5; --text-tertiary: rgba(235, 235, 245, 0.6);
            --accent-blue: #0A84FF; --accent-blue-glow: rgba(10, 132, 255, 0.2);
            --accent-green: #30D158; --accent-green-glow: rgba(48, 209, 88, 0.15);
            --accent-red: #FF453A; --accent-orange: #FF9F0A;
            --border-subtle: rgba(255, 255, 255, 0.05); --border-highlight: rgba(255, 255, 255, 0.12);
            --radius-lg: 20px; --radius-md: 12px; --spring-soft: 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .dash-viewport {
            background-color: var(--bg-base); color: var(--text-primary);
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif;
            box-sizing: border-box; width: 100%; min-height: 100dvh;
            
            /* STRICT CLEARANCES */
            padding-top: 8rem !important; 
            padding-bottom: 6rem !important; 
        }

        .ambient-aurora {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background-image: radial-gradient(circle at 15% 25%, rgba(10, 132, 255, 0.06) 0%, transparent 40%), radial-gradient(circle at 85% 75%, rgba(48, 209, 88, 0.04) 0%, transparent 40%);
            z-index: 0; pointer-events: none;
        }

        .dash-container { max-width: 860px; margin: 0 auto; width: 100%; box-sizing: border-box; padding: 0 1.5rem; position: relative; z-index: 2; }
        .view-layer { transition: opacity 0.4s ease; will-change: opacity; }
        .hidden-layer { display: none; }

        @keyframes shimmer-flow { 0% { background-position: -800px 0; } 100% { background-position: 800px 0; } }
        .skeleton { background: #1C1C1E; background-image: linear-gradient(90deg, rgba(255,255,255,0) 0, rgba(255,255,255,0.03) 20%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 80%, rgba(255,255,255,0) 100%); background-size: 800px 100%; animation: shimmer-flow 2s infinite linear; border-radius: var(--radius-lg); }

        .dash-header { margin-bottom: 2.5rem; animation: slideInDown 0.6s var(--spring-soft); }
        @keyframes slideInDown { from { opacity: 0; transform: translateY(-15px); } to { opacity: 1; transform: translateY(0); } }
        .greeting-time { color: var(--accent-blue); font-size: 0.85rem; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 0.25rem; }
        .greeting-name { font-size: clamp(2rem, 5vw, 3rem); font-weight: 800; margin: 0; letter-spacing: -0.03em; line-height: 1.1; }

        /* STRICT VERTICAL LAYOUT FOR MODULES (Overrides bad global grids) */
        .module-list { display: flex !important; flex-direction: column !important; gap: 1.5rem !important; width: 100% !important; }

        .mod-card { 
            background: var(--bg-elevated); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
            border-radius: var(--radius-lg); border: 1px solid var(--border-subtle); 
            overflow: hidden; transition: var(--spring-soft); 
            animation: fadeInUp 0.5s var(--spring-soft) backwards; box-sizing: border-box; width: 100%;
        }
        .mod-card:hover { background: var(--bg-hover); border-color: var(--border-highlight); transform: translateY(-2px); box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
        .mod-card.open { border-color: rgba(10, 132, 255, 0.4); background: var(--bg-card-active); transform: translateY(-2px); box-shadow: 0 15px 40px rgba(0,0,0,0.4); }

        @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }

        .mod-header { padding: 1.5rem 2rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none; box-sizing: border-box; }
        .mod-header-content { flex: 1; padding-right: 1.5rem; }
        
        .mod-tag { font-size: 0.75rem; font-weight: 800; color: var(--accent-blue); text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 0.5rem; display: block; }
        .mod-title { font-size: 1.35rem; font-weight: 700; margin: 0 0 0.75rem 0; color: var(--text-primary); letter-spacing: -0.01em; }
        .mod-stats-row { display: flex; gap: 1rem; font-size: 0.9rem; color: var(--text-secondary); font-weight: 500; margin-bottom: 1rem; }
        
        .prog-track { width: 100%; height: 6px; background: rgba(255,255,255,0.06); border-radius: 6px; position: relative; overflow: hidden; }
        .prog-fill { position: absolute; left: 0; top: 0; height: 100%; background: rgba(255,255,255,0.8); border-radius: 6px; width: 0%; transition: width 1s cubic-bezier(0.16, 1, 0.3, 1) 0.2s; }
        .mod-card.open .prog-fill { background: var(--accent-blue); box-shadow: 0 0 15px var(--accent-blue-glow); }

        .mod-chevron { 
            width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.05); 
            display: flex; align-items: center; justify-content: center; color: var(--text-secondary); 
            transition: 0.4s cubic-bezier(0.16, 1, 0.3, 1); flex-shrink: 0; border: 1px solid transparent;
        }
        .mod-card:hover .mod-chevron { background: rgba(255,255,255,0.1); color: #FFF; }
        .mod-card.open .mod-chevron { transform: rotate(180deg); background: var(--accent-blue); color: #FFF; border-color: var(--accent-blue); box-shadow: 0 0 15px var(--accent-blue-glow); }

        .mod-body-wrapper { display: grid; grid-template-rows: 0fr; transition: grid-template-rows var(--spring-soft); }
        .mod-card.open .mod-body-wrapper { grid-template-rows: 1fr; }
        .mod-body-inner { overflow: hidden; }

        .chapter-list { padding: 0 2rem 2rem 2rem; display: flex; flex-direction: column; gap: 10px; box-sizing: border-box; }
        .chap-row { display: flex; justify-content: space-between; align-items: center; padding: 1.2rem 1.5rem; background: rgba(0,0,0,0.3); border-radius: var(--radius-md); border: 1px solid var(--border-subtle); transition: 0.2s; box-sizing: border-box; }
        .chap-row:hover { background: rgba(255,255,255,0.05); border-color: var(--border-highlight); transform: translateX(5px); }

        .chap-info { display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 0; padding-right: 1.5rem; }
        .chap-title { font-weight: 600; font-size: 1.05rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        
        .badge-container { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .badge { padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 4px; }
        
        .badge.read { background: var(--accent-green-glow); color: var(--accent-green); }
        .badge.unread { background: transparent; color: var(--text-tertiary); border: 1px solid var(--border-subtle); }
        .badge.score-perfect { background: rgba(255,159,10,0.15); color: var(--accent-orange); }
        .badge.score-pass { background: var(--accent-blue-glow); color: var(--accent-blue); }
        .badge.score-fail { background: rgba(255,69,58,0.15); color: var(--accent-red); }

        .btn { padding: 0.8rem 1.5rem; border-radius: 50px; font-weight: 700; font-size: 0.9rem; cursor: pointer; transition: 0.2s; border: none; display: inline-flex; align-items: center; justify-content: center; gap: 6px; text-decoration: none; white-space: nowrap; }
        .btn:active { transform: scale(0.95); }
        .btn-primary { background: var(--text-primary); color: #000; box-shadow: 0 4px 15px rgba(255,255,255,0.1); }
        .btn-primary:hover { background: #EBEBF5; transform: translateY(-2px); }
        .btn-retry { background: rgba(255, 69, 58, 0.1); color: var(--accent-red); border: 1px solid rgba(255,69,58,0.3); }
        .btn-retry:hover { background: var(--accent-red); color: #FFF; }
        .btn-ghost { background: rgba(255,255,255,0.03); color: var(--text-secondary); border: 1px solid var(--border-highlight); }
        .btn-ghost:hover { background: rgba(255,255,255,0.1); color: var(--text-primary); }

        @media (max-width: 768px) {
            .dash-viewport { padding-top: 6.5rem !important; }
            .dash-container { padding: 0 1rem; }
            .mod-header { flex-direction: column; align-items: flex-start; gap: 1rem; position: relative; padding: 1.5rem; }
            .mod-header-content { padding-right: 0; width: 100%; }
            .mod-chevron { position: absolute; right: 1.5rem; top: 1.5rem; }
            .chapter-list { padding: 0 1.5rem 1.5rem 1.5rem; }
            .chap-row { flex-direction: column; align-items: flex-start; gap: 1rem; padding: 1.25rem; }
            .chap-row:hover { transform: none; }
            .chap-info { padding-right: 0; width: 100%; }
            .chap-title { white-space: normal; line-height: 1.4; }
            .btn { width: 100%; }
        }
      </style>

      <div class="dash-viewport" id="dashViewport">
          <div class="ambient-aurora"></div>
          <div class="dash-container">
              <div id="skeletonLayer" class="view-layer">
                  <div class="dash-header">
                      <div><div class="skeleton" style="height: 16px; width: 120px; margin-bottom: 0.5rem;"></div><div class="skeleton" style="height: 38px; width: 220px;"></div></div>
                  </div>
                  <div class="module-list" style="display:flex; flex-direction:column; gap:1.5rem;">
                      <div class="skeleton" style="height: 140px; width: 100%;"></div>
                      <div class="skeleton" style="height: 140px; width: 100%;"></div>
                      <div class="skeleton" style="height: 140px; width: 100%;"></div>
                  </div>
              </div>
              <div id="dataLayer" class="view-layer hidden-layer">
                  <div id="dashboardContent"></div>
              </div>
          </div>
      </div>
    `;
  }

  async mount() {
    try {
        const user = Store.get('user');
        const profile = Store.get('profile') || {};
        if (!user) return Router.navigateTo('./login');

        const rawName = (profile.displayName || profile.fullName || profile.name || '').trim();
        const firstName = rawName ? rawName.split(' ')[0] : 'Cadet';
        const safeCert = String(profile.certificate || 'A').toUpperCase();
        const safeWing = String(profile.wing || 'army').toLowerCase();
        
        const [modules, userProgress] = await Promise.all([
            ContentService.getModules(safeCert, safeWing).catch(() => []),
            ProgressService.getUserProgress(user.uid).catch(() => ({ modules: {} }))
        ]);

        this.userProgress = userProgress;
        let fullTree = [];

        for (const mod of modules) {
            try {
                const chapters = await ContentService.getChapters(safeCert, mod.id);
                if (chapters.length === 0) continue;
                chapters.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

                let modStats = { chaptersRead: 0, quizzesPassed: 0 };
                const histReads = this.userProgress.modules?.[mod.id]?.chaptersRead || {};
                const histQuizzes = this.userProgress.modules?.[mod.id]?.quizzes || {};

                for (const chap of chapters) {
                    const rData = histReads[chap.id];
                    const isRead = rData?.completed || (rData?.percentScrolled >= 95) || rData === true;
                    if (isRead) { modStats.chaptersRead++; }

                    const qData = histQuizzes[chap.id];
                    const hScore = qData?.highestScore || (qData?.score !== undefined ? qData : null);
                    if (hScore && (hScore.passed || hScore.score >= 50)) { modStats.quizzesPassed++; }
                }

                mod.stats = modStats;
                mod.percentComplete = Math.floor((modStats.chaptersRead / chapters.length) * 100);
                fullTree.push({ ...mod, chapters });
            } catch (e) {}
        }

        this.curriculumTree = fullTree;

        // Auto-open first incomplete module
        if (this.curriculumTree.length > 0) {
            const targetMod = this.curriculumTree.find(m => m.percentComplete < 100) || this.curriculumTree[0];
            this.expandedModules.add(targetMod.id);
        }

        this.renderReality(firstName, safeCert, safeWing);

    } catch (e) {
        document.getElementById('skeletonLayer').innerHTML = `<h3 style="color:#FF453A; padding: 2rem;">Curriculum Uplink Failed</h3>`;
    }
  }

  renderReality(firstName, safeCert, safeWing) {
      const contentDiv = document.getElementById('dashboardContent');
      let html = `
          <div class="dash-header">
              <div><div class="greeting-time">Training Matrix</div><h1 class="greeting-name">Curriculum</h1></div>
          </div>
          <div class="module-list">
      `;

      this.curriculumTree.forEach((mod, index) => {
          const isOpen = this.expandedModules.has(mod.id) ? 'open' : '';
          let chaptersHtml = '';
          const histReads = this.userProgress.modules?.[mod.id]?.chaptersRead || {};
          const histQuizzes = this.userProgress.modules?.[mod.id]?.quizzes || {};

          mod.chapters.forEach(chap => {
              const rData = histReads[chap.id];
              const isRead = rData?.completed || (rData?.percentScrolled >= 95) || rData === true;
              const qData = histQuizzes[chap.id];
              const hScore = qData?.highestScore || (qData?.score !== undefined ? qData : null);
              
              let scoreBadge = '';
              let btnClass = 'btn-primary';
              let btnText = 'Initiate';
              let route = `./chapter?module=${mod.id}&chapter=${chap.id}`;

              if (hScore) {
                  const passed = hScore.passed !== undefined ? hScore.passed : (hScore.score >= 50);
                  const perfect = hScore.score === 100;
                  
                  if (perfect) scoreBadge = `<span class="badge score-perfect">★ 100%</span>`;
                  else if (passed) scoreBadge = `<span class="badge score-pass">✓ ${hScore.score}%</span>`;
                  else scoreBadge = `<span class="badge score-fail">✗ ${hScore.score}%</span>`;

                  if (passed) { btnClass = 'btn-ghost'; btnText = 'Review Data'; } 
                  else { btnClass = 'btn-retry'; btnText = 'Retry Exam'; route = `./quiz?module=${mod.id}&chapter=${chap.id}`; }
              } else if (isRead) {
                  btnClass = 'btn-ghost'; btnText = 'Read Text';
              }

              chaptersHtml += `
                  <div class="chap-row">
                      <div class="chap-info">
                          <div class="chap-title" title="${chap.title}">${chap.title}</div>
                          <div class="badge-container"><span class="badge ${isRead ? 'read' : 'unread'}">${isRead ? 'Read' : 'Pending'}</span>${scoreBadge}</div>
                      </div>
                      <button class="btn ${btnClass}" data-nav="${route}">${btnText}</button>
                  </div>
              `;
          });

          html += `
              <div class="mod-card ${isOpen}" id="mod-card-${mod.id}">
                  <div class="mod-header" data-modid="${mod.id}">
                      <div class="mod-header-content">
                          <span class="mod-tag">Module // ${mod.id.split('_').pop()}</span>
                          <h2 class="mod-title">${mod.title}</h2>
                          <div class="mod-stats-row"><span>${mod.stats.chaptersRead}/${mod.chapters.length} Read</span><span style="color:var(--border-highlight)">|</span><span>${mod.stats.quizzesPassed} Passed</span></div>
                          <div class="prog-track"><div class="prog-fill" data-target-width="${mod.percentComplete}"></div></div>
                      </div>
                      <div class="mod-chevron"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></div>
                  </div>
                  <div class="mod-body-wrapper"><div class="mod-body-inner"><div class="chapter-list">${chaptersHtml}</div></div></div>
              </div>
          `;
      });

      html += `</div>`; 
      contentDiv.innerHTML = html;

      this.bindEvents();
      this.triggerPostRenderAnimations();
  }

  bindEvents() {
      // EXCLUSIVE ACCORDION LOGIC
      document.querySelectorAll('.mod-header').forEach(header => {
          header.onclick = (e) => {
              if (e.target.tagName === 'BUTTON') return; 
              const modId = header.dataset.modid;
              const card = document.getElementById(`mod-card-${modId}`);
              
              if (card.classList.contains('open')) {
                  card.classList.remove('open');
              } else {
                  // Close all others first
                  document.querySelectorAll('.mod-card.open').forEach(c => c.classList.remove('open'));
                  card.classList.add('open');
                  setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
              }
          };
      });

      window.Router = Router; 
      document.querySelectorAll('[data-nav]').forEach(btn => {
          btn.onclick = (e) => {
              e.stopPropagation(); 
              const route = btn.dataset.nav;
              if (route) window.Router.navigateTo(route);
          };
      });
  }

  triggerPostRenderAnimations() {
      setTimeout(() => {
          document.getElementById('skeletonLayer')?.classList.add('hidden-layer');
          document.getElementById('dataLayer')?.classList.remove('hidden-layer');
          requestAnimationFrame(() => {
              document.querySelectorAll('.prog-fill').forEach(bar => {
                  bar.style.width = `${bar.getAttribute('data-target-width')}%`;
              });
          });
      }, 500); 
  }
}