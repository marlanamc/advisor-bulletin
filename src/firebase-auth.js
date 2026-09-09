import { getApp, getApps, initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { initFirebaseAppCheck } from './firebase-app-check.js'
import { firebaseConfig } from './firebase-shared-config.js'

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
initFirebaseAppCheck(app)
export const db = getFirestore(app)
export const auth = getAuth(app)
