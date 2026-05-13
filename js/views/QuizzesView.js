import AbstractView from '../core/AbstractView.js';
import Store from '../core/store.js';
import QuizService from '../services/quiz.service.js';
import ProgressService from '../services/progress.service.js';
import Router from '../core/router.js';

export default class QuizzesView extends AbstractView {
  constructor(params) {
    super(params);
    this.quizzes = [];
    this.progress = {};
  }

  async getHtml() {
    return `
      <style>
        /* ==========================================================================
           TACTICAL TELEMETRY - STRICT VERTICAL LIST
           ========================================================================== */
        :root {
            --bg-deep: #030508; 
            --text-pure: #FFFFFF; 
            --text-muted: #8E8E93;
            --tech-blue: #0A84FF; 
            --ncc-green: #30D158; 
            --ncc-red: #FF453A;
            --bg-card: rgba(15, 20, 25, 0.6); 
            --border-glass: rgba(255, 255, 255, 0.08);
            --radius-lg: 20px;
        }

        .quizzes-viewport {
            min-height: 100dvh;
            background-color: var(--bg-deep);
            /* STRICT NAVBAR & DOCK CLEARANCE */
            padding: 8rem 1.5rem 6rem 1.5rem !important; 
            box-sizing: border-box;
            color: var(--text-pure);
            font-family: "SF Pro Display", "Inter", sans-serif;
            overflow-x: hidden;
        }

        .quizzes-container { 
            max-width: 860px; 
            margin: 0 auto; 
            animation: fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1); 
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }

        .header-section { margin-bottom: 3.5rem; text-align: left; }
        .sys-badge { 
            display: inline-block; padding: 6px 14px; border-radius: 50px; 
            font-size: 0.7rem; font-weight: 800; text-transform: uppercase; 
            letter-spacing: 2px; color: var(--tech-blue); 
            background: rgba(10, 132, 255, 0.1); border: 1px solid rgba(10, 132, 255, 0.2); 
            margin-bottom: 1rem; 
        }
        .header-title { color: #F8FAFC;font-size: clamp(2.2rem, 5vw, 3.2rem); font-weight: 800; margin: 0 0 0.75rem 0; letter-spacing: -0.03em; }
        .header-desc { color: var(--text-muted); font-size: 1.1rem; max-width: 600px; line-height: 1.5; }

        /* STRICT VERTICAL LIST LAYOUT */
        .quiz-list { 
            display: flex !important; 
            flex-direction: column !important; 
            gap: 1.25rem !important; 
            width: 100% !important; 
        }

        .quiz-card {
            background: var(--bg-card); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
            border: 1px solid var(--border-glass); border-radius: var(--radius-lg);
            padding: 1.75rem 2.5rem; display: flex; align-items: center; justify-content: space-between;
            gap: 2rem; transition: 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            position: relative; overflow: hidden;
        }
        
        .quiz-card:hover { 
            background: rgba(28, 32, 38, 0.8); 
            border-color: rgba(10, 132, 255, 0.3);
            transform: translateX(8px);
            box-shadow: 0 15px 40px rgba(0,0,0,0.4); 
        }

        /* Tactical Left Indicator */
        .quiz-card::before {
            content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
            background: rgba(255,255,255,0.1); transition: 0.3s;
        }
        .quiz-card:hover::before { background: var(--tech-blue); box-shadow: 0 0 15px var(--tech-blue); }

        .qc-content { flex: 1; min-width: 0; }
        .qc-header { display: flex; align-items: center; gap: 12px; margin-bottom: 0.5rem; }
        .qc-tag { font-size: 0.75rem; font-weight: 800; color: var(--tech-blue); text-transform: uppercase; letter-spacing: 1.5px; }
        
        .qc-title { font-size: 1.4rem; font-weight: 700; margin: 0 0 0.5rem 0; color: var(--text-pure); letter-spacing: -0.01em; }
        .qc-desc { font-size: 0.95rem; color: var(--text-muted); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 450px; }
        
        .qc-meta { display: flex; gap: 1.5rem; margin-top: 1rem; }
        .meta-item { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
        .meta-item svg { width: 14px; height: 14px; stroke: currentColor; }

        .qc-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 12px; min-width: 160px; }
        
        .qc-status { 
            font-size: 0.7rem; font-weight: 900; padding: 5px 12px; border-radius: 6px; 
            text-transform: uppercase; letter-spacing: 1.5px; 
        }
        .status-passed { background: rgba(48, 209, 88, 0.1); color: var(--ncc-green); border: 1px solid rgba(48, 209, 88, 0.2); }
        .status-failed { background: rgba(255, 69, 58, 0.1); color: var(--ncc-red); border: 1px solid rgba(255, 69, 58, 0.2); }
        .status-pending { background: rgba(255, 255, 255, 0.03); color: var(--text-muted); border: 1px solid var(--border-glass); }

        .btn-launch {
            padding: 0.8rem 1.5rem; border-radius: 50px; font-weight: 800; font-size: 0.85rem;
            cursor: pointer; transition: 0.3s; border: none; text-align: center; 
            text-decoration: none; text-transform: uppercase; letter-spacing: 1.5px;
            background: var(--text-pure); color: #000; width: 100%; box-sizing: border-box;
        }
        .btn-launch:hover { background: #EBEBF5; transform: scale(1.03); }
        .btn-launch.retry { background: rgba(255,255,255,0.05); color: var(--text-pure); border: 1px solid var(--border-glass); }
        .btn-launch.retry:hover { background: rgba(255,255,255,0.1); }

        /* Skeleton States */
        .skeleton-card { height: 120px; width: 100%; border-radius: var(--radius-lg); background: rgba(255,255,255,0.02); margin-bottom: 1rem; }

        @media (max-width: 768px) {
            .quizzes-viewport { padding-top: 6.5rem !important; }
            .quiz-card { padding: 1.5rem; flex-direction: column; align-items: flex-start; gap: 1.5rem; }
            .qc-actions { width: 100%; align-items: flex-start; }
            .quiz-card:hover { transform: translateY(-5px); }
            .qc-desc { white-space: normal; }
        }
      </style>

      <div class="quizzes-viewport">
          <div class="quizzes-container">
              <div class="header-section">
                  <div class="sys-badge">Telemetry Diagnostics</div>
                  <h1 class="header-title">Tactical Assessments</h1>
                  <p class="header-desc">Analyze your curriculum mastery through secure mission evaluations.</p>
              </div>
              
              <div class="quiz-list" id="quizList">
                  <div class="skeleton-card"></div>
                  <div class="skeleton-card"></div>
                  <div class="skeleton-card"></div>
              </div>
          </div>
      </div>
    `;
  }

