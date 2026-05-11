import AbstractView from '../core/AbstractView.js';
import Store from '../core/store.js';
import ContentService from '../services/content.service.js';
import ProgressService from '../services/progress.service.js';
import Router from '../core/router.js';

export default class DashboardView extends AbstractView {
  constructor(params) {
    super(params);
    this.stats = { totalRead: 0, totalQuizzes: 0, passedQuizzes: 0, avgScore: 0, globalProgress: 0 };
  }

  async getHtml() {
    return `
      <style>
        /* ==========================================================================
           CLEAN & RESPONSIVE DASHBOARD (MOBILE-FIRST HIG)
           ========================================================================== */
        :root {
            --bg-base: #000000; 
            --bg-elevated: #151517;
            --accent-blue: #0A84FF; 
            --accent-green: #30D158; 
            --accent-purple: #BF5AF2;
            --text-main: #FFFFFF; 
            --text-muted: #8E8E93;
            --border-glass: rgba(255, 255, 255, 0.08);
            --radius-xl: 24px; 
            --radius-lg: 16px;
        }

        .stats-viewport {
            min-height: 100dvh; 
            background: var(--bg-base); 
            color: var(--text-main);
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif;
            
            /* STRICT CLEARANCES FOR NAVBAR AND MOBILE DOCK */
            padding: 8rem 1.5rem 6.5rem 1.5rem !important; 
            box-sizing: border-box;
            overflow-x: hidden;
        }

        .stats-container { max-width: 1000px; margin: 0 auto; box-sizing: border-box; }

        .hero-header { margin-bottom: 3rem; animation: fadeInDown 0.6s ease-out; }
        .hero-header h1 { 
            font-size: clamp(2.2rem, 5vw, 3rem); /* Fluid text scaling */
            font-weight: 800; letter-spacing: -0.03em; margin: 0; line-height: 1.1; 
        }
        .hero-header p { color: var(--text-muted); font-size: 1.1rem; margin-top: 0.75rem; }

        /* FLUID GRID SYSTEM */
        .metrics-grid {
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); 
            gap: 1.5rem;
            margin-bottom: 3rem;
        }

        .metric-card {
            background: var(--bg-elevated); border-radius: var(--radius-xl); padding: 2rem;
            display: flex; flex-direction: column; align-items: flex-start; justify-content: space-between;
            box-shadow: 0 10px 30px rgba(0,0,0,0.4); border: 1px solid var(--border-glass);
            transition: transform 0.3s ease, background 0.3s ease;
            animation: zoomIn 0.5s ease-out backwards;
            position: relative; overflow: hidden;
        }
        .metric-card:hover { transform: translateY(-4px); background: #1C1C1E; border-color: rgba(255,255,255,0.15); }

        .metric-icon { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem; }
        .metric-icon svg { width: 24px; height: 24px; stroke-width: 2.5; stroke: currentColor; fill: none; }
        
        .icon-blue { background: rgba(10, 132, 255, 0.15); color: var(--accent-blue); }
        .icon-green { background: rgba(48, 209, 88, 0.15); color: var(--accent-green); }
        .icon-purple { background: rgba(191, 90, 242, 0.15); color: var(--accent-purple); }

        .metric-val { font-size: clamp(2.5rem, 5vw, 3rem); font-weight: 800; margin: 0; line-height: 1; font-variant-numeric: tabular-nums; }
        .metric-label { font-size: 0.85rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-top: 0.75rem; }

        /* ACTION BANNER */
        .action-banner {
            background: linear-gradient(135deg, rgba(10, 132, 255, 0.15) 0%, rgba(191, 90, 242, 0.15) 100%);
            border: 1px solid rgba(10, 132, 255, 0.2); border-radius: var(--radius-xl);
            padding: 2.5rem; display: flex; justify-content: space-between; align-items: center;
            backdrop-filter: blur(20px);
            animation: fadeInDown 0.6s ease-out backwards; animation-delay: 0.3s;
        }
        
        .action-banner-text h2 { margin: 0 0 0.5rem 0; font-size: clamp(1.4rem, 4vw, 1.8rem); font-weight: 700; letter-spacing: -0.01em; }
        .action-banner-text p { color: rgba(255,255,255,0.7); margin: 0; font-size: 1rem; line-height: 1.5; }

        .action-buttons { display: flex; gap: 1rem; }
        
        /* TOUCH-FRIENDLY BUTTONS */
        .btn-launch { 
            padding: 1.1rem 2rem; border-radius: 50px; font-weight: 700; font-size: 0.95rem;
            text-decoration: none; display: inline-flex; justify-content: center; align-items: center;
            transition: 0.2s; white-space: nowrap; border: none; cursor: pointer;
        }
        .btn-launch:active { transform: scale(0.96); }
        .btn-primary { background: var(--text-main); color: var(--bg-base); box-shadow: 0 4px 15px rgba(255,255,255,0.1); }
        .btn-primary:hover { background: #EBEBF5; transform: translateY(-2px); box-shadow: 0 8px 20px rgba(255,255,255,0.2); }
        .btn-ghost { background: rgba(255,255,255,0.08); color: var(--text-main); border: 1px solid rgba(255,255,255,0.15); }
        .btn-ghost:hover { background: rgba(255,255,255,0.15); }

        @keyframes fadeInDown { from { opacity: 0; transform: translateY(-15px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes zoomIn { from { opacity: 0; transform: scale(0.97) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        
        /* ==========================================================================
           MOBILE RESPONSIVENESS OVERRIDES
           ========================================================================== */
        @media(max-width: 768px) {
            .stats-viewport { padding-top: 6.5rem !important; padding-left: 1rem !important; padding-right: 1rem !important; }
            
            .metric-card { padding: 1.75rem; border-radius: 20px; }
            .metric-icon { width: 42px; height: 42px; margin-bottom: 1rem; }
            .metric-icon svg { width: 20px; height: 20px; }
            
            /* Action Banner stacks vertically for mobile reading comfort */
            .action-banner { flex-direction: column; align-items: flex-start; gap: 1.5rem; padding: 1.75rem; border-radius: 20px; }
            
            /* Buttons stretch to full width for easy thumb-tapping */
            .action-buttons { width: 100%; flex-direction: column; gap: 0.75rem; }
            .btn-launch { width: 100%; padding: 1.1rem; }
        }
      </style>

      <div class="stats-viewport">
          <div class="stats-container" id="statsContainer">
              <div style="text-align:center; padding: 4rem; color: var(--text-muted);">
                  <div style="width:40px; height:40px; border:3px solid rgba(255,255,255,0.1); border-top-color:var(--accent-blue); border-radius:50%; animation:spin 1s linear infinite; margin: 0 auto 1rem auto;"></div>
                  Synchronizing Telemetry...
                  <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
              </div>
          </div>
      </div>
    `;
  }

