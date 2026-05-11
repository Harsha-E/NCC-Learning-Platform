import AbstractView from '../core/AbstractView.js';
import Store from '../core/store.js';
import ContentService from '../services/content.service.js';
import ProgressService from '../services/progress.service.js';
import Router from '../core/router.js';

export default class MockExamView extends AbstractView {
  constructor(params) {
    super(params);
    this.questions = [];
    this.answers = {};
    this.currentIdx = 0;
    this.timerInterval = null;
    this.timeRemaining = 60 * 30; // Default 30 Minutes
    this.isSubmitted = false;
  }

  async getHtml() {
    return `
      <style>
        .exam-layout {
            display: flex; flex-direction: column; height: calc(100vh - 4.5rem);
            background: #020617; color: white; font-family: 'Inter', sans-serif;
            overflow: hidden; position: relative;
        }

        .exam-layout::before {
            content: ""; position: fixed; inset: 0;
            background-image: url('assets/images/tactical-grid-bg.jpg');
            background-size: cover; background-position: center;
            opacity: 0.05; pointer-events: none; z-index: 0;
        }

        /* STRICT EXAM HEADER */
        .exam-header {
            background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(12px);
            border-bottom: 1px solid rgba(239, 68, 68, 0.2);
            padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center;
            z-index: 10; flex-shrink: 0; box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        }

        .exam-title-area h1 { margin: 0; font-family: 'Poppins', sans-serif; font-size: 1.4rem; font-weight: 800; color: white; letter-spacing: -0.5px; }
        .exam-title-area p { margin: 0; font-size: 0.75rem; color: #94A3B8; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; }

        .timer-box {
            background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3);
            color: #EF4444; padding: 0.6rem 1.2rem; border-radius: 8px;
            font-family: 'Courier New', monospace; font-size: 1.5rem; font-weight: 900;
            display: flex; align-items: center; gap: 10px; box-shadow: 0 0 15px rgba(239, 68, 68, 0.2);
            transition: 0.3s;
        }
        .timer-box.warning { background: #EF4444; color: white; animation: pulse 1s infinite; }
        @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); box-shadow: 0 0 20px rgba(239, 68, 68, 0.6); } 100% { transform: scale(1); } }

        /* QUESTION CANVAS */
        .exam-canvas {
            flex: 1; overflow-y: auto; padding: 3rem 1.5rem; position: relative; z-index: 1;
        }

        .question-card {
            max-width: 800px; margin: 0 auto; background: rgba(30, 41, 59, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px;
            padding: 2.5rem; backdrop-filter: blur(10px);
            animation: slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }

        .q-meta { display: flex; justify-content: space-between; margin-bottom: 1.5rem; color: #64748B; font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; }
        .q-source { color: #38BDF8; background: rgba(56, 189, 248, 0.1); padding: 4px 10px; border-radius: 4px; }
        
        .q-text { font-family: 'Poppins', sans-serif; font-size: 1.4rem; line-height: 1.6; margin-bottom: 2rem; color: white; font-weight: 600; }

        .opt-grid { display: flex; flex-direction: column; gap: 1rem; }
        .opt-btn {
            background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.1);
            color: #CBD5E1; padding: 1.2rem 1.5rem; border-radius: 12px;
            font-size: 1.1rem; text-align: left; cursor: pointer; transition: 0.2s;
            display: flex; align-items: center; gap: 15px; font-weight: 500;
        }
        .opt-btn:hover { background: rgba(56, 189, 248, 0.1); border-color: rgba(56, 189, 248, 0.3); color: white; transform: translateX(5px); }
        .opt-btn.selected { background: #38BDF8; color: #020617; border-color: #38BDF8; font-weight: 700; box-shadow: 0 5px 15px rgba(56, 189, 248, 0.4); }

        /* NAVIGATION BAR */
        .exam-footer {
            background: rgba(15, 23, 42, 0.95); border-top: 1px solid rgba(255, 255, 255, 0.05);
            padding: 1.5rem; display: flex; justify-content: center; gap: 1rem; z-index: 10;
        }
        .nav-btn {
            background: #1E293B; color: white; border: none; padding: 0.8rem 2rem;
            border-radius: 50px; font-weight: 700; cursor: pointer; transition: 0.2s; font-size: 1rem;
        }
        .nav-btn:hover:not(:disabled) { background: #334155; }
        .nav-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-submit { background: linear-gradient(135deg, #10B981, #059669); box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3); }
        .btn-submit:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(16, 185, 129, 0.5); }

        /* PROGRESS TRACKER */
        .progress-dots { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; max-width: 600px; margin: 1rem auto 0 auto; padding: 0 2rem; }
        .dot { width: 12px; height: 12px; border-radius: 50%; background: #334155; cursor: pointer; transition: 0.2s; }
        .dot.answered { background: #38BDF8; }
        .dot.active { border: 2px solid white; transform: scale(1.3); }

        .loader-screen { position: absolute; inset: 0; background: #020617; z-index: 999; display: flex; flex-direction: column; align-items: center; justify-content: center; }
      </style>

      <div class="exam-layout">
         <div class="loader-screen" id="examLoader">
            <div style="width:50px; height:50px; border:4px solid #1E293B; border-top-color:#8B5CF6; border-radius:50%; animation:spin 1s linear infinite;"></div>
            <h2 style="margin-top:2rem; font-family:'Poppins'; letter-spacing:4px; color:#94A3B8; font-size:1rem;">COMPILING BLUEPRINT...</h2>
         </div>

         <div class="exam-header">
            <div class="exam-title-area">
                <p>SIMULATION ACTIVE</p>
                <h1>Comprehensive Mock Assessment</h1>
            </div>
            <div class="timer-box" id="timerDisplay">30:00</div>
         </div>

         <div class="exam-canvas">
            <div id="questionContainer"></div>
            <div class="progress-dots" id="dotNav"></div>
         </div>

         <div class="exam-footer">
            <button class="nav-btn" id="btnPrev" disabled>◀ Previous</button>
            <button class="nav-btn" id="btnNext">Next ▶</button>
            <button class="nav-btn btn-submit" id="btnSubmit" style="display:none;">Terminate & Submit</button>
         </div>
      </div>
    `;
  }

