import AbstractView from '../core/AbstractView.js';
import Store from '../core/store.js';
import ProgressService from '../services/progress.service.js';
import ContentService from '../services/content.service.js';
import Router from '../core/router.js';

export default class QuizView extends AbstractView {
  constructor(params) {
    super(params);
    
    const query = params?.queryParams || {};
    
    this.moduleId = query.module;
    this.chapterId = query.chapter;

    this.state = {
        questions: [],
        currentQIndex: 0,
        answers: {}, 
        timeLimitSeconds: 600, 
        timeRemaining: 600,
        questionTimers: {}
    };
    
    this.timerInterval = null;
    this.lastTimeCheck = Date.now();
    this.sessionKey = `ncc_quiz_state_${this.moduleId}_${this.chapterId}`;
    this.failedBankKey = `ncc_failed_bank_${this.moduleId}_${this.chapterId}`;
    
    // Feature 1: The "Unvisited" tracking key
    this.seenBankKey = `ncc_seen_bank_${this.moduleId}_${this.chapterId}`;
  }

  async getHtml() {
    return `
      <style>
        /* ==========================================================================
           CLEAN & RESPONSIVE ASSESSMENT HUD (APPLE HIG)
           ========================================================================== */
        :root {
            --bg-base: #000000;
            --bg-elevated: #151517;
            --bg-hover: #1C1C1E;
            --text-main: #FFFFFF;
            --text-muted: #8E8E93;
            --accent-blue: #0A84FF;
            --accent-green: #30D158;
            --accent-orange: #FF9F0A;
            --accent-red: #FF453A;
            --border-glass: rgba(255, 255, 255, 0.08);
            --radius-lg: 24px;
            --radius-md: 16px;
        }

        .quiz-viewport {
            min-height: 100dvh;
            background: var(--bg-base);
            color: var(--text-main);
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif;
            
            /* STRICT MOBILE SAFE ZONES */
            padding: 8rem 1.5rem 6.5rem 1.5rem !important;
            box-sizing: border-box;
            
            display: flex;
            gap: 1.5rem;
            max-width: 1200px;
            margin: 0 auto;
        }

        .question-panel {
            flex: 1;
            background: var(--bg-elevated);
            border: 1px solid var(--border-glass);
            border-radius: var(--radius-lg);
            padding: 2.5rem;
            display: flex;
            flex-direction: column;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            position: relative;
        }

        .exam-header {
            display: flex; justify-content: space-between; align-items: center;
            border-bottom: 1px solid var(--border-glass); 
            padding-bottom: 1.5rem; margin-bottom: 2rem;
        }
        .exam-title { font-size: clamp(1.4rem, 3vw, 1.8rem); font-weight: 800; letter-spacing: -0.02em; margin: 0; }
        
        .timer-badge {
            background: rgba(48, 209, 88, 0.1);
            border: 1px solid rgba(48, 209, 88, 0.2);
            padding: 0.5rem 1.25rem; border-radius: 50px;
            font-family: "JetBrains Mono", monospace; font-size: 1.1rem; font-weight: 700;
            color: var(--accent-green); display: flex; align-items: center; gap: 8px;
            transition: 0.3s;
        }
        .timer-badge.warning { 
            color: var(--accent-red); background: rgba(255, 69, 58, 0.1);
            border-color: rgba(255, 69, 58, 0.3); animation: pulseTimer 1s infinite; 
        }
        @keyframes pulseTimer { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }

        /* Floating Chapter Transition Animations */
        #questionContainer {
            flex: 1; display: flex; flex-direction: column;
            transition: opacity 0.3s ease-out, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .question-meta {
            color: var(--text-muted); font-weight: 700; margin-bottom: 1.5rem;
            letter-spacing: 1px; font-size: 0.85rem; text-transform: uppercase;
            display: flex; justify-content: space-between; align-items: center;
        }
        .q-counter { background: rgba(255,255,255,0.05); padding: 6px 14px; border-radius: 50px; border: 1px solid var(--border-glass); color: var(--text-main); }
        .question-category { color: var(--accent-blue); }

        .question-text { font-size: clamp(1.2rem, 3vw, 1.5rem); line-height: 1.5; margin-bottom: 2rem; font-weight: 600; letter-spacing: -0.01em; }

        /* TOUCH-FRIENDLY OPTIONS */
        .options-grid { display: flex; flex-direction: column; gap: 1rem; }
        .option-card {
            background: rgba(255,255,255,0.03); border: 2px solid transparent; border-radius: var(--radius-md);
            padding: 1.25rem; cursor: pointer; display: flex; align-items: center; gap: 1.25rem;
            transition: 0.2s; font-size: 1.1rem; line-height: 1.4;
        }
        .option-card:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); }
        .option-card:active { transform: scale(0.98); }
        .option-card.selected { border-color: var(--accent-blue); background: rgba(10, 132, 255, 0.1); }
        
        .option-letter {
            width: 38px; height: 38px; flex-shrink: 0; border-radius: 10px; background: rgba(255,255,255,0.1);
            display: flex; align-items: center; justify-content: center; font-weight: 700; color: var(--text-muted); transition: 0.2s;
        }
        .option-card.selected .option-letter { background: var(--accent-blue); color: white; }

        .controls-row { margin-top: 3rem; display: flex; justify-content: space-between; }
        .btn-nav {
            padding: 1rem 2rem; border-radius: 50px; font-weight: 700; cursor: pointer; border: none;
            background: rgba(255,255,255,0.08); color: var(--text-main); transition: 0.2s; font-size: 0.95rem;
        }
        .btn-nav:hover:not(:disabled) { background: rgba(255,255,255,0.15); transform: translateY(-2px); }
        .btn-nav:disabled { opacity: 0.3; cursor: not-allowed; transform: none; }

        /* SIDEBAR PANEL */
        .sidebar-panel {
            width: 320px; background: var(--bg-elevated); border: 1px solid var(--border-glass);
            border-radius: var(--radius-lg); display: flex; flex-direction: column;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        .sidebar-header { padding: 1.5rem 2rem; border-bottom: 1px solid var(--border-glass); }
        .sidebar-header h3 { margin: 0; font-size: 1.1rem; font-weight: 700; letter-spacing: -0.01em; }

        .grid-container {
            padding: 2rem; display: grid; grid-template-columns: repeat(4, 1fr);
            gap: 12px; overflow-y: auto; flex: 1; align-content: start;
        }
        .grid-node {
            aspect-ratio: 1; border-radius: 12px; background: rgba(255,255,255,0.05);
            display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.1rem;
            cursor: pointer; color: var(--text-muted); transition: 0.2s; border: 2px solid transparent;
        }
        .grid-node:hover { background: rgba(255,255,255,0.1); color: var(--text-main); }
        .grid-node.answered { background: rgba(48, 209, 88, 0.15); color: var(--accent-green); }
        .grid-node.active { border-color: var(--accent-blue); color: var(--text-main); transform: scale(1.1); box-shadow: 0 5px 15px rgba(10, 132, 255, 0.3); }

        .submit-area { padding: 1.5rem 2rem; border-top: 1px solid var(--border-glass); }
        .btn-submit {
            width: 100%; padding: 1.2rem; border-radius: 50px; border: none; font-weight: 800;
            font-size: 1.05rem; color: #000; background: var(--accent-green); cursor: pointer; 
            transition: 0.2s; text-transform: uppercase; letter-spacing: 1px;
        }
        .btn-submit:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(48, 209, 88, 0.3); }
        .btn-submit:active { transform: scale(0.96); }

        /* MODALS & TOASTS */
        .confirm-modal-overlay {
            position: fixed; inset: 0; background: rgba(0, 0, 0, 0.8); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
            z-index: 99999; display: flex; align-items: center; justify-content: center;
            opacity: 0; pointer-events: none; transition: 0.3s ease;
        }
        .confirm-modal-overlay.active { opacity: 1; pointer-events: all; }
        
        .confirm-modal-card {
            background: #1C1C1E; border: 1px solid var(--border-glass); border-radius: var(--radius-lg);
            padding: 2.5rem; max-width: 400px; width: 90%; text-align: center;
            transform: scale(0.95); transition: 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            box-shadow: 0 30px 60px rgba(0,0,0,0.6);
        }
        .confirm-modal-overlay.active .confirm-modal-card { transform: scale(1); }
        
        .modal-title { font-size: 1.6rem; font-weight: 800; margin-bottom: 0.5rem; letter-spacing: -0.02em; }
        .modal-desc { color: var(--text-muted); margin-bottom: 2rem; font-size: 1rem; line-height: 1.5; }
        
        .modal-actions { display: flex; flex-direction: column; gap: 12px; }
        .modal-btn { padding: 1.1rem; border-radius: 50px; font-weight: 700; border: none; cursor: pointer; transition: 0.2s; font-size: 1rem; }
        .modal-btn-cancel { background: rgba(255,255,255,0.08); color: var(--text-main); }
        .modal-btn-cancel:hover { background: rgba(255,255,255,0.15); }
        .modal-btn-confirm { background: var(--accent-green); color: #000; box-shadow: 0 4px 15px rgba(48, 209, 88, 0.2); }
        .modal-btn-confirm:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(48, 209, 88, 0.4); }

        .error-container { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; text-align:center; padding:2rem; }
        .error-container h2 { color:var(--accent-red); margin-bottom:1rem; font-size: 1.8rem; font-weight: 800; }

        .recovery-toast {
            position: fixed; top: 100px; left: 50%; transform: translateX(-50%);
            background: var(--text-main); color: #000; padding: 0.75rem 1.5rem; border-radius: 50px;
            font-size: 0.9rem; font-weight: 800; box-shadow: 0 10px 30px rgba(255,255,255,0.2);
            z-index: 1000; animation: dropIn 0.5s cubic-bezier(0.16, 1, 0.3, 1), fadeOut 0.5s 3s forwards;
            pointer-events: none;
        }
        @keyframes dropIn { from { top: 0px; opacity: 0; } to { top: 100px; opacity: 1; } }
        @keyframes fadeOut { to { opacity: 0; } }

        /* ==========================================================================
           MOBILE RESPONSIVENESS OVERRIDES
           ========================================================================== */
        @media (max-width: 768px) {
            .quiz-viewport { flex-direction: column; padding-top: 6.5rem !important; gap: 1rem; }
            .question-panel { padding: 1.5rem; border-radius: 20px; }
            .sidebar-panel { width: 100%; border-radius: 20px; }
            .grid-container { grid-template-columns: repeat(6, 1fr); padding: 1.5rem; }
            .submit-area { padding: 1.5rem; }
            .exam-header { flex-direction: column; align-items: flex-start; gap: 1rem; }
            .timer-badge { width: 100%; justify-content: center; box-sizing: border-box; }
            .controls-row { flex-direction: column; gap: 1rem; }
            .btn-nav { width: 100%; text-align: center; }
        }
        
        /* View-Specific Skeleton */
        .sk-header-row { display: flex; justify-content: space-between; padding-bottom: 1.5rem; margin-bottom: 2rem; border-bottom: 1px solid var(--border-glass); }
        .sk-title { height: 30px; width: 200px; border-radius: 8px; background: rgba(255,255,255,0.05); }
        .sk-timer { height: 40px; width: 100px; border-radius: 50px; background: rgba(255,255,255,0.05); }
        .sk-q-tag { height: 24px; width: 140px; border-radius: 50px; margin-bottom: 1.5rem; background: rgba(255,255,255,0.05); }
        .sk-q-text { height: 80px; width: 100%; border-radius: 12px; margin-bottom: 2rem; background: rgba(255,255,255,0.05); }
        .sk-opt { height: 75px; width: 100%; border-radius: 16px; margin-bottom: 1rem; background: rgba(255,255,255,0.03); }
        .sk-sb-grid { padding: 2rem; display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .sk-node { aspect-ratio: 1; border-radius: 12px; background: rgba(255,255,255,0.05); }
        
        @keyframes pulse-skel { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        .sk-anim { animation: pulse-skel 1.5s infinite; }

        .hidden-layer { display: none !important; opacity: 0; }
        .visible-layer { display: flex !important; animation: fadeIn 0.4s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      </style>

      <div class="quiz-viewport" id="quizSkeletonLayer">
          <div class="question-panel">
              <div class="sk-header-row sk-anim"><div class="sk-title"></div><div class="sk-timer"></div></div>
              <div class="sk-q-tag sk-anim"></div><div class="sk-q-text sk-anim"></div>
              <div class="sk-opt sk-anim"></div><div class="sk-opt sk-anim"></div><div class="sk-opt sk-anim"></div><div class="sk-opt sk-anim"></div>
          </div>
          <div class="sidebar-panel">
              <div class="sidebar-header"><div class="sk-title sk-anim" style="height: 20px;"></div></div>
              <div class="sk-sb-grid">${'<div class="sk-node sk-anim"></div>'.repeat(16)}</div>
          </div>
      </div>

      <div class="quiz-viewport hidden-layer" id="quizLayoutContainer"></div>
    `;
  }

