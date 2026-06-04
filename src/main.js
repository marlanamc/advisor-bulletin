import './css/index.css'
import { initImageLightbox } from './lightbox.js'

initImageLightbox()

// Defer firebase-config until just after first paint so the shell can render,
// then hydrate cached/local Firestore data without waiting for idle time.
function loadFirebaseConfig() {
    import('../firebase-config.js')
}

if ('requestAnimationFrame' in window) {
    requestAnimationFrame(() => setTimeout(loadFirebaseConfig, 0))
} else {
    setTimeout(loadFirebaseConfig, 0)
}

const DEPLOY_VERSION_URL = '/version.json'
const DEPLOY_VERSION_STORAGE_KEY = 'ebhcs_student_deploy_version'
const DEPLOY_RELOAD_GUARD_KEY = 'ebhcs_student_reload_version'
const FRESH_SHELL_TIMEOUT_MS = 1500

function readStorage(storageName, key) {
    try {
        return window[storageName].getItem(key)
    } catch {
        return null
    }
}

function writeStorage(storageName, key, value) {
    try {
        window[storageName].setItem(key, value)
    } catch {
        // Private browsing or full storage should not block the app.
    }
}

async function fetchDeployVersion() {
    try {
        const response = await fetch(DEPLOY_VERSION_URL, { cache: 'no-store' })
        if (!response.ok) return null
        const payload = await response.json()
        return typeof payload?.v === 'string' && payload.v ? payload.v : null
    } catch {
        return null
    }
}

function prepareFreshShell() {
    return new Promise((resolve) => {
        const controller = navigator.serviceWorker?.controller
        if (!controller || typeof MessageChannel === 'undefined') {
            resolve(false)
            return
        }

        let settled = false
        const finish = (ok) => {
            if (settled) return
            settled = true
            clearTimeout(timeoutId)
            resolve(ok)
        }
        const channel = new MessageChannel()
        const timeoutId = setTimeout(() => finish(false), FRESH_SHELL_TIMEOUT_MS)
        channel.port1.onmessage = (event) => finish(Boolean(event.data?.ok))

        try {
            controller.postMessage({ type: 'PREPARE_FRESH_SHELL' }, [channel.port2])
        } catch {
            finish(false)
        }
    })
}

let deployVersionCheckPromise = null

async function checkDeployVersion() {
    if (deployVersionCheckPromise) return deployVersionCheckPromise

    deployVersionCheckPromise = (async () => {
        const latestVersion = await fetchDeployVersion()
        if (!latestVersion) return

        const storedVersion = readStorage('localStorage', DEPLOY_VERSION_STORAGE_KEY)
        if (!storedVersion) {
            writeStorage('localStorage', DEPLOY_VERSION_STORAGE_KEY, latestVersion)
            return
        }
        if (storedVersion === latestVersion) return

        const reloadGuard = readStorage('sessionStorage', DEPLOY_RELOAD_GUARD_KEY)
        if (reloadGuard === latestVersion) {
            writeStorage('localStorage', DEPLOY_VERSION_STORAGE_KEY, latestVersion)
            return
        }

        writeStorage('sessionStorage', DEPLOY_RELOAD_GUARD_KEY, latestVersion)
        writeStorage('localStorage', DEPLOY_VERSION_STORAGE_KEY, latestVersion)
        await prepareFreshShell()
        window.location.reload()
    })().finally(() => {
        deployVersionCheckPromise = null
    })

    return deployVersionCheckPromise
}

function watchServiceWorkerUpdates(registration) {
    registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing
        if (!installingWorker) return

        installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                checkDeployVersion()
            }
        })
    })

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        checkDeployVersion()
    })
}

async function registerServiceWorker() {
    try {
        const registration = await navigator.serviceWorker.register('/service-worker.js', {
            updateViaCache: 'none',
        })
        watchServiceWorkerUpdates(registration)
        registration.update().catch(() => {})
        console.log('[Service Worker] Registered successfully with scope:', registration.scope)
    } catch (error) {
        console.error('[Service Worker] Registration failed:', error)
    }
}

// Register PWA Service Worker for offline support & client-side caching.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        registerServiceWorker().finally(() => {
            checkDeployVersion()
        })
    })
}
