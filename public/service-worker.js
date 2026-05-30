// Cold-load strategy for the EBHCS Bulletin PWA:
//
// 1. On install, pre-cache the app shell (/, /index.html) and every hashed
//    JS/CSS chunk listed in /asset-manifest.json. This means a brand-new
//    install pays one network cost up front and every subsequent launch
//    paints from cache in well under a second, even on flaky cellular.
//
// 2. Navigations (HTML) use stale-while-revalidate: serve the cached shell
//    instantly, fetch a fresh copy in the background, and put it back in the
//    cache for next launch. /version.json (fetched separately by app-update.js,
//    never cached here) is the source of truth for "is there a new deploy?" —
//    when it changes, app-update.js reloads, which then picks up the now-fresh
//    shell from the background revalidation.
//
// 3. Hashed /assets/* are immutable, so we cache-first them and only hit the
//    network on a miss.
//
// 4. Firestore / Google APIs and /version.json are always bypassed.

const CACHE_NAME = 'ebhcs-bulletin-v3';

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/images/app-icon-192.png',
  '/images/app-icon-512.png',
  '/images/app-icon.svg',
  '/images/apple-touch-icon.png',
  '/images/favicon-48.png',
  '/images/favicon-32.png',
  '/images/favicon-16.png',
];

async function precacheAppShell(cache) {
  // Use cache:'reload' on the shell HTML so we never install a stale copy
  // (Firebase Hosting marks index.html as no-store, which we honor here).
  await Promise.all(
    APP_SHELL.map((url) => {
      const request = new Request(url, { cache: 'reload' });
      return cache.add(request).catch((err) => {
        console.warn('[Service Worker] Shell pre-cache miss:', url, err);
      });
    })
  );
}

async function precacheBuiltAssets(cache) {
  try {
    const res = await fetch('/asset-manifest.json', { cache: 'no-store' });
    if (!res.ok) return;
    const { assets } = await res.json();
    if (!Array.isArray(assets)) return;
    await Promise.all(
      assets.map((url) =>
        cache.add(new Request(url, { cache: 'reload' })).catch((err) => {
          console.warn('[Service Worker] Asset pre-cache miss:', url, err);
        })
      )
    );
  } catch (err) {
    // Manifest missing on first deploy or offline — runtime caching still works.
    console.warn('[Service Worker] asset-manifest.json unavailable:', err);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await precacheAppShell(cache);
      await precacheBuiltAssets(cache);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((key) => (key !== CACHE_NAME ? caches.delete(key) : null))
      );
      await self.clients.claim();
    })()
  );
});

function isHTMLNavigation(request, requestUrl) {
  if (request.method !== 'GET') return false;
  if (request.mode === 'navigate') return true;
  if (request.destination === 'document') return true;
  if (requestUrl.pathname === '/' || requestUrl.pathname.endsWith('.html')) return true;
  return false;
}

function isHashedAsset(requestUrl) {
  if (requestUrl.origin !== self.location.origin) return false;
  return requestUrl.pathname.startsWith('/assets/');
}

function isShellAsset(requestUrl) {
  if (requestUrl.origin !== self.location.origin) return false;
  return APP_SHELL.includes(requestUrl.pathname);
}

function shouldBypass(request, requestUrl) {
  if (request.method !== 'GET') return true;
  // Never cache the deploy-version marker — it's our staleness signal.
  if (requestUrl.pathname === '/version.json') return true;
  if (requestUrl.pathname === '/asset-manifest.json') return true;
  // Firestore + Google APIs handled by Firebase SDK + its own caches.
  if (
    requestUrl.hostname.includes('firebase') ||
    requestUrl.hostname.includes('googleapis') ||
    requestUrl.hostname.includes('gstatic') ||
    requestUrl.hostname.includes('google.com')
  ) {
    return true;
  }
  return false;
}

// Stale-while-revalidate for the HTML shell. On every navigation we hand
// back the cached index.html instantly (sub-50ms) and refresh it from the
// network in the background. The next launch sees the fresh copy.
async function handleNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  // For the navigation, prefer the cached "/" or "/index.html" — both map to
  // the same shell. Try the request itself first, then fall back to /index.html.
  const cached =
    (await cache.match(request)) ||
    (await cache.match('/index.html')) ||
    (await cache.match('/'));

  const networkFetch = fetch(new Request('/index.html', { cache: 'no-store' }))
    .then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        cache.put('/index.html', networkResponse.clone());
        cache.put('/', networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => null);

  if (cached) {
    // Don't block the response on revalidation.
    networkFetch.catch(() => {});
    return cached;
  }

  const fresh = await networkFetch;
  if (fresh) return fresh;
  // Last-ditch: empty 503 so the browser doesn't show a confusing error page.
  return new Response('Offline and no cached shell available.', {
    status: 503,
    headers: { 'Content-Type': 'text/plain' },
  });
}

// Hashed asset URLs are immutable (Vite content hashing). Cache-first, then
// network on miss; cache the network result for next time.
async function handleHashedAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    return cached || Response.error();
  }
}

// Shell icons / manifest: stale-while-revalidate.
async function handleShellAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => cached);
  return cached || fetchPromise;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const requestUrl = new URL(request.url);

  if (shouldBypass(request, requestUrl)) return;

  if (isHTMLNavigation(request, requestUrl)) {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (isHashedAsset(requestUrl)) {
    event.respondWith(handleHashedAsset(request));
    return;
  }

  if (isShellAsset(requestUrl)) {
    event.respondWith(handleShellAsset(request));
    return;
  }
});
