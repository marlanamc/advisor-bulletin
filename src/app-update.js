const VERSION_KEY = 'ebhcs_app_version';
const VERSION_CHECK_INTERVAL_MS = 60 * 1000;
const VERSION_FETCH_TIMEOUT_MS = 4000;

let checking = false;
let initialized = false;
let lastVersionCheckAt = 0;

async function fetchDeployedVersion() {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller
        ? setTimeout(() => controller.abort(), VERSION_FETCH_TIMEOUT_MS)
        : null;

    try {
        const res = await fetch(`/version.json?${Date.now()}`, {
            cache: 'no-store',
            signal: controller?.signal,
        });
        if (!res.ok) return null;
        const data = await res.json();
        const value = data?.v ?? data?.version;
        return value == null ? null : String(value);
    } catch {
        return null;
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
}

async function runVersionCheck({ allowReload = true } = {}) {
    if (checking) return;
    checking = true;
    lastVersionCheckAt = Date.now();

    try {
        const next = await fetchDeployedVersion();
        if (!next) return;

        const prev = sessionStorage.getItem(VERSION_KEY);
        if (prev && prev !== next) {
            sessionStorage.setItem(VERSION_KEY, next);
            if (allowReload) {
                location.reload();
            }
            return;
        }
        if (!prev) {
            sessionStorage.setItem(VERSION_KEY, next);
        }
    } catch {
        // Offline or dev — keep running the cached app.
    } finally {
        checking = false;
    }
}

export function initAppUpdateCheck() {
    if (typeof document === 'undefined' || initialized) return;
    initialized = true;

    // Run in the background so Firestore and the feed can start immediately.
    runVersionCheck();

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        if (Date.now() - lastVersionCheckAt < VERSION_CHECK_INTERVAL_MS) return;
        runVersionCheck();
    });
}
