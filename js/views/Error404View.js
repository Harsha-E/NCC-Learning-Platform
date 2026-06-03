// filepath: js/views/Error404View.js
// 404 Error page view

import AbstractView from '../core/AbstractView.js';

export default class Error404View extends AbstractView {
  async getHtml() {
    return `
      <div class="error-404" style="min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 6rem 2rem 2rem 2rem; background: #030508; color: #FFFFFF; font-family: 'SF Pro Display', 'Inter', sans-serif; text-align: center; box-sizing: border-box;">
        <h1 style="font-size: clamp(6rem, 15vw, 10rem); font-weight: 900; letter-spacing: -0.05em; color: #EF4444; text-shadow: 0 0 60px rgba(239, 68, 68, 0.3); margin: 0; line-height: 1;">404</h1>
        <h2 style="font-size: clamp(1.5rem, 4vw, 2.5rem); font-weight: 700; margin: 1rem 0; letter-spacing: -0.02em;">Signal Lost</h2>
        <p style="font-size: 1.1rem; color: #8E8E93; max-width: 450px; line-height: 1.6; margin: 0 auto 3rem auto;">The coordinates you entered lead to empty space. The resource you are looking for does not exist in this sector.</p>
        <a href="./" data-nav style="padding: 1.2rem 2.5rem; border-radius: 50px; background: #FFFFFF; color: #000000; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; text-decoration: none; display: inline-flex; align-items: center; gap: 0.75rem; box-shadow: 0 10px 30px rgba(255,255,255,0.15); transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          Return to Command
        </a>
      </div>
    `;
  }

  async mount() {
    // No special mounting needed
  }
}