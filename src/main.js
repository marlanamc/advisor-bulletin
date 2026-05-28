import './css/index.css'
import { initAppUpdateCheck } from './app-update.js'
import { initImageLightbox } from './lightbox.js'

initAppUpdateCheck()

initImageLightbox()

import('../firebase-config.js')

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

