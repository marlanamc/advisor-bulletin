const CACHE_NAME = 'ebhcs-bulletin-static-v2';

const STATIC_ASSETS = [
  '/manifest.json',
  '/favicon.ico',
  '/images/app-icon-192.png',
  '/images/app-icon-512.png',
  '/images/app-icon.svg',
  '/images/apple-touch-icon.png',
  '/images/favicon-48.png',
  '/images/favicon-32.png',
  '/images/favicon-16.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching static PWA assets...');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

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

function shouldBypass(request, requestUrl) {
  if (request.method !== 'GET') return true;

  // Let the browser handle page navigations, HTML, and update checks. Firebase
  // Hosting marks these as no-store; caching them in the worker can slow or
  // stale installed iOS PWA launches.
  if (request.mode === 'navigate') return true;
  if (request.destination === 'document') return true;
  if (requestUrl.pathname === '/' || requestUrl.pathname.endsWith('.html')) return true;
  if (requestUrl.pathname === '/version.json') return true;
  if (requestUrl.search) return true;

  // Bypass Firestore/Firebase dynamic requests entirely.
  if (
    requestUrl.hostname.includes('firebase') ||
    requestUrl.hostname.includes('googleapis')
  ) {
    return true;
  }

  return false;
}

function isCacheableStaticAsset(requestUrl) {
  if (requestUrl.origin !== self.location.origin) return false;
  if (requestUrl.pathname.startsWith('/assets/')) return true;
  return STATIC_ASSETS.includes(requestUrl.pathname);
}

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  if (shouldBypass(event.request, requestUrl) || !isCacheableStaticAsset(requestUrl)) {
    return;
  }

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
          // Offline or flaky network: fall back to any cached immutable asset.
        });

        // Return cached response instantly if available, otherwise wait for network
        return cachedResponse || fetchPromise;
      });
    })
  );
});
