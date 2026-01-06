// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// TODO: Replace the following with your app's Firebase project configuration
// See: https://firebase.google.com/docs/web/learn-more#config-object
const firebaseConfig = {
  apiKey: "AIzaSyCNUQvXxM7hVQXwGD3gzHRBucgPatVKszU",
  authDomain: "todo-list-sync-56241.firebaseapp.com",
  projectId: "todo-list-sync-56241",
  storageBucket: "todo-list-sync-56241.firebasestorage.app",
  messagingSenderId: "738236918776",
  appId: "1:738236918776:web:982d5de0665d1307a0840d",
  measurementId: "G-H1YQ4RBFC8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { db, auth, provider };
