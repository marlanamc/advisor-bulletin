// Lean Firebase init for the student-facing site.
// Only loads Firestore — no Auth or Storage SDK.
// Saves ~30KB JS + a network roundtrip on cold student loads.
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyBGaONCeB5MQCYdp3Gv8eUKPvLsBGFnXgY",
  authDomain: "ebhcs-bulletin-board.firebaseapp.com",
  projectId: "ebhcs-bulletin-board",
  storageBucket: "ebhcs-bulletin-uploads-us",
  messagingSenderId: "556649154585",
  appId: "1:556649154585:web:3a3f49d2056aa507088288"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
