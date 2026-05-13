import AbstractView from '../core/AbstractView.js';
import Store from '../core/store.js';
import Router from '../core/router.js';
import ContentService from '../services/content.service.js';
import ProgressService from '../services/progress.service.js';

export default class QuizResultView extends AbstractView {
  constructor(params) {
    super(params);
    this.resultData = null;
    const rawType = this.params?.queryParams?.type;
    this.examType = (rawType === 'mock') ? 'mock' : 'chapter';
    
    // Dynamic Routing State
    this.nextRoute = './dashboard';
    this.nextText = 'Acknowledge & Return';
  }

  async getHtml() {
    return `
      <style>
        /* ==========================================================================
           TACTICAL BENTO RESULTS HUD (MOBILE-FIRST HIG)
           ========================================================================== */
        :root {
            --bg-abyss: #000000;
            --panel-bg: #151517;
            --panel-hover: #1C1C1E;
            
            --text-pure: #FFFFFF;
            --text-muted: #8E8E93;
            
            --accent-green: #30D158;
            --accent-green-glow: rgba(48, 209, 88, 0.15);
            --accent-red: #FF453A;
            --accent-red-glow: rgba(255, 69, 58, 0.15);
            --accent-blue: #0A84FF;
            
            --border-glass: rgba(255, 255, 255, 0.08);
            --border-highlight: rgba(255, 255, 255, 0.15);
            
            --radius-bento: 24px;
            --spring-snappy: 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .result-viewport {
            min-height: 100dvh;
            background-color: var(--bg-abyss);
            color: var(--text-pure);
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif;
            
            /* STRICT MOBILE SAFE ZONES */
            padding: 8.5rem 1.5rem 6.5rem 1.5rem !important;
            box-sizing: border-box;
            overflow-x: hidden;
            width: 100%;
        }

        .result-container {
            max-width: 900px;
            margin: 0 auto;
            position: relative;
            z-index: 10;
        }

        /* -------------------------------------------
           HERO: TYPOGRAPHY & PROGRESS LINE
           ------------------------------------------- */
        .hero-section {
            margin-bottom: 3rem;
            animation: slideUpFade 0.6s ease-out both;
        }

        .hero-badge {
            display: inline-flex; align-items: center; gap: 8px;
            padding: 6px 14px; border-radius: 50px;
            font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px;
            background: rgba(255,255,255,0.05); border: 1px solid var(--border-glass);
            color: var(--text-muted); margin-bottom: 1.5rem;
        }

        .massive-score-row {
            display: flex; align-items: baseline; gap: 0.5rem;
            margin-bottom: 1rem; line-height: 1;
        }

        .massive-score {
            font-size: clamp(5rem, 15vw, 8rem);
            font-weight: 800; letter-spacing: -0.04em;
            background: linear-gradient(180deg, #FFFFFF 0%, rgba(255,255,255,0.6) 100%);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            font-variant-numeric: tabular-nums;
        }

        .score-symbol { font-size: clamp(2.5rem, 6vw, 4rem); font-weight: 700; color: var(--text-muted); }

        .status-headline {
            font-size: clamp(1.5rem, 4vw, 2.5rem); font-weight: 800; letter-spacing: -0.02em;
            margin: 0 0 2.5rem 0;
        }
        .status-pass { color: var(--accent-green); }
        .status-fail { color: var(--accent-red); }

        /* LINEAR PROGRESS TRACK */
        .linear-track-container { width: 100%; margin-bottom: 3rem; }
        .linear-track {
            width: 100%; height: 8px; background: rgba(255,255,255,0.05);
            border-radius: 8px; position: relative; overflow: hidden;
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.5);
        }
        .linear-fill {
            position: absolute; top: 0; left: 0; height: 100%; width: 0%;
            border-radius: 8px; transition: width 1.5s var(--spring-snappy) 0.3s;
            box-shadow: 0 0 20px currentColor;
        }
        .linear-fill.pass { background: var(--accent-green); color: var(--accent-green); }
        .linear-fill.fail { background: var(--accent-red); color: var(--accent-red); }
        
        .track-labels { display: flex; justify-content: space-between; margin-top: 12px; font-size: 0.85rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; }

        /* -------------------------------------------
           BENTO GRID METRICS
           ------------------------------------------- */
        .bento-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 1.5rem; margin-bottom: 4rem;
        }

        .bento-card {
            background: var(--panel-bg); border: 1px solid var(--border-glass);
            border-radius: var(--radius-bento); padding: 2rem;
            display: flex; flex-direction: column; justify-content: space-between;
            animation: slideUpFade 0.6s ease-out both;
            transition: transform 0.3s ease, background 0.3s ease;
        }
        .bento-card:hover { background: var(--panel-hover); border-color: var(--border-highlight); transform: translateY(-4px); }

        .bento-label { font-size: 0.85rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 1rem; }
        .bento-value { font-size: 2.5rem; font-weight: 800; color: var(--text-pure); letter-spacing: -0.02em; line-height: 1; }
        .bento-sub { font-size: 0.9rem; color: var(--text-muted); font-weight: 600; margin-top: 8px; }

        /* -------------------------------------------
           CORRECTION MATRIX
           ------------------------------------------- */
        .matrix-title { font-size: 1.5rem; font-weight: 800; margin-bottom: 1.5rem; letter-spacing: -0.02em; }
        
        .correction-row {
            background: rgba(255,255,255,0.03); border: 1px solid var(--border-glass);
            border-radius: 16px; padding: 1.5rem; margin-bottom: 1rem;
            transition: 0.3s ease;
        }
        .correction-row:hover { background: rgba(255,255,255,0.05); border-color: var(--border-highlight); transform: translateX(4px); }

        .q-meta { font-size: 0.75rem; font-weight: 800; color: var(--accent-red); text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 0.5rem; display: block; }
        .q-text { font-size: 1.15rem; font-weight: 600; margin: 0 0 1.5rem 0; line-height: 1.5; color: var(--text-pure); }

        .ans-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .ans-box { padding: 1rem; border-radius: 12px; font-size: 0.95rem; line-height: 1.4; font-weight: 600; }
        .ans-box.wrong { background: var(--accent-red-glow); border: 1px solid rgba(255, 69, 58, 0.2); color: #FF8A84; }
        .ans-box.correct { background: var(--accent-green-glow); border: 1px solid rgba(48, 209, 88, 0.2); color: #84E09E; }
        .ans-label { font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; display: block; opacity: 0.8; color: white; }

        /* -------------------------------------------
           ACTIONS
           ------------------------------------------- */
        .action-dock {
            display: flex; gap: 1rem; margin-top: 3rem;
            animation: slideUpFade 0.6s ease-out both;
            animation-delay: 0.3s;
        }

        .btn {
            padding: 1.1rem 2.5rem; border-radius: 50px; font-weight: 700; font-size: 1rem;
            cursor: pointer; transition: 0.2s; border: none; text-align: center;
            display: inline-flex; align-items: center; justify-content: center; gap: 10px; text-decoration: none;
        }
        .btn:active { transform: scale(0.96); }
        .btn-primary { background: var(--text-pure); color: var(--bg-abyss); box-shadow: 0 5px 15px rgba(255,255,255,0.1); }
        .btn-primary:hover { background: #E4E4E7; transform: translateY(-2px); box-shadow: 0 10px 25px rgba(255,255,255,0.2); }
        .btn-ghost { background: rgba(255,255,255,0.05); color: var(--text-pure); border: 1px solid var(--border-glass); }
        .btn-ghost:hover { background: rgba(255,255,255,0.1); transform: translateY(-2px); }

        @keyframes slideUpFade { 
            from { opacity: 0; transform: translateY(20px); } 
            to { opacity: 1; transform: translateY(0); } 
        }

        #confettiCanvas { position: fixed; inset: 0; pointer-events: none; z-index: 9999; display: none; }

        /* MOBILE RESPONSIVENESS */
        @media (max-width: 768px) {
            .ans-grid { grid-template-columns: 1fr; }
            .action-dock { flex-direction: column; width: 100%; gap: 1rem; }
            .btn { width: 100%; box-sizing: border-box; }
        }
      </style>

      <canvas id="confettiCanvas"></canvas>

      <div class="result-viewport">
          <div class="result-container" id="resultContent">
               </div>
      </div>
    `;
  }

