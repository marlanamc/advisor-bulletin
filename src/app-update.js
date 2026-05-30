const VERSION_KEY = 'ebhcs_app_version';
const VERSION_RELOAD_KEY = 'ebhcs_app_reload_for_version';
const VERSION_CHECK_INTERVAL_MS = 60 * 1000;
const VERSION_FETCH_TIMEOUT_MS = 4000;
const SHELL_PREP_TIMEOUT_MS = 5000;

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

function waitForServiceWorkerController() {
    if (!('serviceWorker' in navigator)) return Promise.resolve(null);
    if (navigator.serviceWorker.controller) {
        return Promise.resolve(navigator.serviceWorker.controller);
    }

    return new Promise((resolve) => {
        const timeoutId = setTimeout(() => resolve(null), 1000);
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            clearTimeout(timeoutId);
            resolve(navigator.serviceWorker.controller || null);
        }, { once: true });
    });
}

async function prepareFreshShell() {
    const controller = await waitForServiceWorkerController();
    if (!controller || !navigator.serviceWorker) return false;

    return new Promise((resolve) => {
        const channel = new MessageChannel();
        const timeoutId = setTimeout(() => {
            channel.port1.close();
            resolve(false);
        }, SHELL_PREP_TIMEOUT_MS);

        channel.port1.onmessage = (event) => {
            clearTimeout(timeoutId);
            channel.port1.close();
            resolve(event.data?.ok === true);
        };

        try {
            controller.postMessage({ type: 'PREPARE_FRESH_SHELL' }, [channel.port2]);
        } catch {
            clearTimeout(timeoutId);
            channel.port1.close();
            resolve(false);
        }
    });
}

async function reloadForVersion(version) {
    const lastReloadVersion = sessionStorage.getItem(VERSION_RELOAD_KEY);
    if (lastReloadVersion === version) return;

    const prepared = await prepareFreshShell();
    sessionStorage.setItem(VERSION_RELOAD_KEY, version);

    if (!prepared) {
        console.warn('[App Update] Fresh shell preparation timed out; reloading normally.');
    }

    location.reload();
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
                await reloadForVersion(next);
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
