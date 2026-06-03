import db from './DexieStore.js';
import Store from '../core/store.js';
import { SyncEngine } from './SyncEngine.js';

export default class NotificationService {
    
    /**
     * Bootstraps the local Notification History DB and syncs preferences.
     */
    static async init() {
        if (this.initialized) return;
        this.initialized = true;
        
        // Setup initial default preferences if none exist
        let prefs = Store.get('notification_prefs');
        if (!prefs) {
            prefs = {
                syllabus_updates: true,
                exam_updates: true,
                attendance: true,
                camps: true,
                announcements: true
            };
            Store.set('notification_prefs', prefs);
        }
    }

    /**
     * Prompts user for push notification permission.
     * Uses native PushManager since we handle FCM server-side.
     */
    static async requestPermission() {
        if (!('Notification' in window)) return false;
        
        let permission = Notification.permission;
        if (permission === 'default') {
            permission = await Notification.requestPermission();
        }

        if (permission === 'granted') {
            await this.registerPushSubscription();
            return true;
        }
        return false;
    }

    /**
     * Gets a native PushSubscription and saves it to Firestore 
     * so Cloud Functions can route FCM to it.
     */
    static async registerPushSubscription() {
        try {
            const registration = await navigator.serviceWorker.ready;
            
            // We expect the server to provide the VAPID key
            // For now, we queue an intent. A real FCM implementation requires a VAPID public key.
            // Since we use Firebase v10, we'd normally use getMessaging().getToken().
            // We leave this architecture ready for the Firebase Messaging SDK injection.
            
            const user = Store.get('user');
            if (!user) return;

            const prefs = Store.get('notification_prefs');
            
            // Sync preferences to server so Cloud Function knows which topics to include
            await SyncEngine.queueUp(`users/${user.uid}/fcm_routing/prefs`, {
                preferences: prefs,
                updatedAt: Date.now(),
                userAgent: navigator.userAgent
            });
            
            console.log("✅ [NotificationService] Routing preferences synced.");
        } catch (e) {
            console.warn("⚠️ Push registration failed:", e);
        }
    }

    /**
     * Update a specific category preference.
     */
    static async updatePreference(category, isEnabled) {
        let prefs = Store.get('notification_prefs') || {};
        prefs[category] = isEnabled;
        Store.set('notification_prefs', prefs);
        
        await this.registerPushSubscription(); // Sync upstream
    }

    /**
     * Retrieve local notification history for the Notification Center.
     */
    static async getHistory(limitCount = 50) {
        try {
            return await db.notifications.orderBy('timestamp').reverse().limit(limitCount).toArray();
        } catch (e) {
            return [];
        }
    }

    /**
     * Mark a notification as read locally.
     */
    static async markAsRead(id) {
        try {
            await db.notifications.update(id, { read: true });
        } catch (e) {
            console.warn("Failed to mark notification read", e);
        }
    }

    /**
     * Get count of unread notifications.
     */
    static async getUnreadCount() {
        try {
            return await db.notifications.where('read').equals(false).count();
        } catch (e) {
            return 0;
        }
    }

    /**
     * Create a local notification (e.g. for Syllabus Updates)
     */
    static async createLocalNotification(title, body, type = 'system', url = '/') {
        try {
            const notif = {
                title, body, type, url,
                timestamp: Date.now(),
                read: false
            };
            await db.notifications.add(notif);
            
            // Try to show native notification if allowed
            if (('Notification' in window) && Notification.permission === 'granted') {
                const reg = await navigator.serviceWorker.ready;
                reg.showNotification(title, {
                    body: body,
                    icon: './assets/icons/icon-192x192.png',
                    badge: './assets/icons/icon-192x192.png'
                });
            }
        } catch (e) {
            console.warn("Failed to create local notification", e);
        }
    }
}
