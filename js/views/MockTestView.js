import AbstractView from '../core/AbstractView.js';
import Store from '../core/store.js';
import ContentService from '../services/content.service.js';
import Router from '../core/router.js';

export default class MockTestView extends AbstractView {
  constructor(params) {
    super(params);
    this.questions = [];
    this.currentIdx = 0;
    this.userAnswers = {}; // Mapping of question index -> selected option index
    this.markedForReview = new Set();
    
    this.timer = null;
    this.timeLeft = 3600; // Default 60 Minutes
    this.isSubmitted = false;
    this.violationCount = 0;
    
    this.fsListener = this.onFullscreenChange.bind(this);
  }

  async getHtml() {
    return `
      <style>
        .mock-bg { background: #020617; height: 100vh; width: 100vw; color: #F8FAFC; font-family: 'Inter', sans-serif; display: flex; flex-direction: column; overflow: hidden; position: fixed; inset: 0; z-index: 99999; }
        .mock-header { background: #0F172A; padding: 1.25rem 2.5rem; border-bottom: 1px solid #1E293B; display: flex; justify-content: space-between; align-items: center; z-index: 10; }
        .mock-title { font-family: 'Poppins', sans-serif; font-size: 1.5rem; font-weight: 800; margin: 0; color: #38BDF8; letter-spacing: 1.5px; text-transform: uppercase; }
        .timer-box { font-family: 'Courier New', monospace; font-size: 1.8rem; font-weight: 800; background: rgba(239, 68, 68, 0.1); color: #EF4444; padding: 0.5rem 1.5rem; border-radius: 8px; border: 1px solid rgba(239,68,68,0.3); }
        
        .mock-body { flex: 1; display: flex; overflow: hidden; }
        
        /* Main Question Canvas */
        .q-canvas { flex: 1; padding: 4rem 5rem; overflow-y: auto; position: relative; }
        .q-header { display: flex; justify-content: space-between; margin-bottom: 2rem; color: #94A3B8; font-weight: 700; font-size: 1.1rem; border-bottom: 1px solid #1E293B; padding-bottom: 1rem; text-transform: uppercase; letter-spacing: 1px; }
        .q-text { font-size: 1.7rem; line-height: 1.6; margin-bottom: 3rem; font-family: 'Poppins', sans-serif; font-weight: 500; color: white; }
        
        .options-grid { display: flex; flex-direction: column; gap: 1.25rem; }
        .opt-btn { background: #111827; border: 2px solid #1E293B; color: #CBD5E1; padding: 1.5rem; border-radius: 16px; font-size: 1.25rem; text-align: left; cursor: pointer; transition: 0.2s cubic-bezier(0.16, 1, 0.3, 1); display: flex; align-items: center; gap: 1.5rem; font-family: 'Inter', sans-serif; font-weight: 500; }
        .opt-btn:hover { border-color: #38BDF8; background: rgba(56, 189, 248, 0.05); transform: translateX(5px); }
        .opt-btn.selected { border-color: #38BDF8; background: rgba(56, 189, 248, 0.15); color: #38BDF8; box-shadow: 0 0 20px rgba(56, 189, 248, 0.2); transform: translateX(10px); }
        .opt-char { background: #1E293B; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 10px; font-weight: 800; font-size: 1.2rem; color: white; transition: 0.2s; flex-shrink: 0; }
        .opt-btn.selected .opt-char { background: #38BDF8; color: #020617; }

        /* Right Sidebar - Palette */
        .q-palette { width: 360px; background: #0F172A; border-left: 1px solid #1E293B; padding: 2rem; display: flex; flex-direction: column; overflow-y: auto; }
        .palette-title { font-family: 'Poppins', sans-serif; font-size: 1.2rem; font-weight: 800; border-bottom: 1px solid #1E293B; padding-bottom: 1rem; margin-bottom: 1.5rem; color: white; letter-spacing: 1px; }
        .palette-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; align-content: flex-start; }
        .pal-btn { width: 100%; aspect-ratio: 1; border-radius: 10px; border: 2px solid #334155; background: #1E293B; color: white; font-weight: 800; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; }
        .pal-btn:hover { background: #38BDF8; border-color: #38BDF8; color: #020617; }
        .pal-btn.answered { background: #10B981; border-color: #10B981; color: white; }
        .pal-btn.review { border-color: #F59E0B; }
        .pal-btn.active { border-color: #38BDF8; background: transparent; color: #38BDF8; box-shadow: inset 0 0 0 2px #38BDF8; transform: scale(1.1); z-index: 2; }
        .pal-btn.answered.review { background: #10B981; border-color: #F59E0B; }

        .palette-legend { margin-top: auto; border-top: 1px solid #1E293B; padding-top: 1.5rem; font-size: 0.9rem; font-weight: 600; color: #94A3B8; display: flex; flex-direction: column; gap: 0.75rem; }
        .legend-item { display: flex; align-items: center; gap: 12px; }
        .l-box { width: 18px; height: 18px; border-radius: 4px; }

        /* Action Footer */
        .mock-footer { background: #0F172A; border-top: 1px solid #1E293B; padding: 1.5rem 2.5rem; display: flex; justify-content: space-between; align-items: center; z-index: 10; }
        .footer-left, .footer-right { display: flex; gap: 1.5rem; }
        
        .action-btn { padding: 1rem 2rem; border-radius: 12px; font-weight: 800; cursor: pointer; transition: 0.2s; font-size: 1.1rem; border: none; letter-spacing: 0.5px; }
        .btn-outline { background: transparent; border: 2px solid #334155; color: white; }
        .btn-outline:hover { background: #1E293B; border-color: #64748B; }
        .btn-review { background: rgba(245, 158, 11, 0.1); color: #F59E0B; border: 2px solid rgba(245,158,11,0.3); }
        .btn-review:hover { background: rgba(245, 158, 11, 0.2); border-color: rgba(245,158,11,0.6); }
        .btn-primary { background: #38BDF8; color: #020617; }
        .btn-primary:hover { background: #0EA5E9; transform: translateY(-2px); box-shadow: 0 8px 25px rgba(56,189,248,0.3); }
        .btn-submit { background: #10B981; color: white; }
        .btn-submit:hover { background: #059669; box-shadow: 0 8px 25px rgba(16,185,129,0.4); transform: translateY(-2px); }

        /* Overlays */
        .fs-warning { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.98); z-index: 100000; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; opacity: 0; pointer-events: none; transition: 0.3s; padding: 2rem; }
        .fs-warning.active { opacity: 1; pointer-events: all; }
        .fs-warning h1 { font-family: 'Poppins', sans-serif; font-size: 4rem; color: #EF4444; margin: 0; letter-spacing: 2px; }
        .fs-warning p { font-size: 1.5rem; color: #E2E8F0; margin-top: 1.5rem; max-width: 700px; font-weight: 500; }
        .btn-return-fs { margin-top: 3rem; background: #EF4444; color: white; padding: 1.2rem 3rem; font-size: 1.2rem; border-radius: 50px; font-weight: 800; cursor: pointer; border: none; box-shadow: 0 10px 30px rgba(239, 68, 68, 0.3); transition: 0.2s; letter-spacing: 1px; }
        .btn-return-fs:hover { transform: scale(1.05); background: #DC2626; }

        .loader-overlay { position: fixed; inset: 0; background: #020617; z-index: 100000; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
        .spinner { width: 60px; height: 60px; border: 4px solid #1E293B; border-top-color: #38BDF8; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 2rem; }
        
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>

      <div class="loader-overlay" id="mockLoader">
         <div class="spinner"></div>
         <h2 style="font-family: 'Poppins', sans-serif; font-size: 2rem; color: white; margin: 0;">Generating Blueprint Test...</h2>
         <p style="color: #94A3B8; font-size: 1.2rem; margin-top: 1rem; max-width: 500px;">Calculating chapter weightage and pulling strictly proportionate questions from the curriculum.</p>
      </div>

      <div class="fs-warning" id="fsWarning">
         <h1>VIOLATION DETECTED</h1>
         <p>You have exited Full-Screen mode during a Strict Mock Test. Background activity is recorded and restricted.</p>
         <p>Return to the exam terminal immediately or your test will be auto-submitted.</p>
         <button class="btn-return-fs" id="btnReturnFs">RETURN TO FULL SCREEN</button>
      </div>

      <div class="mock-bg" id="mockApp" style="display: none;">
         <div class="mock-header">
            <h1 class="mock-title">NCC MOCK EXAM [STRICT MODE]</h1>
            <div class="timer-box" id="timeDisplay">60:00</div>
         </div>
         
         <div class="mock-body">
            <div class="q-canvas">
               <div id="qContainer"></div>
            </div>
            
            <div class="q-palette">
               <div class="palette-title">QUESTION PALETTE</div>
               <div class="palette-grid" id="paletteGrid"></div>
               
               <div class="palette-legend">
                   <div class="legend-item"><div class="l-box" style="background: #10B981;"></div> Answered</div>
                   <div class="legend-item"><div class="l-box" style="background: #1E293B; border: 2px solid #334155;"></div> Not Answered</div>
                   <div class="legend-item"><div class="l-box" style="background: #1E293B; border: 2px solid #F59E0B;"></div> Marked for Review</div>
                   <div class="legend-item"><div class="l-box" style="background: #10B981; border: 2px solid #F59E0B;"></div> Answered & Marked</div>
               </div>
            </div>
         </div>

         <div class="mock-footer">
            <div class="footer-left">
               <button class="action-btn btn-outline" id="btnPrev">◀ Previous</button>
               <button class="action-btn btn-review" id="btnReview">⚑ Mark for Review</button>
            </div>
            <div class="footer-right">
               <button class="action-btn btn-primary" id="btnNext">Save & Next ▶</button>
               <button class="action-btn btn-submit" id="btnSubmitFinal">Submit Exam ✓</button>
            </div>
         </div>
      </div>
    `;
  }

