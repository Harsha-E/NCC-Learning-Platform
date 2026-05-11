import AbstractView from '../core/AbstractView.js';
import Store from '../core/store.js';
import AuthService from '../services/auth.service.js';

export default class ProfileView extends AbstractView {
  async getHtml() {
    return `
      <style>
        /* ==========================================================================
           TACTICAL DARK THEME PROFILE
           ========================================================================== */
        :root {
            --bg-deep: #030508;
            --text-pure: #FFFFFF;
            --text-muted: #8E8E93;
            --ncc-saffron: #FF9933;
            --ncc-green: #138808;
            --tech-blue: #0A84FF;
            --bg-bento: rgba(15, 20, 25, 0.5);
            --border-glass: rgba(255, 255, 255, 0.08);
        }

        .profile-viewport {
            min-height: 100dvh;
            background-color: var(--bg-deep);
            /* 8rem top clears navbar, 6rem bottom clears mobile dock */
            padding: 8rem 1.5rem 6rem 1.5rem; 
            box-sizing: border-box;
            color: var(--text-pure);
            font-family: "SF Pro Display", "Inter", sans-serif;
            overflow-y: auto;
        }

        .profile-container {
          max-width: 800px; margin: 0 auto;
          animation: fadeIn 0.4s ease-out;
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        
        .profile-header { text-align: center; margin-bottom: 2.5rem; }
        .profile-header h1 {
          font-size: clamp(2rem, 5vw, 2.8rem);
          font-weight: 800; letter-spacing: -0.03em; margin-bottom: 0.5rem;
          color: var(--text-pure);
        }
        .profile-header p { color: var(--text-muted); font-size: 1.1rem; margin: 0; }
        
        .profile-card {
          background: var(--bg-bento);
          backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
          border-radius: 24px; padding: 2.5rem;
          box-shadow: 0 20px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05);
          border: 1px solid var(--border-glass);
        }
        
        .form-group { margin-bottom: 1.5rem; }
        .form-label { display: block; font-size: 0.85rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 1px; }
        
        .form-input { 
          width: 70%; max-width: 85%; padding: 1rem 1.2rem; 
          background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); 
          border-radius: 12px; font-size: 1rem; color: var(--text-pure); 
          transition: all 0.3s ease; box-sizing: border-box; font-family: inherit;
        }
        .form-input:focus { outline: none; border-color: var(--tech-blue); background: rgba(10, 132, 255, 0.05); box-shadow: inset 0 0 20px rgba(10,132,255,0.1); }
        .form-input:disabled { background: rgba(255,255,255,0.02); color: rgba(255,255,255,0.3); cursor: not-allowed; border-color: rgba(255,255,255,0.05); }
        
        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
          gap: 1.5rem;
        }
        
        .btn-save { 
          width: 100%; padding: 1.2rem; background: var(--ncc-green); color: #FFF; 
          border: none; border-radius: 12px; font-weight: 800; font-size: 1.1rem; 
          text-transform: uppercase; letter-spacing: 2px;
          cursor: pointer; transition: 0.3s ease; margin-top: 1.5rem; 
        }
        .btn-save:hover { background: #0D6606; transform: translateY(-2px); box-shadow: 0 10px 30px rgba(19,136,8,0.3); }
        .btn-save:disabled { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.3); cursor: not-allowed; transform: none; box-shadow: none; }
        
        .spinner-inline { display: none; width: 20px; height: 20px; border: 3px solid rgba(255,255,255,0.3); border-radius: 50%; border-top-color: white; animation: spin 1s ease-in-out infinite; vertical-align: middle; margin-right: 8px; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        
        .status-message { margin-top: 1.5rem; padding: 1rem; border-radius: 12px; text-align: center; font-weight: 700; display: none; text-transform: uppercase; letter-spacing: 1px; font-size: 0.85rem;}
        .status-message.success { background: rgba(48, 209, 88, 0.1); color: var(--ncc-green); border: 1px solid rgba(48, 209, 88, 0.2); }
        .status-message.error { background: rgba(255, 69, 58, 0.1); color: #FF453A; border: 1px solid rgba(255, 69, 58, 0.2); }
        
        .profile-skeleton { background: rgba(15,20,25,0.3); border-radius: 24px; padding: 2.5rem; border: 1px solid var(--border-glass); }
        .sk-header { height: 40px; width: 250px; margin: 0 auto 0.5rem auto; border-radius: 8px; background: rgba(255,255,255,0.1); animation: pulse 1.5s infinite; }
        .sk-sub { height: 20px; width: 350px; margin: 0 auto 2.5rem auto; border-radius: 6px; background: rgba(255,255,255,0.1); animation: pulse 1.5s infinite; }
        .sk-label { height: 16px; width: 120px; margin-bottom: 0.75rem; border-radius: 4px; background: rgba(255,255,255,0.1); animation: pulse 1.5s infinite; }
        .sk-input { height: 50px; width: 100%; border-radius: 12px; margin-bottom: 1.5rem; background: rgba(255,255,255,0.05); animation: pulse 1.5s infinite; }
        .sk-btn { height: 55px; width: 100%; border-radius: 12px; margin-top: 1.5rem; background: rgba(255,255,255,0.1); animation: pulse 1.5s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        
        .hidden-layer { display: none !important; opacity: 0; }
        .visible-layer { display: block !important; animation: fadeIn 0.4s ease-out forwards; }

        @media (max-width: 600px) {
            .profile-card { padding: 1.5rem; border-radius: 16px; }
            .profile-skeleton { padding: 1.5rem; border-radius: 16px; }
            .profile-viewport { padding-top: 6rem; padding-bottom: 6rem; }
            .form-grid { grid-template-columns: 1fr; }
        }
      </style>

      <div class="profile-viewport">
          <div class="profile-container">
            <div id="skeletonLayer">
                <div class="profile-header">
                    <div class="sk-header"></div>
                    <div class="sk-sub"></div>
                </div>
                <div class="profile-skeleton">
                    <div class="sk-label"></div><div class="sk-input"></div>
                    <div class="form-grid">
                        <div><div class="sk-label"></div><div class="sk-input"></div></div>
                        <div><div class="sk-label"></div><div class="sk-input"></div></div>
                    </div>
                    <div class="form-grid">
                        <div><div class="sk-label"></div><div class="sk-input"></div></div>
                        <div><div class="sk-label"></div><div class="sk-input"></div></div>
                    </div>
                    <div class="sk-btn"></div>
                </div>
            </div>

            <div id="dataLayer" class="hidden-layer">
              <div class="profile-header">
                <h1>Deployment Profile</h1>
                <p>Manage your operational identity and training protocols</p>
              </div>
              <div class="profile-card">
                <form id="profileForm">
                  
                <div class="form-group">
                  <label class="form-label" for="email">Comms Uplink (Email)</label>
                  <input type="email" id="email" class="form-input" disabled>
                </div>

                <div class="form-grid">
                  <div class="form-group">
                    <label class="form-label" for="displayName">Target Designation (Name)</label>
                    <input type="text" id="displayName" name="displayName" class="form-input" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="serviceNumber">Service Number</label>
                    <input type="text" id="serviceNumber" name="serviceNumber" class="form-input" placeholder="> AP21SDA" required style="text-transform: uppercase;">
                  </div>
                </div>

                <div class="form-grid">
                  <div class="form-group">
                    <label class="form-label" for="certificate">Target Objective</label>
                    <select id="certificate" name="certificate" class="form-input">
                      <option value="A">Certificate A</option>
                      <option value="B">Certificate B</option>
                      <option value="C">Certificate C</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="wing">Service Wing</label>
                    <select id="wing" name="wing" class="form-input">
                      <option value="army">Army</option>
                      <option value="navy">Navy</option>
                      <option value="airforce">Air Force</option>
                    </select>
                  </div>
                </div>

                <button type="submit" id="saveBtn" class="btn-save">
                  <span class="spinner-inline" id="saveSpinner"></span>
                  <span id="saveBtnText">Execute Update</span>
                </button>
                <div id="statusMessage" class="status-message"></div>
              </form>
            </div>
          </div>
      </div>
    `;
  }

