// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDmbvH3x89JLk-uj_QoyuwVLXMQ3EGImao",
    authDomain: "keypeepanch-786b9.firebaseapp.com",
    projectId: "keypeepanch-786b9",
    storageBucket: "keypeepanch-786b9.firebasestorage.app",
    messagingSenderId: "886539726415",
    appId: "1:886539726415:web:ececfb8f4efe7f3925443a",
    measurementId: "G-GXMPB8NBQB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
