import { auth, provider } from "./firebase-config.js";
import { signInWithPopup, signOut, onAuthStateChanged, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let currentUser = null;

const loginButton = document.getElementById("login-btn");
const logoutButton = document.getElementById("logout-btn");
const userProfile = document.getElementById("user-profile");
const userNameDisplay = document.getElementById("user-name");
const authContainer = document.getElementById("auth-container");

// Login Function
export async function login() {
    try {
        provider.setCustomParameters({
            prompt: 'select_account'
        });
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        console.log("User signed in:");
    } catch (error) {
        console.error("Login failed:", error);
        alert("Login failed: " + error.message);
    }
}

// Logout Function
export async function logout() {
    try {
        await signOut(auth);
        console.log("User signed out");
        location.reload(); // Reload to clear state
    } catch (error) {
        console.error("Logout failed:", error);
    }
}

// Auth State Listener
export function initAuth(onLogin, onLogout) {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            if (loginButton) loginButton.classList.add("d-none");
            if (userProfile) userProfile.classList.remove("d-none");
            if (userNameDisplay) userNameDisplay.textContent = user.displayName;
            if (onLogin) onLogin(user);
        } else {
            currentUser = null;
            if (loginButton) loginButton.classList.remove("d-none");
            if (userProfile) userProfile.classList.add("d-none");
            if (userNameDisplay) userNameDisplay.textContent = "";
            if (onLogout) onLogout();
        }
    });
}

export function getCurrentUser() {
    return currentUser;
}

// Attach event listeners if elements exist
if (loginButton) loginButton.addEventListener("click", login);
if (logoutButton) logoutButton.addEventListener("click", logout);
