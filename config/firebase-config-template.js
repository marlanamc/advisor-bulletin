// Firebase Configuration Template
// Replace the values below with your actual Firebase config
// IMPORTANT: Never commit real API keys to version control!

const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "ebhcs-bulletin-board.firebaseapp.com",
  projectId: "ebhcs-bulletin-board",
  storageBucket: "ebhcs-bulletin-uploads-us",
  messagingSenderId: "556649154585",
  appId: "1:556649154585:web:3a3f49d2056aa507088288"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore();

// Initialize Auth
const auth = firebase.auth();

// Initialize Storage
const storage = firebase.storage();
