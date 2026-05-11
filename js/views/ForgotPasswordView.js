import AbstractView from '../core/AbstractView.js';
import AuthService from '../services/auth.service.js';
import Router from '../core/router.js';

export default class ForgotPasswordView extends AbstractView {
  async getHtml() {
    return `
      <style>
        .forgot-password-page {
          max-width: 520px;
          margin: 4rem auto;
          padding: 2rem;
          background: white;
          border: 1px solid #E9ECEF;
          border-radius: 24px;
          box-shadow: 0 14px 40px rgba(0,0,0,0.06);
          animation: fadeIn 0.35s ease-out;
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        .forgot-password-page h1 { font-family: 'Poppins', sans-serif; font-size: 2rem; margin-bottom: 0.75rem; color: #000080; }
        .forgot-password-page p { color: #555; line-height: 1.7; margin-bottom: 1.75rem; }
        .form-group { margin-bottom: 1.25rem; }
        .form-group label { display: block; margin-bottom: 0.5rem; color: #333; font-weight: 600; }
        .form-group input { width: 100%; padding: 1rem 1.2rem; border: 1px solid #D1D5DB; border-radius: 12px; font-size: 1rem; }
        .btn-submit { width: 100%; padding: 1rem 1.25rem; background: #FF9933; color: white; border: none; border-radius: 12px; font-size: 1rem; font-weight: 700; cursor: pointer; }
        .btn-submit:disabled { opacity: 0.65; cursor: not-allowed; }
        .form-footer { margin-top: 1rem; text-align: center; color: #666; }
        .form-footer a { color: #FF9933; text-decoration: none; }
        .alert { display: none; margin-bottom: 1rem; padding: 1rem 1.25rem; border-radius: 12px; }
        .alert.error { background: rgba(220,38,38,0.1); color: #B91C1C; border: 1px solid rgba(220,38,38,0.2); }
        .alert.success { background: rgba(19,136,8,0.1); color: #166534; border: 1px solid rgba(19,136,8,0.2); }
      </style>

      <div class="forgot-password-page">
        <h1>Reset Your Password</h1>
        <p>Enter your email address and we will send a secure password reset link to your inbox.</p>

        <div id="forgotAlert" class="alert"></div>

        <form id="forgotPasswordForm">
          <div class="form-group">
            <label for="resetEmail">Email address</label>
            <input type="email" id="resetEmail" required placeholder="you@example.com" />
          </div>
          <button type="submit" id="resetBtn" class="btn-submit">Send Reset Link</button>
        </form>

        <div class="form-footer">
          <a href="./login" data-route>Back to login</a>
        </div>
      </div>
    `;
  }

  async mount() {
    const form = document.getElementById('forgotPasswordForm');
    const resetEmail = document.getElementById('resetEmail');
    const resetBtn = document.getElementById('resetBtn');
    const forgotAlert = document.getElementById('forgotAlert');

    if (!form) return;

    const showMessage = (message, type = 'error') => {
      forgotAlert.textContent = message;
      forgotAlert.className = `alert ${type}`;
      forgotAlert.style.display = 'block';
    };

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = resetEmail.value.trim();

      if (!email) {
        showMessage('Please enter your registered email address.', 'error');
        return;
      }

      resetBtn.disabled = true;
      resetBtn.textContent = 'Sending...';

      try {
        await AuthService.resetPassword(email);
        showMessage('Password reset email sent. Check your inbox to continue.', 'success');
      } catch (error) {
        console.error('[ForgotPasswordView] Reset error:', error);
        showMessage('Unable to send reset email. Please verify your email and try again.', 'error');
      } finally {
        resetBtn.disabled = false;
        resetBtn.textContent = 'Send Reset Link';
      }
    });

    document.querySelectorAll('a[data-route]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        Router.navigateTo(link.getAttribute('href'));
      });
    });
  }
}
