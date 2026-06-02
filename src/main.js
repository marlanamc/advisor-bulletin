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
