import AbstractView from '../core/AbstractView.js';
import Store from '../core/store.js';
import ContentService from '../services/content.service.js';
import ProgressService from '../services/progress.service.js';

export default class ModuleView extends AbstractView {
  constructor(params) {
    super(params);
    const queryParams = this.params?.queryParams || Object.fromEntries(new URLSearchParams(window.location.search));
    this.moduleId = queryParams.id || queryParams.module || null;
  }

  async getHtml() {
    return `
      <style>
        .module-container {
          max-width: 1000px;
          margin: 0 auto;
          padding: 2rem 1rem;
          padding-top: 8rem !important;
          min-height: 100dvh !important;
          box-sizing: border-box !important;
          animation: fadeIn 0.4s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .module-header-card {
          background: linear-gradient(135deg, #000080 0%, #138808 100%);
          border-radius: 20px;
          padding: 3rem 2rem;
          color: white;
          margin-bottom: 2rem;
          position: relative;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0,0,128,0.15);
        }
        .module-header-card::before {
          content: ''; position: absolute; top: -50%; right: -10%;
          width: 400px; height: 400px; background: radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%);
          border-radius: 50%;
        }
        .back-link {
          display: inline-flex; align-items: center; gap: 0.5rem;
          color: rgba(255,255,255,0.8); text-decoration: none;
          font-weight: 500; margin-bottom: 1.5rem; transition: color 0.2s;
          position: relative; z-index: 2;
        }
        .back-link:hover { color: white; }
        .module-title {
          font-family: 'Poppins', sans-serif; font-size: clamp(1.8rem, 4vw, 2.5rem); font-weight: 800;
          margin-bottom: 0.5rem; line-height: 1.2; position: relative; z-index: 2;
        }
        .module-desc {
          font-size: 1.1rem; opacity: 0.9; max-width: 600px; line-height: 1.6;
          position: relative; z-index: 2; margin-bottom: 2rem;
        }
        .module-stats {
          display: flex; align-items: center; gap: 2rem; position: relative; z-index: 2;
          background: rgba(255,255,255,0.1); padding: 1.5rem;
          border-radius: 16px; backdrop-filter: blur(10px); display: inline-flex;
        }
        .m-stat { display: flex; flex-direction: column; }
        .m-stat-val { font-weight: 700; font-size: 1.2rem; }
        .m-stat-lbl { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.8; }
        
        .header-circular-progress {
          position: relative; width: 80px; height: 80px;
        }
        .header-circular-progress svg {
          transform: rotate(-90deg);
        }
        .header-progress-circle-bg, .header-progress-circle-fg {
          fill: none; stroke-width: 8;
        }
        .header-progress-circle-bg { stroke: rgba(255,255,255,0.2); }
        .header-progress-circle-fg {
          stroke: white; stroke-linecap: round;
          transition: stroke-dashoffset 0.8s cubic-bezier(0.25, 1, 0.5, 1);
        }
        .header-progress-percent-text {
          position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
          font-family: 'Poppins', sans-serif; font-weight: 700; font-size: 1.2rem; color: white;
        }

        .chapters-section-title {
          font-family: 'Poppins', sans-serif; font-size: 1.5rem; color: #1A1A1A;
          margin-bottom: 1.5rem; font-weight: 700;
        }
        .chapters-list { display: flex; flex-direction: column; gap: 1rem; }
        
        .chapter-card {
          background: white; border: 1px solid #E0E0E0; border-radius: 16px;
          padding: 1.5rem; display: flex; align-items: center; justify-content: space-between;
          transition: all 0.2s; box-shadow: 0 4px 15px rgba(0,0,0,0.02);
        }
        .chapter-card:hover:not(.locked) {
          transform: translateY(-3px); box-shadow: 0 8px 25px rgba(0,0,0,0.06); border-color: #FF9933;
        }
        .chapter-card.locked { opacity: 0.6; filter: grayscale(100%); background: #F8F9FA; cursor: not-allowed; }
        
        .chap-left { display: flex; align-items: center; gap: 1.5rem; }
        .chap-number {
          width: 50px; height: 50px; border-radius: 12px; background: rgba(0,0,128,0.1);
          color: #000080; display: flex; align-items: center; justify-content: center;
          font-size: 1.2rem; font-weight: 700; font-family: 'Poppins', sans-serif; flex-shrink: 0;
        }
        .chapter-card.read .chap-number { background: #138808; color: white; }
        .chap-info h3 {
          font-size: 1.2rem; color: #1A1A1A; margin-bottom: 0.25rem; font-weight: 600;
          display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;
        }
        .chap-info p { color: #666; font-size: 0.9rem; margin: 0; }
        
        .badge-read {
          background: rgba(19,136,8,0.15); color: #138808; padding: 0.2rem 0.6rem;
          border-radius: 6px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase;
        }

        .btn-read {
          padding: 0.8rem 1.5rem; background: #FF9933; color: white; border: none; display: inline-block;
          border-radius: 8px; font-weight: 600; text-decoration: none; transition: all 0.2s; text-align: center;
        }
        .btn-read:hover { background: #E6821A; transform: translateY(-1px); }
        .btn-locked {
          padding: 0.8rem 1.5rem; background: #E9ECEF; color: #999; border: none; width: 100%;
          border-radius: 8px; font-weight: 600; cursor: not-allowed; text-align: center;
        }

        /* Progress visualizer in chapter */
        .chap-progress-bar {
          height: 4px; background: #E0E0E0; border-radius: 2px; width: 100px; margin-top: 0.5rem; overflow: hidden;
        }
        .chap-progress-fill { height: 100%; background: #138808; border-radius: 2px; }
        
        @media (max-width: 640px) {
          .chapter-card { flex-direction: column; align-items: flex-start; gap: 1rem; }
          .chap-right { width: 100%; }
          .btn-read { width: 100%; }
        }
      </style>

      <div class="module-container">
        <div id="module-header-container">
          <!-- Skeleton Loader -->
          <div class="module-header-card" style="opacity: 0.7; animation: pulse 1.5s infinite;">
            <div style="height: 20px; width: 100px; background: rgba(255,255,255,0.2); border-radius: 4px; margin-bottom: 1.5rem;"></div>
            <div style="height: 40px; width: 60%; background: rgba(255,255,255,0.2); border-radius: 8px; margin-bottom: 1rem;"></div>
            <div style="height: 20px; width: 80%; background: rgba(255,255,255,0.2); border-radius: 4px; margin-bottom: 2rem;"></div>
          </div>
        </div>

        <h2 class="chapters-section-title">Curriculum Chapters</h2>
        <div id="chapters-container" class="chapters-list">
          <!-- Skeletons -->
          <div class="chapter-card"><div class="chap-left"><div class="chap-number" style="background: #E0E0E0; color: transparent;">0</div><div style="height:20px; width:200px; background: #f0f0f0; border-radius:4px;"></div></div></div>
          <div class="chapter-card"><div class="chap-left"><div class="chap-number" style="background: #E0E0E0; color: transparent;">0</div><div style="height:20px; width:150px; background: #f0f0f0; border-radius:4px;"></div></div></div>
        </div>
      </div>
    `;
  }