  async mount() {
    const profile = Store.get('profile');
    if (!profile) return Router.navigateTo('./login');

    try {
        await this.generateExamFromCache(profile.certificate || 'A', profile.wing);
        document.getElementById('examLoader').style.display = 'none';
        
        if (this.questions.length === 0) {
            document.getElementById('questionContainer').innerHTML = `<h3 style="text-align:center; color:#EF4444;">No assessment data found in curriculum cache.</h3>`;
            return;
        }

        this.startTimer();
        this.renderQuestion();
        this.renderDots();
        this.bindEvents();

    } catch (e) {
        console.error("Blueprint compilation failed:", e);
    }
  }

  // --- THE BLUEPRINT COMPILER (ZERO FIREBASE READS) ---
  async generateExamFromCache(certId, wing, questionCount = 50) {
      const modules = await ContentService.getModules(certId, wing);
      let pool = [];

      for (const mod of modules) {
          const chapters = await ContentService.getChapters(certId, mod.id);
          for (const chap of chapters) {
              const chapData = await ContentService.getChapter(certId, mod.id, chap.id);
              if (chapData && chapData.assessmentData && chapData.assessmentData.length > 0) {
                  chapData.assessmentData.forEach(q => {
                      // Only pull MCQ for standard mock test
                      if (q.type === 'mcq' && q.options && q.options.length === 4) {
                          pool.push({
                              ...q,
                              sourceMod: mod.title,
                              sourceChap: chapData.title
                          });
                      }
                  });
              }
          }
      }

      // Cryptographically pseudo-random shuffle
      pool = pool.sort(() => 0.5 - Math.random());
      
      // Slice to required count (e.g., 50 questions)
      this.questions = pool.slice(0, Math.min(questionCount, pool.length));
  }

