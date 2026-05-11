import AbstractView from '../core/AbstractView.js';
import Store from '../core/store.js';
import ContentService from '../services/content.service.js';
import ProgressService from '../services/progress.service.js';

export default class QuizzesView extends AbstractView {
  constructor(params) {
    super(params);
    this.quizDataList = [];
  }

  async getHtml() {
    return `
      <style>
        :root {
            --bg-base: #000000; --bg-elevated: #1C1C1E; --bg-hover: #2C2C2E;
            --text-main: #FFFFFF; --text-muted: #8E8E93;
            --accent-blue: #0A84FF; --accent-green: #30D158; --accent-red: #FF453A;
            --border-glass: rgba(255, 255, 255, 0.1);
        }

        .quiz-viewport { 
            box-sizing: border-box !important; 
            min-height: 100dvh !important; 
            background: var(--bg-base); color: var(--text-main); 
            font-family: -apple-system, BlinkMacSystemFont, sans-serif; 
            padding: 4rem 1.5rem;
            padding-top: 8rem !important;
        }
        
        .quiz-container { max-width: 900px; margin: 0 auto; box-sizing: border-box; }

        .header-title { font-size: 2.5rem; font-weight: 800; margin: 0 0 0.5rem 0; letter-spacing: -0.03em; }
        .header-sub { color: var(--text-muted); font-size: 1.1rem; margin-bottom: 3rem; }

        /* 🐛 BUG FIX: Improved Flexbox wrapping for smaller screens */
        .quiz-card {
            background: var(--bg-elevated); border: 1px solid var(--border-glass);
            border-radius: 20px; padding: 1.5rem; margin-bottom: 1rem;
            display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem;
            transition: 0.3s; animation: slideUp 0.5s ease backwards; box-sizing: border-box;
        }
        .quiz-card:hover { transform: translateX(5px); border-color: rgba(10, 132, 255, 0.3); background: #222225; }

        /* 🐛 BUG FIX: Force the text info block to take up remaining space, but never overflow */
        .q-info { flex: 1 1 60%; min-width: 0; }
        
        .q-tag { font-size: 0.75rem; font-weight: 700; color: var(--accent-blue); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.25rem; display: block; }
        .q-title { font-size: 1.25rem; font-weight: 600; margin: 0 0 0.5rem 0; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        
        .q-stats { display: flex; gap: 1rem; align-items: center; font-size: 0.85rem; color: var(--text-muted); font-weight: 500; }
        
        .badge { padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; white-space: nowrap; }
        .badge.pass { background: rgba(48, 209, 88, 0.15); color: var(--accent-green); }
        .badge.fail { background: rgba(255, 69, 58, 0.15); color: var(--accent-red); }
        .badge.pending { background: rgba(255, 255, 255, 0.1); color: var(--text-muted); }

        .btn-launch { background: var(--text-main); color: var(--bg-base); border: none; padding: 0.8rem 1.5rem; border-radius: 50px; font-weight: 700; cursor: pointer; transition: 0.2s; text-decoration: none; display: inline-block; white-space: nowrap; flex-shrink: 0; }
        .btn-launch:hover { background: #E5E5EA; transform: scale(1.05); }

        @keyframes slideUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        
        /* 🐛 BUG FIX: Explicit mobile breakpoint to stack elements beautifully */
        @media(max-width: 600px) {
            .quiz-viewport { padding: 2rem 1rem; }
            .quiz-card { flex-direction: column; align-items: flex-start; gap: 1.25rem; padding: 1.25rem; }
            .q-info { width: 100%; flex: none; }
            .q-title { white-space: normal; word-wrap: break-word; } /* Allow titles to wrap on mobile */
            .btn-launch { width: 100%; text-align: center; box-sizing: border-box;}
        }
      </style>

      <div class="quiz-viewport">
          <div class="quiz-container" id="quizContainer">
              <div style="text-align:center; padding: 4rem; color: #8E8E93;">Scanning Database...</div>
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

      try {
          const modules = await ContentService.getModules(cert, wing);
          const progress = await ProgressService.getUserProgress(user.uid) || { modules: {} };
          
          let list = [];

          for (const mod of modules) {
              const chaps = await ContentService.getChapters(cert, mod.id);
              const histQuizzes = progress.modules[mod.id]?.quizzes || {};

              for (const chap of chaps) {
                  const qData = histQuizzes[chap.id];
                  const hScore = qData?.highestScore || (qData?.score !== undefined ? qData : null);
                  
                  list.push({
                      modId: mod.id, modTitle: mod.title,
                      chapId: chap.id, chapTitle: chap.title,
                      score: hScore ? hScore.score : null,
                      passed: hScore ? (hScore.passed || hScore.score >= 50) : null
                  });
              }
          }

          this.quizDataList = list;
          this.render();
      } catch (e) { console.error(e); }
  }

  render() {
      const container = document.getElementById('quizContainer');
      let html = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3rem; flex-wrap:wrap; gap:1rem;">
             <div>
                <h1 class="header-title">Assessment Hub</h1>
                <p class="header-sub" style="margin-bottom:0;">Review your past scores and launch pending examinations.</p>
             </div>
             <a href="./mock-exam" class="btn-launch" style="background: rgba(10, 132, 255, 0.2); color: #0A84FF; border: 1px solid rgba(10, 132, 255, 0.4);">Launch Strict Mock</a>
          </div>
      `;

      this.quizDataList.forEach((q, idx) => {
          let badge = `<span class="badge pending">Pending</span>`;
          let btnText = 'Initiate';
          
          if (q.score !== null) {
              badge = `<span class="badge ${q.passed ? 'pass' : 'fail'}">${q.passed ? 'Passed' : 'Failed'} · ${q.score}%</span>`;
              btnText = q.passed ? 'Review' : 'Retry';
          }

          html += `
              <div class="quiz-card" style="animation-delay: ${idx * 0.05}s;">
                  <div class="q-info">
                      <span class="q-tag">${q.modTitle}</span>
                      <h3 class="q-title" title="${q.chapTitle}">${q.chapTitle}</h3>
                      <div class="q-stats">
                          ${badge}
                      </div>
                  </div>
                  <a href="./quiz?module=${q.modId}&chapter=${q.chapId}" class="btn-launch">${btnText}</a>
              </div>
          `;
      });

      container.innerHTML = html;
  }
}