  shuffleArray(array) {
      let shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
  }

  persistState() {
      try {
          sessionStorage.setItem(this.sessionKey, JSON.stringify(this.state));
      } catch (e) {
          console.warn("[QuizView] Failed to backup state to SessionStorage.", e);
      }
  }

  async mount() {
    if (!this.moduleId || !this.chapterId) {
      Router.navigateTo('./dashboard');
      return;
    }

    const profile = Store.get('profile');
    if (!profile) return;

    try {
        const chapterData = await ContentService.getChapter(profile.certificate || 'A', this.moduleId, this.chapterId);

        if (!chapterData || !chapterData.assessmentData || chapterData.assessmentData.length === 0) {
            this.renderError("No questions found. The administrator has not published an assessment for this chapter yet.");
            return;
        }

        const recoveredState = sessionStorage.getItem(this.sessionKey);
        
        if (recoveredState) {
            console.log("[QuizView] Crash Recovery: Restoring previous session.");
            this.state = JSON.parse(recoveredState);
            this.renderMainUI(chapterData.title || "Assessment", true);
        } else {
            console.log("[QuizView] Generating new assessment instance...");
            this.generateTargetedQuiz(chapterData.assessmentData);
            this.renderMainUI(chapterData.title || "Assessment", false);
        }

        this.renderGrid();
        this.renderQuestion(this.state.currentQIndex, 'initial');
        this.startTimer();

        // 1.5s Perception Lock Reveal
        setTimeout(() => {
            const skel = document.getElementById('quizSkeletonLayer');
            const data = document.getElementById('quizLayoutContainer');
            if (skel) skel.classList.add('hidden-layer');
            if (data) {
                data.classList.remove('hidden-layer');
                data.classList.add('visible-layer');
            }
        }, 1000);

        document.getElementById('btnPrevQ').onclick = () => this.navigateQuestion(-1);
        document.getElementById('btnNextQ').onclick = () => this.navigateQuestion(1);
        document.getElementById('btnSubmitExam').onclick = () => this.requestSubmitExam();
        document.getElementById('btnCancelSubmit').onclick = () => this.closeSubmitModal();
        document.getElementById('btnConfirmSubmit').onclick = () => this.confirmSubmitExam();

    } catch (e) {
        console.error("Quiz Initialization Error:", e);
        this.renderError("Failed to load assessment data securely.");
    }
  }

