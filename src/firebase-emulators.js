/**
 * Per-service claim for the local-emulator hookup used by test runs.
 *
 * Three modules initialize Firebase for different surfaces -- firebase.js
 * (admin: Firestore, Auth, Storage), firebase-auth.js (the admin sign-in path:
 * Firestore, Auth) and firebase-student.js (student: Firestore) -- and they can
 * run in either order on the same app. They used to share one boolean
 * (__firebaseEmulatorsConnected), so whichever module ran first claimed it and
 * the others skipped their entire block: on the admin page that could leave
 * Storage pointed at production while Firestore was emulated.
 *
 * getFirestore(app) / getAuth(app) / getStorage(app) each return a singleton
 * per app, so connecting each service exactly once is what matters, and
 * connect*Emulator throws if called twice on one instance (Vite HMR can
 * re-execute these modules).
 *
 * Callers must keep the `import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true'`
 * test inline at their call site rather than delegating it here, so Vite can
 * statically fold it to false and drop the emulator branch -- and the SDK's
 * connect*Emulator imports with it -- out of the production bundle.
 */

/** True the first time this service is claimed, false every time after. */
export function claimEmulatorService(service) {
    const claimed = (globalThis.__firebaseEmulatorServices ||= new Set());
    if (claimed.has(service)) return false;
    claimed.add(service);
    return true;
}