  async mount() {
      const chapterData = Store.get('tempQuizResult');
      const mockData = Store.get('mockResult');

      if (this.examType === 'mock' && mockData) {
          this.resultData = mockData;
      } else if (chapterData) {
          this.resultData = chapterData;
          
          const user = Store.get('user');
          const moduleId = this.params?.queryParams?.module;
          const chapterId = this.params?.queryParams?.chapter;
          if (user && moduleId && chapterId) {
              await ProgressService.saveQuizResult(user.uid, moduleId, chapterId, this.resultData);
          }
      } else {
          console.warn("[QuizResultView] Critical: No result data. Forcing redirect.");
          return Router.navigateTo('./dashboard');
      }

      await this.calculateNextObjective();
      this.renderReality();

      const finalPercent = this.resultData.percentage !== undefined ? this.resultData.percentage : this.resultData.score;
      if (finalPercent === 100) {
          setTimeout(() => this.triggerConfetti(), 600);
      }
  }

  async calculateNextObjective() {
      if (this.examType === 'mock') return; 

      const moduleId = this.params?.queryParams?.module;
      const chapterId = this.params?.queryParams?.chapter;
      const profile = Store.get('profile') || {};
      const cert = profile.certificate || 'A';
      const wing = profile.wing || 'army';

      if (moduleId && chapterId) {
          try {
              const modules = await ContentService.getModules(cert, wing);
              const modIndex = modules.findIndex(m => m.id === moduleId);
              
              if (modIndex !== -1) {
                  const chapters = await ContentService.getChapters(cert, moduleId);
                  chapters.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

                  const chapIndex = chapters.findIndex(c => c.id === chapterId);

                  if (chapIndex !== -1 && chapIndex < chapters.length - 1) {
                      const nextChap = chapters[chapIndex + 1];
                      this.nextRoute = `./chapter?module=${moduleId}&chapter=${nextChap.id}`;
                      this.nextText = 'Proceed to Next Chapter';
                  } else if (modIndex < modules.length - 1) {
                      const nextMod = modules[modIndex + 1];
                      const nextModChapters = await ContentService.getChapters(cert, nextMod.id);
                      nextModChapters.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
                      
                      if (nextModChapters.length > 0) {
                          this.nextRoute = `./chapter?module=${nextMod.id}&chapter=${nextModChapters[0].id}`;
                          this.nextText = 'Proceed to Next Module';
                      }
                  } else {
                      this.nextRoute = './dashboard';
                      this.nextText = 'Curriculum Complete - Return Home';
                  }
              }
          } catch (e) {
              console.warn("Failed to determine next chapter sequence.", e);
          }
      }
  }