  async mount() {
      const user = Store.get('user');
      const profile = Store.get('profile') || {};
      if (!user) return Router.navigateTo('./login');

      const cert = profile.certificate || 'A';
      const wing = profile.wing || 'army';
      const rawName = (profile.displayName || profile.fullName || '').split(' ')[0] || 'Cadet';

      try {
          const modules = await ContentService.getModules(cert, wing);
          const progress = await ProgressService.getUserProgress(user.uid) || { modules: {} };

          let totalChaps = 0, readChaps = 0, passQ = 0, totalScore = 0, scoreCount = 0;

          for (const mod of modules) {
              const chaps = await ContentService.getChapters(cert, mod.id);
              totalChaps += chaps.length;

              const modProg = progress.modules[mod.id] || {};
              const histReads = modProg.chaptersRead || {};
              const histQuizzes = modProg.quizzes || {};

              chaps.forEach(c => {
                  const r = histReads[c.id];
                  if (r?.completed || r?.percentScrolled >= 95 || r === true) readChaps++;

                  const q = histQuizzes[c.id];
                  const hScore = q?.highestScore || (q?.score !== undefined ? q : null);
                  if (hScore) {
                      scoreCount++;
                      totalScore += hScore.score;
                      if (hScore.passed || hScore.score >= 50) passQ++;
                  }
              });
          }

          this.stats = {
              globalProgress: totalChaps > 0 ? Math.round((readChaps / totalChaps) * 100) : 0,
              totalRead: readChaps,
              passedQuizzes: passQ,
              avgScore: scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0
          };

          this.renderUI(rawName);
      } catch (e) { 
          console.error(e); 
          document.getElementById('statsContainer').innerHTML = `<div style="color: #FF453A; text-align:center; padding: 4rem;">Connection severed. Unable to load dashboard data.</div>`;
      }
  }

  renderUI(name) {
      document.getElementById('statsContainer').innerHTML = `
          <div class="hero-header">
              <h1>Telemetry Overview, ${name}.</h1>
              <p>Real-time analytics of your tactical training progression.</p>
          </div>

          <div class="metrics-grid">
              <div class="metric-card" style="animation-delay: 0.1s;">
                  <div class="metric-icon icon-blue">
                      <svg viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
                  </div>
                  <div>
                      <div class="metric-val" id="animRead">0</div>
                      <div class="metric-label">Chapters Cleared</div>
                  </div>
              </div>
              <div class="metric-card" style="animation-delay: 0.15s;">
                  <div class="metric-icon icon-green">
                      <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                  </div>
                  <div>
                      <div class="metric-val" id="animProg">0%</div>
                      <div class="metric-label">Global Completion</div>
                  </div>
              </div>
              <div class="metric-card" style="animation-delay: 0.2s;">
                  <div class="metric-icon icon-purple">
                      <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>
                  </div>
                  <div>
                      <div class="metric-val" id="animScore">0%</div>
                      <div class="metric-label">Average Accuracy</div>
                  </div>
              </div>
          </div>

          <div class="action-banner">
              <div class="action-banner-text">
                  <h2>Ready to deploy?</h2>
                  <p>Resume your active curriculum or execute pending assessments.</p>
              </div>
              <div class="action-buttons">
                  <a href="./learning" class="btn-launch btn-ghost" data-nav>Learning Matrix</a>
                  <a href="./quizzes" class="btn-launch btn-primary" data-nav>Assessments</a>
              </div>
          </div>
      `;

      this.animateNumber('animRead', this.stats.totalRead, '');
      this.animateNumber('animProg', this.stats.globalProgress, '%');
      this.animateNumber('animScore', this.stats.avgScore, '%');

      // Rebind routing for SPA navigation
      window.Router = Router;
      document.querySelectorAll('[data-nav]').forEach(link => {
          link.onclick = (e) => {
              e.preventDefault();
              Router.navigateTo(link.getAttribute('href'));
          };
      });
  }

  animateNumber(id, end, suffix) {
      const el = document.getElementById(id);
      if (!el) return;
      
      if (end === 0) {
          el.textContent = "0" + suffix;
          return;
      }

      let start = 0;
      const duration = 1200; 
      const stepTime = Math.max(16, Math.abs(Math.floor(duration / end)));
      
      const timer = setInterval(() => {
          start += 1;
          el.textContent = start + suffix;
          if (start >= end) { 
              clearInterval(timer); 
              el.textContent = end + suffix; 
          }
      }, stepTime);
  }
}