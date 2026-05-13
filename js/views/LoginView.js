import AbstractView from '../core/AbstractView.js';
import AuthService from '../services/auth.service.js';
import Router from '../core/router.js';

export default class LoginView extends AbstractView {
  constructor(params) {
    super(params);
    this.radarInterval = null;
  }

  async getHtml() {
    return `
      <style>
        /* ==========================================================================
           TACTICAL MILITARY HUD - LOGIN PORTAL
           ========================================================================== */
        :root {
            --bg-abyss: #020202;
            --hud-primary: #0A84FF;
            --hud-glow: rgba(10, 132, 255, 0.4);
            --hud-danger: #FF453A;
            --hud-danger-glow: rgba(255, 69, 58, 0.4);
            --hud-success: #30D158;
            --hud-panel: rgba(10, 20, 30, 0.7);
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
            display: flex; align-items: center; justify-content: center;
            padding: 8rem 1.5rem 2rem 1.5rem; box-sizing: border-box; position: relative;
            font-family: "JetBrains Mono", "SF Pro Display", monospace; /* Terminal vibe */
            overflow: hidden;
            isolation: isolate;
        }

        .hud-viewport::before {
            content: "";
            position: fixed;
            inset: 0;
            background:
              radial-gradient(circle at 20% 20%, rgba(10, 132, 255, 0.16), transparent 35%),
              radial-gradient(circle at 80% 10%, rgba(48, 209, 88, 0.12), transparent 30%),
              radial-gradient(circle at 50% 85%, rgba(10, 132, 255, 0.1), transparent 40%);
            z-index: 0;
            pointer-events: none;
        }

        /* 2D Radar Canvas Background */
        #radar-canvas {
            position: absolute; top: 0; left: 0; width: 100vw; height: 100vh;
            z-index: 0; opacity: 0.6; pointer-events: none;
        }

        /* Scanning Line Overlay */
        .scan-line {
            position: absolute; top: 0; left: 0; width: 100%; height: 4px;
            background: linear-gradient(90deg, transparent, var(--hud-primary), transparent);
            box-shadow: 0 0 20px var(--hud-primary);
            opacity: 0.5; z-index: 1; pointer-events: none;
            animation: scan 6s linear infinite;
        }

        @keyframes scan {
            0% { transform: translateY(-100vh); }
            100% { transform: translateY(100vh); }
        }

        /* The Main Command Panel */
        .hud-card {
            background: var(--hud-panel); border: 1px solid rgba(10, 132, 255, 0.2);
            border-radius: 16px; padding: 3rem 4rem; width: 100%; max-width: 500px;
            backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px);
            position: relative; z-index: 10;
            box-shadow: inset 0 0 40px rgba(0,0,0,0.8), 0 0 30px rgba(10, 132, 255, 0.1);
            animation: bootUp 1s ease-out forwards;
        }

        /* Corner Decals for Tactical Feel */
        .hud-card::before, .hud-card::after {
            content: ''; position: absolute; width: 20px; height: 20px;
            border: 2px solid var(--hud-primary); opacity: 0.7; pointer-events: none;
        }
        .hud-card::before { top: -1px; left: -1px; border-right: none; border-bottom: none; }
        .hud-card::after { bottom: -1px; right: -1px; border-left: none; border-top: none; }

        @keyframes bootUp {
            0% { opacity: 0; transform: scale(0.9) translateY(20px); filter: brightness(2); }
            100% { opacity: 1; transform: scale(1) translateY(0); filter: brightness(1); }
        }

        .hud-header { text-align: center; margin-bottom: 2.5rem; position: relative; }
        
        .sys-status {
            position: absolute; top: -1.5rem; right: -2.5rem;
            font-size: 0.65rem; color: var(--hud-success); text-transform: uppercase;
            letter-spacing: 2px; display: flex; align-items: center; gap: 6px;
            animation: blink 2s infinite;
        }
        .sys-status::before { content: ''; width: 6px; height: 6px; background: var(--hud-success); border-radius: 50%; box-shadow: 0 0 10px var(--hud-success); }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

        .auth-title { font-size: 2rem; font-weight: 800; color: var(--text-digital); margin: 0 0 0.5rem 0; letter-spacing: 2px; text-transform: uppercase; text-shadow: 0 0 15px var(--hud-glow); }
        
        /* Typewriter Subtitle */
        .typewriter {
            font-size: 0.85rem; color: var(--hud-primary); margin: 0;
            overflow: hidden; white-space: nowrap; border-right: 2px solid var(--hud-primary);
            width: 0; animation: typing 2s steps(40, end) forwards, blink-caret 0.75s step-end infinite;
        }
        @keyframes typing { from { width: 0 } to { width: 100% } }
        @keyframes blink-caret { from, to { border-color: transparent } 50% { border-color: var(--hud-primary); } }

        .input-group { margin-bottom: 2rem; position: relative; }
        .input-label { display: flex; justify-content: space-between; font-size: 0.75rem; font-weight: 700; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 0.75rem; }
        
        .hud-input {
            width: 100%; padding: 1.2rem 1.5rem; background: rgba(0,0,0,0.5);
            border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;
            color: var(--text-digital); font-size: 1rem; font-family: inherit;
            transition: all 0.3s ease; box-sizing: border-box; outline: none;
            letter-spacing: 1px;
        }
        .hud-input:focus { border-color: var(--hud-primary); background: rgba(10, 132, 255, 0.05); box-shadow: inset 0 0 20px rgba(10, 132, 255, 0.2); }
        
        /* Validation States */
        .hud-input.error { border-color: var(--hud-danger); animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both; }
        .hud-input.success { border-color: var(--hud-success); box-shadow: 0 0 15px rgba(48, 209, 88, 0.2); }

        @keyframes shake {
            10%, 90% { transform: translate3d(-1px, 0, 0); }
            20%, 80% { transform: translate3d(2px, 0, 0); }
            30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
            40%, 60% { transform: translate3d(4px, 0, 0); }
        }

        .auth-error { 
            color: var(--hud-danger); font-size: 0.8rem; font-weight: 700; text-transform: uppercase;
            margin-top: 1rem; text-align: center; display: none; padding: 12px; 
            background: rgba(255, 69, 58, 0.1); border: 1px solid var(--hud-danger); border-radius: 4px;
            text-shadow: 0 0 8px var(--hud-danger-glow); letter-spacing: 1px;
        }

        .btn-submit {
            width: 100%; padding: 1.2rem; background: transparent; color: var(--hud-primary);
            border: 1px solid var(--hud-primary); border-radius: 4px; font-weight: 800; font-size: 1rem;
            cursor: pointer; transition: 0.2s; margin-top: 1.5rem; text-transform: uppercase;
            letter-spacing: 3px; position: relative; overflow: hidden;
        }
        .btn-submit::before {
            content: ''; position: absolute; top: 0; left: -100%; width: 100%; height: 100%;
            background: linear-gradient(90deg, transparent, rgba(10,132,255,0.4), transparent);
            transition: left 0.5s;
        }
        .btn-submit:hover { background: var(--hud-primary); color: #000; box-shadow: 0 0 30px var(--hud-glow); }
        .btn-submit:hover::before { left: 100%; }
        .btn-submit:active { transform: scale(0.98); }
        .btn-submit:disabled { opacity: 0.5; border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.5); cursor: not-allowed; background: transparent; box-shadow: none; }

        .auth-footer { margin-top: 2.5rem; text-align: center; font-size: 0.8rem; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1px;}
        .auth-footer a { color: var(--hud-primary); text-decoration: none; font-weight: 800; transition: 0.2s; margin-left: 8px;}
        .auth-footer a:hover { color: #FFF; text-shadow: 0 0 10px var(--hud-primary); }

        /* Biometric Loading Overlay */
        #biometric-loader {
            position: absolute; inset: 0; background: rgba(0,0,0,0.9); z-index: 50;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            opacity: 0; pointer-events: none; transition: 0.3s; border-radius: 16px;
        }
        .bio-ring { width: 60px; height: 60px; border: 2px dashed var(--hud-primary); border-radius: 50%; animation: spin 4s linear infinite; margin-bottom: 1rem; }
        .bio-text { color: var(--hud-primary); font-size: 0.8rem; letter-spacing: 4px; text-transform: uppercase; animation: blink 1s infinite; }

        @media (max-width: 480px) {
            .hud-card { padding: 2.5rem 1.5rem; background: rgba(10, 20, 30, 0.82); box-shadow: 0 18px 42px rgba(0, 0, 0, 0.45); }
            .hud-card::before, .hud-card::after { display: none; }
        }

        /* 2D Radar Canvas Background */
        #radar-canvas {
            position: fixed; /* FIXED BUG HERE */
            inset: 0; width: 100vw; height: 100vh;
            z-index: 0; opacity: 0.6; pointer-events: none;
        }

        /* Scanning Line Overlay */
        .scan-line {
            position: fixed; /* FIXED BUG HERE */
            inset: 0; width: 100vw; height: 4px;
            background: linear-gradient(90deg, transparent, var(--hud-primary), transparent);
            box-shadow: 0 0 20px var(--hud-primary);
            opacity: 0.5; z-index: 1; pointer-events: none;
            animation: scan 6s linear infinite;
        }
      </style>

      <div class="hud-viewport">
        <canvas id="radar-canvas"></canvas>
        <div class="scan-line"></div>
        
        <div class="hud-card">
          <div id="biometric-loader">
              <div class="bio-ring"></div>
              <div class="bio-text">Decrypting...</div>
          </div>

          <div class="hud-header">
            <div class="sys-status">Connection Established</div>
            <h1 class="auth-title">Learning Access</h1>
            <div style="display:flex; justify-content:center;">
                <p class="typewriter">Enter clearance codes to proceed.</p>
            </div>
          </div>

          <form id="loginForm">
            <div class="input-group">
              <label class="input-label" for="email">Cadet Email</label>
              <input type="email" id="email" class="hud-input" placeholder="> USER_EMAIL_" required autocomplete="email">
            </div>

            <div class="input-group">
              <label class="input-label" for="password">
                <span>Access Key</span>
                <a href="./forgot-password" data-nav style="color: rgba(255,255,255,0.4); text-decoration: none; text-transform: none; letter-spacing: normal; transition: 0.2s;" onmouseover="this.style.color='var(--hud-primary)'" onmouseout="this.style.color='rgba(255,255,255,0.4)'">Forgot Password?</a>
              </label>
              <input type="password" id="password" class="hud-input" placeholder="> ••••••••" required autocomplete="current-password">
            </div>

            <div id="authGlobalError" class="auth-error"></div>

            <button type="submit" id="loginBtn" class="btn-submit">
              <span id="loginBtnText">Login !</span>
            </button>
          </form>

          <div class="auth-footer">
            New For this Website ? <a href="./register" data-nav>Sign-Up</a>
          </div>
        </div>
      </div>
    `;
  }