  renderReality() {
      const contentDiv = document.getElementById('resultContent');
      
      const scorePercent = this.resultData.percentage !== undefined ? this.resultData.percentage : this.resultData.score;
      const rawCorrect = this.resultData.correct || this.resultData.score; 
      const totalQs = this.resultData.total || this.resultData.questions?.length || 0;
      
      const isPass = scorePercent >= 50;
      const isPerfect = scorePercent === 100;
      const themeClass = isPerfect || isPass ? 'pass' : 'fail';
      const statusText = isPerfect ? 'Perfect Execution.' : (isPass ? 'Clearance Granted.' : 'Clearance Denied.');

      const badgeText = this.examType === 'mock' ? 'Simulation Results' : 'Mission Assessment';
      
      const incorrectCount = totalQs - rawCorrect;
      const avgTime = this.resultData.avgTime ? `${this.resultData.avgTime}s` : 'N/A';
      const retryRoute = `./quiz?module=${this.params?.queryParams?.module || ''}&chapter=${this.params?.queryParams?.chapter || ''}`;

      let html = `
          <div class="hero-section">
              <div class="hero-badge">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                  ${badgeText}
              </div>
              
              <div class="massive-score-row">
                  <div class="massive-score">${scorePercent}</div>
                  <div class="score-symbol">%</div>
              </div>
              
              <h2 class="status-headline status-${themeClass}">${statusText}</h2>

              <div class="linear-track-container">
                  <div class="linear-track">
                      <div class="linear-fill ${themeClass}" id="mainProgressLine" style="width: 0%;"></div>
                  </div>
                  <div class="track-labels">
                      <span>0%</span>
                      <span>${rawCorrect} of ${totalQs} Correct</span>
                      <span>100%</span>
                  </div>
              </div>
          </div>
      `;

      html += `
          <div class="bento-grid">
              <div class="bento-card" style="animation-delay: 0.1s;">
                  <div class="bento-label">Accuracy Target</div>
                  <div class="bento-value">${rawCorrect}</div>
                  <div class="bento-sub">Correct Answers</div>
              </div>
              <div class="bento-card" style="animation-delay: 0.15s;">
                  <div class="bento-label">Deficit</div>
                  <div class="bento-value" style="color: ${incorrectCount > 0 ? 'var(--accent-red)' : 'var(--text-pure)'}">${incorrectCount}</div>
                  <div class="bento-sub">Incorrect Answers</div>
              </div>
              <div class="bento-card" style="animation-delay: 0.2s;">
                  <div class="bento-label">Velocity</div>
                  <div class="bento-value">${avgTime}</div>
                  <div class="bento-sub">Avg. Time Per Question</div>
              </div>
          </div>
      `;

      if (!isPerfect && this.resultData.questions && this.resultData.userAnswers) {
          html += `<h3 class="matrix-title">Correction Matrix</h3>`;
          
          this.resultData.questions.forEach((q, idx) => {
              const uAns = this.resultData.userAnswers[idx];
              const cAns = q.correct;
              const isCorrect = uAns === cAns;
              
              if (isCorrect) return; 

              const uText = uAns !== undefined && uAns !== null ? q.options[uAns] : 'Omitted';
              const cText = q.options[cAns];

              html += `
                  <div class="correction-row">
                      <span class="q-meta">Q${idx + 1} Error</span>
                      <p class="q-text">${q.text}</p>
                      
                      <div class="ans-grid">
                          <div class="ans-box wrong">
                              <span class="ans-label">Your Selection</span>
                              ${uText}
                          </div>
                          <div class="ans-box correct">
                              <span class="ans-label">Correct Protocol</span>
                              ${cText}
                          </div>
                      </div>
                  </div>
              `;
          });
      } else if (!isPerfect && this.resultData.failedTexts && this.resultData.failedTexts.length > 0) {
          html += `<h3 class="matrix-title">Areas for Improvement</h3>`;
          this.resultData.failedTexts.forEach((text, idx) => {
               html += `
                  <div class="correction-row">
                      <span class="q-meta">Missed Concept</span>
                      <p class="q-text" style="margin:0;">${text}</p>
                  </div>
              `;
          });
      }

      html += `
          <div class="action-dock">
              <a href="${this.nextRoute}" class="btn btn-primary" data-nav>${this.nextText}</a>
              ${!isPass && this.examType !== 'mock' ? `<a href="${retryRoute}" class="btn btn-ghost" data-nav>Re-Attempt Protocol</a>` : ''}
          </div>
      `;

      contentDiv.innerHTML = html;
      this.bindEvents();
      
      setTimeout(() => {
          const track = document.getElementById('mainProgressLine');
          if (track) track.style.width = `${scorePercent}%`;
      }, 100);
  }