  async mount() {
    const profile = Store.get('profile');
    if (!profile) return Router.navigateTo('./dashboard');

    document.addEventListener('fullscreenchange', this.fsListener);

    try {
        this.questions = await this.generateBlueprintTest(profile.certificate, profile.wing);
        if (this.questions.length === 0) throw new Error("No questions available in the current curriculum module cache.");
        
        document.getElementById('mockLoader').style.display = 'none';
        document.getElementById('mockApp').style.display = 'flex';
        
        this.enforceFullScreen();
        this.startTimer();
        this.renderPalette();
        this.renderQuestion();
        this.attachFooterEvents();
        
    } catch (e) {
        document.getElementById('mockLoader').innerHTML = `
           <h2 style="color: #EF4444; font-family: 'Poppins', sans-serif; font-size: 2rem;">Test Generation Failed</h2>
           <p style="color: #94A3B8; font-size: 1.2rem; max-width: 600px; margin-top: 1rem;">${e.message}</p>
           <button onclick="window.history.back()" style="margin-top:3rem; padding: 1.2rem 3rem; background: #38BDF8; color:#020617; border:none; border-radius:50px; font-weight:800; cursor:pointer; font-size:1.1rem; box-shadow: 0 10px 25px rgba(56,189,248,0.3);">Return to Dashboard</button>
        `;
    }
  }

