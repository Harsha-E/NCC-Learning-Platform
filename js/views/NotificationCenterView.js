import AbstractView from '../core/AbstractView.js';
import Store from '../core/store.js';
import NotificationService from '../services/NotificationService.js';
import Router from '../core/router.js';

export default class NotificationCenterView extends AbstractView {
    constructor(params) {
        super(params);
        this.filter = 'all'; // 'all' | 'unread'
        this.searchQuery = '';
        this.notifications = [];
    }

    async getHtml() {
        return `
            <style>
                .notif-viewport {
                    min-height: 100dvh;
                    padding: 8rem 1.5rem 6rem 1.5rem;
                    max-width: 800px; margin: 0 auto;
                    color: #FFF;
                }
                .notif-header-section {
                    display: flex; justify-content: space-between; align-items: flex-end;
                    margin-bottom: 2rem;
                }
                .notif-title {
                    font-size: 2.5rem; font-weight: 900; margin: 0;
                    letter-spacing: -0.03em;
                }
                .notif-controls {
                    display: flex; gap: 1rem; align-items: center; background: rgba(255,255,255,0.05); padding: 0.5rem; border-radius: 12px;
                }
                .notif-tab {
                    background: transparent; color: #8E8E93; border: none; padding: 0.5rem 1.5rem; border-radius: 8px; font-weight: 700; cursor: pointer; transition: 0.2s;
                }
                .notif-tab.active {
                    background: rgba(10, 132, 255, 0.15); color: #0A84FF;
                }
                .notif-search {
                    background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #FFF; padding: 0.6rem 1rem; border-radius: 8px;
                    width: 200px;
                }
                .notif-search:focus { outline: none; border-color: #0A84FF; }
                .notif-card {
                    background: rgba(15,20,25,0.6); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 1.5rem; margin-bottom: 1rem; display: flex; gap: 1rem; cursor: pointer;
                }
                .notif-card.unread { border-left: 4px solid #0A84FF; background: rgba(10,132,255,0.05); }
                .notif-icon {
                    width: 40px; height: 40px; border-radius: 10px; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;
                }
                .notif-content { flex: 1; }
                .notif-card-title { font-size: 1.1rem; font-weight: 800; margin: 0 0 0.25rem 0; }
                .notif-card-body { font-size: 0.95rem; color: #B7BCC4; margin: 0 0 0.5rem 0; line-height: 1.4; }
                .notif-card-time { font-size: 0.8rem; color: #8E8E93; font-weight: 600; }
                .notif-empty { text-align: center; padding: 4rem; color: #8E8E93; font-size: 1.1rem; }
                .mark-all-btn {
                    background: transparent; color: #0A84FF; border: none; font-weight: 700; cursor: pointer; padding: 0.5rem; margin-top: 1rem; text-align: right; width: 100%;
                }
                .mark-all-btn:hover { text-decoration: underline; }
            </style>
            <div class="notif-viewport">
                <div class="notif-header-section">
                    <h1 class="notif-title">Communication Center</h1>
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
                    <div class="notif-controls">
                        <button class="notif-tab active" data-tab="all">All</button>
                        <button class="notif-tab" data-tab="unread">Unread</button>
                    </div>
                    <input type="text" id="notifSearch" class="notif-search" placeholder="Search logs...">
                </div>

                <div id="notifListContainer"></div>
                <button class="mark-all-btn" id="markAllBtn" style="display: none;">Mark All as Read</button>
            </div>
        `;
    }

    async mount() {
        const user = Store.get('user');
        if (!user) return Router.navigateTo('/login');

        await this.loadNotifications();
        this.bindEvents();
    }

    async loadNotifications() {
        this.notifications = await NotificationService.getHistory();
        this.renderList();
    }

    renderList() {
        const container = document.getElementById('notifListContainer');
        if (!container) return;

        let filtered = this.notifications;

        // Apply filter
        if (this.filter === 'unread') {
            filtered = filtered.filter(n => !n.read);
        }

        // Apply search
        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            filtered = filtered.filter(n => 
                n.title.toLowerCase().includes(q) || 
                n.body.toLowerCase().includes(q)
            );
        }

        if (filtered.length === 0) {
            container.innerHTML = '<div class="notif-empty">No transmissions found matching criteria.</div>';
            document.getElementById('markAllBtn').style.display = 'none';
            return;
        }

        const unreadCount = this.notifications.filter(n => !n.read).length;
        const markAllBtn = document.getElementById('markAllBtn');
        if (markAllBtn) markAllBtn.style.display = unreadCount > 0 ? 'block' : 'none';

        container.innerHTML = filtered.map(n => {
            const dateStr = new Date(n.timestamp).toLocaleString();
            let icon = '💬';
            if (n.title.includes('Achievement') || n.title.includes('Promotion')) icon = '🏅';
            if (n.title.includes('Warning')) icon = '⚠️';
            
            return `
                <div class="notif-card tier-b ${!n.read ? 'unread' : ''}" data-id="${n.id}">
                    <div class="notif-icon">${icon}</div>
                    <div class="notif-content">
                        <h3 class="notif-card-title">${n.title}</h3>
                        <p class="notif-card-body">${n.body}</p>
                        <div class="notif-card-time">${dateStr}</div>
                    </div>
                </div>
            `;
        }).join('');

        // Bind clicks
        container.querySelectorAll('.notif-card.unread').forEach(card => {
            card.onclick = async () => {
                const id = Number(card.dataset.id);
                await NotificationService.markAsRead(id);
                const notif = this.notifications.find(n => n.id === id);
                if (notif) notif.read = true;
                this.renderList();
                
                // Trigger global update for navbar badge
                if (window.Navbar && typeof window.Navbar.initNotificationUI === 'function') {
                    window.Navbar.initNotificationUI();
                }
            };
        });
    }

    bindEvents() {
        // Tabs
        document.querySelectorAll('.notif-tab').forEach(tab => {
            tab.onclick = () => {
                document.querySelectorAll('.notif-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.filter = tab.dataset.tab;
                this.renderList();
            };
        });

        // Search
        const searchInput = document.getElementById('notifSearch');
        if (searchInput) {
            searchInput.oninput = (e) => {
                this.searchQuery = e.target.value;
                this.renderList();
            };
        }

        // Mark All
        const markAll = document.getElementById('markAllBtn');
        if (markAll) {
            markAll.onclick = async () => {
                const unread = this.notifications.filter(n => !n.read);
                for (let n of unread) {
                    await NotificationService.markAsRead(n.id);
                    n.read = true;
                }
                this.renderList();
                if (window.Navbar && typeof window.Navbar.initNotificationUI === 'function') {
                    window.Navbar.initNotificationUI();
                }
            };
        }
    }
}