  async mount() {
    // 1. Initialize Tactical Radar Background
    this.initRadarCanvas();

    // 2. Form Logic & Robust Client Validation
    const form = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    const loginBtnText = document.getElementById('loginBtnText');
    const authGlobalError = document.getElementById('authGlobalError');
    const bioLoader = document.getElementById('biometric-loader');

    if (!form) return;

    // Secure Nav routing
    document.querySelectorAll('[data-nav]').forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            const route = btn.getAttribute('href');
            if (route) Router.navigateTo(route);
        };
    });

    // Real-time Visual Feedback
    emailInput.addEventListener('blur', () => {
      if(!emailInput.value) return;
      const isValid = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(emailInput.value);
      emailInput.className = isValid ? 'hud-input success' : 'hud-input error';
    });

    passwordInput.addEventListener('blur', () => {
      if(!passwordInput.value) return;
      const isValid = passwordInput.value.length >= 6;
      passwordInput.className = isValid ? 'hud-input success' : 'hud-input error';
    });

    emailInput.addEventListener('input', () => emailInput.className = 'hud-input');
    passwordInput.addEventListener('input', () => passwordInput.className = 'hud-input');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      authGlobalError.style.display = 'none';

      const email = emailInput.value.trim();
      const password = passwordInput.value;

      // Local Haptic Validation
      if (!email || !password) {
        if(!email) emailInput.className = 'hud-input error';
        if(!password) passwordInput.className = 'hud-input error';
        this.triggerError(authGlobalError, 'DATA MISSING. PROVIDE ALL CREDENTIALS.');
        return;
      }

      // Simulate Biometric Engine Lock
      loginBtn.disabled = true;
      bioLoader.style.opacity = '1';
      bioLoader.style.pointerEvents = 'all';

      // Minimum artificial delay to force the user to see the cool animation
      await new Promise(r => setTimeout(r, 1200));

      try {
        // Core Business Logic Remains EXACTLY untouched
        const authResult = await AuthService.login(email, password);
        
        if (authResult && authResult.status === 'unverified') {
          bioLoader.style.opacity = '0'; bioLoader.style.pointerEvents = 'none';
          loginBtn.disabled = false;
          this.triggerError(authGlobalError, 'BIOMETRICS UNVERIFIED. CHECK INBOX.');
          return;
        }
        
        // Success: Router handles the state change automatically via app.js listener
      } catch (error) {
        console.error('[LoginView] Auth error:', error);
        
        bioLoader.style.opacity = '0'; bioLoader.style.pointerEvents = 'none';
        loginBtn.disabled = false;
        
        let errorMsg = 'INVALID CREDENTIALS. ACCESS DENIED.';
        if (error.code === 'auth/too-many-requests') {
          errorMsg = 'LOCKOUT ENGAGED. TOO MANY FAILED ATTEMPTS.';
        } else if (error.code === 'auth/network-request-failed') {
          errorMsg = 'UPLINK SEVERED. CHECK NETWORK CONNECTION.';
        }

        this.triggerError(authGlobalError, errorMsg);
        passwordInput.value = ''; // Force them to re-enter
        passwordInput.focus();
      }
    });
  }

  triggerError(el, msg) {
      el.textContent = msg;
      el.style.display = 'block';
      // Re-trigger animation
      el.style.animation = 'none';
      el.offsetHeight; 
      el.style.animation = 'shake 0.4s cubic-bezier(.36,.07,.19,.97) both';
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
          
          ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'; // Trail effect
          ctx.fillRect(0, 0, width, height);

          const cx = width / 2;
          const cy = height / 2;
          const radius = Math.min(width, height) * 0.8;

          // Draw Grid
          ctx.strokeStyle = 'rgba(10, 132, 255, 0.1)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          for(let i=0; i<width; i+=50) { ctx.moveTo(i, 0); ctx.lineTo(i, height); }
          for(let i=0; i<height; i+=50) { ctx.moveTo(0, i); ctx.lineTo(width, i); }
          ctx.stroke();

          // Draw Radar Rings
          ctx.beginPath();
          ctx.arc(cx, cy, radius * 0.33, 0, Math.PI * 2);
          ctx.arc(cx, cy, radius * 0.66, 0, Math.PI * 2);
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.stroke();

          // Draw Sweeping Line
          angle += 0.02;
          const x = cx + Math.cos(angle) * radius;
          const y = cy + Math.sin(angle) * radius;

          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(x, y);
          ctx.strokeStyle = 'rgba(10, 132, 255, 0.8)';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Add random blips
          if(Math.random() > 0.95) {
              const bx = cx + (Math.random()-0.5) * radius * 1.5;
              const by = cy + (Math.random()-0.5) * radius * 1.5;
              ctx.fillStyle = '#30D158';
              ctx.beginPath();
              ctx.arc(bx, by, 3, 0, Math.PI*2);
              ctx.fill();
          }
      };
      draw();
  }

  async destroy() {
      if(this.radarInterval) cancelAnimationFrame(this.radarInterval);
  }
}
