import { getApp, getApps, initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { initFirebaseAppCheck } from './firebase-app-check.js'

const firebaseConfig = {
  apiKey: "AIzaSyBGaONCeB5MQCYdp3Gv8eUKPvLsBGFnXgY",
  authDomain: "ebhcs-bulletin-board.firebaseapp.com",
  projectId: "ebhcs-bulletin-board",
  storageBucket: "ebhcs-bulletin-uploads-us",
  messagingSenderId: "556649154585",
  appId: "1:556649154585:web:3a3f49d2056aa507088288"
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
initFirebaseAppCheck(app)
export const db = getFirestore(app)
export const auth = getAuth(app)
