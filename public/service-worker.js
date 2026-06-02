// Stable-load strategy for the EBHCS Bulletin PWA:
//
// 1. On install, pre-cache the student app shell essentials and only the
//    critical hashed JS/CSS listed in /asset-manifest.json. Deferred Firebase
//    chunks are cached at runtime after first use, not during install.
//
// 2. Student navigations use network-first with cache fallback for offline
//    support. Admin navigations bypass this worker entirely so the browser
//    fetches admin HTML directly (admin.html also unregisters the SW).
//    /version.json is never cached here (deploy version checks bypass the SW).
//
// 3. Hashed /assets/* are immutable, so we cache-first them and only hit the
//    network on a miss.
//
// 4. Firestore / Google APIs and /version.json are always bypassed.

const CACHE_NAME = 'ebhcs-bulletin-v8';

const FETCH_RETRIES = 3;
const FETCH_BACKOFF_MS = 500;

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

const STUDENT_SHELL_ALIASES = ['/', '/index.html'];
const ADMIN_SHELL_ALIASES = ['/admin', '/admin.html'];

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
  if (requestUrl.pathname === '/admin') return true;
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

function isAdminShellPath(pathname) {
  return ADMIN_SHELL_ALIASES.includes(pathname);
}

function getShellInfo(pathname) {
  return {
    cacheKey: '/index.html',
    networkPath: '/index.html',
    aliases: STUDENT_SHELL_ALIASES,
  };
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

// Fire-and-forget cache write that never throws (quota errors, opaque
// responses, etc. should not surface as uncaught SW rejections).
function safeCachePut(cache, request, response) {
  try {
    cache.put(request, response).catch(() => {});
  } catch {}
}

// Fetch with retries on transient network failure. Cellular drops a single
// request constantly; without this, a new deploy's first asset request after
// activation can hit a hiccup and surface as ERR_FAILED with no recovery UI.
async function fetchWithRetry(request, { retries = FETCH_RETRIES, backoffMs = FETCH_BACKOFF_MS } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(request);
      // 5xx is also worth a retry once.
      if (response && response.status >= 500 && attempt < retries) {
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }
      return response;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }
    }
  }
  throw lastErr;
}

async function fetchAndCacheShell(shellInfo) {
  const cache = await caches.open(CACHE_NAME);
  const request = new Request(shellInfo.networkPath, { cache: 'reload' });
  const networkResponse = await fetchWithRetry(request);

  if (networkResponse && networkResponse.status === 200) {
    await Promise.all(
      [shellInfo.cacheKey, ...shellInfo.aliases].map((key) =>
        cache.put(key, networkResponse.clone()).catch(() => {})
      )
    );
  }

  return networkResponse;
}

function offlineShellResponse() {
  return new Response(
    '<!doctype html><meta charset=utf-8><title>Offline</title>' +
    '<style>body{font-family:system-ui;padding:2rem;color:#1e3a6e}</style>' +
    '<h1>You are offline</h1>' +
    '<p>Reconnect and refresh to load the bulletin board.</p>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

async function matchCachedShell(cache, request, shellInfo) {
  let cached = await cache.match(request);
  if (cached) return cached;
  for (const alias of shellInfo.aliases) {
    cached = await cache.match(alias);
    if (cached) return cached;
  }
  return null;
}

// Network-first for student navigations: always try the network so post-deploy
// loads get fresh HTML immediately. Fall back to cached shell when offline.
async function handleNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  const requestUrl = new URL(request.url);
  const shellInfo = getShellInfo(requestUrl.pathname);

  try {
    const fresh = await fetchAndCacheShell(shellInfo);
    if (fresh && fresh.status === 200) return fresh;
  } catch {
    // Network failed — fall through to cache fallback.
  }

  const cached = await matchCachedShell(cache, request, shellInfo);
  if (cached) return cached;

  return offlineShellResponse();
}

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'PREPARE_FRESH_SHELL') return;

  event.waitUntil(
    fetchAndCacheShell(getShellInfo('/index.html'))
      .then((response) => {
        event.ports?.[0]?.postMessage({ ok: Boolean(response && response.status === 200) });
      })
      .catch(() => {
        event.ports?.[0]?.postMessage({ ok: false });
      })
  );
});

// Hashed asset URLs are immutable. Cache-first, then network-with-retry on
// miss. On 404, evict any stale cache entry and retry once from network.
async function handleHashedAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  let networkResponse;
  try {
    networkResponse = await fetchWithRetry(request);
  } catch (err) {
    throw err;
  }

  if (networkResponse && networkResponse.status === 404) {
    await cache.delete(request).catch(() => {});
    try {
      networkResponse = await fetchWithRetry(request, { retries: 1 });
    } catch (err) {
      throw err;
    }
  }

  if (networkResponse && networkResponse.status === 200) {
    safeCachePut(cache, request, networkResponse.clone());
  }
  return networkResponse;
}

// Shell icons / manifest: stale-while-revalidate.
async function handleShellAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        safeCachePut(cache, request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => null);
  if (cached) {
    fetchPromise.catch(() => {});
    return cached;
  }
  const fresh = await fetchPromise;
  if (fresh) return fresh;
  return fetch(request);
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const requestUrl = new URL(request.url);

  if (shouldBypass(request, requestUrl)) return;

  if (isHTMLNavigation(request, requestUrl)) {
    // Admin is not the offline PWA — let the browser fetch it directly so a
    // SW network hiccup cannot surface as ERR_FAILED before admin.js runs.
    if (isAdminShellPath(requestUrl.pathname)) {
      return;
    }
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
