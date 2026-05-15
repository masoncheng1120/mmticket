import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { bindLogout, getUserProfile, requireAuth } from "./auth-guard.js";

const marketplaceGrid = document.getElementById("marketplaceGrid");
const myPendingRequests = document.getElementById("myPendingRequests");

let currentUser = null;
let currentNickname = "";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderMarket(items) {
  if (!items.length) {
    marketplaceGrid.innerHTML = `<div class="empty-state">No tickets are currently available.</div>`;
    return;
  }

  marketplaceGrid.innerHTML = items
    .map((item) => {
      return `<article class="ticket-card">
        <h4>${escapeHtml(item.showDetails)}</h4>
        <p class="muted">Owner: ${escapeHtml(item.ownerName || item.ownerEmail || "Unknown")}</p>
        <span class="badge available">available</span>
        <button class="btn btn-primary request-button" data-ticket-id="${escapeHtml(item.id)}">Request Transfer</button>
      </article>`;
    })
    .join("");

  document.querySelectorAll(".request-button").forEach((button) => {
    button.addEventListener("click", () => {
      const ticketId = button.getAttribute("data-ticket-id");
      requestTransfer(ticketId, button);
    });
  });
}

function renderMyPending(items) {
  if (!items.length) {
    myPendingRequests.innerHTML = `<li class="empty-state">You have no pending requests.</li>`;
    return;
  }

  myPendingRequests.innerHTML = items
    .map((item) => {
      return `<li>
        <div>
          <strong>${escapeHtml(item.showDetails)}</strong><br>
          <span class="muted">Owner: ${escapeHtml(item.ownerName || item.ownerEmail || "Unknown")}</span>
        </div>
        <span class="badge requested">pending</span>
      </li>`;
    })
    .join("");
}

async function hasExistingRequest(ticketId) {
  const requesterQuery = query(
    collection(db, "requests"),
    where("requesterId", "==", currentUser.uid)
  );

  const snapshot = await getDocs(requesterQuery);
  return snapshot.docs.some((docSnapshot) => {
    const data = docSnapshot.data();
    return data.ticketId === ticketId && (data.status === "pending" || data.status === "accepted");
  });
}

async function requestTransfer(ticketId, button) {
  button.disabled = true;

  try {
    const ticketQuery = query(collection(db, "tickets"), where("status", "==", "available"));
    const snapshot = await getDocs(ticketQuery);
    const ticketDoc = snapshot.docs.find((docSnapshot) => docSnapshot.id === ticketId);

    if (!ticketDoc) {
      throw new Error("Ticket is no longer available.");
    }

    const ticketData = ticketDoc.data();

    if (ticketData.ownerId === currentUser.uid) {
      throw new Error("You cannot request your own ticket.");
    }

    if (await hasExistingRequest(ticketId)) {
      throw new Error("You already requested this ticket.");
    }

    await addDoc(collection(db, "requests"), {
      ticketId,
      requesterId: currentUser.uid,
      requesterEmail: currentUser.email || "",
      requesterName: currentNickname || currentUser.email || "User",
      ownerId: ticketData.ownerId,
      ownerEmail: ticketData.ownerEmail || "",
      ownerName: ticketData.ownerName || ticketData.ownerEmail || "Unknown",
      showDetails: ticketData.showDetails,
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    await updateDoc(doc(db, "tickets", ticketId), {
      status: "requested",
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    alert(error.message || "Could not send transfer request.");
  } finally {
    button.disabled = false;
  }
}

function bindRealtimeListeners() {
  const marketQuery = query(collection(db, "tickets"), where("status", "==", "available"));

  onSnapshot(marketQuery, (snapshot) => {
    const items = snapshot.docs
      .map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }))
      .filter((item) => item.ownerId !== currentUser.uid);

    renderMarket(items);
  });

  const myPendingQuery = query(
    collection(db, "requests"),
    where("requesterId", "==", currentUser.uid)
  );

  onSnapshot(myPendingQuery, (snapshot) => {
    const items = snapshot.docs
      .map((docSnapshot) => ({
        id: docSnapshot.id,
        ...docSnapshot.data()
      }))
      .filter((item) => item.status === "pending")
      .sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      });

    renderMyPending(items);
  });
}

(async function init() {
  currentUser = await requireAuth();
  const profile = await getUserProfile(currentUser.uid);
  currentNickname = profile?.nickname?.trim() || currentUser.email || "User";

  bindLogout();
  bindRealtimeListeners();
})();
