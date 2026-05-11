import { waitForAuthReady, getCachedAuthData } from './firebase-init.js';
import { initNavbar } from '../components/navbar.js';

const ROUTES = {
  '/': { view: () => import('../views/HomeView.js'), rules: { guestOnly: true } },
  '/login': { view: () => import('../views/LoginView.js'), rules: { guestOnly: true } },
  '/register': { view: () => import('../views/RegisterView.js'), rules: { guestOnly: true } },
  '/dashboard': { view: () => import('../views/DashboardView.js'), rules: { requireAuth: true } },
  '/module': { view: () => import('../views/ModuleView.js'), rules: { requireAuth: true } },
  '/chapter': { view: () => import('../views/ChapterView.js'), rules: { requireAuth: true } },
  
  '/learning': { view: () => import('../views/LearningView.js'), rules: { requireAuth: true } },
  '/quizzes': { view: () => import('../views/QuizzesView.js'), rules: { requireAuth: true } },

  '/quiz': { view: () => import('../views/QuizView.js'), rules: { requireAuth: true } },
  '/results': { view: () => import('../views/QuizResultView.js'), rules: { requireAuth: true } },
  '/mock-test': { view: () => import('../views/MockTestView.js'), rules: { requireAuth: true } },
  '/forgot-password': { view: () => import('../views/ForgotPasswordView.js'), rules: { guestOnly: true } },
  '/profile': { view: () => import('../views/ProfileView.js'), rules: { requireAuth: true } },
  '/admin/dashboard': { view: () => import('../views/AdminDashboardView.js'), rules: { requireAuth: true, role: 'admin' } },
  '/admin/blueprint': { view: () => import('../views/BlueprintView.js'), rules: { requireAuth: true, role: 'admin' } },
  '/mock-exam': { view: () => import('../views/MockExamView.js'), rules: { requireAuth: true } },
  '/404': { view: () => import('../views/Error404View.js'), rules: {} }
};

export default class Router {

  // Extracts the path from the hash (e.g., "#/dashboard?user=1" -> "/dashboard")
  static getHashPath() {
    let hash = window.location.hash.slice(1);
    if (!hash) return '/';
    const path = hash.split('?')[0]; 
    return path || '/';
  }

  // Extracts query parameters from the hash (e.g., "#/quiz?module=1" -> { module: '1' })
  static getHashQueryParams() {
    let hash = window.location.hash.slice(1);
    if (!hash || !hash.includes('?')) return {};
    const queryString = hash.split('?')[1];
    return Object.fromEntries(new URLSearchParams(queryString));
  }

  static MapsTo(path) {
    if (ROUTES[path]) return path;
    const sortedRoutes = Object.keys(ROUTES).sort((a, b) => b.length - a.length);
    for (const routeKey of sortedRoutes) {
      if (routeKey === '/') continue;
      if (path === routeKey || path.endsWith(routeKey)) return routeKey;
    }
    return null;
  }

  static async dropCurtain() {
    let curtain = document.getElementById('router-curtain');
    if (!curtain) {
      curtain = document.createElement('div');
      curtain.id = 'router-curtain';
      curtain.style.cssText = `
        position: fixed; inset: 0; top: 0; 
        background: #020617; 
        z-index: 99999; opacity: 0; pointer-events: none;
        transition: opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      `;
      document.body.appendChild(curtain);
    }
    return new Promise(resolve => {
      curtain.style.pointerEvents = 'all';
      requestAnimationFrame(() => {
        curtain.style.opacity = '1';
        setTimeout(resolve, 350); 
      });
    });
  }

  static liftCurtain() {
    const curtain = document.getElementById('router-curtain');
    if (curtain) {
      curtain.style.opacity = '0';
      setTimeout(() => { curtain.style.pointerEvents = 'none'; }, 350);
    }
  }

  // Converts standard paths into hash paths and updates the URL
  static async navigateTo(destination) {
     let cleanDest = destination;
     
     // Strip out origin if absolute URL
     if (cleanDest.startsWith(window.location.origin)) {
         cleanDest = cleanDest.replace(window.location.origin, '');
     }
     
     // Handle relative paths
     if (cleanDest.startsWith('./')) cleanDest = cleanDest.substring(1);
     if (!cleanDest.startsWith('/')) cleanDest = '/' + cleanDest;
     
     const newHash = '#' + cleanDest;

     if (window.location.hash === newHash) return; // Already there

     await this.dropCurtain();
     window.location.hash = newHash; // Triggers 'hashchange' event naturally
  }

  static async init() {
    if (window._routerInitialized) return;
    window._routerInitialized = true;

    // Intercept all anchor clicks to route them through the hash system
    document.body.addEventListener('click', async e => {
      const link = e.target.closest('a');
      if (!link || link.hasAttribute('data-bypass') || link.target === '_blank' || link.rel === 'external') return;

      const href = link.getAttribute('href');
      if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:') || href.startsWith('#')) return;

      e.preventDefault();
      await this.navigateTo(href);
    });

    // Listen for manual URL changes or browser back/forward buttons
    window.addEventListener('hashchange', async () => {
      await this.dropCurtain();
      await this.navigate();
    });
    
    // Boot sequence: If no hash exists, default to home
    if (!window.location.hash || window.location.hash === '#') {
        window.location.hash = '#/'; 
    } else {
        await this.navigate();
    }
  }

  static async navigate() {
    const appRoot = document.getElementById('app-root');
    const startTime = Date.now(); 

    if (appRoot) {
      appRoot.style.opacity = '0';
      appRoot.style.transform = 'scale(0.98)';
      appRoot.style.transition = 'none'; 
    }

    const path = this.getHashPath();
    const routeKey = Router.MapsTo(path) || '/404';
    let route = ROUTES[routeKey] || ROUTES['/404'];

    await waitForAuthReady();
    const authData = getCachedAuthData();
    const user = authData?.user;
    const role = authData?.role;

    // Security & Role Redirects
    if (route.rules.requireAuth && !user) {
      window.location.hash = '#/'; // Redirect to home/login if unauthorized
      return; 
    } else if (route.rules.guestOnly && user) {
      const targetRoute = (role === 'admin' || role === 'superadmin') ? '#/admin/dashboard' : '#/dashboard';
      window.location.hash = targetRoute;
      return; 
    } else if (route.rules.role && route.rules.role !== role) {
      window.location.hash = '#/404';
      return; 
    }

    try {
      const { default: ViewClass } = await route.view();
      const queryParams = this.getHashQueryParams();
      const view = new ViewClass({ queryParams, path, routeKey });

      if (window.currentView?.destroy) await window.currentView.destroy();

      if (appRoot) {
        appRoot.innerHTML = await view.getHtml();
        appRoot.style.opacity = '1';

        if (view.mount) await view.mount(queryParams);
        
        initNavbar(); 
        
        const elapsed = Date.now() - startTime;
        const delay = Math.max(0, 1500 - elapsed);

        setTimeout(() => {
          appRoot.style.transition = 'opacity 0.5s ease, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
          appRoot.style.opacity = '1';
          appRoot.style.transform = 'scale(1)';

          const loader = document.getElementById('global-loader');
          if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 400);
          }

          document.body.style.overflow = 'auto';
          this.liftCurtain();
        }, delay);
      }
      
      window.currentView = view;
      window.scrollTo(0, 0); 
      window.dispatchEvent(new CustomEvent('route-changed'));
      
    } catch (err) {
      console.error('[Router Error]:', err);
      this.liftCurtain();
    }
  }
}