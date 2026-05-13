import Store from '../core/store.js';
import AuthService from '../services/auth.service.js';

class NavbarComponent {
    constructor() {
        this.navRoot = document.getElementById('nav-root');
        this.lastScrollY = window.scrollY;
        this.initDOM();
        this.bindEvents();
        window.Navbar = this;
        
        if (typeof Store.subscribe === 'function') {
            Store.subscribe('user', () => this.render());
            Store.subscribe('profile', () => this.render());
        }
    }

    initDOM() {
        if (!document.getElementById('aww-navbar-styles')) {
            const style = document.createElement('style');
            style.id = 'aww-navbar-styles';
            style.textContent = `
                /* ==========================================================================
                   TACTICAL NAVBAR & GLOWING MOBILE DOCK (STRICT FLEXBOX)
                   ========================================================================== */
                .aww-navbar {
                    position: fixed; top: 1.5rem; left: 50%; transform: translateX(-50%);
                    z-index: 9000; display: flex; align-items: center; justify-content: space-between;
                    height: 4.5rem; width: 90%; max-width: 860px; padding: 0 1rem 0 1.5rem;
                    background: rgba(15, 20, 25, 0.5); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
                    border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 100px;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
                    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease;
                    box-sizing: border-box;
                }
                .aww-navbar.hidden { transform: translate(-50%, -150%); opacity: 0; }

                .nav-brand { display: flex; align-items: center; gap: 10px; font-family: "JetBrains Mono", monospace; font-weight: 800; font-size: 1rem; color: #FFFFFF; letter-spacing: 1.5px; flex-shrink: 0; }
                .brand-dot { width: 8px; height: 8px; background: #30D158; border-radius: 50%; box-shadow: 0 0 12px rgba(48, 209, 88, 0.8); animation: pulse-dot 2s infinite; flex-shrink: 0; }
                @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

                .nav-links { display: flex; align-items: center; gap: 0.25rem; background: rgba(0, 0, 0, 0.4); padding: 0.35rem; border-radius: 50px; border: 1px solid rgba(255, 255, 255, 0.05); }
                .nav-item { position: relative; padding: 0.6rem 1.25rem; color: #B7BCC4; text-decoration: none; font-size: 0.85rem; font-weight: 700; border-radius: 50px; transition: 0.3s ease; z-index: 1; text-transform: uppercase; letter-spacing: 1px; white-space: nowrap; }
                .nav-item:hover { color: #FFFFFF; }
                .nav-item.active { color: #0A84FF; text-shadow: 0 0 15px rgba(10,132,255,0.4); }
                .nav-item.active::before { content: ''; position: absolute; inset: 0; background: rgba(10, 132, 255, 0.1); border-radius: 50px; z-index: -1; border: 1px solid rgba(10, 132, 255, 0.2); }

                /* STRICT NO-SQUISH CONTAINER FOR ACTIONS */
                .nav-actions { 
                    display: flex !important; 
                    flex-direction: row !important; 
                    flex-wrap: nowrap !important;
                    align-items: center !important; 
                    justify-content: flex-end !important;
                    gap: 0.75rem !important; 
                    flex-shrink: 0 !important;
                    margin-left: auto;
                }
                
                .icon-btn { 
                    width: 44px !important; 
                    height: 44px !important; 
                    min-width: 44px !important;
                    min-height: 44px !important;
                    aspect-ratio: 1 / 1 !important;
                    border-radius: 50% !important; 
                    background: rgba(15, 20, 25, 0.92);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    flex-shrink: 0 !important;
                    padding: 0 !important;
                    color: #F8FAFC;
                    transition: 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .icon-btn:hover { border-color: #0A84FF; color: #0A84FF; transform: scale(1.05) translateY(-2px); box-shadow: 0 5px 15px rgba(10,132,255,0.2); }
                .icon-btn.logout:hover { border-color: #FF453A; color: #FF453A; box-shadow: 0 5px 15px rgba(255,69,58,0.2); }
                
                .nav-icon { 
                    
                    width: 20px !important; 
                    height: 20px !important; 
                    stroke-width: 2.5; 
                    flex-shrink: 0 !important;
                }
                
                /* --- MOBILE DOCK --- */
                .mobile-dock { display: none; position: fixed; bottom: 1.5rem; left: 50%; transform: translateX(-50%); z-index: 9000; background: rgba(15, 20, 25, 0.85); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 50px; padding: 0.5rem; gap: 0.5rem; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6); transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
                .dock-item { width: 50px; height: 50px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #B7BCC4; text-decoration: none; transition: 0.3s; position: relative; }
                .dock-item:hover { color: #FFF; background: rgba(255,255,255,0.05); }
                .dock-item.active { color: #0A84FF; background: rgba(10,132,255,0.1); border: 1px solid rgba(10,132,255,0.2); box-shadow: 0 0 15px rgba(10,132,255,0.3); }
                .dock-item svg { width: 22px; height: 22px; }

                /* --- CUSTOM LOGOUT MODAL --- */
                .logout-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(10px); z-index: 99999; display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: 0.3s ease; }
                .logout-overlay.active { opacity: 1; pointer-events: all; }
                .logout-card { background: #1C1C1E; border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 2.5rem; width: 90%; max-width: 400px; text-align: center; transform: scale(0.95); transition: 0.4s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 30px 60px rgba(0,0,0,0.6); }
                .logout-overlay.active .logout-card { transform: scale(1); }
                .logout-icon { width: 64px; height: 64px; background: rgba(255,69,58,0.15); color: #FF453A; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem auto; box-shadow: 0 0 20px rgba(255,69,58,0.2); }
                .logout-title { font-size: 1.5rem; font-weight: 800; color: #FFF; margin: 0 0 0.5rem 0; }
                .logout-desc { color: #B7BCC4; font-size: 0.95rem; margin: 0 0 2rem 0; line-height: 1.5; }
                .logout-actions { display: flex; gap: 1rem; }
                .modal-btn { flex: 1; padding: 1rem; border-radius: 50px; font-weight: 800; font-size: 1rem; cursor: pointer; transition: 0.2s; border: none; text-transform: uppercase; }
                .btn-cancel { background: rgba(255,255,255,0.05); color: #FFF; border: 1px solid rgba(255,255,255,0.1); }
                .btn-cancel:hover { background: rgba(255,255,255,0.1); }
                .btn-confirm { background: #FF453A; color: #000; box-shadow: 0 4px 15px rgba(255,69,58,0.3); }
                .btn-confirm:hover { background: #D70015; box-shadow: 0 8px 25px rgba(255,69,58,0.4); }

                @media (max-width: 768px) {
                    .aww-navbar { top: 1rem; width: 94%; padding: 0.5rem 0.75rem; height: auto; }
                    .nav-brand span { display: none; }
                    .nav-links { display: none; }
                    .nav-actions { margin-left: auto !important; width: auto !important; }
                    .icon-btn { width: 40px !important; height: 40px !important; min-width: 40px !important; color: #F8FAFC;}
                    .mobile-dock { display: flex; }
                }
            `;
            document.head.appendChild(style);
        }
        this.render();
    }

