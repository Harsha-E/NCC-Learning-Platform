import AbstractView from '../core/AbstractView.js';
import AuthService from '../services/auth.service.js';
import Router from '../core/router.js';

export default class RegisterView extends AbstractView {
  constructor(params) {
    super(params);
    this.radarInterval = null;
  }

  async getHtml() {
    return `
      <style>
        /* ==========================================================================
           TACTICAL MILITARY HUD - REGISTRATION PORTAL
           ========================================================================== */
        :root {
            --bg-abyss: #020202;
            --hud-primary: #0A84FF;
            --hud-glow: rgba(10, 132, 255, 0.4);
            --hud-danger: #FF453A;
            --hud-danger-glow: rgba(255, 69, 58, 0.4);
            --hud-success: #30D158;
            --hud-warning: #FF9F0A;
            --hud-panel: rgba(10, 20, 30, 0.75);
            --text-digital: #E0F2FE;
            --spring-bounce: 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        body, #app-root {
            background: var(--bg-abyss);
            min-height: 100dvh;
        }

        .hud-viewport {
            min-height: 100dvh;
            width: 100%;
            background-color: var(--bg-abyss);
            display: flex; 
            flex-direction: column;
            align-items: center; 
            justify-content: center;
            
            /* CRITICAL FIX: 7rem top padding pushes the card safely below the floating navbar */
            padding: 7rem 1.5rem 3rem 1.5rem; 
            
            box-sizing: border-box; 
            position: relative;
            font-family: "JetBrains Mono", "SF Pro Display", monospace;
            overflow-x: hidden;
            overflow-y: auto;
            isolation: isolate;
        }

        .hud-viewport::before {
            content: "";
            position: fixed;
            inset: 0;
            background:
              radial-gradient(circle at 15% 18%, rgba(10, 132, 255, 0.16), transparent 34%),
              radial-gradient(circle at 85% 15%, rgba(48, 209, 88, 0.12), transparent 28%),
              radial-gradient(circle at 50% 88%, rgba(255, 159, 10, 0.08), transparent 38%);
            z-index: 0;
            pointer-events: none;
        }

        /* 2D Radar Canvas Background */
        #radar-canvas {
            position: fixed; inset: 0; width: 100vw; height: 100vh;
            z-index: 0; opacity: 0.7; pointer-events: none;
        }

        /* Scanning Line Overlay */
        .scan-line {
            position: fixed; top: 0; left: 0; width: 100%; height: 6px;
            background: linear-gradient(90deg, transparent, var(--hud-primary), transparent);
            box-shadow: 0 0 25px var(--hud-primary);
            opacity: 0.4; z-index: 1; pointer-events: none;
            animation: scan 4s linear infinite;
        }

        @keyframes scan {
            0% { transform: translateY(-100vh); }
            100% { transform: translateY(100vh); }
        }

        /* The Main Command Panel */
        .hud-card {
            background: var(--hud-panel); border: 1px solid rgba(10, 132, 255, 0.25);
            border-radius: 16px; padding: 3rem 4rem; width: 100%; max-width: 560px;
            backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
            position: relative; z-index: 10;
            box-shadow: inset 0 0 60px rgba(0,0,0,0.9), 0 0 40px rgba(10, 132, 255, 0.15);
            animation: bootUp 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            box-sizing: border-box;
        }

        /* Corner Decals */
        .hud-card::before, .hud-card::after {
            content: ''; position: absolute; width: 24px; height: 24px;
            border: 2px solid var(--hud-primary); opacity: 0.8; pointer-events: none;
        }
        .hud-card::before { top: -2px; left: -2px; border-right: none; border-bottom: none; }
        .hud-card::after { bottom: -2px; right: -2px; border-left: none; border-top: none; }

        @keyframes bootUp {
            0% { opacity: 0; transform: scale(0.95) translateY(20px); filter: brightness(2); }
            100% { opacity: 1; transform: scale(1) translateY(0); filter: brightness(1); }
        }

        .hud-header { text-align: center; margin-bottom: 2rem; position: relative; }
        
        .sys-status {
            position: absolute; top: -1.5rem; right: -2.5rem;
            font-size: 0.7rem; color: var(--hud-primary); text-transform: uppercase;
            letter-spacing: 2px; display: flex; align-items: center; gap: 6px;
            animation: blink 2s infinite; font-weight: 700;
        }
        .sys-status::before { content: ''; width: 8px; height: 8px; background: var(--hud-primary); border-radius: 50%; box-shadow: 0 0 12px var(--hud-primary); }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

        .auth-title { font-size: 2rem; font-weight: 800; color: var(--text-digital); margin: 0 0 0.5rem 0; letter-spacing: 2px; text-transform: uppercase; text-shadow: 0 0 20px var(--hud-glow); }
        
        /* Tactical Step Indicator */
        .step-indicator { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 2.5rem; padding: 0 1rem; }
        .step-block { flex: 1; height: 6px; background: rgba(255,255,255,0.1); border-radius: 2px; transition: 0.4s; position: relative; overflow: hidden; }
        .step-block.completed { background: rgba(10, 132, 255, 0.4); }
        .step-block.active { background: var(--hud-primary); box-shadow: 0 0 10px var(--hud-primary); }
        .step-block.active::after { content: ''; position: absolute; top: 0; left: -100%; width: 50%; height: 100%; background: linear-gradient(90deg, transparent, #FFF, transparent); animation: scan-block 1.5s infinite; }
        @keyframes scan-block { 0% { left: -100%; } 100% { left: 200%; } }

        /* Multi-step framework */
        .step-content { display: none; animation: slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .step-content.active { display: block; }
        @keyframes slideInRight { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }

        .input-group { margin-bottom: 2rem; position: relative; }
        .input-label { display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 700; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 0.75rem; }
        
        .hud-input {
            width: 100%; padding: 1.25rem 1.5rem; background: rgba(0,0,0,0.6);
            border: 1px solid rgba(255,255,255,0.15); border-radius: 8px;
            color: var(--text-digital); font-size: 1.1rem; font-family: inherit;
            transition: all 0.3s ease; box-sizing: border-box; outline: none;
            letter-spacing: 2px;
        }
        .hud-input:focus { border-color: var(--hud-primary); background: rgba(10, 132, 255, 0.08); box-shadow: inset 0 0 25px rgba(10, 132, 255, 0.2); }
        
        /* Validation States */
        .hud-input.error { border-color: var(--hud-danger); animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both; }
        .hud-input.success { border-color: var(--hud-success); box-shadow: 0 0 20px rgba(48, 209, 88, 0.2); }

        @keyframes shake {
            10%, 90% { transform: translate3d(-2px, 0, 0); }
            20%, 80% { transform: translate3d(3px, 0, 0); }
            30%, 50%, 70% { transform: translate3d(-5px, 0, 0); }
            40%, 60% { transform: translate3d(5px, 0, 0); }
        }

        /* Modern Security Bar */
        .pwd-strength-container { display: none; margin-top: 1.5rem; padding: 1.25rem; background: rgba(0,0,0,0.4); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); }
        .pwd-track { width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden; margin-bottom: 1rem; }
        .pwd-fill { height: 100%; width: 0%; background: var(--hud-danger); transition: width 0.4s ease, background-color 0.4s ease; border-radius: 4px; box-shadow: 0 0 10px currentColor; }
        
        .pwd-req-list { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.75rem; color: rgba(255,255,255,0.4); font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
        .pwd-req-list li { display: flex; align-items: center; gap: 8px; transition: 0.3s; }
        .pwd-req-list li::before { content: '[ ]'; font-size: 0.9rem; }
        .pwd-req-list li.match { color: var(--hud-success); text-shadow: 0 0 8px var(--hud-success); }
        .pwd-req-list li.match::before { content: '[X]'; }

        .auth-error { 
            color: var(--hud-danger); font-size: 0.85rem; font-weight: 700; text-transform: uppercase;
            margin-top: 1rem; margin-bottom: 1rem; text-align: center; display: none; padding: 14px; 
            background: rgba(255, 69, 58, 0.15); border: 1px solid var(--hud-danger); border-radius: 6px;
            text-shadow: 0 0 10px var(--hud-danger-glow); letter-spacing: 1.5px;
        }

        /* Buttons */
        .btn-row { display: flex; gap: 1rem; margin-top: 2rem; }
        .btn-submit {
            flex: 1; padding: 1.25rem; background: transparent; color: var(--hud-primary);
            border: 2px solid var(--hud-primary); border-radius: 6px; font-weight: 800; font-size: 1.1rem;
            cursor: pointer; transition: 0.2s; text-transform: uppercase; letter-spacing: 4px; 
            position: relative; overflow: hidden;
        }
        .btn-submit::before {
            content: ''; position: absolute; top: 0; left: -100%; width: 100%; height: 100%;
            background: linear-gradient(90deg, transparent, rgba(10,132,255,0.5), transparent); transition: left 0.6s;
        }
        .btn-submit:hover { background: var(--hud-primary); color: #000; box-shadow: 0 0 40px var(--hud-glow); }
        .btn-submit:hover::before { left: 100%; }
        .btn-submit:active { transform: scale(0.97); }
        .btn-submit:disabled { opacity: 0.4; border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.5); cursor: not-allowed; background: transparent; box-shadow: none; }

        .btn-ghost { border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.6); }
        .btn-ghost:hover { background: rgba(255,255,255,0.1); color: #FFF; box-shadow: none; border-color: #FFF;}

        .auth-footer { margin-top: 3rem; text-align: center; font-size: 0.85rem; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1.5px;}
        .auth-footer a { color: var(--hud-primary); text-decoration: none; font-weight: 800; transition: 0.2s; margin-left: 8px;}
        .auth-footer a:hover { color: #FFF; text-shadow: 0 0 15px var(--hud-primary); }

        /* Biometric Loading Overlay */
        #biometric-loader {
            position: absolute; inset: 0; background: rgba(0,0,0,0.95); z-index: 50;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            opacity: 0; pointer-events: none; transition: 0.4s; border-radius: 16px;
        }
        .bio-ring { width: 80px; height: 80px; border: 3px dashed var(--hud-success); border-radius: 50%; animation: spin 3s linear infinite; margin-bottom: 1.5rem; }
        .bio-text { color: var(--hud-success); font-size: 0.9rem; font-weight: 700; letter-spacing: 5px; text-transform: uppercase; animation: blink 1s infinite; text-shadow: 0 0 10px var(--hud-success); }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        /* Terms Checkbox */
        .terms-container { display:flex; align-items:flex-start; gap:12px; margin-bottom:1.5rem; margin-top:1rem; padding: 1rem; background: rgba(0,0,0,0.3); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);}
        .terms-checkbox { appearance: none; width: 20px; height: 20px; border: 2px solid var(--hud-primary); border-radius: 4px; background: transparent; cursor: pointer; position: relative; margin-top: 2px; flex-shrink: 0;}
        .terms-checkbox:checked { background: var(--hud-primary); box-shadow: 0 0 10px var(--hud-glow); }
        .terms-checkbox:checked::after { content: '✓'; position: absolute; top: -2px; left: 3px; color: #000; font-size: 14px; font-weight: bold; }
        .terms-label { font-size: 0.8rem; color: rgba(255,255,255,0.6); line-height: 1.6; cursor: pointer; font-family: "SF Pro Display", sans-serif; text-transform: none; letter-spacing: normal;}

        @media (max-width: 600px) {
            .hud-viewport { padding-top: 5.5rem; }
            .hud-card { padding: 2.5rem 1.5rem; background: rgba(10, 20, 30, 0.84); box-shadow: 0 18px 42px rgba(0, 0, 0, 0.45); margin-top: 0;}
            .hud-card::before, .hud-card::after { display: none; }
            .sys-status { position: static; justify-content: center; margin-bottom: 1rem; }
            .auth-title { font-size: 1.8rem; }
            .pwd-req-list { grid-template-columns: 1fr; }
            .btn-submit { font-size: 0.95rem; padding: 1.1rem; }
        }

        /* 2D Radar Canvas Background */
        #radar-canvas {
            position: fixed; /* FIXED BUG HERE */
            inset: 0; width: 100vw; height: 100vh;
            z-index: 0; opacity: 0.7; pointer-events: none;
        }

        /* Scanning Line Overlay */
        .scan-line {
            position: fixed; /* FIXED BUG HERE */
            inset: 0; width: 100vw; height: 6px;
            background: linear-gradient(90deg, transparent, var(--hud-primary), transparent);
            box-shadow: 0 0 25px var(--hud-primary);
            opacity: 0.4; z-index: 1; pointer-events: none;
            animation: scan 4s linear infinite;
        }
      </style>

      <div class="hud-viewport">
        <canvas id="radar-canvas"></canvas>
        <div class="scan-line"></div>
        
        <div class="hud-card">
          <div id="biometric-loader">
              <div class="bio-ring"></div>
              <div class="bio-text">Deploying Profile...</div>
          </div>

          <div class="hud-header">
            <div class="sys-status">Clearance Required</div>
            <h1 class="auth-title">Initialize Profile</h1>
          </div>

          <div class="step-indicator">
            <div class="step-block active" data-step="1"></div>
            <div class="step-block" data-step="2"></div>
            <div class="step-block" data-step="3"></div>
            <div class="step-block" data-step="4"></div>
            <div class="step-block" data-step="5"></div>
          </div>

          <form id="registerForm">
            <div class="step-content active" data-step="1">
              <div class="input-group">
                <label class="input-label" for="fullName">Target Designation (Name)</label>
                <input type="text" id="fullName" class="hud-input" placeholder="> e.g. JOHN DOE" required>
              </div>
              <div class="btn-row">
                <button type="button" class="btn-submit btn-next">Proceed</button>
              </div>
            </div>

            <div class="step-content" data-step="2">
              <div class="input-group">
                <label class="input-label" for="serviceNumber">Service Number</label>
                <input type="text" id="serviceNumber" class="hud-input" placeholder="> e.g. AP2024SWIA0150219" required style="text-transform: uppercase;">
              </div>
              <div class="btn-row">
                <button type="button" class="btn-submit btn-ghost btn-prev">Back</button>
                <button type="button" class="btn-submit btn-next">Proceed</button>
              </div>
            </div>

            <div class="step-content" data-step="3">
              <div class="input-group">
                <label class="input-label" for="email">Comms Uplink (Email)</label>
                <input type="email" id="email" class="hud-input" placeholder="> cadet@ncc.com" required>
              </div>
              <div class="input-group">
                <label class="input-label" for="phone">Secure Frequency (Phone)</label>
                <input type="tel" id="phone" class="hud-input" placeholder="> 10-DIGIT NUMBER" required>
              </div>
              <div class="btn-row">
                <button type="button" class="btn-submit btn-ghost btn-prev">Back</button>
                <button type="button" class="btn-submit btn-next">Proceed</button>
              </div>
            </div>

            <div class="step-content" data-step="4">
              <div class="input-group">
                <label class="input-label" for="password">Generate Access Key</label>
                <input type="password" id="password" class="hud-input" placeholder="> ••••••••" required>
                
                <div class="pwd-strength-container" id="pwdContainer">
                  <div style="display:flex; justify-content:space-between; font-size:0.75rem; font-weight:800; text-transform:uppercase; letter-spacing:2px; margin-bottom:10px; color:var(--text-pure);">
                    Encryption: <span id="strengthText" style="color: var(--hud-danger);">WEAK</span>
                  </div>
                  <div class="pwd-track"><div class="pwd-fill" id="strengthFill"></div></div>
                  <ul class="pwd-req-list">
                    <li id="reqLength">8+ Characters</li>
                    <li id="reqUpper">1 Uppercase</li>
                    <li id="reqNumber">1 Number</li>
                    <li id="reqSpecial">1 Special (!@#)</li>
                  </ul>
                </div>
              </div>
              <div class="btn-row">
                <button type="button" class="btn-submit btn-ghost btn-prev">Back</button>
                <button type="button" class="btn-submit btn-next">Proceed</button>
              </div>
            </div>

            <div class="step-content" data-step="5">
              <div class="input-group">
                <label class="input-label" for="confirmPassword">Verify Access Key</label>
                <input type="password" id="confirmPassword" class="hud-input" placeholder="> ••••••••" required>
              </div>
              
              <div class="terms-container">
                  <input type="checkbox" id="termsCheckbox" class="terms-checkbox" required>
                  <label for="termsCheckbox" class="terms-label">
                      I acknowledge that I am registering for the NCC Core System. All actions are logged and governed by standard operational protocols.
                  </label>
              </div>

              <div id="registerGlobalError" class="auth-error"></div>

              <div class="btn-row">
                <button type="button" class="btn-submit btn-ghost btn-prev">Back</button>
                <button type="submit" id="submitBtn" class="btn-submit" style="background: var(--hud-success); border-color: var(--hud-success); color: #000;">Deploy Profile</button>
              </div>
            </div>
          </form>

          <div class="auth-footer">
            Profile already active? <a href="./login" data-nav>Authenticate</a>
          </div>
        </div>
      </div>
    `;
  }

