// The admin sign-in path only. admin.js imports this at the top level, so it
// is what starts the Firestore client on /admin -- firebase-admin.js (and with
// it firebase.js) is imported lazily, after verifyAdvisorAccess has already
// read advisors/{username}. Without the emulator hookup below, every admin-page
// read went to PRODUCTION even under VITE_USE_FIREBASE_EMULATOR=true, so
// Playwright runs billed against the daily Firestore read quota -- which is
// exactly what scripts/run-with-emulator.mjs exists to prevent.
import { getApp, getApps, initializeApp } from 'firebase/app'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { initFirebaseAppCheck } from './firebase-app-check.js'
import { firebaseConfig } from './firebase-shared-config.js'
import { claimEmulatorService } from './firebase-emulators.js'

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
initFirebaseAppCheck(app)
export const db = getFirestore(app)
export const auth = getAuth(app)

if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  if (claimEmulatorService('firestore')) connectFirestoreEmulator(db, 'localhost', 8080)
  if (claimEmulatorService('auth')) connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true })
}
