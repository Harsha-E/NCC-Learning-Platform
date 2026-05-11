// filepath: js/views/Error404View.js
// 404 Error page view

import AbstractView from '../core/AbstractView.js';

export default class Error404View extends AbstractView {
  async getHtml() {
    return `
      <div class="error-404 text-center py-12">
        <h1 class="text-6xl font-bold text-error mb-4">404</h1>
        <h2 class="text-2xl font-semibold mb-4">Page Not Found</h2>
        <p class="text-secondary mb-8">The page you're looking for doesn't exist.</p>
        <a href="./" class="btn btn-primary">Go Home</a>
      </div>
    `;
  }

  async mount() {
    // No special mounting needed
  }
}