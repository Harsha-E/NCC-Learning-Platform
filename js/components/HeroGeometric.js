export default class HeroGeometric {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.options = {
            title1: options.title1 || '',
            title2: options.title2 || '',
            description: options.description || '',
            color1: options.color1 || '#0f172a',
            color2: options.color2 || '#e2e8f0',
            speed: options.speed || 0.8
        };
        this.wrapper = null;
    }

    mount() {
        if (!this.container) return;
        this.destroy(); // Cleanup previous if exists

        this.wrapper = document.createElement('div');
        this.wrapper.className = 'hero-geometric-wrapper';
        this.wrapper.style.cssText = `
            position: relative;
            width: 100%;
            min-height: 300px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            background: transparent;
            color: #ffffff;
            font-family: 'SF Pro Display', 'Inter', sans-serif;
            border-radius: inherit;
        `;

        // We clear the container's inner HTML since we are replacing the header content
        this.container.innerHTML = '';

        // Add CSS if missing
        if (!document.getElementById('hero-geo-styles')) {
            const style = document.createElement('style');
            style.id = 'hero-geo-styles';
            style.innerHTML = `
                .hero-geo-canvas {
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100dvh;
                    z-index: -10; pointer-events: none;
                }
                .hero-geo-content {
                    position: relative; z-index: 10; width: 100%; max-width: 1200px;
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    padding: 2rem 1.5rem; text-align: center;
                }
                .hero-geo-title-container { overflow: hidden; margin-bottom: 0.5rem; }
                .hero-geo-title {
                    font-size: clamp(3.5rem, 10vw, 5rem);
                    line-height: 0.9; letter-spacing: -0.05em;
                    color: #ffffff; margin: 0;
                    transform: translateY(100%); opacity: 0;
                    text-shadow: 0 10px 30px rgba(0,0,0,0.8), 0 2px 10px rgba(0,0,0,0.5), -1px -1px 0 rgba(0,0,0,0.2), 1px 1px 0 rgba(0,0,0,0.2);
                }
                .hero-geo-title-1 { font-style: italic; font-weight: 300; animation: geoSlideUp 1s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards; }
                .hero-geo-title-2 { font-weight: 800; color: #f8fafc; animation: geoSlideUp 1s cubic-bezier(0.16, 1, 0.3, 1) 0.35s forwards; }
                .hero-geo-desc {
                    font-size: clamp(1.1rem, 4vw, 1.35rem); line-height: 1.6;
                    color: rgba(255,255,255,0.9); max-width: 480px; margin-top: 1.5rem; margin-bottom: 0;
                    transform: translateY(20px); opacity: 0;
                    animation: geoFadeUp 0.8s ease-out 0.6s forwards;
                    text-shadow: 0 4px 15px rgba(0,0,0,0.8), 0 1px 4px rgba(0,0,0,0.6);
                    font-weight: 500;
                }
                @keyframes geoSlideUp { to { transform: translateY(0); opacity: 1; } }
                @keyframes geoFadeUp { to { transform: translateY(0); opacity: 1; } }
            `;
            document.head.appendChild(style);
        }

        if (window.BackgroundManager) {
            window.BackgroundManager.updateColors?.(this.options.color1, this.options.color2);
        }

        const canvas = document.createElement('canvas');
        canvas.className = 'hero-geo-canvas';
        // Append to body to bypass any transform containing blocks (e.g., animations)
        this.canvasElement = canvas;
        document.body.appendChild(canvas);

        const content = document.createElement('div');
        content.className = 'hero-geo-content';
        
        const titleDiv = document.createElement('div');
        titleDiv.style.marginBottom = this.options.description ? '1.5rem' : '0';
        
        if (this.options.title1) {
            const c1 = document.createElement('div'); c1.className = 'hero-geo-title-container';
            const h1 = document.createElement('h1'); h1.className = 'hero-geo-title hero-geo-title-1';
            h1.innerText = this.options.title1;
            c1.appendChild(h1);
            titleDiv.appendChild(c1);
        }
        if (this.options.title2) {
            const c2 = document.createElement('div'); c2.className = 'hero-geo-title-container';
            const h2 = document.createElement('h1'); h2.className = 'hero-geo-title hero-geo-title-2';
            h2.innerText = this.options.title2;
            c2.appendChild(h2);
            titleDiv.appendChild(c2);
        }
        content.appendChild(titleDiv);

        if (this.options.description) {
            const p = document.createElement('p');
            p.className = 'hero-geo-desc';
            p.innerHTML = this.options.description;
            content.appendChild(p);
        }

        this.wrapper.appendChild(content);
        this.container.appendChild(this.wrapper);
    }

    destroy() {
        if (this.wrapper && this.wrapper.parentNode) {
            this.wrapper.parentNode.removeChild(this.wrapper);
        }
        this.wrapper = null;
    }
}