  bindEvents() {
      window.Router = Router; 
      document.querySelectorAll('[data-nav]').forEach(link => {
          link.onclick = (e) => {
              e.preventDefault();
              Router.navigateTo(link.getAttribute('href'));
          };
      });
  }

  triggerConfetti() {
      const canvas = document.getElementById('confettiCanvas');
      if (!canvas) return;
      canvas.style.display = 'block';
      const ctx = canvas.getContext('2d');
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const pieces = [];
      const colors = ['#30D158', '#34D399', '#6EE7B7', '#FFFFFF', '#0A84FF'];

      for (let i = 0; i < 100; i++) {
          pieces.push({
              x: canvas.width / 2,
              y: canvas.height * 0.3, 
              vx: (Math.random() - 0.5) * 20,
              vy: (Math.random() - 1) * 15 - 5,
              size: Math.random() * 8 + 4,
              color: colors[Math.floor(Math.random() * colors.length)],
              rotation: Math.random() * 360,
              rotationSpeed: (Math.random() - 0.5) * 15
          });
      }

      const animate = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          let active = false;

          pieces.forEach(p => {
              p.x += p.vx;
              p.y += p.vy;
              p.vy += 0.3; 
              p.rotation += p.rotationSpeed;

              if (p.y < canvas.height) active = true;

              ctx.save();
              ctx.translate(p.x, p.y);
              ctx.rotate((p.rotation * Math.PI) / 180);
              ctx.fillStyle = p.color;
              ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
              ctx.restore();
          });

          if (active) requestAnimationFrame(animate);
          else canvas.style.display = 'none'; 
      };

      animate();
  }
}
