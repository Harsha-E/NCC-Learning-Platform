import AbstractView from '../core/AbstractView.js';
import AuthService from '../services/auth.service.js';
import Router from '../core/router.js';

export default class ForgotPasswordView extends AbstractView {
  constructor(params) {
    super(params);
  }

  async getHtml() {
    return `
      <style>
        :root {
            --bg-abyss: #000000;
            --panel-bg: rgba(20, 20, 22, 0.6);
            --border-glass: rgba(255, 255, 255, 0.1);
            --text-pure: #FFFFFF;
            --text-muted: #8E8E93;
            --accent-blue: #0A84FF;
            --accent-blue-glow: rgba(10, 132, 255, 0.3);
            --radius-xl: 24px;
            --radius-md: 12px;
        }

        body, #app-root {
            background: var(--bg-abyss);
            min-height: 100dvh;
        }

        .auth-viewport {
            min-height: 100dvh; width: 100%; background-color: var(--bg-abyss);
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            padding: 8.5rem 1.5rem 6.5rem 1.5rem !important; box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
            position: relative; overflow: hidden; isolation: isolate;
        }

        /* Background Grid Illusion */
        .auth-viewport::before {
            content: ''; position: absolute; inset: 0;
            background-image: 
                linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
            background-size: 30px 30px; pointer-events: none; z-index: 0;
            mask-image: radial-gradient(circle at center, black 10%, transparent 80%);
            -webkit-mask-image: radial-gradient(circle at center, black 10%, transparent 80%);
        }

        .auth-card {
            background: var(--panel-bg); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
            border: 1px solid var(--border-glass); border-radius: var(--radius-xl);
            padding: 3rem; width: 100%; max-width: 420px; z-index: 10;
            box-shadow: 0 25px 50px rgba(0,0,0,0.5);
            animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .auth-header { text-align: center; margin-bottom: 2.5rem; }
        .auth-icon { width: 56px; height: 56px; background: rgba(10, 132, 255, 0.1); border: 1px solid rgba(10, 132, 255, 0.2); border-radius: 16px; display: flex; align-items: center; justify-content: center; color: var(--accent-blue); margin: 0 auto 1.5rem auto; box-shadow: 0 0 20px var(--accent-blue-glow); }
        .auth-title { font-size: 1.8rem; font-weight: 800; color: var(--text-pure); margin: 0 0 0.5rem 0; letter-spacing: -0.02em; }
        .auth-subtitle { color: var(--text-muted); font-size: 0.95rem; line-height: 1.5; margin: 0; }

        .form-group { margin-bottom: 1.5rem; }
        .form-label { display: block; font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.5rem; }
        
        .form-input {
            width: 100%; background: rgba(0,0,0,0.5); border: 1px solid var(--border-glass);
            color: var(--text-pure); padding: 1.1rem 1.25rem; border-radius: var(--radius-md);
            font-size: 1rem; outline: none; transition: 0.3s; box-sizing: border-box;
        }
        .form-input:focus { border-color: var(--accent-blue); box-shadow: 0 0 0 3px var(--accent-blue-glow); }

        .btn-submit {
            width: 100%; padding: 1.2rem; border-radius: 50px; border: none;
            background: var(--text-pure); color: #000; font-weight: 800; font-size: 1.05rem;
            cursor: pointer; transition: 0.2s; margin-top: 1rem; display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .btn-submit:active { transform: scale(0.96); }
        .btn-submit:hover { background: #E4E4E7; }
        .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        .auth-footer { text-align: center; margin-top: 2rem; font-size: 0.9rem; color: var(--text-muted); font-weight: 600; }
        .auth-link { color: var(--accent-blue); text-decoration: none; transition: 0.2s; cursor: pointer; }
        .auth-link:hover { text-shadow: 0 0 10px var(--accent-blue-glow); }

        .feedback-msg { padding: 1rem; border-radius: 8px; font-size: 0.9rem; font-weight: 600; text-align: center; margin-bottom: 1.5rem; display: none; }
        .feedback-msg.error { background: rgba(255, 69, 58, 0.1); border: 1px solid rgba(255, 69, 58, 0.3); color: #FF453A; display: block; }
        .feedback-msg.success { background: rgba(48, 209, 88, 0.1); border: 1px solid rgba(48, 209, 88, 0.3); color: #30D158; display: block; }

        @keyframes slideUpFade { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

        @media (max-width: 768px) {
            .auth-viewport { padding-top: 6.5rem !important; }
            .auth-card { padding: 2rem 1.5rem; border-radius: 20px; border: none; border-top: 1px solid var(--border-glass); }
        }
      </style>

      <div class="auth-viewport">
          <div class="auth-card">
              <div class="auth-header">
                  <div class="auth-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                  </div>
                  <h1 class="auth-title">Forgot Password?</h1>
                  <p class="auth-subtitle">Enter your registered email to reset your password !</p>
              </div>

              <div id="feedbackBox" class="feedback-msg"></div>

              <form id="resetForm">
                  <div class="form-group">
                      <label class="form-label">Registered Email</label>
                      <input type="email" id="resetEmail" class="form-input" placeholder="cadet@gmail.com" required autocomplete="email">
                  </div>
                  
                  <button type="submit" class="btn-submit" id="submitBtn">
                      Send Mail
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                  </button>
              </form>

              <div class="auth-footer">
                  Memorized password? <a class="auth-link" id="backToLogin">Return to Login</a>
              </div>
          </div>
      </div>
    `;
  }

  async mount() {
    const form = document.getElementById('resetForm');
    const emailInput = document.getElementById('resetEmail');
    const submitBtn = document.getElementById('submitBtn');
    const feedbackBox = document.getElementById('feedbackBox');

    document.getElementById('backToLogin').onclick = (e) => {
        e.preventDefault();
        Router.navigateTo('./login');
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = emailInput.value.trim();
      if (!email) return;

      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Transmitting... <span style="display:inline-block; width:14px; height:14px; border:2px solid #000; border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite;"></span>';
      feedbackBox.className = 'feedback-msg'; // Hide previous

      try {
        await AuthService.resetPassword(email);
        feedbackBox.textContent = 'Uplink sent. Check your email for the reset transmission.';
        feedbackBox.className = 'feedback-msg success';
        emailInput.value = '';
        submitBtn.innerHTML = 'Transmission Successful';
      } catch (error) {
        console.error('Reset Error:', error);
        feedbackBox.textContent = error.message || 'Failed to establish connection. Verify your email.';
        feedbackBox.className = 'feedback-msg error';
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Retry Transmission';
      }
    });
  }
}
