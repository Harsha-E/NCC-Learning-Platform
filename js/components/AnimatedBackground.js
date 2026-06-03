export default class AnimatedBackground {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.wrapper = null;
        this.isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    mount() {
        if (!this.container) return;
        this.destroy(); // Cleanup previous if exists
        
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'animated-bg-wrapper';
        this.wrapper.style.cssText = `
            position: absolute;
            inset: 0;
            overflow: hidden;
            z-index: 0;
            pointer-events: none;
            border-radius: inherit;
        `;
        
        // Gradient layer
        const gradient = document.createElement('div');
        gradient.className = 'anim-gradient-layer';
        gradient.style.cssText = `
            position: absolute;
            inset: -50%;
            background: radial-gradient(circle at 30% 30%, rgba(10, 132, 255, 0.15) 0%, transparent 60%),
                        radial-gradient(circle at 80% 70%, rgba(255, 153, 51, 0.08) 0%, transparent 50%);
            animation: ${this.isReducedMotion ? 'none' : 'bgShift 25s ease-in-out infinite alternate'};
        `;
        
        // High-performance SVG Noise layer (replaces heavy Canvas)
        const noise = document.createElement('div');
        noise.className = 'anim-noise-layer';
        noise.style.cssText = `
            position: absolute;
            inset: 0;
            opacity: 0.3;
            mix-blend-mode: overlay;
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
        `;
        
        // Add Keyframes to document if missing
        if (!document.getElementById('anim-bg-keyframes')) {
            const style = document.createElement('style');
            style.id = 'anim-bg-keyframes';
            style.innerHTML = `
                @keyframes bgShift {
                    0% { transform: scale(1) translate(0, 0); }
                    100% { transform: scale(1.1) translate(-2%, 2%); }
                }
            `;
            document.head.appendChild(style);
        }

        this.wrapper.appendChild(gradient);
        this.wrapper.appendChild(noise);
        
        // Ensure parent has positioning context
        const computedStyle = window.getComputedStyle(this.container);
        if (computedStyle.position === 'static') {
            this.container.style.position = 'relative';
        }
        
        this.container.insertBefore(this.wrapper, this.container.firstChild);
    }

    pause() {
        if (this.wrapper) {
            const grad = this.wrapper.querySelector('.anim-gradient-layer');
            if (grad) grad.style.animationPlayState = 'paused';
        }
    }

    resume() {
        if (this.wrapper && !this.isReducedMotion) {
            const grad = this.wrapper.querySelector('.anim-gradient-layer');
            if (grad) grad.style.animationPlayState = 'running';
        }
    }

    destroy() {
        if (this.wrapper && this.wrapper.parentNode) {
            this.wrapper.parentNode.removeChild(this.wrapper);
        }
        this.wrapper = null;
    }
}
