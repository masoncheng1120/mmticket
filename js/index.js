import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { auth } from "./firebase-config.js";
import { upsertUserProfile } from "./auth-guard.js";

const authForm = document.getElementById("authForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const nicknameWrap = document.getElementById("nicknameWrap");
const nicknameInput = document.getElementById("nickname");
const confirmWrap = document.getElementById("confirmWrap");
const confirmPasswordInput = document.getElementById("confirmPassword");
const authTitle = document.getElementById("authTitle");
const authSubtitle = document.getElementById("authSubtitle");
const submitButton = document.getElementById("submitButton");
const toggleModeButton = document.getElementById("toggleMode");
const formMessage = document.getElementById("formMessage");

let isRegisterMode = false;

function setMessage(text, type = "") {
  formMessage.textContent = text;
  formMessage.classList.remove("error", "success");
  if (type) {
    formMessage.classList.add(type);
  }
}

function formatFirebaseError(error) {
  const code = error?.code || "";

  if (code.includes("invalid-email")) return "Please enter a valid email address.";
  if (code.includes("user-not-found")) return "No account found for this email.";
  if (code.includes("wrong-password") || code.includes("invalid-credential")) {
    return "Email or password is incorrect.";
  }
  if (code.includes("email-already-in-use")) return "This email is already registered.";
  if (code.includes("weak-password")) return "Password must be at least 6 characters.";
  if (code.includes("too-many-requests")) return "Too many attempts. Please try again later.";

  return error?.message || "Something went wrong. Please try again.";
}

function toggleAuthMode() {
  isRegisterMode = !isRegisterMode;

  authTitle.textContent = isRegisterMode ? "Create Account" : "Welcome Back";
  authSubtitle.textContent = isRegisterMode
    ? "Register to start listing and requesting ticket transfers."
    : "Sign in to access your dashboard and marketplace.";
  submitButton.textContent = isRegisterMode ? "Register" : "Sign In";
  toggleModeButton.textContent = isRegisterMode
    ? "Already have an account? Sign In"
    : "Need an account? Register";

  nicknameWrap.classList.toggle("hidden", !isRegisterMode);
  nicknameInput.required = isRegisterMode;
  confirmWrap.classList.toggle("hidden", !isRegisterMode);
  confirmPasswordInput.required = isRegisterMode;
  setMessage("");
}

toggleModeButton.addEventListener("click", toggleAuthMode);

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    setMessage("Email and password are required.", "error");
    return;
  }

  if (isRegisterMode) {
    const nickname = nicknameInput.value.trim();
    if (nickname.length < 2) {
      setMessage("Nickname must be at least 2 characters.", "error");
      return;
    }

    const confirmPassword = confirmPasswordInput.value;
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.", "error");
      return;
    }
  }

  submitButton.disabled = true;
  setMessage(isRegisterMode ? "Creating your account..." : "Signing in...");

  try {
    if (isRegisterMode) {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await upsertUserProfile(result.user, nicknameInput.value.trim());
      setMessage("Account created. Redirecting...", "success");
    } else {
      const result = await signInWithEmailAndPassword(auth, email, password);
      await upsertUserProfile(result.user);
      setMessage("Login successful. Redirecting...", "success");
    }

    window.location.replace("dashboard.html");
  } catch (error) {
    setMessage(formatFirebaseError(error), "error");
    submitButton.disabled = false;
  }
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.replace("dashboard.html");
  }
});
