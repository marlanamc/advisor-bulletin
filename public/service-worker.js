const CACHE_NAME = 'ebhcs-bulletin-cache-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/images/app-icon.svg',
  '/images/favicon-32.png',
  '/images/favicon-16.png'
];

// Perform install & cache static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching static app shell...');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate & clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheKey) => {
          if (cacheKey !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', cacheKey);
            return caches.delete(cacheKey);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch & Caching Strategy
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Bypass Firestore/Firebase dynamic requests entirely
  if (
    requestUrl.hostname.includes('firebase') || 
    requestUrl.hostname.includes('googleapis') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // Strategy: Stale-While-Revalidate for local assets, stylesheets, scripts, and Google Fonts
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          // If valid response, clone and cache it
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          // Silent catch for network failure
        });

        // Return cached response instantly if available, otherwise wait for network
        return cachedResponse || fetchPromise;
      });
    })
  );
});
