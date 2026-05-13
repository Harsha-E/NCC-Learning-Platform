import AbstractView from '../core/AbstractView.js';
import Store from '../core/store.js';
import Router from '../core/router.js';
import { getDbInstance, doc, getDoc } from '../core/firebase-init.js';

export default class MockTestView extends AbstractView {
  constructor(params) {
    super(params);
    this.blueprintSettings = {
        totalQuestions: 75,
        durationMins: 180,
        passPercentage: 50
    };
  }

  async getHtml() {
    return `
      <style>
        /* ==========================================================================
           PRE-FLIGHT BRIEFING HUD (MOBILE-FIRST HIG)
           ========================================================================== */
        :root {
            --bg-abyss: #000000;
            --panel-bg: rgba(20, 20, 22, 0.6);
            --border-glass: rgba(255, 255, 255, 0.1);
            --text-pure: #FFFFFF;
            --text-muted: #8E8E93;
            --accent-blue: #0A84FF;
            --accent-red: #FF453A;
            --accent-green: #30D158;
            --radius-xl: 24px;
            --radius-md: 16px;
        }

        .briefing-viewport {
            min-height: 100dvh; background-color: var(--bg-abyss);
            padding: 8.5rem 1.5rem 6.5rem 1.5rem !important; box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
            color: var(--text-pure);
            display: flex; flex-direction: column; align-items: center; justify-content: center;
        }

        .briefing-card {
            width: 100%; max-width: 800px;
            animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) backwards;
        }

        .sys-badge {
            display: inline-flex; align-items: center; gap: 8px;
            padding: 6px 14px; border-radius: 50px; font-size: 0.75rem; font-weight: 800;
            text-transform: uppercase; letter-spacing: 1.5px; color: var(--accent-blue);
            background: rgba(10, 132, 255, 0.1); border: 1px solid rgba(10, 132, 255, 0.3);
            margin-bottom: 1.5rem;
        }

        .briefing-title { font-size: clamp(2rem, 5vw, 3rem); font-weight: 800; margin: 0 0 0.5rem 0; letter-spacing: -0.02em; }
        .briefing-subtitle { font-size: 1.1rem; color: var(--text-muted); margin: 0 0 3rem 0; line-height: 1.5; }

        /* Metrics Bento */
        .bento-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
        .bento-box {
            background: var(--panel-bg); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
            border: 1px solid var(--border-glass); border-radius: var(--radius-md);
            padding: 2rem; display: flex; flex-direction: column; align-items: flex-start;
        }
        .bento-label { font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.5rem; }
        .bento-val { font-size: 2.5rem; font-weight: 800; color: var(--text-pure); line-height: 1; }
        
        /* Strict Warning Panel */
        .warning-panel {
            background: rgba(255, 69, 58, 0.05); border: 1px solid rgba(255, 69, 58, 0.2);
            border-radius: var(--radius-md); padding: 1.5rem 2rem; margin-bottom: 3rem;
            display: flex; gap: 1.5rem; align-items: flex-start;
        }
        .warning-icon { color: var(--accent-red); margin-top: 4px; }
        .warning-text h3 { margin: 0 0 0.5rem 0; color: var(--accent-red); font-size: 1.1rem; font-weight: 800; letter-spacing: -0.01em; }
        .warning-text p { margin: 0; color: rgba(255,255,255,0.8); font-size: 0.95rem; line-height: 1.5; }

        /* Action */
        .action-row { display: flex; justify-content: flex-end; gap: 1rem; }
        .btn { padding: 1.2rem 2.5rem; border-radius: 50px; font-weight: 800; font-size: 1rem; cursor: pointer; transition: 0.2s; border: none; letter-spacing: 0.5px; text-transform: uppercase; }
        .btn-cancel { background: rgba(255,255,255,0.1); color: var(--text-pure); }
        .btn-cancel:hover { background: rgba(255,255,255,0.15); }
        .btn-launch { background: var(--text-pure); color: #000; box-shadow: 0 5px 15px rgba(255,255,255,0.1); }
        .btn-launch:hover { background: #E4E4E7; transform: translateY(-2px); box-shadow: 0 10px 25px rgba(255,255,255,0.2); }
        .btn-launch:active { transform: scale(0.96); }

        @keyframes slideUpFade { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

        @media (max-width: 768px) {
            .briefing-viewport { padding-top: 6.5rem !important; justify-content: flex-start; }
            .warning-panel { flex-direction: column; gap: 1rem; padding: 1.5rem; }
            .action-row { flex-direction: column-reverse; }
            .btn { width: 100%; text-align: center; }
        }
      </style>

      <div class="briefing-viewport">
          <div class="briefing-card" id="briefingCard">
              <div style="text-align: center; padding: 4rem;">
                  <div style="width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.1); border-top-color: var(--accent-blue); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem auto;"></div>
                  <div style="color: var(--text-muted); font-weight: 600;">Decrypting Blueprint Parameters...</div>
                  <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
              </div>
          </div>
      </div>
    `;
  }

