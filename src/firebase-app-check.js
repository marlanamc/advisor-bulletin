import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'

export function initFirebaseAppCheck(app) {
    const siteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;
    const debugToken = import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN;

    if (!siteKey || globalThis.__ebhcsAppCheckInitialized) {
        return null;
    }

    if (debugToken && import.meta.env.DEV) {
        globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken === 'true' ? true : debugToken;
    }

    try {
        const appCheck = initializeAppCheck(app, {
            provider: new ReCaptchaV3Provider(siteKey),
            isTokenAutoRefreshEnabled: true,
        });
        globalThis.__ebhcsAppCheckInitialized = true;
        return appCheck;
    } catch (error) {
        console.warn('[Firebase] App Check did not initialize:', error);
        return null;
    }
}
