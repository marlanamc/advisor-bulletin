import { getApp, getApps, initializeApp } from 'firebase/app'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getStorage, connectStorageEmulator } from 'firebase/storage'
import { initFirebaseAppCheck } from './firebase-app-check.js'
import { firebaseConfig } from './firebase-shared-config.js'
import { claimEmulatorService } from './firebase-emulators.js'

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
initFirebaseAppCheck(app)
export const db = getFirestore(app)
export const auth = getAuth(app)
export const storage = getStorage(app)

// Route to local emulators when explicitly opted in — tests/CI only, never
// production. The literal env test keeps this whole branch out of the prod
// bundle; see firebase-emulators.js for the per-service guard rationale.
if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  if (claimEmulatorService('firestore')) connectFirestoreEmulator(db, 'localhost', 8080)
  if (claimEmulatorService('auth')) connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true })
  if (claimEmulatorService('storage')) connectStorageEmulator(storage, 'localhost', 9199)
}
