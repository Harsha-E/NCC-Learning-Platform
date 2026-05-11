import AbstractView from '../core/AbstractView.js';
import Store from '../core/store.js';
import ProgressService from '../services/progress.service.js';
import ContentService from '../services/content.service.js';
import Router from '../core/router.js';

export default class QuizView extends AbstractView {
  constructor(params) {
    super(params);
    const queryParams = this.params?.queryParams || Object.fromEntries(new URLSearchParams(window.location.search));
    this.moduleId = queryParams.module || null;
    this.chapterId = queryParams.chapter || null;

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
        :root {
            --bg-base: #020617;
            --bg-surface: #0F172A;
            --bg-elevated: #1E293B;
            --bg-hover: #334155;
            --text-main: #F8FAFC;
            --text-muted: #94A3B8;
            --accent-primary: #3B82F6;
            --accent-success: #10B981;
            --accent-warning: #F59E0B;
            --accent-danger: #EF4444;
            --border-color: #334155;
        }

        .quiz-layout {
            display: flex; height: calc(100vh - 4.5rem); background: var(--bg-surface); color: var(--text-main);
            font-family: 'Inter', system-ui, sans-serif; overflow: hidden;
            box-sizing: border-box !important;
            padding-top: 8rem !important;
            min-height: 100dvh !important;
        }

        .question-area {
            flex: 1; display: flex; flex-direction: column; overflow-y: auto;
            padding: 3rem; position: relative; scroll-behavior: smooth;
        }

        .exam-header {
            display: flex; justify-content: space-between; align-items: center;
            border-bottom: 2px dashed var(--border-color); padding-bottom: 1.5rem; margin-bottom: 2rem;
            flex-shrink: 0;
        }
        .exam-title { font-family: 'Poppins', sans-serif; font-size: 1.5rem; font-weight: 700; color: var(--accent-warning); margin: 0; }
        
        .timer-badge {
            background: var(--bg-elevated); border: 1px solid var(--border-color); padding: 0.5rem 1.25rem;
            border-radius: 12px; font-family: 'JetBrains Mono', monospace; font-size: 1.25rem;
            font-weight: 700; color: var(--accent-success); display: flex; align-items: center; gap: 8px;
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.2); transition: 0.3s;
        }
        .timer-badge.warning { color: var(--accent-danger); animation: pulseTimer 1s infinite; border-color: rgba(239,68,68,0.5); box-shadow: inset 0 0 10px rgba(239,68,68,0.2); }
        @keyframes pulseTimer { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }

