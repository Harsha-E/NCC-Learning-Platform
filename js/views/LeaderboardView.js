import AbstractView from '../core/AbstractView.js';
import Store from '../core/store.js';
import GamificationService from '../services/GamificationService.js';
import Router from '../core/router.js';
import HeroGeometric from '../components/HeroGeometric.js';

export default class LeaderboardView extends AbstractView {
    constructor(params) {
        super(params);
        this.leaderboard = [];
        this.myRank = null;
        this.error = null;
    }

    async getHtml() {
        return `
            <style>
                .lb-viewport {
                    min-height: 100dvh;
                    padding: 8rem 1.5rem 6rem 1.5rem;
                    max-width: 1000px; margin: 0 auto;
                    color: #FFF;
                }
                .podium-container {
                    display: flex; align-items: flex-end; justify-content: center; gap: 1rem;
                    margin: 4rem 0 3rem 0; height: 250px;
                }
                .podium-place {
                    display: flex; flex-direction: column; align-items: center;
                    background: rgba(15,20,25,0.8); backdrop-filter: blur(20px);
                    border: 1px solid rgba(255,255,255,0.1); border-radius: 16px 16px 0 0;
                    padding: 1.5rem 1rem; width: 120px; text-align: center;
                    position: relative;
                }
                .podium-1 { height: 220px; border-color: rgba(255, 215, 0, 0.4); box-shadow: 0 -10px 40px rgba(255,215,0,0.15); z-index: 3; }
                .podium-2 { height: 180px; border-color: rgba(192, 192, 192, 0.4); z-index: 2; }
                .podium-3 { height: 150px; border-color: rgba(205, 127, 50, 0.4); z-index: 1; }
                
                .podium-avatar {
                    width: 60px; height: 60px; border-radius: 50%; background: rgba(255,255,255,0.1); margin-bottom: -30px; position: absolute; top: -30px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 800; border: 3px solid #0F1419;
                }
                .podium-1 .podium-avatar { background: linear-gradient(135deg, #FFD700, #FDB931); color: #000; }
                .podium-2 .podium-avatar { background: linear-gradient(135deg, #E0E0E0, #9E9E9E); color: #000; }
                .podium-3 .podium-avatar { background: linear-gradient(135deg, #CD7F32, #A0522D); color: #FFF; }

                .podium-name { font-weight: 800; font-size: 1rem; margin-top: 1rem; margin-bottom: 0.25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; }
                .podium-xp { font-size: 0.85rem; color: var(--accent-green); font-weight: 700; }
                .podium-rank-text { position: absolute; bottom: 10px; font-size: 4rem; font-weight: 900; color: rgba(255,255,255,0.05); }

                .my-rank-card {
                    background: linear-gradient(135deg, rgba(10, 132, 255, 0.15), rgba(191, 90, 242, 0.15));
                    border: 1px solid rgba(10,132,255,0.3); border-radius: 16px; padding: 1.5rem; margin-bottom: 2rem;
                    display: flex; justify-content: space-between; align-items: center; box-shadow: 0 10px 30px rgba(10,132,255,0.15);
                }

                .lb-list { display: flex; flex-direction: column; gap: 0.5rem; }
                .lb-row {
                    display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.5rem;
                    background: rgba(15,20,25,0.5); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px;
                    transition: 0.2s;
                }
                .lb-row:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); }
                .lb-rank-num { font-size: 1.2rem; font-weight: 800; color: #8E8E93; width: 40px; text-align: center; }
                .lb-info { flex: 1; margin-left: 1rem; }
                .lb-name { font-weight: 700; font-size: 1rem; color: #FFF; margin-bottom: 0.2rem; }
                .lb-sub { font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px;}
                .lb-xp { font-weight: 800; font-size: 1.1rem; color: var(--accent-green); }

                @media(max-width: 768px) {
                    .podium-container { gap: 0.5rem; height: 200px; margin-top: 3rem; }
                    .podium-place { padding: 1rem 0.5rem; width: 30%; }
                    .podium-1 { height: 180px; }
                    .podium-2 { height: 140px; }
                    .podium-3 { height: 110px; }
                    .podium-name { font-size: 0.85rem; }
                    .podium-rank-text { font-size: 3rem; }
                }
            </style>
            
            <div class="lb-viewport" id="lbContainer">
                <div id="lb-hero-container" style="min-height: 250px; margin: -8rem -1.5rem 0 -1.5rem; padding: 8rem 1.5rem 2rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05);"></div>
                
                <div style="text-align: center; padding: 4rem;" id="lbLoading">
                    <div class="spinner-inline" style="display:inline-block; border-color: rgba(255,255,255,0.1); border-top-color: var(--accent-blue); width:40px; height:40px; border-width: 4px;"></div>
                    <div style="margin-top: 1rem; color: var(--text-muted); font-weight: 600;">Syncing Global Rankings...</div>
                </div>

                <div id="lbContent" style="display:none;"></div>
            </div>
        `;
    }