  renderQuestion() {
      const q = this.questions[this.currentIdx];
      const container = document.getElementById('questionContainer');
      const savedAns = this.answers[this.currentIdx];

      let optsHtml = q.options.map((opt, i) => `
          <button class="opt-btn ${savedAns === i ? 'selected' : ''}" data-idx="${i}">
              <span style="background:rgba(255,255,255,0.1); width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:0.9rem;">${String.fromCharCode(65 + i)}</span>
              ${opt}
          </button>
      `).join('');

      container.innerHTML = `
          <div class="question-card">
              <div class="q-meta">
                  <span>Question ${this.currentIdx + 1} of ${this.questions.length}</span>
                  <span class="q-source">${q.sourceMod}</span>
              </div>
              <div class="q-text">${q.text}</div>
              <div class="opt-grid">${optsHtml}</div>
          </div>
      `;

      container.querySelectorAll('.opt-btn').forEach(btn => {
          btn.onclick = () => {
              this.answers[this.currentIdx] = parseInt(btn.dataset.idx);
              this.renderQuestion();
              this.renderDots();
          };
      });

      this.updateControls();
  }

  renderDots() {
      const dotContainer = document.getElementById('dotNav');
      dotContainer.innerHTML = this.questions.map((_, i) => `
          <div class="dot ${this.answers[i] !== undefined ? 'answered' : ''} ${i === this.currentIdx ? 'active' : ''}" data-jump="${i}"></div>
      `).join('');

      dotContainer.querySelectorAll('.dot').forEach(dot => {
          dot.onclick = () => {
              this.currentIdx = parseInt(dot.dataset.jump);
              this.renderQuestion();
              this.renderDots();
          };
      });
  }

  updateControls() {
      const btnPrev = document.getElementById('btnPrev');
      const btnNext = document.getElementById('btnNext');
      const btnSubmit = document.getElementById('btnSubmit');

      btnPrev.disabled = this.currentIdx === 0;
      
      if (this.currentIdx === this.questions.length - 1) {
          btnNext.style.display = 'none';
          btnSubmit.style.display = 'block';
      } else {
          btnNext.style.display = 'block';
          btnSubmit.style.display = 'none';
      }
  }

  bindEvents() {
      document.getElementById('btnPrev').onclick = () => { this.currentIdx--; this.renderQuestion(); this.renderDots(); };
      document.getElementById('btnNext').onclick = () => { this.currentIdx++; this.renderQuestion(); this.renderDots(); };
      document.getElementById('btnSubmit').onclick = () => this.submitExam();
  }

  startTimer() {
      const display = document.getElementById('timerDisplay');
      this.timerInterval = setInterval(() => {
          this.timeRemaining--;
          const m = Math.floor(this.timeRemaining / 60).toString().padStart(2, '0');
          const s = (this.timeRemaining % 60).toString().padStart(2, '0');
          display.textContent = `${m}:${s}`;

          if (this.timeRemaining <= 300) display.classList.add('warning'); // Last 5 mins
          if (this.timeRemaining <= 0) {
              clearInterval(this.timerInterval);
              this.submitExam(true); // Auto submit
          }
      }, 1000);
  }

  async submitExam(isAuto = false) {
      if (this.isSubmitted) return;
      if (!isAuto && !confirm("Are you sure you want to submit your assessment?")) return;
      
      this.isSubmitted = true;
      clearInterval(this.timerInterval);
      
      let score = 0;
      this.questions.forEach((q, idx) => {
          if (this.answers[idx] === q.correct) score++;
      });

      const percentage = Math.round((score / this.questions.length) * 100);
      
      // Store in transient state and navigate to results
      Store.set('mockResult', {
          score,
          total: this.questions.length,
          percentage,
          questions: this.questions,
          userAnswers: this.answers
      });

      Router.navigateTo('./results?type=mock');
  }

  async destroy() {
      if (this.timerInterval) clearInterval(this.timerInterval);
  }
}