  async mount() {
    this.hydrateForm(Store.get('profile'), Store.get('user'));
    setTimeout(() => {
        document.getElementById('skeletonLayer').style.display = 'none';
        document.getElementById('dataLayer').classList.remove('hidden-layer');
        document.getElementById('dataLayer').classList.add('visible-layer');
    }, 1000);

    this.unsubscribe = Store.subscribe('profile', (newProfile) => {
      this.hydrateForm(newProfile, Store.get('user'));
    });

    const form = document.getElementById('profileForm');
    if (form) form.addEventListener('submit', this.handleSave.bind(this));
  }

  hydrateForm(profileData, userData) {
    if (!profileData) return;
    const emailEl = document.getElementById('email');
    const nameEl = document.getElementById('displayName');
    const serviceEl = document.getElementById('serviceNumber');
    const certEl = document.getElementById('certificate');
    const wingEl = document.getElementById('wing');

    if (emailEl && userData) emailEl.value = userData.email || '';
    if (nameEl) nameEl.value = profileData.displayName || '';
    if (serviceEl) serviceEl.value = profileData.serviceNumber || '';
    if (certEl) certEl.value = profileData.certificate || 'A';
    if (wingEl) wingEl.value = profileData.wing || 'army';
  }

  async handleSave(e) {
    e.preventDefault();
    const user = Store.get('user');
    if (!user) return;

    const btn = document.getElementById('saveBtn');
    const spinner = document.getElementById('saveSpinner');
    const btnText = document.getElementById('saveBtnText');
    const statusMsg = document.getElementById('statusMessage');

    if (btn) btn.disabled = true;
    if (spinner) spinner.style.display = 'inline-block';
    if (btnText) btnText.textContent = 'Deploying...';

    try {
      const updates = {
        displayName: document.getElementById('displayName').value.trim(),
        serviceNumber: document.getElementById('serviceNumber').value.trim().toUpperCase(),
        certificate: document.getElementById('certificate').value,
        wing: document.getElementById('wing').value
      };

      await AuthService.updateProfile(user.uid, updates);

      if (statusMsg) {
        statusMsg.textContent = 'UPLINK SECURED. REDIRECTING...';
        statusMsg.className = 'status-message success';
        statusMsg.style.display = 'block';
      }

      setTimeout(() => {
          if(window.Router) window.Router.navigateTo('./dashboard');
      }, 1500);

    } catch (error) {
      if (statusMsg) {
        statusMsg.textContent = error.message || 'DEPLOYMENT FAILED. RETRY.';
        statusMsg.className = 'status-message error';
        statusMsg.style.display = 'block';
      }
      if (btn) btn.disabled = false;
    } finally {
      if (spinner) spinner.style.display = 'none';
      if (btnText) btnText.textContent = 'Execute Update';
    }
  }

  async destroy() {
    if (typeof this.unsubscribe === 'function') this.unsubscribe();
  }
}