  // --- FEATURE 1: UNVISITED QUESTION ALGORITHM ---
  generateTargetedQuiz(allQuestions) {
      const isModuleQuiz = this.chapterId.toLowerCase().includes('module') || this.chapterId.toLowerCase().includes('final');
      const questionLimit = isModuleQuiz ? 10 : 5;

      const failedBankStr = localStorage.getItem(this.failedBankKey);
      let failedBank = failedBankStr ? JSON.parse(failedBankStr) : [];
      
      const seenBankStr = localStorage.getItem(this.seenBankKey);
      let seenBank = seenBankStr ? JSON.parse(seenBankStr) : [];
      
      let failedQs = [];
      let unvisitedQs = [];
      let visitedQs = [];

      allQuestions.forEach(q => {
          const qText = q.text.trim();
          if (failedBank.includes(qText)) {
              failedQs.push(q);
          } else if (!seenBank.includes(qText)) {
              unvisitedQs.push(q);
          } else {
              visitedQs.push(q);
          }
      });

      // Hierarchy: Unvisited -> Failed -> Already Visited
      unvisitedQs = this.shuffleArray(unvisitedQs);
      failedQs = this.shuffleArray(failedQs);
      visitedQs = this.shuffleArray(visitedQs);

      let finalBlock = [...unvisitedQs, ...failedQs, ...visitedQs].slice(0, questionLimit);
      this.state.questions = this.shuffleArray(finalBlock);
      
      // Update Seen Bank immediately so they aren't served again as 'unvisited'
      this.state.questions.forEach(q => {
          const qText = q.text.trim();
          if (!seenBank.includes(qText)) seenBank.push(qText);
      });
      localStorage.setItem(this.seenBankKey, JSON.stringify(seenBank));

      this.state.questions.forEach((_, i) => this.state.questionTimers[i] = 0);
      this.state.timeLimitSeconds = this.state.questions.length * 60; 
      this.state.timeRemaining = this.state.timeLimitSeconds;
      
      this.persistState();
  }

