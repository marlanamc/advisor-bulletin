import './css/index.css'
import { initAppUpdateCheck } from './app-update.js'
import { initImageLightbox } from './lightbox.js'

initAppUpdateCheck()

initImageLightbox()

// Defer the 146KB firebase-config bundle until after first paint so the shell
// HTML + CSS can render before we pay for parse/compile on low-end mobile.
// The cached bulletin grid (localStorage) hydrates inside firebase-config init.
function loadFirebaseConfig() {
    import('../firebase-config.js')
}

if ('requestIdleCallback' in window) {
    requestIdleCallback(loadFirebaseConfig, { timeout: 1500 })
} else {
    setTimeout(loadFirebaseConfig, 0)
}

// Register PWA Service Worker for offline support & client-side caching
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then((registration) => {
                console.log('[Service Worker] Registered successfully with scope:', registration.scope);
            })
            .catch((error) => {
                console.error('[Service Worker] Registration failed:', error);
            });
    });
}

