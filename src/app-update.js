const VERSION_KEY = 'ebhcs_app_version';
const BULLETIN_CACHE_KEY = 'ebhcs_bulletins_v1';

let versionCheckPromise = null;
let checking = false;
let initialized = false;

async function fetchDeployedVersion() {
    const res = await fetch(`/version.json?${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    const value = data?.v ?? data?.version;
    return value == null ? null : String(value);
}

function clearBulletinCache() {
    try {
        sessionStorage.removeItem(BULLETIN_CACHE_KEY);
    } catch {
        // ignore
    }
}

async function runVersionCheck({ allowReload = true } = {}) {
    if (checking) {
        return versionCheckPromise ?? true;
    }
    checking = true;

    const work = (async () => {
        try {
            const next = await fetchDeployedVersion();
            if (!next) return true;

            const prev = sessionStorage.getItem(VERSION_KEY);
            if (prev && prev !== next) {
                sessionStorage.setItem(VERSION_KEY, next);
                clearBulletinCache();
                if (allowReload) {
                    location.reload();
                    return false;
                }
            } else if (!prev) {
                sessionStorage.setItem(VERSION_KEY, next);
            }
            return true;
        } catch {
            return true;
        } finally {
            checking = false;
        }
    })();

    versionCheckPromise = work;
    return work;
}

export function initAppUpdateCheck() {
    if (typeof document === 'undefined' || initialized) return;
    initialized = true;
    runVersionCheck();
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            runVersionCheck();
        }
    });
}

export async function ensureAppVersionCurrent() {
    if (!versionCheckPromise) {
        initAppUpdateCheck();
    }
    return versionCheckPromise ?? true;
}
