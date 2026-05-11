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
  '/mock-exam': { view: () => import('../views/MockExamView.js'), rules: { requireAuth: true } },
  '/404': { view: () => import('../views/Error404View.js'), rules: {} }
};

export default class Router {
  static getBasePath() {
    const baseElement = document.querySelector('base');
    if (baseElement) {
      const resolved = new URL(baseElement.href, window.location.href);
      return resolved.pathname.replace(/\/$/, '') || '/';
    }
    return window.location.pathname.replace(/\/index(?:\.html)?$/, '').replace(/\/$/, '') || '/';
  }

  static normalizeRoutePath(pathname) {
    let path = pathname.replace(/\.html$/, '');
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
    return path || '/';
  }

  static MapsTo(path) {
    if (ROUTES[path]) return path;
    const sortedRoutes = Object.keys(ROUTES).sort((a, b) => b.length - a.length);
    for (const routeKey of sortedRoutes) {
      if (routeKey === '/') continue;
      if (path === routeKey || path.endsWith(routeKey)) return routeKey;
    }
    if (path === '/' || path.endsWith('/index') || path.endsWith('/index.html')) return '/';
    return null;
  }

  static isSamePageHashLink(url) {
    return url.pathname === window.location.pathname &&
           url.search === window.location.search &&
           url.hash && 
           url.hash.length > 1;
  }

  // --- V15: PREMIUM TRANSITION ENGINE ---
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

  static async navigateTo(destination) {
    const url = new URL(destination, window.location.href);
    if (url.origin !== window.location.origin) {
      window.location.href = destination;
      return;
    }
    if (this.isSamePageHashLink(url)) {
      window.history.pushState(null, null, url.href);
      this.scrollToHash(url.hash);
      return;
    }

    await this.dropCurtain();
    window.history.pushState(null, null, url.href);
    await this.navigate(true); 
  }

  static async init() {
    if (window._routerInitialized) return;
    window._routerInitialized = true;

    document.body.addEventListener('click', async e => {
      const link = e.target.closest('a');
      if (!link || link.hasAttribute('data-bypass') || link.target === '_blank' || link.rel === 'external') return;

      const href = link.getAttribute('href');
      if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;

      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;

      if (this.isSamePageHashLink(url)) {
        e.preventDefault();
        window.history.pushState(null, null, url.href);
        this.scrollToHash(url.hash);
        return;
      }

      e.preventDefault();
      await this.navigateTo(link.href);
    });

    window.addEventListener('popstate', async () => {
      await this.dropCurtain();
      await this.navigate(true);
    });
    
    await this.navigate(false);
  }

  static scrollToHash(hash) {
    if (!hash) return;
    try {
      const target = document.querySelector(hash);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) { console.warn("Invalid hash:", hash); }
  }

  static async navigate(isClientRouted = false) {
    const appRoot = document.getElementById('app-root');
    const startTime = Date.now(); // START THE 1.5s SHIMMER TIMER

    // Prevent home-page ghosting on fresh load
    if (appRoot) {
      appRoot.style.opacity = '0';
      appRoot.style.transform = 'scale(0.98)';
      appRoot.style.transition = 'none'; // Instant hide
    }

    const basePath = this.getBasePath(); 
    const rawPath = this.normalizeRoutePath(window.location.pathname);
    const path = basePath !== '/' && rawPath.startsWith(basePath) 
      ? rawPath.slice(basePath.length) || '/' : rawPath;

    const routeKey = Router.MapsTo(path) || '/404';
    let route = ROUTES[routeKey] || ROUTES['/404'];

    await waitForAuthReady();
    const authData = getCachedAuthData();
    const user = authData?.user;
    const role = authData?.role;

    const createSafeUrl = (target) => {
      const fullPath = (basePath + target).replace(/\/+/g, '/');
      return window.location.origin + (fullPath.startsWith('/') ? fullPath : '/' + fullPath);
    };

    if (route.rules.requireAuth && !user) {
      window.history.replaceState(null, null, createSafeUrl('/login'));
      route = ROUTES['/login'];
    } else if (route.rules.guestOnly && user) {
      const targetRoute = (role === 'admin' || role === 'superadmin') ? '/admin/dashboard' : '/dashboard';
      window.history.replaceState(null, null, createSafeUrl(targetRoute));
      route = ROUTES[targetRoute];
    } else if (route.rules.role && route.rules.role !== role) {
      window.history.replaceState(null, null, createSafeUrl('/404'));
      route = ROUTES['/404'];
    }

    try {
      const { default: ViewClass } = await route.view();
      const queryParams = Object.fromEntries(new URLSearchParams(window.location.search));
      const view = new ViewClass({ queryParams, path, routeKey });

      if (window.currentView?.destroy) await window.currentView.destroy();

      if (appRoot) {
        // Inject Skeleton/Base HTML immediately to show the shimmer
        appRoot.innerHTML = await view.getHtml();
        appRoot.style.opacity = '1';

        // Background hydration
        if (view.mount) await view.mount(queryParams);
        
        // Initialize the tactical navbar after the DOM has updated
        initNavbar(); 
        
        // --- 1.5s PERCEPTION GUARD ---
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
      if (window.location.hash) {
        setTimeout(() => this.scrollToHash(window.location.hash), 100); 
      } else {
        window.scrollTo(0, 0); 
      }

      window.dispatchEvent(new CustomEvent('route-changed'));
      
    } catch (err) {
      console.error('[Router Error]:', err);
      this.liftCurtain();
    }
  }
}