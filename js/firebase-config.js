import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA2XCTlrsHaoduNMrlWyqpc_h-3vGb8Y7k",
  authDomain: "mmtix-93d5e.firebaseapp.com",
  projectId: "mmtix-93d5e",
  storageBucket: "mmtix-93d5e.firebasestorage.app",
  messagingSenderId: "1039067126237",
  appId: "1:1039067126237:web:42dbeb5f19976fed0f3e34"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
