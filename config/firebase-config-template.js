// Firebase Configuration Template
// Copy these values into src/firebase-shared-config.js and
// scripts/lib/firebase-config.mjs when creating a new Firebase project.
// Firebase web apiKey values are public identifiers, not service-account secrets.

const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Optional hardening: set VITE_FIREBASE_APPCHECK_SITE_KEY in the build
// environment after registering this web app in Firebase App Check.

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore();

// Initialize Auth
const auth = firebase.auth();

// Initialize Storage
const storage = firebase.storage();
