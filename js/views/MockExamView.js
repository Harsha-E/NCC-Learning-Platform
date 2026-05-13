import AbstractView from '../core/AbstractView.js';
import Store from '../core/store.js';
import ContentService from '../services/content.service.js';
import Router from '../core/router.js';

export default class MockExamView extends AbstractView {
  constructor(params) {
    super(params);
    this.questions = [];
    this.userAnswers = {};
    this.markedForReview = new Set();
    this.currentIdx = 0;
    this.timerInterval = null;
    this.timeRemaining = 60 * 30; 
    this.isSubmitted = false;
  }

  async getHtml() {
    return `
      <style>
        .exam-layout { display: flex; flex-direction: column; height: 100dvh; background: #000; color: white; font-family: 'Inter', sans-serif; overflow: hidden; }
        
        .exam-header { 
            background: #0F172A; padding: 1rem 1.5rem; display: flex; justify-content: space-between; align-items: center;
            border-bottom: 1px solid rgba(255,255,255,0.1); flex-shrink: 0;
        }

        .timer-box { font-family: monospace; font-size: 1.5rem; font-weight: 800; color: #EF4444; background: rgba(239, 68, 68, 0.1); padding: 0.5rem 1rem; border-radius: 8px; }

        .exam-body { flex: 1; display: flex; overflow: hidden; }

        /* Main Question Space */
        .q-canvas { flex: 1; overflow-y: auto; padding: 2rem; position: relative; }
        .q-card { max-width: 700px; margin: 0 auto; background: #111827; border-radius: 20px; padding: 2.5rem; border: 1px solid rgba(255,255,255,0.05); }
        .q-text { font-size: 1.3rem; font-weight: 600; line-height: 1.5; margin-bottom: 2rem; }
        
        .opt-btn { 
            width: 100%; text-align: left; padding: 1.2rem; margin-bottom: 0.75rem; border-radius: 12px; 
            background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); color: #94A3B8;
            cursor: pointer; transition: 0.2s; font-size: 1rem; display: flex; align-items: center; gap: 15px;
        }
        .opt-btn:hover { background: rgba(255,255,255,0.08); color: white; }
        .opt-btn.selected { background: #0A84FF; border-color: #0A84FF; color: white; font-weight: 700; }

        /* TACTICAL PALETTE SIDEBAR */
        .q-palette { 
            width: 320px; background: #0F172A; border-left: 1px solid rgba(255,255,255,0.1); 
            padding: 1.5rem; display: flex; flex-direction: column; overflow-y: auto;
        }
        .palette-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
        .pal-node { 
            aspect-ratio: 1; border-radius: 8px; display: flex; align-items: center; justify-content: center;
            font-size: 0.85rem; font-weight: 700; cursor: pointer; border: 1px solid rgba(255,255,255,0.1);
            background: rgba(255,255,255,0.02); color: #475569; transition: 0.2s;
        }
        .pal-node.active { border: 2px solid #0A84FF; color: #0A84FF; }
        .pal-node.answered { background: #30D158; color: #000; border-color: #30D158; }
        .pal-node.review { border-color: #FF9933; color: #FF9933; background: rgba(255, 153, 51, 0.1); }

        .exam-footer { 
            background: #0F172A; padding: 1.5rem; display: flex; justify-content: center; gap: 1rem; 
            border-top: 1px solid rgba(255,255,255,0.1); flex-shrink: 0;
        }
        .btn-nav { padding: 0.8rem 1.8rem; border-radius: 50px; border: none; font-weight: 700; cursor: pointer; }
        .btn-mark { background: rgba(255, 153, 51, 0.1); color: #FF9933; border: 1px solid rgba(255, 153, 51, 0.3); }

        @media (max-width: 768px) {
            .exam-body { flex-direction: column; }
            .q-palette { width: 100%; height: 180px; border-left: none; border-top: 1px solid rgba(255,255,255,0.1); }
            .palette-grid { grid-template-columns: repeat(10, 1fr); }
        }
      </style>

      <div class="exam-layout">
          <div class="exam-header">
              <div><h2 style="margin:0; font-size:1.1rem;">MOCK SIMULATION</h2><span style="color:#64748B; font-size:0.75rem;">STRICT EVALUATION ACTIVE</span></div>
              <div class="timer-box" id="timerDisplay">30:00</div>
          </div>

          <div class="exam-body">
              <div class="q-canvas" id="qCanvas">
                  <div id="questionContainer"></div>
              </div>

              <div class="q-palette">
                  <div style="font-size:0.75rem; font-weight:800; color:#64748B; margin-bottom:1rem; text-transform:uppercase;">Question Matrix</div>
                  <div class="palette-grid" id="paletteContainer"></div>
              </div>
          </div>

          <div class="exam-footer">
              <button class="btn-nav" id="btnPrev" style="background:#1E293B; color:white;">Previous</button>
              <button class="btn-nav btn-mark" id="btnMark">Mark Review</button>
              <button class="btn-nav" id="btnNext" style="background:#0A84FF; color:white;">Next Question</button>
              <button class="btn-nav" id="btnSubmit" style="background:#30D158; color:black; display:none;">Finish Exam</button>
          </div>
      </div>
    `;
  }

