import AbstractView from '../core/AbstractView.js';
import Store from '../core/store.js';
import ContentService from '../services/content.service.js';
import ProgressService from '../services/progress.service.js';

export default class DashboardView extends AbstractView {
  constructor(params) {
    super(params);
    this.stats = { totalRead: 0, totalQuizzes: 0, passedQuizzes: 0, avgScore: 0, globalProgress: 0 };
  }

  async getHtml() {
    return `
      <style>
        :root {
            --bg-base: #000000; --bg-elevated: #1C1C1E;
            --accent-blue: #0A84FF; --accent-green: #30D158; --accent-purple: #BF5AF2;
            --text-main: #FFFFFF; --text-muted: #8E8E93;
            --radius-xl: 28px; --radius-lg: 20px;
        }

        .stats-viewport {
            min-height: calc(100vh - 4.5rem); padding: 4rem 1.5rem;
            background: var(--bg-base); color: var(--text-main);
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
            box-sizing: border-box;
        }

        .stats-container { max-width: 1100px; margin: 0 auto; box-sizing: border-box; }

        .hero-header { margin-bottom: 3rem; animation: fadeInDown 0.8s cubic-bezier(0.16, 1, 0.3, 1); }
        .hero-header h1 { font-size: 2.5rem; font-weight: 800; letter-spacing: -0.03em; margin: 0; }
        .hero-header p { color: var(--text-muted); font-size: 1.1rem; margin-top: 0.5rem; }

        .metrics-grid {
            display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem;
            margin-bottom: 3rem;
        }

        .metric-card {
            background: var(--bg-elevated); border-radius: var(--radius-xl); padding: 2rem;
            display: flex; flex-direction: column; align-items: flex-start; justify-content: space-between;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05);
            transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            animation: zoomIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) backwards;
        }
        .metric-card:hover { transform: translateY(-5px); background: #222225; }

        .metric-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin-bottom: 1.5rem; }
        .icon-blue { background: rgba(10, 132, 255, 0.15); color: var(--accent-blue); }
        .icon-green { background: rgba(48, 209, 88, 0.15); color: var(--accent-green); }
        .icon-purple { background: rgba(191, 90, 242, 0.15); color: var(--accent-purple); }

        .metric-val { font-size: 2.5rem; font-weight: 800; margin: 0; line-height: 1; font-variant-numeric: tabular-nums; }
        .metric-label { font-size: 0.9rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-top: 0.5rem; }

        .action-banner {
            background: linear-gradient(135deg, rgba(10, 132, 255, 0.2) 0%, rgba(191, 90, 242, 0.2) 100%);
            border: 1px solid rgba(10, 132, 255, 0.3); border-radius: var(--radius-lg);
            padding: 2.5rem; display: flex; justify-content: space-between; align-items: center;
            backdrop-filter: blur(20px);
        }
        .action-banner h2 { margin: 0 0 0.5rem 0; font-size: 1.5rem; }
        .btn-launch { background: var(--text-main); color: var(--bg-base); padding: 1rem 2rem; border-radius: 50px; font-weight: 700; text-decoration: none; display: inline-block; transition: 0.3s; }
        .btn-launch:hover { transform: scale(1.05); }

        @keyframes fadeInDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes zoomIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        
        @media(max-width: 600px) {
            .action-banner { flex-direction: column; align-items: flex-start; gap: 1.5rem; padding: 1.5rem; }
        }
      </style>

      <div class="stats-viewport">
          <div class="stats-container" id="statsContainer">
              <div style="text-align:center; padding: 4rem; color: #8E8E93;">
                  <div style="width:40px; height:40px; border:4px solid #333; border-top-color:#0A84FF; border-radius:50%; animation:spin 1s linear infinite; margin: 0 auto 1rem auto;"></div>
                  Processing Telemetry...
              </div>
          </div>
      </div>
    `;
  }

  async mount() {
      const user = Store.get('user');
      const profile = Store.get('profile') || {};
      if (!user) return window.location.replace('./login');

      const cert = profile.certificate || 'A';
      const wing = profile.wing || 'army';
      const rawName = (profile.fullName || '').split(' ')[0] || 'Cadet';

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

          this.render(rawName);
      } catch (e) { console.error(e); }
  }

  render(name) {
      document.getElementById('statsContainer').innerHTML = `
          <div class="hero-header">
              <h1>Telemetry Overview, ${name}.</h1>
              <p>Real-time analytics of your training progression.</p>
          </div>

          <div class="metrics-grid">
              <div class="metric-card" style="animation-delay: 0.1s;">
                  <div class="metric-icon icon-blue">📚</div>
                  <div>
                      <div class="metric-val" id="animRead">0</div>
                      <div class="metric-label">Chapters Cleared</div>
                  </div>
              </div>
              <div class="metric-card" style="animation-delay: 0.2s;">
                  <div class="metric-icon icon-green">🎯</div>
                  <div>
                      <div class="metric-val" id="animProg">0%</div>
                      <div class="metric-label">Global Completion</div>
                  </div>
              </div>
              <div class="metric-card" style="animation-delay: 0.3s;">
                  <div class="metric-icon icon-purple">🏆</div>
                  <div>
                      <div class="metric-val" id="animScore">0%</div>
                      <div class="metric-label">Average Accuracy</div>
                  </div>
              </div>
          </div>

          <div class="action-banner">
              <div>
                  <h2>Ready to deploy?</h2>
                  <p style="color: rgba(255,255,255,0.8); margin: 0;">Access your full curriculum or take pending assessments.</p>
              </div>
              <div style="display:flex; gap: 1rem;">
                  <a href="./learning" class="btn-launch" style="background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2);">Learning Modules</a>
                  <a href="./quizzes" class="btn-launch">Assessment Hub</a>
              </div>
          </div>
      `;

      this.animateNumber('animRead', this.stats.totalRead, '');
      this.animateNumber('animProg', this.stats.globalProgress, '%');
      this.animateNumber('animScore', this.stats.avgScore, '%');
  }

  animateNumber(id, end, suffix) {
      const el = document.getElementById(id);
      if (!el) return;
      let start = 0;
      const duration = 1500; const stepTime = Math.abs(Math.floor(duration / (end || 1)));
      const timer = setInterval(() => {
          start += 1;
          el.textContent = start + suffix;
          if (start >= end) { clearInterval(timer); el.textContent = end + suffix; }
      }, stepTime);
  }
}