// filepath: js/components/RankPromotionModal.js

export default class RankPromotionModal {
    static init() {
        if (this.initialized) return;
        this.initialized = true;

        window.addEventListener('rank_up', (e) => {
            const { oldRank, newRank } = e.detail;
            this.showPromotion(oldRank, newRank);
        });
    }

    static showPromotion(oldRank, newRank) {
        // Prevent multiple modals
        if (document.getElementById('promotion-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'promotion-modal';
        modal.className = 'promotion-modal-overlay';
        
        modal.innerHTML = `
            <div class="promotion-modal-content">
                <div class="promo-header">══════════════════════</div>
                <h2 class="promo-title">🎖 PROMOTION</h2>
                <div class="promo-ranks">
                    <div class="old-rank">${oldRank}</div>
                    <div class="promo-arrow">↓</div>
                    <div class="new-rank">${newRank}</div>
                </div>
                <div class="promo-bonus">
                    <span class="bonus-label">+100 Bonus XP</span>
                </div>
                <button class="promo-btn" id="promoContinueBtn">CONTINUE</button>
                <div class="promo-footer">══════════════════════</div>
            </div>
            <canvas id="promoConfetti"></canvas>
        `;

        document.body.appendChild(modal);

        // Trigger confetti
        this.triggerConfetti(document.getElementById('promoConfetti'));

        // Handle close
        document.getElementById('promoContinueBtn').addEventListener('click', () => {
            modal.style.opacity = '0';
            setTimeout(() => {
                if (modal.parentNode) modal.parentNode.removeChild(modal);
                // Award the bonus XP after closing the modal
                if (window.GamificationService) {
                    window.GamificationService.awardXP(
                        window.Store ? window.Store.get('user')?.uid : null, 
                        100, 
                        `Promotion to ${newRank}`
                    );
                }
            }, 500);
        });
    }

    static triggerConfetti(canvas) {
        if (!window.confetti) return; // Depends on canvas-confetti being loaded
        const myConfetti = window.confetti.create(canvas, {
            resize: true,
            useWorker: true
        });
        
        myConfetti({
            particleCount: 150,
            spread: 90,
            origin: { y: 0.6 },
            colors: ['#FFD700', '#FF8C00', '#FFFFFF', '#30D158']
        });
        
        setTimeout(() => {
            myConfetti({
                particleCount: 100,
                spread: 120,
                origin: { y: 0.5 },
                colors: ['#FFD700', '#FF8C00']
            });
        }, 800);
    }
}
