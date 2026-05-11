import Router from './router.js';
import Store from './store.js';
import { onAuthChange, getDbInstance, getStorageInstance, doc, getDoc } from './firebase-init.js';
import ProgressService from '../services/progress.service.js';
import AuthService from '../services/auth.service.js';

// Expose globals for the React/External components if needed
window.__FIREBASE_DB__ = getDbInstance();
window.__FIREBASE_STORAGE__ = getStorageInstance();

const App = {
    async init() {
        console.log("🚀 Initializing NCC Command SPA...");

        // 1. Listen for Auth Changes
        onAuthChange(async (authData) => {
            if (authData && authData.user) {
                const user = authData.user;
                
                window.__CURRENT_ADMIN__ = {
                    uid: user.uid,
                    displayName: user.displayName || "Command Admin",
                    email: user.email
                };
                
                Store.set('user', user);
                Store.set('auth.role', authData.role);
                
                // 2. Initial Progress Load (Costs 1 Read)
                try {
                    await AuthService.init();
                    const profileSnap = await getDoc(doc(getDbInstance(), 'users', user.uid));
                    if (profileSnap.exists()) {
                        Store.set('profile', profileSnap.data());
                    }
                    await ProgressService.getUserProgress(user.uid);
                } catch (e) {
                    console.error("Auth hydration failed:", e);
                }

                // 3. START THE WRITE GUARD HEARTBEAT (Task #3)
                this.startWriteGuard(user.uid);
            } else {
                Store.set('user', null);
                Store.set('auth.role', null);
                Store.set('profile', null);
                Store.set('userProgress', null);
                this.stopWriteGuard();
            }

            // 4. Initialize Router
            if (!this.isAppReady) {
                this.isAppReady = true;
                await Router.init();
                const loader = document.getElementById('global-loader');
                if (loader) {
                    loader.style.opacity = '0';
                    setTimeout(() => loader.remove(), 400);
                }
                document.body.style.overflow = 'auto';
            } else {
                await Router.navigate();
            }
        });

        // 5. Global Error Handling
        window.onerror = (msg, url, line) => {
            if (msg === "Script error." || msg.toString().includes("Script error")) return true;
            console.error(`🚨 [Global Crash Captured]:\n ${msg}\n at ${url}:${line}`);
        };
        
        window.onunhandledrejection = function (event) {
            if (event.reason && event.reason.name === 'RenderingCancelledException') {
                event.preventDefault();
                return;
            }
            console.error('⚠️ [Unhandled Promise Rejection]:', event.reason);
        };
    },

    startWriteGuard(uid) {
        if (this.syncInterval) clearInterval(this.syncInterval);
        
        this.syncInterval = setInterval(async () => {
            console.log("⏱️ Write-Guard: Syncing batch progress...");
            await ProgressService.flushQueue();
        }, 60000); // 60 Seconds

        // Also sync when the user leaves the tab or closes the browser
        window.addEventListener('beforeunload', () => {
            ProgressService.flushQueue();
        });
        
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                ProgressService.flushQueue();
            }
        });
    },

    stopWriteGuard() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());