  renderMainUI(title, isRecovered) {
      let recoveryHtml = isRecovered ? `<div class="recovery-toast">Session Recovered</div>` : '';

      document.getElementById('quizLayoutContainer').innerHTML = `
        ${recoveryHtml}
        <div class="question-panel">
            <div class="exam-header">
                <h2 class="exam-title" id="quizTitle">${title}</h2>
                <div class="timer-badge" id="examTimer">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span>--:--</span>
                </div>
            </div>
            <div id="questionContainer"></div>
            <div class="controls-row">
                <button class="btn-nav" id="btnPrevQ">◀ Previous</button>
                <button class="btn-nav" id="btnNextQ">Next ▶</button>
            </div>
        </div>
        
        <div class="sidebar-panel">
            <div class="sidebar-header"><h3>Question Navigator</h3></div>
            <div class="grid-container" id="navGrid"></div>
            <div class="submit-area">
                <button class="btn-submit" id="btnSubmitExam">Submit Exam</button>
            </div>
        </div>

        <div class="confirm-modal-overlay" id="submitModalOverlay">
            <div class="confirm-modal-card">
                <div style="font-size:3rem; margin-bottom:1rem;" id="modalIcon">📝</div>
                <h3 class="modal-title">Finish Assessment?</h3>
                <p class="modal-desc" id="submitModalDesc">You are about to submit your exam. Are you sure?</p>
                <div class="modal-actions">
                    <button class="modal-btn modal-btn-confirm" id="btnConfirmSubmit">Yes, Grade It</button>
                    <button class="modal-btn modal-btn-cancel" id="btnCancelSubmit">Return to Exam</button>
                </div>
            </div>
        </div>
      `;
  }