  async mount() {
    if (!this.moduleId) {
      this.renderError('Invalid Module ID specified in the URL.');
      return;
    }

    const user = Store.get('user');
    const profile = Store.get('profile');
    if (!user || !profile) return;

    try {
      // Parallel fetch via strictly managed cache/services
      const [moduleData, chapters, moduleProgress] = await Promise.all([
        ContentService.getModule(profile.certificate || 'A', this.moduleId, profile.wing || 'army'),
        ContentService.getChapters(profile.certificate || 'A', this.moduleId),
        ProgressService.getModuleProgress(user.uid, this.moduleId)
      ]);

      this.renderHeader(moduleData, moduleProgress, chapters.length);
      this.renderChapters(chapters, moduleProgress);
    } catch (error) {
      console.error("[ModuleView] Failed to load data:", error);
      this.renderError('Failed to load module data. Please check your internet connection.');
    }
  }

  renderHeader(moduleData, moduleProgress, totalChapters) {
    const header = document.getElementById('module-header-container');
    if (!moduleData) {
      this.renderError('Module not found or unpublished.');
      return;
    }

    const progressPercent = moduleProgress?.progressPercent || 0;

    header.innerHTML = `
      <div class="module-header-card">
        <a href="./dashboard" class="back-link" data-route>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Back to Dashboard
        </a>
        <h1 class="module-title">${moduleData.title}</h1>
        <p class="module-desc">${moduleData.description || 'Complete all chapters in order to unlock the module quiz.'}</p>

        <div class="module-stats">
          <div class="header-circular-progress">
            <svg viewBox="0 0 100 100">
              <circle class="header-progress-circle-bg" cx="50" cy="50" r="45" />
              <circle class="header-progress-circle-fg" cx="50" cy="50" r="45" style="stroke-dasharray: 282.743; stroke-dashoffset: ${282.743 * (1 - progressPercent / 100)};" />
            </svg>
            <span class="header-progress-percent-text">${progressPercent}%</span>
          </div>
          <div class="m-stat">
            <span class="m-stat-val">${totalChapters}</span>
            <span class="m-stat-lbl">Chapters</span>
          </div>
          <div class="m-stat">
            <span class="m-stat-val">${moduleProgress?.chaptersCompleted || 0}</span>
            <span class="m-stat-lbl">Read</span>
          </div>
        </div>
      </div>
    `;
  }