  async mount() {
    try {
        const user = Store.get('user');
        if (!user) return Router.navigateTo('./login');

        const profile = Store.get('profile') || {};
        const safeCert = String(profile.certificate || 'A').toUpperCase();

        const safeWing = String(profile.wing || 'army').toLowerCase();

        const [availableQuizzes, userProgress] = await Promise.all([
            QuizService.getAvailableQuizzes(safeCert, safeWing),
            ProgressService.getUserProgress(user.uid)
        ]);

        this.quizzes = availableQuizzes;
        this.progress = userProgress;
        this.renderQuizzes();

    } catch (error) {
        document.getElementById('quizList').innerHTML = `<div style="color: var(--ncc-red); padding: 2rem; text-align:center;">PROTOCOL ERROR: UNABLE TO RETRIEVE TELEMETRY</div>`;
    }
  }

  renderQuizzes() {
      const list = document.getElementById('quizList');
      if (!this.quizzes.length) {
          list.innerHTML = `<div style="color: var(--text-muted); text-align:center; padding: 3rem;">No authorized assessments found for your clearance level.</div>`;
          return;
      }

      let html = '';
      html += `
          <style>
              .elite-mock-banner {
                  position: relative; margin-bottom: 3.5rem; padding: 1px;
                  background: linear-gradient(90deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02), rgba(255,255,255,0.1));
                  border-radius: 20px;
              }
              .emb-inner {
                  background: #020617; border-radius: 19px; padding: 2rem 2.5rem;
                  display: flex; justify-content: space-between; align-items: center;
              }
              .emb-tag { color: var(--text-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 0.5rem; display: block; }
              .emb-title { color: #FFF; font-size: 1.7rem; font-weight: 800; margin: 0 0 0.5rem 0; letter-spacing: -0.01em; }
              .emb-desc { color: #8E8E93; font-size: 0.95rem; margin: 0; }
              .emb-action {
                  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #FFF;
                  padding: 1.1rem 2rem; border-radius: 50px; font-weight: 700; font-size: 0.95rem; text-decoration: none;
                  transition: 0.3s; display: inline-flex; align-items: center; gap: 8px; flex-shrink: 0;
              }
              .emb-action:hover { background: #FFF; color: #000; box-shadow: 0 10px 25px rgba(255,255,255,0.15); transform: translateY(-2px); }
              @media (max-width: 768px) {
                  .emb-inner { flex-direction: column; align-items: flex-start; gap: 1.5rem; padding: 1.5rem; }
                  .emb-action { width: 100%; justify-content: center; box-sizing: border-box; }
              }
          </style>

          <div class="elite-mock-banner">
              <div class="emb-inner">
                  <div class="emb-text">
                      <span class="emb-tag">Strict Mode Active</span>
                      <h2 class="emb-title">Parametric Mock Exam</h2>
                      <p class="emb-desc">Global weightage applied. Blueprint constraints enforced.</p>
                  </div>
                  <a href="/mock-test" class="emb-action" data-nav>
                      Initialize
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </a>
              </div>
          </div>
      `;
      this.quizzes.forEach(quiz => {
          const modProgress = this.progress.modules?.[quiz.moduleId]?.quizzes?.[quiz.chapterId];
          const bestScore = modProgress?.highestScore || (modProgress?.score !== undefined ? modProgress : null);
          
          let statusHtml = `<span class="qc-status status-pending">Pending</span>`;
          let btnText = 'Initiate Test';
          let btnClass = 'btn-launch';

          if (bestScore) {
              const passed = bestScore.passed !== undefined ? bestScore.passed : (bestScore.score >= 50);
              if (passed) {
                  statusHtml = `<span class="qc-status status-passed">Cleared // ${bestScore.score}%</span>`;
                  btnText = 'Re-Analyze';
                  btnClass = 'btn-launch retry';
              } else {
                  statusHtml = `<span class="qc-status status-failed">Failed // ${bestScore.score}%</span>`;
                  btnText = 'Retry Mission';
              }
          }

          html += `
              <div class="quiz-card">
                  <div class="qc-content">
                      <div class="qc-header">
                          <span class="qc-tag">${quiz.moduleTitle || 'Operational'}</span>
                      </div>
                      <h3 class="qc-title">${quiz.title}</h3>
                      <p class="qc-desc">${quiz.description || 'Standard knowledge evaluation protocol.'}</p>
                      
                      <div class="qc-meta">
                          <div class="meta-item">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                              ${quiz.duration || 10}m
                          </div>
                          <div class="meta-item">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                              ${quiz.questionCount || 10} Qs
                          </div>
                      </div>
                  </div>
                  
                  <div class="qc-actions">
                      ${statusHtml}
                      <a href="./quiz?module=${quiz.moduleId}&chapter=${quiz.chapterId}" class="${btnClass}" data-nav>${btnText}</a>
                  </div>
              </div>
          `;
      });

      list.innerHTML = html;

      // Rebind Navigation
      window.Router = Router; 
      list.querySelectorAll('[data-nav]').forEach(btn => {
          btn.onclick = (e) => {
              e.preventDefault(); 
              const route = btn.getAttribute('href');
              if (route) window.Router.navigateTo(route);
          };
      });
  }
}