        /* FEATURE 4: Floating Chapter Transition Animations */
        #questionContainer {
            flex: 1; display: flex; flex-direction: column;
            transition: opacity 0.4s ease-out, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        #questionContainer.float-out {
            opacity: 0; transform: translateY(-15px) scale(0.98);
        }
        #questionContainer.float-in {
            opacity: 0; transform: translateY(15px) scale(0.98);
        }

        .question-category { color: #8B5CF6; font-size: 0.85rem; font-weight: 800; letter-spacing: 1px; margin-bottom: 0.5rem; text-transform: uppercase; }
        .question-text { font-size: 1.35rem; line-height: 1.6; margin-bottom: 2rem; font-weight: 500; font-family: 'Poppins', sans-serif; color: white; }

        .options-grid { display: flex; flex-direction: column; gap: 1rem; }
        .option-card {
            background: var(--bg-elevated); border: 2px solid var(--border-color); border-radius: 12px;
            padding: 1.25rem; cursor: pointer; display: flex; align-items: center; gap: 1rem;
            transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1); font-size: 1.1rem;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .option-card:hover { border-color: #475569; background: var(--bg-hover); transform: translateX(5px); }
        .option-card.selected { border-color: var(--accent-primary); background: rgba(59, 130, 246, 0.1); box-shadow: 0 4px 15px rgba(59,130,246,0.2); }
        
        .option-letter {
            width: 32px; height: 32px; border-radius: 8px; background: var(--bg-base);
            display: flex; align-items: center; justify-content: center; font-weight: 700;
            color: var(--text-muted); border: 1px solid var(--border-color); transition: 0.2s;
        }
        .option-card.selected .option-letter { background: var(--accent-primary); color: white; border-color: var(--accent-primary); }

        .controls-row {
            margin-top: auto; padding-top: 2rem; display: flex; justify-content: space-between; flex-shrink: 0;
        }
        .btn-nav {
            padding: 0.8rem 1.75rem; border-radius: 8px; font-weight: 700; cursor: pointer;
            border: none; background: var(--bg-elevated); color: white; transition: 0.2s;
            display: inline-flex; align-items: center; gap: 8px; font-size: 1rem;
            border: 1px solid var(--border-color);
        }
        .btn-nav:hover:not(:disabled) { background: var(--bg-hover); border-color: #475569; }
        .btn-nav:disabled { opacity: 0.3; cursor: not-allowed; }

        .sidebar-area {
            width: 340px; background: var(--bg-base); border-left: 1px solid var(--border-color);
            display: flex; flex-direction: column; flex-shrink: 0; box-shadow: -10px 0 30px rgba(0,0,0,0.2); z-index: 10;
        }
        .sidebar-header { padding: 1.5rem; border-bottom: 1px solid var(--border-color); }
        .sidebar-header h3 { margin: 0; color: white; font-family: 'Poppins', sans-serif; font-size: 1.1rem; }

        .grid-container {
            padding: 1.5rem; display: grid; grid-template-columns: repeat(4, 1fr);
            gap: 12px; overflow-y: auto; flex: 1; align-content: start;
        }
        .grid-node {
            aspect-ratio: 1; border-radius: 8px; background: var(--bg-elevated); border: 1px solid var(--border-color);
            display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.1rem;
            cursor: pointer; color: var(--text-muted); transition: 0.2s;
        }
        .grid-node:hover { border-color: var(--text-muted); color: var(--text-main); transform: scale(1.05); }
        .grid-node.answered { background: rgba(16, 185, 129, 0.1); border-color: var(--accent-success); color: var(--accent-success); }
        .grid-node.active { border-width: 2px; border-color: var(--accent-warning); color: white; transform: scale(1.1); box-shadow: 0 0 10px rgba(245, 158, 11, 0.3); }

        .submit-area { padding: 1.5rem; border-top: 1px solid var(--border-color); background: var(--bg-surface); }
        .btn-submit {
            width: 100%; padding: 1.2rem; border-radius: 12px; border: none; font-weight: 800;
            font-size: 1.1rem; color: white; background: linear-gradient(135deg, #138808 0%, #0D6606 100%);
            cursor: pointer; box-shadow: 0 4px 15px rgba(19, 136, 8, 0.3); transition: 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .btn-submit:hover { transform: translateY(-3px) scale(1.02); box-shadow: 0 8px 25px rgba(19, 136, 8, 0.5); }

        .confirm-modal-overlay {
            position: fixed; inset: 0;
            background: rgba(2, 6, 23, 0.85); backdrop-filter: blur(8px);
            z-index: 99999; display: flex; align-items: center; justify-content: center;
            opacity: 0; pointer-events: none; transition: 0.3s ease;
        }
        .confirm-modal-overlay.active { opacity: 1; pointer-events: all; }
        
        .confirm-modal-card {
            background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 20px;
            padding: 2.5rem; max-width: 420px; width: 90%; text-align: center;
            transform: translateY(20px) scale(0.95); transition: 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8);
        }
        .confirm-modal-overlay.active .confirm-modal-card { transform: translateY(0) scale(1); }
        
        .modal-title { color: white; font-family: 'Poppins', sans-serif; font-size: 1.6rem; margin-bottom: 0.5rem; }
        .modal-desc { color: var(--text-muted); margin-bottom: 2rem; font-size: 1rem; line-height: 1.5; }
        .modal-actions { display: flex; gap: 12px; }
        .modal-btn { flex: 1; padding: 1rem; border-radius: 10px; font-weight: 700; border: none; cursor: pointer; transition: 0.2s; font-size: 1rem; }
        .modal-btn-cancel { background: transparent; border: 2px solid var(--border-color); color: white; }
        .modal-btn-cancel:hover { background: var(--bg-elevated); border-color: #475569; }
        .modal-btn-confirm { background: linear-gradient(135deg, var(--accent-success) 0%, #059669 100%); color: white; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3); }
        .modal-btn-confirm:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(16, 185, 129, 0.5); }

        .error-container { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; text-align:center; padding:2rem; }
        .error-container h2 { color:var(--accent-danger); margin-bottom:1rem; }

        .recovery-toast {
            position: fixed; top: 80px; left: 50%; transform: translateX(-50%);
            background: var(--accent-primary); color: white; padding: 0.75rem 1.5rem; border-radius: 50px;
            font-size: 0.9rem; font-weight: bold; box-shadow: 0 10px 25px rgba(59, 130, 246, 0.4);
            z-index: 1000; animation: dropIn 0.5s cubic-bezier(0.16, 1, 0.3, 1), fadeOut 0.5s 4s forwards;
            pointer-events: none;
        }
        @keyframes dropIn { from { top: 0px; opacity: 0; } to { top: 80px; opacity: 1; } }
        @keyframes fadeOut { to { opacity: 0; } }

        @media (max-width: 768px) {
            .quiz-layout { flex-direction: column; }
            .sidebar-area { width: 100%; height: 220px; border-left: none; border-top: 1px solid var(--border-color); }
            .question-area { padding: 1.5rem; }
            .exam-header { flex-direction: column; align-items: flex-start; gap: 1rem; }
            .grid-container { grid-template-columns: repeat(6, 1fr); }
        }
        
        /* View-Specific Skeleton */
        .quiz-skeleton-layout { display: flex; height: calc(100vh - 4.5rem); background: var(--bg-surface); box-sizing: border-box !important; padding-top: 8rem !important; min-height: 100dvh !important; }
        .sk-q-area { flex: 1; padding: 3rem; display: flex; flex-direction: column; }
        .sk-header-row { display: flex; justify-content: space-between; border-bottom: 2px dashed var(--border-color); padding-bottom: 1.5rem; margin-bottom: 2rem; }
        .sk-title { height: 30px; width: 250px; border-radius: 8px; }
        .sk-timer { height: 40px; width: 120px; border-radius: 12px; }
        .sk-q-tag { height: 24px; width: 180px; border-radius: 6px; margin-bottom: 1.5rem; }
        .sk-q-text { height: 80px; width: 100%; border-radius: 12px; margin-bottom: 2rem; }
        .sk-opt { height: 70px; width: 100%; border-radius: 12px; margin-bottom: 1rem; }
        .sk-controls { margin-top: auto; padding-top: 2rem; display: flex; justify-content: space-between; }
        .sk-nav-btn { height: 50px; width: 140px; border-radius: 8px; }
        .sk-sidebar { width: 340px; background: var(--bg-base); border-left: 1px solid var(--border-color); display: flex; flex-direction: column; }
        .sk-sb-header { padding: 1.5rem; border-bottom: 1px solid var(--border-color); height: 75px; }
        .sk-sb-grid { padding: 1.5rem; display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .sk-node { aspect-ratio: 1; border-radius: 8px; }
        .sk-sb-footer { margin-top: auto; padding: 1.5rem; border-top: 1px solid var(--border-color); }
        .sk-submit-btn { height: 60px; width: 100%; border-radius: 12px; }
        
        .hidden-layer { display: none !important; opacity: 0; }
        .visible-layer { display: flex !important; animation: fadeIn 0.4s ease-out forwards; }
        
        @media (max-width: 768px) {
            .quiz-skeleton-layout { flex-direction: column; }
            .sk-sidebar { width: 100%; height: 220px; border-left: none; border-top: 1px solid var(--border-color); }
            .sk-sb-grid { grid-template-columns: repeat(6, 1fr); }
        }
      </style>

      <!-- SKELETON LAYER -->
      <div class="quiz-skeleton-layout" id="quizSkeletonLayer">
          <div class="sk-q-area">
              <div class="sk-header-row"><div class="sk-title skeleton"></div><div class="sk-timer skeleton"></div></div>
              <div class="sk-q-tag skeleton"></div><div class="sk-q-text skeleton"></div>
              <div class="sk-opt skeleton"></div><div class="sk-opt skeleton"></div><div class="sk-opt skeleton"></div><div class="sk-opt skeleton"></div>
              <div class="sk-controls"><div class="sk-nav-btn skeleton"></div><div class="sk-nav-btn skeleton"></div></div>
          </div>
          <div class="sk-sidebar">
              <div class="sk-sb-header"><div class="skeleton" style="height: 24px; width: 180px; border-radius: 6px;"></div></div>
              <div class="sk-sb-grid">${'<div class="sk-node skeleton"></div>'.repeat(16)}</div>
              <div class="sk-sb-footer"><div class="sk-submit-btn skeleton"></div></div>
          </div>
      </div>

      <!-- DATA LAYER -->
      <div class="quiz-layout hidden-layer" id="quizLayoutContainer"></div>
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
        }, 1500);

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
      let recoveryHtml = isRecovered ? `<div class="recovery-toast">🔄 Session Recovered</div>` : '';

      document.getElementById('quizLayoutContainer').innerHTML = `
        ${recoveryHtml}
        <div class="question-area">
            <div class="exam-header">
                <h2 class="exam-title" id="quizTitle">${title} - Quiz</h2>
                <div class="timer-badge" id="examTimer">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span>--:--</span>
                </div>
            </div>
            <div id="questionContainer"></div>
            <div class="controls-row">
                <button class="btn-nav" id="btnPrevQ">◀ Previous</button>
                <button class="btn-nav" id="btnNextQ">Next ▶</button>
            </div>
        </div>
        
        <div class="sidebar-area">
            <div class="sidebar-header"><h3>Question Navigator</h3></div>
            <div class="grid-container" id="navGrid"></div>
            <div class="submit-area">
                <button class="btn-submit" id="btnSubmitExam">SUBMIT EXAM</button>
            </div>
        </div>

        <div class="confirm-modal-overlay" id="submitModalOverlay">
            <div class="confirm-modal-card">
                <div style="font-size:4rem; margin-bottom:1rem;" id="modalIcon">📝</div>
                <h3 class="modal-title">Finish Assessment?</h3>
                <p class="modal-desc" id="submitModalDesc">You are about to submit your exam. Are you sure?</p>
                <div class="modal-actions">
                    <button class="modal-btn modal-btn-cancel" id="btnCancelSubmit">Review Answers</button>
                    <button class="modal-btn modal-btn-confirm" id="btnConfirmSubmit">Yes, Grade It</button>
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
          <div class="error-container">
            <h2>Assessment Unavailable</h2>
            <p>${msg}</p>
            <button onclick="window.history.back()" style="padding:1rem 2rem; background:var(--bg-elevated); color:white; border:1px solid var(--border-color); border-radius:8px; cursor:pointer; font-weight:bold; transition:0.2s;">Return to Module</button>
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

  // --- FEATURE 4: FLOATING CHAPTER ANIMATION ---
  renderQuestion(index, animationDir) {
    const container = document.getElementById('questionContainer');
    
    // Step 1: Trigger exit animation
    if (animationDir !== 'initial') {
        container.style.opacity = '0';
        container.style.transform = animationDir === 'next' ? 'translateY(-20px)' : 'translateY(20px)';
    }

    // Step 2: Wait for CSS transition (150ms), swap DOM, then animate in
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

        const categoryHtml = q.category ? `<div class="question-category">${q.category}</div>` : '';

        container.innerHTML = `
            <div style="color:var(--text-muted); font-weight:700; margin-bottom:1.5rem; letter-spacing:1px; font-size:0.9rem; display:flex; justify-content:space-between; align-items:center;">
                <span style="background:var(--bg-elevated); padding:6px 12px; border-radius:6px; border:1px solid var(--border-color);">QUESTION ${index + 1} OF ${this.state.questions.length}</span>
            </div>
            ${categoryHtml}
            <div class="question-text">${q.text}</div>
            <div class="options-grid">${optionsHtml}</div>
        `;

        // Rebind click listeners
        container.querySelectorAll('.option-card').forEach(card => {
            card.onclick = () => {
                this.state.answers[index] = parseInt(card.dataset.index);
                this.persistState(); 
                // Quick re-render without the long slide animation for immediate selection feedback
                this.renderQuestion(index, 'initial'); 
                this.renderGrid(); 
            };
        });

        document.getElementById('btnPrevQ').disabled = index === 0;
        document.getElementById('btnNextQ').disabled = index === this.state.questions.length - 1;

        document.querySelectorAll('.grid-node').forEach(n => n.classList.remove('active'));
        const activeNode = document.getElementById(`node-${index}`);
        if(activeNode) activeNode.classList.add('active');

        // Step 3: Trigger entrance float animation
        if (animationDir !== 'initial') {
            container.style.transform = animationDir === 'next' ? 'translateY(20px)' : 'translateY(-20px)';
            // Small reflow delay
            requestAnimationFrame(() => {
                container.style.opacity = '1';
                container.style.transform = 'translateY(0)';
            });
        }
    }, animationDir === 'initial' ? 0 : 150); // Fast exit, smooth entrance
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
          modalDesc.innerHTML = `You have only answered <strong style="color:var(--accent-danger);">${answeredCount} out of ${totalCount}</strong> questions.<br><br>Unanswered questions will automatically be marked incorrect. Are you sure you want to proceed?`;
      } else {
          modalIcon.innerHTML = '✅';
          modalDesc.innerHTML = `You have answered all <strong style="color:var(--accent-success);">${totalCount}</strong> questions.<br><br>Are you ready to lock in your final score?`;
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
    confirmBtn.innerHTML = `Grading... <div style="display:inline-block; width:14px; height:14px; border:2px solid white; border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite; margin-left:8px; vertical-align:middle;"></div>`;
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

        // Merge newly failed questions into the global Failed Bank for future Retries
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