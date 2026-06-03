const CACHE_NAME = 'ncc-training-v5';
const STATIC_ASSETS = [
  './',
  './index.html',
  './offline.html',

  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/themes.css',
  './css/tokens.css',

  './js/core/app.js',
  './js/core/router.js',

  './flaticon.png',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Network-First strategy for API/external calls
  if (url.origin !== self.location.origin || event.request.url.includes('/api/') || event.request.url.includes('firestore')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('./offline.html'))
    );
    return;
  }

  // Stale-While-Revalidate strategy for local assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Don't cache invalid responses
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // Fallback for document requests
        if (event.request.mode === 'navigate') {
          return caches.match('./offline.html');
        }
      });
      return cachedResponse || fetchPromise;
    })
  );
});