  renderError(msg) {
      const skel = document.getElementById('quizSkeletonLayer');
      if (skel) skel.classList.add('hidden-layer');
      
      const container = document.getElementById('quizLayoutContainer');
      container.classList.remove('hidden-layer');
      container.classList.add('visible-layer');
      
      container.innerHTML = `
          <div class="question-panel" style="width: 100%;">
            <div class="error-container">
              <h2>Assessment Unavailable</h2>
              <p style="color: var(--text-muted); margin-bottom: 2rem;">${msg}</p>
              <a href="./module?module=${this.moduleId}" class="btn-nav" style="background: rgba(255,255,255,0.1); text-decoration:none; display:inline-flex; align-items:center; justify-content:center;">Return to Module</a>
            </div>
          </div>
      `;
  }

  async destroy() {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  updateQuestionTime() {
    const now = Date.now();
    const timeSpent = (now - this.lastTimeCheck) / 1000;
    this.state.questionTimers[this.state.currentQIndex] += timeSpent;
    this.lastTimeCheck = now;
  }

  startTimer() {
    const timerDisplay = document.querySelector('#examTimer span');
    const timerBadge = document.getElementById('examTimer');
    this.lastTimeCheck = Date.now();

    this.timerInterval = setInterval(() => {
      this.state.timeRemaining--;

      const mins = Math.floor(this.state.timeRemaining / 60);
      const secs = this.state.timeRemaining % 60;
      timerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

      if (this.state.timeRemaining <= 60 && !timerBadge.classList.contains('warning')) {
          timerBadge.classList.add('warning');
      }
      
      if (this.state.timeRemaining % 5 === 0) {
          this.persistState();
      }
      
      if (this.state.timeRemaining <= 0) {
        clearInterval(this.timerInterval);
        this.confirmSubmitExam(); 
      }
    }, 1000);
  }

  navigateQuestion(direction) {
    this.updateQuestionTime(); 
    const nextIndex = this.state.currentQIndex + direction;
    if (nextIndex >= 0 && nextIndex < this.state.questions.length) {
      this.renderQuestion(nextIndex, direction > 0 ? 'next' : 'prev');
    }
  }

  jumpToQuestion(index) {
    this.updateQuestionTime(); 
    const dir = index > this.state.currentQIndex ? 'next' : 'prev';
    this.renderQuestion(index, dir);
  }

  renderQuestion(index, animationDir) {
    const container = document.getElementById('questionContainer');
    
    if (animationDir !== 'initial') {
        container.style.opacity = '0';
        container.style.transform = animationDir === 'next' ? 'translateY(-15px)' : 'translateY(15px)';
    }

    setTimeout(() => {
        this.state.currentQIndex = index;
        this.persistState();

        const q = this.state.questions[index];
        const letters = ['A', 'B', 'C', 'D'];
        let optionsHtml = q.options.map((opt, i) => {
            const isSelected = this.state.answers[index] === i;
            return `
                <div class="option-card ${isSelected ? 'selected' : ''}" data-index="${i}">
                    <div class="option-letter">${letters[i]}</div>
                    <div>${opt}</div>
                </div>
            `;
        }).join('');

        const categoryHtml = q.category ? `<span class="question-category">${q.category}</span>` : '';

        container.innerHTML = `
            <div class="question-meta">
                <span class="q-counter">Question ${index + 1} of ${this.state.questions.length}</span>
                ${categoryHtml}
            </div>
            <div class="question-text">${q.text}</div>
            <div class="options-grid">${optionsHtml}</div>
        `;

        container.querySelectorAll('.option-card').forEach(card => {
            card.onclick = () => {
                this.state.answers[index] = parseInt(card.dataset.index);
                this.persistState(); 
                this.renderQuestion(index, 'initial'); 
                this.renderGrid(); 
            };
        });

        document.getElementById('btnPrevQ').disabled = index === 0;
        document.getElementById('btnNextQ').disabled = index === this.state.questions.length - 1;

        document.querySelectorAll('.grid-node').forEach(n => n.classList.remove('active'));
        const activeNode = document.getElementById(`node-${index}`);
        if(activeNode) activeNode.classList.add('active');

        if (animationDir !== 'initial') {
            container.style.transform = animationDir === 'next' ? 'translateY(15px)' : 'translateY(-15px)';
            requestAnimationFrame(() => {
                container.style.opacity = '1';
                container.style.transform = 'translateY(0)';
            });
        }
    }, animationDir === 'initial' ? 0 : 150); 
  }

  renderGrid() {
    const grid = document.getElementById('navGrid');
    if (!grid.innerHTML.trim()) {
        let html = '';
        for (let i = 0; i < this.state.questions.length; i++) {
            html += `<div class="grid-node" id="node-${i}">${i + 1}</div>`;
        }
        grid.innerHTML = html;
        grid.querySelectorAll('.grid-node').forEach((node, i) => {
            node.onclick = () => this.jumpToQuestion(i);
        });
    } else {
        for (let i = 0; i < this.state.questions.length; i++) {
            const isAnswered = this.state.answers[i] !== undefined;
            const node = document.getElementById(`node-${i}`);
            if(node) {
                if (isAnswered) node.classList.add('answered');
                else node.classList.remove('answered');
            }
        }
    }
  }

  requestSubmitExam() {
      const answeredCount = Object.keys(this.state.answers).length;
      const totalCount = this.state.questions.length;
      
      const modalDesc = document.getElementById('submitModalDesc');
      const modalIcon = document.getElementById('modalIcon');
      
      if (answeredCount < totalCount) {
          modalIcon.innerHTML = '⚠️';
          modalDesc.innerHTML = `You have only answered <strong style="color:var(--accent-red);">${answeredCount} out of ${totalCount}</strong> questions.<br><br>Unanswered questions will automatically be marked incorrect. Proceed?`;
      } else {
          modalIcon.innerHTML = '✅';
          modalDesc.innerHTML = `You have answered all <strong style="color:var(--accent-green);">${totalCount}</strong> questions.<br><br>Are you ready to lock in your final score?`;
      }
      
      document.getElementById('submitModalOverlay').classList.add('active');
  }
  
  closeSubmitModal() {
      document.getElementById('submitModalOverlay').classList.remove('active');
  }

  async confirmSubmitExam() {
    const confirmBtn = document.getElementById('btnConfirmSubmit');
    const cancelBtn = document.getElementById('btnCancelSubmit');
    
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `Grading... <div style="display:inline-block; width:14px; height:14px; border:2px solid #000; border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite; margin-left:8px; vertical-align:middle;"></div>`;
    cancelBtn.style.opacity = '0.5';
    cancelBtn.style.pointerEvents = 'none';

    try {
        this.updateQuestionTime(); 
        clearInterval(this.timerInterval);

        let correctCount = 0;
        let newlyFailedTexts = []; 

        this.state.questions.forEach((q, i) => {
            if (this.state.answers[i] === parseInt(q.correct)) {
                correctCount++;
            } else {
                newlyFailedTexts.push(q.text.trim());
            }
        });

        const oldBankStr = localStorage.getItem(this.failedBankKey);
        let globalFailedBank = oldBankStr ? JSON.parse(oldBankStr) : [];
        let updatedBank = [...new Set([...globalFailedBank, ...newlyFailedTexts])];
        localStorage.setItem(this.failedBankKey, JSON.stringify(updatedBank));

        const totalSecondsSpent = this.state.timeLimitSeconds - this.state.timeRemaining;
        const avgTimePerQuestion = (totalSecondsSpent / this.state.questions.length).toFixed(1);
        const scorePercentage = Math.round((correctCount / this.state.questions.length) * 100);
        const passed = scorePercentage >= 50; 

        const resultData = {
            score: scorePercentage,
            correct: correctCount,
            total: this.state.questions.length,
            avgTime: avgTimePerQuestion,
            passed: passed,
            failedTexts: newlyFailedTexts
        };

        const user = Store.get('user');
        if (user) {
            try {
                await ProgressService.saveQuizResult(user.uid, this.moduleId, this.chapterId, resultData);
            } catch (syncError) {
                console.warn("[QuizView] Sync delayed, proceeding to local results.", syncError);
            }
        }

        Store.set('tempQuizResult', resultData);
        sessionStorage.removeItem(this.sessionKey);

        this.closeSubmitModal();
        Router.navigateTo(`./results?module=${this.moduleId}&chapter=${this.chapterId}`);

    } catch (err) {
        console.error("Critical Grading Error:", err);
        confirmBtn.innerHTML = 'Error. Try Again';
        confirmBtn.disabled = false;
        cancelBtn.style.opacity = '1';
        cancelBtn.style.pointerEvents = 'all';
    }
  }
}   
