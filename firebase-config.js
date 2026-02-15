// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, initializeFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyA0CJpzYSze5uTImSVx45ottpN4GChKr54",
    authDomain: "keypeepanch-new.firebaseapp.com",
    projectId: "keypeepanch-new",
    storageBucket: "keypeepanch-new.firebasestorage.app",
    messagingSenderId: "382916575120",
    appId: "1:382916575120:web:44dbf935fb034d4cb9fd15",
    measurementId: "G-569SX69JH9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// Fix for hanging writes: Force Long Polling (bypasses WebSocket blocks)
const db = initializeFirestore(app, { experimentalForceLongPolling: true });
const storage = getStorage(app);

export { auth, db, storage };
