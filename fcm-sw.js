// Native Push Event Handler for FCM and Web Push
self.addEventListener('push', function(event) {
    if (!event.data) return;

    let data = {};
    try {
        data = event.data.json();
    } catch (e) {
        console.warn('Push event data is not JSON:', event.data.text());
        return;
    }

    const title = data.notification?.title || data.title || 'NCC Command Update';
    const body = data.notification?.body || data.body || 'You have a new message.';
    const url = data.data?.url || data.url || '/';
    const type = data.data?.type || data.type || 'system';

    const options = {
        body: body,
        icon: './assets/icons/icon-192x192.png',
        badge: './assets/icons/icon-192x192.png',
        vibrate: [200, 100, 200],
        data: { url, type, timestamp: Date.now() }
    };

    // Store the notification locally in IndexedDB so the Notification Center can see it
    event.waitUntil(
        Promise.all([
            self.registration.showNotification(title, options),
            saveNotificationToDexie({ title, body, type, url, timestamp: Date.now(), read: false })
        ])
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    const url = event.notification.data.url;
    
    if (url) {
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
                for (let i = 0; i < windowClients.length; i++) {
                    const client = windowClients[i];
                    if (client.url.includes(url) && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(url);
                }
            })
        );
    }
});

// Helper to manually save to Dexie from SW context
async function saveNotificationToDexie(notif) {
    return new Promise((resolve) => {
        const request = indexedDB.open('NCC_Platform_DB', 5); // Version 5 for notifications
        
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('notifications')) {
                db.createObjectStore('notifications', { keyPath: 'id', autoIncrement: true });
            }
        };

        request.onsuccess = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('notifications')) return resolve();
            
            const tx = db.transaction('notifications', 'readwrite');
            const store = tx.objectStore('notifications');
            store.add(notif);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve(); // fail silently
        };
        request.onerror = () => resolve();
    });
}
