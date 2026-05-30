// Stable-load strategy for the EBHCS Bulletin PWA:
//
// 1. On install, pre-cache the student app shell essentials and only the
//    critical hashed JS/CSS listed in /asset-manifest.json. Deferred Firebase
//    chunks are cached at runtime after first use, not during install.
//
// 2. Navigations (HTML) use stale-while-revalidate: serve the cached shell
//    instantly, fetch a fresh copy in the background, and put it back in the
//    cache for next launch. /version.json (fetched separately by app-update.js,
//    never cached here) is the source of truth for "is there a new deploy?" —
//    when it changes, app-update.js asks this worker to cache the fresh shell
//    before reloading.
//
// 3. Hashed /assets/* are immutable, so we cache-first them and only hit the
//    network on a miss.
//
// 4. Firestore / Google APIs and /version.json are always bypassed.

const CACHE_NAME = 'ebhcs-bulletin-v6';

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

function getShellInfo(pathname) {
  if (ADMIN_SHELL_ALIASES.includes(pathname)) {
    return {
      cacheKey: '/admin.html',
      networkPath: '/admin.html',
      aliases: ADMIN_SHELL_ALIASES,
    };
  }

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

// Fetch with one retry on transient network failure. Cellular drops a single
// request constantly; without this, a new deploy's first asset request after
// activation can hit a hiccup and surface as ERR_FAILED with no recovery UI.
async function fetchWithRetry(request, { retries = 1, backoffMs = 250 } = {}) {
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

// Stale-while-revalidate for navigations: serve cached shell instantly
// (sub-50ms), refresh from network in the background. This is what makes
// cold loads fast.
//
// IMPORTANT TRANSITION NOTE: when a new deploy lands, the first navigation
// returns the OLD cached HTML (whose asset hashes are also cached → works),
// and the background revalidation caches the NEW HTML. On the *next*
// navigation we hand back the new HTML; its new asset hashes are not yet
// cached, so they're network-fetched on demand. fetchWithRetry below makes
// sure a single flaky cellular packet doesn't turn that into an ERR_FAILED.
async function handleNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  const requestUrl = new URL(request.url);
  const shellInfo = getShellInfo(requestUrl.pathname);

  let cached = await cache.match(request);
  if (!cached) {
    for (const alias of shellInfo.aliases) {
      cached = await cache.match(alias);
      if (cached) break;
    }
  }

  const networkFetch = fetchAndCacheShell(shellInfo)
    .catch(() => null);

  if (cached) {
    networkFetch.catch(() => {});
    return cached;
  }

  const fresh = await networkFetch;
  if (fresh) return fresh;

  // Truly offline AND no cached shell (brand-new install, no network).
  return new Response(
    '<!doctype html><meta charset=utf-8><title>Offline</title>' +
    '<style>body{font-family:system-ui;padding:2rem;color:#1e3a6e}</style>' +
    '<h1>You are offline</h1>' +
    '<p>Reconnect and refresh to load the bulletin board.</p>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
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
// miss. We do NOT return Response.error() on failure — we re-throw so the
// browser surfaces a normal network error (which the user's normal refresh
// can recover from) rather than the dead-end ERR_FAILED page.
async function handleHashedAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const networkResponse = await fetchWithRetry(request);
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
