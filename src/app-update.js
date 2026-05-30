const VERSION_KEY = 'ebhcs_app_version';
const VERSION_RELOAD_KEY = 'ebhcs_app_reload_for_version';
const VERSION_CHECK_INTERVAL_MS = 60 * 1000;
const VERSION_FETCH_TIMEOUT_MS = 4000;
const SHELL_PREP_TIMEOUT_MS = 5000;
const UPDATE_BANNER_ID = 'ebhcs-app-update-banner';

let checking = false;
let initialized = false;
let lastVersionCheckAt = 0;
let bannerVisible = false;

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

function ensureUpdateBannerStyles() {
    if (document.getElementById('ebhcs-app-update-banner-styles')) return;

    const style = document.createElement('style');
    style.id = 'ebhcs-app-update-banner-styles';
    style.textContent = `
      #${UPDATE_BANNER_ID} {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        flex-wrap: wrap;
        padding: 0.85rem 1.25rem;
        background: #1e3a6e;
        color: #fff;
        font: 500 0.95rem/1.4 system-ui, sans-serif;
        box-shadow: 0 -4px 24px rgba(15, 23, 42, 0.25);
      }
      #${UPDATE_BANNER_ID} button {
        border: 0;
        border-radius: 999px;
        padding: 0.5rem 1rem;
        background: #c9a84c;
        color: #1e3a6e;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }
      #${UPDATE_BANNER_ID} button:disabled {
        opacity: 0.7;
        cursor: wait;
      }
    `;
    document.head.appendChild(style);
}

function showUpdateBanner(version) {
    if (bannerVisible || typeof document === 'undefined') return;
    bannerVisible = true;

    ensureUpdateBannerStyles();

    const existing = document.getElementById(UPDATE_BANNER_ID);
    if (existing) {
        existing.hidden = false;
        return;
    }

    const banner = document.createElement('div');
    banner.id = UPDATE_BANNER_ID;
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    banner.innerHTML = `
      <span>A new version is available — refresh to update.</span>
      <button type="button">Refresh</button>
    `;

    const button = banner.querySelector('button');
    button.addEventListener('click', async () => {
        button.disabled = true;
        button.textContent = 'Updating…';

        const prepared = await prepareFreshShell();
        sessionStorage.setItem(VERSION_RELOAD_KEY, version);

        if (!prepared) {
            console.warn('[App Update] Fresh shell preparation timed out; reloading normally.');
        }

        location.reload();
    });

    document.body.appendChild(banner);
}

async function runVersionCheck() {
    if (checking) return;
    checking = true;
    lastVersionCheckAt = Date.now();

    try {
        const next = await fetchDeployedVersion();
        if (!next) return;

        const prev = sessionStorage.getItem(VERSION_KEY);
        if (prev && prev !== next) {
            sessionStorage.setItem(VERSION_KEY, next);
            showUpdateBanner(next);
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

// Exposed for tests.
export async function __testOnlyRunVersionCheck() {
    await runVersionCheck();
}

export async function __testOnlyPrepareFreshShell() {
    return prepareFreshShell();
}
