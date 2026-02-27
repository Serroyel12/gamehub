// assets/js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

// Pega aquí el firebaseConfig que te da Firebase
const firebaseConfig = {
    apiKey: "AIzaSyB7LV-JMYAj27FbB1Y3JsdH5Kce6LK6iWo",
    authDomain: "rankarena-45551.firebaseapp.com",
    projectId: "rankarena-45551",
    storageBucket: "rankarena-45551.firebasestorage.app",
    messagingSenderId: "296542519284",
    appId: "1:296542519284:web:945279c8bfffb014f4c3a1"
  };

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);