  async mount() {
    this.initRadarCanvas();

    this.currentStep = 1;
    this.totalSteps = 5;

    const form = document.getElementById('registerForm');
    const globalError = document.getElementById('registerGlobalError');
    const submitBtn = document.getElementById('submitBtn');
    const bioLoader = document.getElementById('biometric-loader');
    
    const fullNameInput = document.getElementById('fullName');
    const serviceNumberInput = document.getElementById('serviceNumber');
    const emailInput = document.getElementById('email');
    const phoneInput = document.getElementById('phone');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const termsCheckbox = document.getElementById('termsCheckbox');

    if (!form) return;

    window.Router = Router;
    document.querySelectorAll('[data-nav]').forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            const route = btn.getAttribute('href');
            if (route) window.Router.navigateTo(route);
        };
    });

    const showStep = (step) => {
      document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
      const activeContent = document.querySelector(`.step-content[data-step="${step}"]`);
      if (activeContent) activeContent.classList.add('active');

      document.querySelectorAll('.step-block').forEach((el, index) => {
        const stepNum = index + 1;
        el.classList.remove('active', 'completed');
        if (stepNum === step) {
          el.classList.add('active');
        } else if (stepNum < step) {
          el.classList.add('completed');
        }
      });
      this.currentStep = step;
    };

    showStep(this.currentStep);

    const triggerError = (input) => {
        input.classList.add('error');
        input.style.animation = 'none';
        input.offsetHeight; 
        input.style.animation = 'shake 0.4s cubic-bezier(.36,.07,.19,.97) both';
    };

    const validateStep = () => {
      let isValid = true;
      let firstInvalidInput = null;
      const currentContent = document.querySelector(`.step-content[data-step="${this.currentStep}"]`);
      if (!currentContent) return false;

      const inputs = currentContent.querySelectorAll('input[required]');
      inputs.forEach(input => {
        input.classList.remove('error', 'success');
        
        if (!input.value.trim()) {
          triggerError(input);
          if (!firstInvalidInput) firstInvalidInput = input;
          isValid = false;
          return;
        }

        if (input.id === 'fullName' && input.value.trim().length < 3) {
          triggerError(input);
          if (!firstInvalidInput) firstInvalidInput = input;
          isValid = false;
        }
        if (input.id === 'serviceNumber' && !/^AP\d{4}(SD|SW)[A-Z]{2}\d{7}$/.test(input.value.trim())) {
          triggerError(input);
          if (!firstInvalidInput) firstInvalidInput = input;
          isValid = false;
        }
        if (input.id === 'email' && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(input.value.trim())) {
          triggerError(input);
          if (!firstInvalidInput) firstInvalidInput = input;
          isValid = false;
        }
        if (input.id === 'password') {
          const pwd = input.value;
          if (pwd.length < 8 || !/[A-Z]/.test(pwd) || !/\d/.test(pwd) || !/[^A-Za-z0-9]/.test(pwd)) {
            triggerError(input);
            if (!firstInvalidInput) firstInvalidInput = input;
            isValid = false;
          }
        }
        
        if (isValid) input.classList.add('success');
      });

      if (this.currentStep === 5) {
        if (confirmPasswordInput.value !== passwordInput.value) {
          triggerError(confirmPasswordInput);
          if (!firstInvalidInput) firstInvalidInput = confirmPasswordInput;
          isValid = false;
        } else if (confirmPasswordInput.value) {
          confirmPasswordInput.classList.add('success');
        }

        if (!termsCheckbox.checked) {
          isValid = false;
        }
      }

      if (!isValid && firstInvalidInput) firstInvalidInput.focus();
      return isValid;
    };

    form.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-next')) {
        if (validateStep() && this.currentStep < this.totalSteps) {
          showStep(this.currentStep + 1);
        }
      } else if (e.target.classList.contains('btn-prev')) {
        if (this.currentStep > 1) showStep(this.currentStep - 1);
      }
    });

    const strengthFill = document.getElementById('strengthFill');
    const strengthText = document.getElementById('strengthText');
    const pwdContainer = document.getElementById('pwdContainer');
    const reqLength = document.getElementById('reqLength');
    const reqUpper = document.getElementById('reqUpper');
    const reqNumber = document.getElementById('reqNumber');
    const reqSpecial = document.getElementById('reqSpecial');

    passwordInput.addEventListener('input', (e) => {
      const pwd = e.target.value;
      const hasLength = pwd.length >= 8;
      const hasUpper = /[A-Z]/.test(pwd);
      const hasNumber = /\d/.test(pwd);
      const hasSpecial = /[^A-Za-z0-9]/.test(pwd);

      reqLength.classList.toggle('match', hasLength);
      reqUpper.classList.toggle('match', hasUpper);
      reqNumber.classList.toggle('match', hasNumber);
      reqSpecial.classList.toggle('match', hasSpecial);

      let strength = 0;
      let label = 'WEAK';
      let color = 'var(--hud-danger)';

      if (hasLength) strength += 25;
      if (hasUpper) strength += 25;
      if (hasNumber) strength += 25;
      if (hasSpecial) strength += 25;

      if (strength === 50) { label = 'FAIR'; color = 'var(--hud-warning)'; }
      if (strength === 75) { label = 'GOOD'; color = 'var(--hud-primary)'; }
      if (strength === 100) { label = 'SECURE'; color = 'var(--hud-success)'; }

      pwdContainer.style.display = 'block';
      if (strength === 100) {
          passwordInput.classList.remove('error');
          passwordInput.classList.add('success');
      }
      
      strengthFill.style.width = strength + '%';
      strengthFill.style.backgroundColor = color;
      strengthFill.style.boxShadow = `0 0 15px ${color}`;
      strengthText.textContent = label;
      strengthText.style.color = color;
      strengthText.style.textShadow = `0 0 10px ${color}`;
    });

    [fullNameInput, serviceNumberInput, emailInput, phoneInput, passwordInput, confirmPasswordInput].forEach(inp => {
      inp.addEventListener('input', () => inp.classList.remove('error', 'success'));
    });

    serviceNumberInput.addEventListener('input', () => {
      serviceNumberInput.value = serviceNumberInput.value.toUpperCase();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      globalError.style.display = 'none';

      if (!validateStep()) return;

      submitBtn.disabled = true;
      bioLoader.style.opacity = '1';
      bioLoader.style.pointerEvents = 'all';

      // Minimum artificial delay to force the user to see the cool animation
      await new Promise(r => setTimeout(r, 1500));

      try {
        await AuthService.register(
          emailInput.value.trim(),
          passwordInput.value,
          fullNameInput.value.trim(),
          serviceNumberInput.value.trim().toUpperCase(),
          phoneInput.value.trim()
        );
        
        if (typeof AuthService.logout === 'function') await AuthService.logout();
        Router.navigateTo('/login');
      } catch (error) {
        console.error('[RegisterView] Auth Error:', error);
        
        bioLoader.style.opacity = '0'; bioLoader.style.pointerEvents = 'none';
        submitBtn.disabled = false;
        
        let errorMsg = 'DEPLOYMENT FAILED. TRY AGAIN.';
        if (error.code === 'auth/email-already-in-use') {
          errorMsg = 'CADET ID ALREADY ACTIVE IN SYSTEM.';
        } else if (error.code === 'auth/network-request-failed') {
          errorMsg = 'UPLINK SEVERED. CHECK CONNECTION.';
        }

        globalError.textContent = errorMsg;
        globalError.style.display = 'block';
        globalError.style.animation = 'none';
        globalError.offsetHeight; 
        globalError.style.animation = 'shake 0.4s cubic-bezier(.36,.07,.19,.97) both';
      }
    });
  }

  // Pure Math 2D Canvas Radar Generation
  initRadarCanvas() {
      const canvas = document.getElementById('radar-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      let width, height;

      const resize = () => {
          width = canvas.width = window.innerWidth;
          height = canvas.height = window.innerHeight;
      };
      window.addEventListener('resize', resize);
      resize();

      let angle = 0;
      const draw = () => {
          this.radarInterval = requestAnimationFrame(draw);
          
          ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'; 
          ctx.fillRect(0, 0, width, height);

          const cx = width / 2;
          const cy = height / 2;
          const radius = Math.min(width, height) * 0.9;

          ctx.strokeStyle = 'rgba(10, 132, 255, 0.15)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          for(let i=0; i<width; i+=60) { ctx.moveTo(i, 0); ctx.lineTo(i, height); }
          for(let i=0; i<height; i+=60) { ctx.moveTo(0, i); ctx.lineTo(width, i); }
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(cx, cy, radius * 0.33, 0, Math.PI * 2);
          ctx.arc(cx, cy, radius * 0.66, 0, Math.PI * 2);
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.stroke();

          angle += 0.02;
          const x = cx + Math.cos(angle) * radius;
          const y = cy + Math.sin(angle) * radius;

          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(x, y);
          ctx.strokeStyle = 'rgba(10, 132, 255, 0.9)';
          ctx.lineWidth = 3;
          ctx.stroke();

          if(Math.random() > 0.96) {
              const bx = cx + (Math.random()-0.5) * radius * 1.5;
              const by = cy + (Math.random()-0.5) * radius * 1.5;
              ctx.fillStyle = '#30D158';
              ctx.beginPath();
              ctx.arc(bx, by, 4, 0, Math.PI*2);
              ctx.fill();
              
              ctx.strokeStyle = 'rgba(48, 209, 88, 0.5)';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.arc(bx, by, 15, 0, Math.PI*2);
              ctx.stroke();
          }
      };
      draw();
  }

  async destroy() {
      if(this.radarInterval) cancelAnimationFrame(this.radarInterval);
  }
}
