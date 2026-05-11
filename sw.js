// filepath: sw.js
// Service Worker for NCC Cadet Learning Platform

const CACHE_NAME = 'ncc-learning-v1';
const BASE_URL = self.registration.scope;
const STATIC_ASSETS = [
  new URL('./', BASE_URL).href,
  new URL('./index.html', BASE_URL).href,
  new URL('./css/tokens.css', BASE_URL).href,
  new URL('./css/base.css', BASE_URL).href,
  new URL('./css/components.css', BASE_URL).href,
  new URL('./css/layout.css', BASE_URL).href,
  new URL('./css/themes.css', BASE_URL).href,
  new URL('./js/core/router.js', BASE_URL).href,
  new URL('./js/core/store.js', BASE_URL).href,
  new URL('./js/core/firebase-init.js', BASE_URL).href,
  new URL('./js/components/navbar.js', BASE_URL).href
];

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  self.clients.claim();
});

// Fetch event
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // Network-first for API calls
  if (url.pathname.includes('firebaseio.com') || 
      url.pathname.includes('googleapis.com')) {
    event.respondWith(networkFirst(request));
    return;
  }
  
  // Cache-first for static assets
  event.respondWith(cacheFirst(request));
});

// Cache-first strategy
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network request failed:', error);
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match(new URL('./index.html', BASE_URL).href);
    }
    
    return new Response('Offline', { status: 503 });
  }
}

// Network-first strategy
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    return cachedResponse || new Response('Offline', { status: 503 });
  }
}

// Background sync for progress updates
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-progress') {
    console.log('[SW] Network restored. Syncing offline progress data...');
    event.waitUntil(syncProgressToFirestore());
  }
});

async function syncProgressToFirestore() {
  const clientsList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  
  // 1. If tabs are open, delegate to the client to use the initialized Firebase SDK
  if (clientsList.length > 0) {
    for (const client of clientsList) {
      client.postMessage({ type: 'FLUSH_PROGRESS_QUEUE' });
    }
    return;
  }

  // 2. Direct Background Sync (App is closed)
  console.log('[SW] App is closed. Processing offline queue directly via IndexedDB...');
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('NCC_Learning_DB');
    
    request.onerror = () => reject('Failed to open IndexedDB in Service Worker');
    request.onsuccess = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('progressQueue')) {
        return resolve();
      }
      
      const transaction = db.transaction('progressQueue', 'readwrite');
      const store = transaction.objectStore('progressQueue');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = async () => {
        const items = getAllRequest.result;
        if (!items || items.length === 0) return resolve();

        try {
          console.log(`[SW] Pending progress updates to sync: ${items.length}`);
          
          // Send 'items' payload to the Firebase Cloud Function REST endpoint 
          const response = await fetch('/api/syncProgress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates: items })
          });

          if (response.ok) {
            console.log('[SW] Direct sync successful.');
            store.clear(); // Clear queue upon success
            resolve();
          } else {
            throw new Error(`Sync failed with status: ${response.status}`);
          }
        } catch (err) {
          console.error('[SW] Direct sync failed:', err);
          reject(err);
        }
      };
    };
  });
}

// Push notifications (optional)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'New notification',
      icon: '/icon-192.png',
      badge: '/icon-72.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: data.id || '1'
      }
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'NCC Learning', options)
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow(BASE_URL)
  );
});