    render() {
        if (!this.navRoot) return;
        const user = Store.get('user');
        const profile = Store.get('profile');
        
        const currentHash = window.location.hash || '#/';
        const isActive = (path) => currentHash.includes(path) ? 'active' : '';

        let navHtml = '';

        if (user) {
            const isAdmin = profile?.role === 'admin';
            let linksHtml = '';
            let mobileDockHtml = '';

            if (isAdmin) {
                linksHtml = `
                    <a href="/admin/dashboard" class="nav-item ${isActive('admin/dashboard')}" data-nav>Content Forge</a>
                    <a href="/admin/blueprint" class="nav-item ${isActive('admin/blueprint')}" data-nav>System Blueprint</a>
                `;
                mobileDockHtml = `
                    <a href="/admin/dashboard" class="dock-item ${isActive('admin/dashboard')}" data-nav><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg></a>
                    <a href="/admin/blueprint" class="dock-item ${isActive('admin/blueprint')}" data-nav><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg></a>
                `;
            } else {
                linksHtml = `
                    <a href="/dashboard" class="nav-item ${isActive('/dashboard')}" data-nav>Dashboard</a>
                    <a href="/learning" class="nav-item ${isActive('/learning')}" data-nav>Curriculum</a>
                    <a href="/quizzes" class="nav-item ${isActive('/quizzes')}" data-nav>Telemetry</a>
                `;
                mobileDockHtml = `
                    <a href="/dashboard" class="dock-item ${isActive('/dashboard')}" data-nav><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg></a>
                    <a href="/learning" class="dock-item ${isActive('/learning')}" data-nav><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg></a>
                    <a href="/quizzes" class="dock-item ${isActive('/quizzes')}" data-nav><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></a>
                `;
            }

            navHtml = `
                <nav class="aww-navbar" id="global-nav">
                    <div class="nav-brand"><div class="brand-dot"></div><span>NCC CORE</span></div>
                    <div class="nav-links">${linksHtml}</div>
                    
                    <div class="nav-actions">
                        ${!isAdmin ? `
                        <a href="/profile" class="icon-btn" data-nav title="Profile">
                            <svg class="nav-icon" stroke="white" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        </a>` : ''}
                        <button id="navLogoutBtn" class="icon-btn logout" title="Logout">
                            <svg class="nav-icon" stroke="white" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                        </button>
                    </div>
                </nav>
                <div class="mobile-dock" id="mobile-dock">${mobileDockHtml}</div>
                
                <div class="logout-overlay" id="customLogoutModal">
                    <div class="logout-card">
                        <div class="logout-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg></div>
                        <h3 class="logout-title">Terminate Session?</h3>
                        <p class="logout-desc">You are about to sever your connection to the NCC Terminal. Active unsaved telemetry may be lost.</p>
                        <div class="logout-actions">
                            <button class="modal-btn btn-cancel" id="cancelLogout">Abort</button>
                            <button class="modal-btn btn-confirm" id="confirmLogout">Log Out</button>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // --- UPDATED GUEST VIEW WITH BOTH BUTTONS ---
            navHtml = `
                <nav class="aww-navbar" id="global-nav">
                    <div class="nav-brand"><div class="brand-dot" style="background:#0A84FF; box-shadow: 0 0 10px rgba(10,132,255,0.6);"></div><span>NCC CORE</span></div>
                    <div class="nav-actions">
                        <a href="/login" class="nav-item ${isActive('/login')}" data-nav>Sign In</a>
                        <a href="/register" class="nav-item ${isActive('/register')}" data-nav style="background: rgba(10, 132, 255, 0.1); border: 1px solid rgba(10, 132, 255, 0.2);">Register</a>
                    </div>
                </nav>
            `;
        }

        this.navRoot.innerHTML = navHtml;
        this.bindLogoutEvents();
    }

    bindEvents() {
        window.addEventListener('hashchange', () => setTimeout(() => this.render(), 50));
    }
    bindLogoutEvents() {
    const logoutBtn = document.getElementById('navLogoutBtn');
    const modal = document.getElementById('customLogoutModal');
    const cancelBtn = document.getElementById('cancelLogout');
    const confirmBtn = document.getElementById('confirmLogout');

    if (!logoutBtn || !modal) return;

    logoutBtn.onclick = (e) => {
        e.preventDefault();
        modal.classList.add('active');
    };

    cancelBtn.onclick = () => modal.classList.remove('active');
    
    modal.onclick = (e) => { if(e.target === modal) modal.classList.remove('active'); };

    confirmBtn.onclick = async () => {
        modal.classList.remove('active');
        if (AuthService && typeof AuthService.logout === 'function') {
            await AuthService.logout();
        }
        if (window.Router) window.Router.navigateTo('/login');
    };
}
}

const Navbar = new NavbarComponent();
export default Navbar;

let isNavCloakEngaged = false;
export const initNavbar = () => {
    Navbar.render(); 
    if (isNavCloakEngaged) return; 
    let lastScrollY = window.scrollY;
    
    window.addEventListener('scroll', () => {
        const navbar = document.getElementById('global-nav');
        const dock = document.getElementById('mobile-dock');
        
        if (window.scrollY < 50) {
            if (navbar) navbar.classList.remove('hidden');
            if (dock) dock.style.transform = 'translate(-50%, 0)';
            return;
        }
        
        if (window.scrollY > lastScrollY) {
            if (navbar) navbar.classList.add('hidden');
            if (dock) dock.style.transform = 'translate(-50%, 150%)'; 
        } else {
            if (navbar) navbar.classList.remove('hidden');
            if (dock) dock.style.transform = 'translate(-50%, 0)'; 
        }
        lastScrollY = window.scrollY;
    }, { passive: true });
    
    isNavCloakEngaged = true;
};