    async mount() {
        const user = Store.get('user');
        if (!user) return Router.navigateTo('/login');
        
        this.bg = new HeroGeometric('lb-hero-container', {
            title1: 'Global',
            title2: 'Leaderboard',
            description: 'Top Cadets across the NCC Platform'
        });
        this.bg.mount();

        const result = await GamificationService.getGlobalLeaderboard();
        if (result.error) {
            this.error = result.error;
        } else {
            this.leaderboard = result.top100;
        }

        // Find my rank
        const myXp = (await GamificationService.getStats(user.uid))?.xp || 0;
        const myProfile = Store.get('profile') || {};
        const myName = (myProfile.displayName || myProfile.fullName || 'You');
        
        // Mocking my rank based on mock data
        this.myRank = this.leaderboard.findIndex(x => x.xp <= myXp) + 1;
        if (this.myRank === 0) this.myRank = 101; // Not in top 100

        this.renderLeaderboard(user.uid, myName, myXp);
    }

    renderLeaderboard(uid, myName, myXp) {
        document.getElementById('lbLoading').style.display = 'none';
        const content = document.getElementById('lbContent');
        content.style.display = 'block';

        if (this.error) {
            content.innerHTML = `<div style="text-align:center; padding: 4rem; color: #FF453A;">${this.error}</div>`;
            return;
        }

        const top3 = this.leaderboard.slice(0, 3);
        const rest = this.leaderboard.slice(3, 100);

        let podiumHTML = '';
        if (top3.length === 3) {
            podiumHTML = `
                <div class="podium-container">
                    <div class="podium-place podium-2">
                        <div class="podium-avatar">2</div>
                        <div class="podium-name">${top3[1].displayName.split(' ')[0]}</div>
                        <div class="podium-xp">${top3[1].xp} XP</div>
                        <div class="podium-rank-text">2</div>
                    </div>
                    <div class="podium-place podium-1">
                        <div class="podium-avatar">1</div>
                        <div class="podium-name">${top3[0].displayName.split(' ')[0]}</div>
                        <div class="podium-xp">${top3[0].xp} XP</div>
                        <div class="podium-rank-text">1</div>
                    </div>
                    <div class="podium-place podium-3">
                        <div class="podium-avatar">3</div>
                        <div class="podium-name">${top3[2].displayName.split(' ')[0]}</div>
                        <div class="podium-xp">${top3[2].xp} XP</div>
                        <div class="podium-rank-text">3</div>
                    </div>
                </div>
            `;
        }

        let myRankHTML = '';
        if (this.myRank) {
            const rankLabel = this.myRank > 100 ? '>100' : `#${this.myRank}`;
            myRankHTML = `
                <div class="my-rank-card tier-a">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <div style="font-size: 2.5rem; font-weight: 900; color: #FFF;">${rankLabel}</div>
                        <div>
                            <div style="font-weight: 800; font-size: 1.2rem; color: #FFF;">${myName}</div>
                            <div style="color: rgba(255,255,255,0.7); font-size: 0.9rem; font-weight: 700;">YOUR RANK</div>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 1.5rem; font-weight: 900; color: var(--accent-green);">${myXp} XP</div>
                    </div>
                </div>
            `;
        }

        let listHTML = '<div class="lb-list">';
        rest.forEach((u, i) => {
            const rank = i + 4;
            listHTML += `
                <div class="lb-row tier-b">
                    <div class="lb-rank-num">${rank}</div>
                    <div class="lb-info">
                        <div class="lb-name">${u.displayName}</div>
                        <div class="lb-sub">${u.rank} • ${u.wing}</div>
                    </div>
                    <div class="lb-xp">${u.xp} XP</div>
                </div>
            `;
        });
        listHTML += '</div>';

        content.innerHTML = podiumHTML + myRankHTML + listHTML;
    }

    async destroy() {
        if (this.bg) {
            this.bg.destroy();
            this.bg = null;
        }
    }
}