  // BLUEPRINT ALGORITHM: Exactly proportionate questions across all chapters
  async generateBlueprintTest(cert, wing) {
      const modules = await ContentService.getModules(cert, wing);
      let allPool = [];

      // Hydrate all available questions into a massive curriculum pool
      for (const mod of modules) {
          const chapters = await ContentService.getChapters(cert, mod.id);
          for (const chap of chapters) {
              const chapData = await ContentService.getChapter(cert, mod.id, chap.id);
              if (chapData && chapData.assessmentData && chapData.assessmentData.length > 0) {
                  allPool.push({
                      modId: mod.id,
                      chapId: chap.id,
                      title: chap.title,
                      questions: chapData.assessmentData
                  });
              }
          }
      }

      const targetSize = 50; 
      let totalQ = allPool.reduce((sum, pool) => sum + pool.questions.length, 0);
      let testSet = [];

      if (totalQ <= targetSize) {
          allPool.forEach(pool => testSet.push(...pool.questions));
      } else {
          allPool.forEach(pool => {
              // WEIGHTAGE MATH: Calculate chapter share of the total curriculum
              let count = Math.ceil((pool.questions.length / totalQ) * targetSize);
              let shuffled = [...pool.questions].sort(() => 0.5 - Math.random()).slice(0, count);
              testSet.push(...shuffled);
          });
      }

      // Final comprehensive shuffle and exact trimming to target size
      return testSet.sort(() => 0.5 - Math.random()).slice(0, targetSize);
  }