  async mount() {
      const profile = Store.get('profile');
      if (!profile) return Router.navigateTo('/login');

      try {
          await this.loadExamPool(profile.certificate, profile.wing);
          this.startTimer();
          this.renderQuestion();
          this.renderPalette();
          this.bindControls();
      } catch (e) {
          console.error("Exam mount failed:", e);
      }
  }

  async loadExamPool(cert, wing) {
      const modules = await ContentService.getModules(cert, wing);
      let pool = [];
      for (const mod of modules) {
          const chapters = await ContentService.getChapters(cert, mod.id);
          for (const chap of chapters) {
              const chapData = await ContentService.getChapter(cert, mod.id, chap.id);
              if (chapData?.assessmentData) {
                  chapData.assessmentData.forEach(q => {
                      if (q.type === 'mcq') pool.push({...q, modTitle: mod.title});
                  });
              }
          }
      }
      this.questions = pool.sort(() => 0.5 - Math.random()).slice(0, 75);
  }

  renderQuestion() {
      const q = this.questions[this.currentIdx];
      const container = document.getElementById('questionContainer');
      const selected = this.userAnswers[this.currentIdx];

      let opts = q.options.map((opt, i) => `
          <button class="opt-btn ${selected === i ? 'selected' : ''}" data-opt="${i}">
              <span style="opacity:0.5; width:25px;">${String.fromCharCode(65+i)}.</span> ${opt}
          </button>
      `).join('');

      container.innerHTML = `
          <div class="q-card">
              <div style="color:#0A84FF; font-weight:800; font-size:0.8rem; margin-bottom:1rem;">QUESTION ${this.currentIdx + 1} // ${q.modTitle}</div>
              <div class="q-text">${q.text}</div>
              <div class="opt-grid">${opts}</div>
          </div>
      `;

      container.querySelectorAll('.opt-btn').forEach(btn => {
          btn.onclick = () => {
              this.userAnswers[this.currentIdx] = parseInt(btn.dataset.opt);
              this.renderQuestion();
              this.renderPalette();
          };
      });

      this.updateFooter();
  }

  renderPalette() {
      const container = document.getElementById('paletteContainer');
      container.innerHTML = this.questions.map((_, i) => {
          let cls = 'pal-node';
          if (i === this.currentIdx) cls += ' active';
          if (this.userAnswers[i] !== undefined) cls += ' answered';
          if (this.markedForReview.has(i)) cls += ' review';
          return `<div class="${cls}" data-idx="${i}">${i + 1}</div>`;
      }).join('');

      container.querySelectorAll('.pal-node').forEach(node => {
          node.onclick = () => {
              this.currentIdx = parseInt(node.dataset.idx);
              this.renderQuestion();
              this.renderPalette();
          };
      });
  }

  bindControls() {
      document.getElementById('btnPrev').onclick = () => { if(this.currentIdx > 0) this.currentIdx--; this.renderQuestion(); this.renderPalette(); };
      document.getElementById('btnNext').onclick = () => { if(this.currentIdx < this.questions.length - 1) this.currentIdx++; this.renderQuestion(); this.renderPalette(); };
      document.getElementById('btnMark').onclick = () => {
          this.markedForReview.has(this.currentIdx) ? this.markedForReview.delete(this.currentIdx) : this.markedForReview.add(this.currentIdx);
          this.renderPalette();
      };
      document.getElementById('btnSubmit').onclick = () => this.concludeExam();
  }

  updateFooter() {
      const isLast = this.currentIdx === this.questions.length - 1;
      document.getElementById('btnNext').style.display = isLast ? 'none' : 'block';
      document.getElementById('btnSubmit').style.display = isLast ? 'block' : 'none';
      document.getElementById('btnPrev').disabled = this.currentIdx === 0;
  }

  startTimer() {
      this.timerInterval = setInterval(() => {
          this.timeRemaining--;
          const m = Math.floor(this.timeRemaining / 60).toString().padStart(2,'0');
          const s = (this.timeRemaining % 60).toString().padStart(2,'0');
          document.getElementById('timerDisplay').textContent = `${m}:${s}`;
          if (this.timeRemaining <= 0) this.concludeExam();
      }, 1000);
  }

  async concludeExam() {
      if (this.isSubmitted) return;
      this.isSubmitted = true;
      clearInterval(this.timerInterval);
      
      let score = 0;
      this.questions.forEach((q, i) => { if(this.userAnswers[i] === q.correct) score++; });
      
      Store.set('mockResult', { 
          score, 
          total: this.questions.length, 
          percentage: Math.round((score/this.questions.length)*100) 
      });
      Router.navigateTo('/results?type=mock');
  }

  async destroy() { clearInterval(this.timerInterval); }
}