  async mount() {
      const profile = Store.get('profile');
      if (!profile) return Router.navigateTo('/dashboard');

      const cert = profile.certificate || 'A';
      const wing = profile.wing || 'army';

      try {
          // 1. Fetch Admin Blueprint Settings
          const db = getDbInstance();
          const snap = await getDoc(doc(db, 'metadata', `mockBlueprint_${cert}_${wing}`));
          if (snap.exists()) this.blueprintSettings = snap.data().settings;

          // 2. Cross-check against actual available question pool in cache
          const modules = await ContentService.getModules(cert, wing);
          let totalAvailable = 0;
          for (const mod of modules) {
              const chapters = await ContentService.getChapters(cert, mod.id);
              for (const chap of chapters) {
                  const chapData = await ContentService.getChapter(cert, mod.id, chap.id);
                  if (chapData?.assessmentData) {
                      totalAvailable += chapData.assessmentData.filter(q => q.type === 'mcq').length;
                  }
              }
          }

          // 3. Automatically adjust display count if pool is smaller than 75
          this.blueprintSettings.totalQuestions = Math.min(this.blueprintSettings.totalQuestions, totalAvailable);
          
      } catch (e) {
          console.warn("Briefing calculation error:", e);
      }

      this.renderBriefing();
  }

  renderBriefing() {
      const container = document.getElementById('briefingCard');
      
      container.innerHTML = `
          <div class="sys-badge">Mock Deployment Briefing</div>
          <h1 class="briefing-title">Final Simulation Protocol</h1>
          <p class="briefing-subtitle">Review your operational parameters before initiating the deployment sequence. Once commenced, the environment is strictly monitored.</p>

          <div class="bento-grid">
              <div class="bento-box">
                  <span class="bento-label">Evaluation Scope</span>
                  <div class="bento-val">${this.blueprintSettings.totalQuestions}</div>
                  <span style="color:var(--text-muted); font-size:0.85rem; margin-top:4px;">Questions</span>
              </div>
              <div class="bento-box">
                  <span class="bento-label">Time Limit</span>
                  <div class="bento-val">${this.blueprintSettings.durationMins}<span style="font-size:1.2rem; color:var(--text-muted);">m</span></div>
                  <span style="color:var(--text-muted); font-size:0.85rem; margin-top:4px;">Maximum Duration</span>
              </div>
              <div class="bento-box">
                  <span class="bento-label">Passing Target</span>
                  <div class="bento-val">${this.blueprintSettings.passPercentage}<span style="font-size:1.2rem; color:var(--text-muted);">%</span></div>
                  <span style="color:var(--text-muted); font-size:0.85rem; margin-top:4px;">Minimum Accuracy</span>
              </div>
          </div>

          <div class="warning-panel">
              <div class="warning-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              </div>
              <div class="warning-text">
                  <h3>Strict Anti-Cheat Protocol Active</h3>
                  <p>This simulation enforces a strict full-screen lock. Navigating away, opening other tabs, or exiting full-screen mode will trigger a violation sequence. Multiple violations will result in automatic exam termination and failure.</p>
              </div>
          </div>

          <div class="action-row">
              <button class="btn btn-cancel" id="btnAbort">Abort</button>
              <button class="btn btn-launch" id="btnLaunch">Acknowledge & Launch</button>
          </div>
      `;

      document.getElementById('btnAbort').onclick = () => {
          Router.navigateTo('/dashboard');
      };

      document.getElementById('btnLaunch').onclick = () => {
          // Navigates to the active exam interface
          Router.navigateTo('/mock-exam');
      };
  }
}