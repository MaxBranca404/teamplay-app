// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// --- INCOLLA QUI SOTTO IL TUO OGGETTO DI CONFIGURAZIONE ---
// (Lo trovi nella console Firebase -> Impostazioni progetto -> Generali)
const firebaseConfig = {
  apiKey: "AIzaSyC7lDJr-dvaHFJ9EUMYxsroQ9i6uMgTxVg",
  authDomain: "teamplay-app-691f7.firebaseapp.com",
  projectId: "teamplay-app-691f7",
  storageBucket: "teamplay-app-691f7.firebasestorage.app",
  messagingSenderId: "496680296951",
  appId: "1:496680296951:web:f05cd14a5ba99d02084ef2"
};
// -----------------------------------------------------------

// Inizializza Firebase
const app = initializeApp(firebaseConfig);

// Esportiamo i servizi per usarli nel resto dell'app
export const auth = getAuth(app);
export const db = getFirestore(app);