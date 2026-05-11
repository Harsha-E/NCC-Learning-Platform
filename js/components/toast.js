/**
 * Global Stacked Toast Notification Engine
 * V14.0 - Hover-to-expand, Z-Index stacking, Pause-on-hover
 */

class ToastManager {
    constructor() {
        this.toasts = [];
        this.isHovered = false;
        this.initDOM();
    }

    initDOM() {
        if (document.getElementById('global-toast-container')) return;

        this.container = document.createElement('div');
        this.container.id = 'global-toast-container';
        document.body.appendChild(this.container);

        // Inject Styles dynamically so it's a fully portable component
        const style = document.createElement('style');
        style.textContent = `
            #global-toast-container {
                position: fixed;
                bottom: 30px;
                right: 30px;
                z-index: 99999;
                width: 320px;
                perspective: 1000px;
                pointer-events: none; /* Let clicks pass through empty space */
            }
            .toast-card {
                position: absolute;
                bottom: 0;
                right: 0;
                width: 100%;
                background: rgba(30, 41, 59, 0.95);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                color: white;
                padding: 1rem 1.25rem;
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                border: 1px solid #334155;
                border-left: 4px solid #3B82F6;
                transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), 
                            opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                pointer-events: auto;
                opacity: 0;
                transform: translateY(30px) scale(0.9);
                display: flex;
                align-items: center;
                gap: 12px;
                overflow: hidden;
            }
            .toast-card.success { border-left-color: #10B981; }
            .toast-card.error { border-left-color: #EF4444; }
            .toast-card.warning { border-left-color: #F59E0B; }
            
            .toast-icon { font-size: 1.25rem; flex-shrink: 0; }
            .toast-content { flex: 1; font-family: 'Inter', sans-serif; font-size: 0.9rem; font-weight: 500; line-height: 1.4; color: #E2E8F0; }
            
            .toast-close {
                background: transparent;
                border: none;
                color: #64748B;
                cursor: pointer;
                font-size: 1.25rem;
                line-height: 1;
                padding: 4px;
                border-radius: 4px;
                transition: 0.2s;
            }
            .toast-close:hover { color: white; background: rgba(255,255,255,0.1); }
        `;
        document.head.appendChild(style);

        // Bind Hover Events
        this.container.addEventListener('mouseenter', () => {
            this.isHovered = true;
            this.updateStack();
        });
        
        this.container.addEventListener('mouseleave', () => {
            this.isHovered = false;
            this.updateStack();
        });
    }

    getIcon(type) {
        switch (type) {
            case 'success': return '✅';
            case 'error': return '🚨';
            case 'warning': return '⚠️';
            default: return 'ℹ️';
        }
    }

    show(message, type = 'default', duration = 4000) {
        const id = `toast-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        
        const toast = document.createElement('div');
        toast.className = `toast-card ${type}`;
        toast.id = id;
        
        toast.innerHTML = `
            <div class="toast-icon">${this.getIcon(type)}</div>
            <div class="toast-content">${message}</div>
            <button class="toast-close">&times;</button>
        `;

        this.container.appendChild(toast);

        const toastObj = {
            id,
            element: toast,
            createdAt: Date.now(),
            height: toast.offsetHeight,
            timerId: null,
            timeLeft: duration
        };

        // Prepend to array so index 0 is always the newest
        this.toasts.unshift(toastObj);

        // Bind Close Button
        toast.querySelector('.toast-close').onclick = (e) => {
            e.stopPropagation();
            this.remove(id);
        };

        // Start Timer
        this.startTimer(toastObj);

        // Pause/Resume individual timer on hover
        toast.addEventListener('mouseenter', () => this.pauseTimer(toastObj));
        toast.addEventListener('mouseleave', () => this.startTimer(toastObj));

        // Trigger reflow & Update Stack
        void toast.offsetWidth; 
        this.updateStack();
    }

    remove(id) {
        const index = this.toasts.findIndex(t => t.id === id);
        if (index === -1) return;

        const toastObj = this.toasts[index];
        if (toastObj.timerId) clearTimeout(toastObj.timerId);

        // Animate out
        toastObj.element.style.opacity = '0';
        toastObj.element.style.transform = 'translateY(-20px) scale(0.9)';
        toastObj.element.style.pointerEvents = 'none';

        this.toasts.splice(index, 1);
        
        setTimeout(() => {
            if (toastObj.element.parentNode) {
                toastObj.element.parentNode.removeChild(toastObj.element);
            }
        }, 400);

        this.updateStack();
    }

    startTimer(toastObj) {
        if (toastObj.timeLeft <= 0) return;
        toastObj.startTime = Date.now();
        toastObj.timerId = setTimeout(() => {
            // Only auto-remove if the user isn't actively hovering the container stack
            if (!this.isHovered) {
                this.remove(toastObj.id);
            } else {
                // If they are hovering, queue it to die shortly after they leave
                toastObj.timeLeft = 1000; 
                this.pauseTimer(toastObj);
            }
        }, toastObj.timeLeft);
    }

    pauseTimer(toastObj) {
        if (toastObj.timerId) {
            clearTimeout(toastObj.timerId);
            toastObj.timerId = null;
            toastObj.timeLeft -= (Date.now() - toastObj.startTime);
        }
    }

    updateStack() {
        // Limit max toasts in DOM to prevent insane memory usage
        if (this.toasts.length > 5) {
            const excess = this.toasts.splice(5);
            excess.forEach(t => {
                if (t.element.parentNode) t.element.parentNode.removeChild(t.element);
                if (t.timerId) clearTimeout(t.timerId);
            });
        }

        let accumulatedHeight = 0;

        this.toasts.forEach((toastObj, index) => {
            const el = toastObj.element;
            const zIndex = 9999 - index;
            el.style.zIndex = zIndex;

            if (this.isHovered) {
                // FANNED OUT STATE
                el.style.transform = `translateY(-${accumulatedHeight}px) scale(1)`;
                el.style.opacity = '1';
                // Add gap for the next toast
                accumulatedHeight += toastObj.height + 12; 
            } else {
                // STACKED / COLLAPSED STATE
                if (index === 0) {
                    el.style.transform = `translateY(0) scale(1)`;
                    el.style.opacity = '1';
                } else if (index === 1) {
                    el.style.transform = `translateY(-12px) scale(0.95)`;
                    el.style.opacity = '0.8';
                } else if (index === 2) {
                    el.style.transform = `translateY(-24px) scale(0.9)`;
                    el.style.opacity = '0.5';
                } else {
                    el.style.transform = `translateY(-36px) scale(0.85)`;
                    el.style.opacity = '0';
                    el.style.pointerEvents = 'none';
                }
            }
        });
    }
}

// Export as a Global Singleton
const Toast = new ToastManager();
export default Toast;