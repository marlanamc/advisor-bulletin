import { getApp, getApps, initializeApp } from 'firebase/app'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getStorage, connectStorageEmulator } from 'firebase/storage'
import { initFirebaseAppCheck } from './firebase-app-check.js'
import { firebaseConfig } from './firebase-shared-config.js'

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
initFirebaseAppCheck(app)
export const db = getFirestore(app)
export const auth = getAuth(app)
export const storage = getStorage(app)

// Route to local emulators when explicitly opted in — tests/CI only, never
// production. Guarded against double-connect since Vite HMR can re-execute
// this module and connect*Emulator throws if called twice on one instance.
if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true' && !globalThis.__firebaseEmulatorsConnected) {
  connectFirestoreEmulator(db, 'localhost', 8080)
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true })
  connectStorageEmulator(storage, 'localhost', 9199)
  globalThis.__firebaseEmulatorsConnected = true
}
