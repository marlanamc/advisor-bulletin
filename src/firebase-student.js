// Lean Firebase init for the student-facing site.
// Only loads Firestore — no Auth or Storage SDK.
// Saves ~30KB JS + a network roundtrip on cold student loads.
import { initializeApp } from 'firebase/app'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { initFirebaseAppCheck } from './firebase-app-check.js'
import { firebaseConfig } from './firebase-shared-config.js'

const app = initializeApp(firebaseConfig)
initFirebaseAppCheck(app)
export const db = getFirestore(app)

// Route to the local emulator when explicitly opted in — tests/CI only,
// never production. See src/firebase.js for the matching admin-side setup
// and the double-connect guard rationale.
if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true' && !globalThis.__firebaseEmulatorsConnected) {
  connectFirestoreEmulator(db, 'localhost', 8080)
  globalThis.__firebaseEmulatorsConnected = true
}