  renderChapters(chapters, moduleProgress) {
    const container = document.getElementById('chapters-container');
    if (!chapters || chapters.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding: 3rem; color: #666; background: #f8f9fa; border-radius: 12px; border: 1px dashed #e0e0e0;">No chapters available in this module yet. Please check back later.</div>`;
      return;
    }

    const chaptersRead = moduleProgress?.chaptersRead || {};

    container.innerHTML = chapters.map((chapter, index) => {
      // Security Logic: Chapter 1 is always unlocked. Others unlock if the previous chapter is marked as completed.
      const prevChapterId = index > 0 ? chapters[index - 1].id : null;
      const isUnlocked = index === 0 || (prevChapterId && chaptersRead[prevChapterId]?.completed);
      
      const myProgress = chaptersRead[chapter.id];
      const scrollPct = myProgress?.percentScrolled || 0;
      const isRead = myProgress?.completed;

      return `
        <div class="chapter-card ${!isUnlocked ? 'locked' : isRead ? 'read' : ''}">
          <div class="chap-left">
            <div class="chap-number">${isRead ? '✓' : (index + 1)}</div>
            <div class="chap-info">
              <h3>
                ${chapter.title}
                ${isRead ? '<span class="badge-read">Completed</span>' : ''}
              </h3>
              <p>Estimated reading time: ${chapter.estimatedReadTime || 10} minutes</p>
              ${isUnlocked && !isRead && scrollPct > 0 ? `
                <div class="chap-progress-bar"><div class="chap-progress-fill" style="width: ${scrollPct}%;"></div></div>
              ` : ''}
            </div>
          </div>
          <div class="chap-right">
            ${isUnlocked 
              ? `<a href="./chapter?module=${this.moduleId}&chapter=${chapter.id}" class="btn-read" data-route>${scrollPct > 0 && !isRead ? 'Continue Reading' : 'Read Chapter'}</a>` 
              : `<button class="btn-locked" disabled>Locked</button>`
            }
          </div>
        </div>
      `;
    }).join('');
  }

  renderError(msg) {
    document.getElementById('module-header-container').innerHTML = `
      <div style="background: rgba(220,38,38,0.05); color: #DC2626; padding: 2.5rem; border-radius: 16px; border: 1px solid rgba(220,38,38,0.2); text-align: center;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
        <h2 style="margin-bottom: 0.5rem; font-family: 'Poppins', sans-serif; color: #1A1A1A;">Data Unavailable</h2>
        <p>${msg}</p>
        <a href="./dashboard" data-route style="display: inline-block; margin-top: 1.5rem; color: #DC2626; text-decoration: none; font-weight: 600; padding: 0.8rem 1.5rem; background: rgba(220,38,38,0.1); border-radius: 8px;">Return to Dashboard</a>
      </div>
    `;
    document.getElementById('chapters-container').innerHTML = '';
  }
}