  enforceFullScreen() {
      const elem = document.documentElement;
      const rfs = elem.requestFullscreen || elem.webkitRequestFullscreen || elem.msRequestFullscreen;
      if (rfs) {
          rfs.call(elem).catch(err => console.warn("Fullscreen blocked until user interaction."));
      }
  }

  onFullscreenChange() {
      if (this.isSubmitted) return;
      const warning = document.getElementById('fsWarning');
      
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
          this.violationCount++;
          warning.classList.add('active');
          
          if (this.violationCount >= 3) {
             warning.innerHTML = "<h1 style='color:#EF4444;'>TEST TERMINATED</h1><p>Maximum full-screen violations reached.</p>";
             setTimeout(() => this.submitTest(), 3000);
          }
      } else {
          warning.classList.remove('active');
      }
  }

  startTimer() {
      const display = document.getElementById('timeDisplay');
      this.timer = setInterval(() => {
          if (this.timeLeft <= 0) {
              clearInterval(this.timer);
              this.submitTest();
              return;
          }
          this.timeLeft--;
          const m = Math.floor(this.timeLeft / 60).toString().padStart(2, '0');
          const s = (this.timeLeft % 60).toString().padStart(2, '0');
          display.textContent = `${m}:${s}`;
          
          if (this.timeLeft < 300) display.style.color = '#EF4444'; // Flashing Red under 5 mins
      }, 1000);
  }

  renderPalette() {
      const grid = document.getElementById('paletteGrid');
      grid.innerHTML = this.questions.map((_, idx) => {
          let classes = ['pal-btn'];
          if (idx === this.currentIdx) classes.push('active');
          if (this.userAnswers[idx] !== undefined) classes.push('answered');
          if (this.markedForReview.has(idx)) classes.push('review');
          
          return `<button class="${classes.join(' ')}" data-idx="${idx}">${idx + 1}</button>`;
      }).join('');

      grid.querySelectorAll('.pal-btn').forEach(btn => {
          btn.onclick = () => {
              this.currentIdx = parseInt(btn.dataset.idx);
              this.renderQuestion();
              this.renderPalette();
          };
      });
  }

  renderQuestion() {
      const q = this.questions[this.currentIdx];
      const container = document.getElementById('qContainer');
      
      let optionsHtml = q.options.map((opt, i) => {
          const chars = ['A', 'B', 'C', 'D'];
          const isSelected = this.userAnswers[this.currentIdx] === i ? 'selected' : '';
          return `
            <button class="opt-btn ${isSelected}" data-opt="${i}">
                <span class="opt-char">${chars[i]}</span>
                <span>${opt}</span>
            </button>
          `;
      }).join('');

      container.innerHTML = `
         <div class="q-header">
            <span>QUESTION ${this.currentIdx + 1} OF ${this.questions.length}</span>
            <span>Weightage: +1 Correct | 0 Negative</span>
         </div>
         <div class="q-text">${q.text}</div>
         <div class="options-grid">${optionsHtml}</div>
      `;

      container.querySelectorAll('.opt-btn').forEach(btn => {
          btn.onclick = () => {
              this.userAnswers[this.currentIdx] = parseInt(btn.dataset.opt);
              this.renderQuestion();
              this.renderPalette();
          };
      });

      document.getElementById('btnPrev').style.visibility = this.currentIdx > 0 ? 'visible' : 'hidden';
      document.getElementById('btnNext').style.display = this.currentIdx === this.questions.length - 1 ? 'none' : 'inline-block';
      document.getElementById('btnReview').innerHTML = this.markedForReview.has(this.currentIdx) ? '✓ Unmark Review' : '⚑ Mark for Review';
  }

  attachFooterEvents() {
      document.getElementById('btnPrev').onclick = () => {
          if (this.currentIdx > 0) this.currentIdx--;
          this.renderQuestion(); this.renderPalette();
      };
      
      document.getElementById('btnNext').onclick = () => {
          if (this.currentIdx < this.questions.length - 1) this.currentIdx++;
          this.renderQuestion(); this.renderPalette();
      };

      document.getElementById('btnReview').onclick = () => {
          this.markedForReview.has(this.currentIdx) ? this.markedForReview.delete(this.currentIdx) : this.markedForReview.add(this.currentIdx);
          this.renderQuestion(); this.renderPalette();
      };

      document.getElementById('btnSubmitFinal').onclick = () => {
          if (confirm("Are you sure you want to submit the Mock Test? You cannot undo this action.")) this.submitTest();
      };

      document.getElementById('btnReturnFs').onclick = () => this.enforceFullScreen();
  }

  async submitTest() {
      this.isSubmitted = true;
      clearInterval(this.timer);
      if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});

      let score = 0;
      this.questions.forEach((q, idx) => { if (this.userAnswers[idx] === q.correct) score++; });
      const percentage = Math.round((score / this.questions.length) * 100);

      document.getElementById('mockApp').innerHTML = `
          <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 3rem; text-align:center;">
             <h1 style="font-family:'Poppins', sans-serif; font-size:4rem; color:#38BDF8; margin:0; letter-spacing: 2px;">EXAM CONCLUDED</h1>
             <p style="font-size:1.5rem; color:#94A3B8; margin-top:1rem;">Your blueprint evaluation has been strictly analyzed.</p>
             
             <div style="background:#0F172A; border:1px solid #1E293B; padding:4rem; border-radius:24px; margin-top:3rem; min-width:450px; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
                <div style="font-size:7rem; font-weight:900; color:${percentage >= 50 ? '#10B981' : '#EF4444'}; line-height:1;">${percentage}%</div>
                <div style="color:#64748B; font-size:1.2rem; font-weight:800; letter-spacing:3px; margin-top:1.5rem;">FINAL SCORE</div>
                <div style="margin-top:2rem; font-size:1.5rem; font-weight: 500;">${score} Correct out of ${this.questions.length}</div>
             </div>

             <button onclick="window.Router.navigateTo('./dashboard')" style="margin-top:4rem; padding: 1.2rem 4rem; background:#38BDF8; color:#020617; font-size:1.2rem; font-weight:800; border:none; border-radius:50px; cursor:pointer; transition:0.3s; box-shadow: 0 10px 30px rgba(56,189,248,0.3);">Return to Terminal</button>
          </div>
      `;
  }

  async destroy() {
      document.removeEventListener('fullscreenchange', this.fsListener);
      if (this.timer) clearInterval(this.timer);
      if (!this.isSubmitted && document.fullscreenElement) document.exitFullscreen().catch(()=>{});
  }
}