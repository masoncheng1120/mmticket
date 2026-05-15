import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

export function requireAuth(redirectTo = "index.html") {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();

      if (!user) {
        window.location.replace(redirectTo);
        return;
      }

      await upsertUserProfile(user);
      resolve(user);
    });
  });
}

export function bindLogout(buttonId = "logoutButton") {
  const logoutButton = document.getElementById(buttonId);
  if (!logoutButton) return;

  logoutButton.addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.replace("index.html");
    } catch (error) {
      // Keep a visible fallback when sign-out fails unexpectedly.
      alert(error.message || "Unable to log out at the moment.");
    }
  });
}

function defaultNicknameFromEmail(email) {
  if (!email) return "User";
  const [namePart] = email.split("@");
  return namePart || "User";
}

export async function upsertUserProfile(user, nickname = "") {
  const userRef = doc(db, "users", user.uid);
  const snapshot = await getDoc(userRef);
  const cleanNickname = nickname.trim();

  if (!snapshot.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email || "",
      nickname: cleanNickname || defaultNicknameFromEmail(user.email || ""),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return;
  }

  const mergeData = {
    email: user.email || "",
    updatedAt: serverTimestamp()
  };

  if (cleanNickname) {
    mergeData.nickname = cleanNickname;
  }

  await setDoc(
    userRef,
    mergeData,
    { merge: true }
  );
}

export async function getUserProfile(userId) {
  const userRef = doc(db, "users", userId);
  const snapshot = await getDoc(userRef);
  return snapshot.exists() ? snapshot.data() : null;
}
