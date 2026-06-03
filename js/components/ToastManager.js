// filepath: js/components/ToastManager.js

export default class ToastManager {
    static init() {
        if (this.initialized) return;
        this.initialized = true;

        // Create container if it doesn't exist
        this.container = document.getElementById('toast-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }

        // Listen for XP Updates globally
        window.addEventListener('xp_updated', (e) => {
            const { added, reason } = e.detail;
            if (added > 0) {
                this.showXPToast(added, reason || 'XP Gained');
                this.showFloatingXP(added);
            }
        });
    }

    static showXPToast(amount, title) {
        const toast = document.createElement('div');
        toast.className = 'toast toast-xp animate-slide-in';
        
        toast.innerHTML = `
            <div class="toast-icon">🏅</div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-amount">+${amount} XP</div>
            </div>
        `;

        this.container.appendChild(toast);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.replace('animate-slide-in', 'animate-fade-out');
            setTimeout(() => {
                if (toast.parentNode === this.container) {
                    this.container.removeChild(toast);
                }
            }, 500); // Wait for fade out animation
        }, 3000);
    }

    static showFloatingXP(amount) {
        const floater = document.createElement('div');
        floater.className = 'floating-xp-anim';
        floater.textContent = `+${amount} XP`;
        
        // Randomize starting position slightly around the center
        const offsetX = (Math.random() - 0.5) * 100;
        const offsetY = (Math.random() - 0.5) * 50;
        
        floater.style.left = `calc(50% + ${offsetX}px)`;
        floater.style.top = `calc(50% + ${offsetY}px)`;
        
        document.body.appendChild(floater);
        
        setTimeout(() => {
            if (floater.parentNode) {
                floater.parentNode.removeChild(floater);
            }
        }, 2000); // Duration matches CSS animation
    }
}
