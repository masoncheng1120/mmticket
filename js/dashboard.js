import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { bindLogout, getUserProfile, requireAuth, upsertUserProfile } from "./auth-guard.js";

const ticketForm = document.getElementById("ticketForm");
const showDetailsSelect = document.getElementById("showDetails");
const ticketFormMessage = document.getElementById("ticketFormMessage");
const myTicketsList = document.getElementById("myTicketsList");
const incomingRequestsList = document.getElementById("incomingRequestsList");
const receivedList = document.getElementById("receivedList");
const welcomeTitle = document.getElementById("welcomeTitle");
const nicknameForm = document.getElementById("nicknameForm");
const nicknameInput = document.getElementById("nicknameInput");
const nicknameMessage = document.getElementById("nicknameMessage");
const tabButtons = document.querySelectorAll(".tab-button");
const tabPanels = document.querySelectorAll(".tab-panel");

let currentUser = null;
let currentNickname = "";

function setFormMessage(text, type = "") {
  ticketFormMessage.textContent = text;
  ticketFormMessage.classList.remove("error", "success");
  if (type) {
    ticketFormMessage.classList.add(type);
  }
}

function setNicknameMessage(text, type = "") {
  nicknameMessage.textContent = text;
  nicknameMessage.classList.remove("error", "success");
  if (type) {
    nicknameMessage.classList.add(type);
  }
}

function getDisplayName(profile = null) {
  const nickname = profile?.nickname?.trim();
  if (nickname) return nickname;
  if (currentNickname) return currentNickname;
  return currentUser?.email || "User";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function emptyStateHtml(message) {
  return `<li class="empty-state">${escapeHtml(message)}</li>`;
}

function renderMyTickets(items) {
  if (!items.length) {
    myTicketsList.innerHTML = emptyStateHtml("No tickets listed yet.");
    return;
  }

  myTicketsList.innerHTML = items
    .map((item) => {
      return `<li>
        <div>
          <strong>${escapeHtml(item.showDetails)}</strong><br>
          <span class="muted">Owner: you</span>
        </div>
        <div class="action-group">
          <span class="badge ${escapeHtml(item.status)}">${escapeHtml(item.status)}</span>
          <button class="btn btn-danger delete-ticket-button" data-ticket-id="${escapeHtml(item.id)}">Delete</button>
        </div>
      </li>`;
    })
    .join("");

  document.querySelectorAll(".delete-ticket-button").forEach((button) => {
    button.addEventListener("click", () => {
      const ticketId = button.getAttribute("data-ticket-id");
      deleteTicket(ticketId, button);
    });
  });
}

function renderReceived(items) {
  if (!items.length) {
    receivedList.innerHTML = emptyStateHtml("No successful transfers yet.");
    return;
  }

  receivedList.innerHTML = items
    .map((item) => {
      return `<li>
        <div>
          <strong>${escapeHtml(item.showDetails)}</strong><br>
          <span class="muted">Transferred by ${escapeHtml(item.ownerName || item.ownerEmail || "Unknown owner")}</span>
        </div>
        <span class="badge occupied">received</span>
      </li>`;
    })
    .join("");
}

function renderIncoming(items) {
  if (!items.length) {
    incomingRequestsList.innerHTML = emptyStateHtml("No pending requests right now.");
    return;
  }

  incomingRequestsList.innerHTML = items
    .map((item) => {
      return `<li>
        <div>
          <strong>${escapeHtml(item.showDetails)}</strong><br>
          <span class="muted">Requested by ${escapeHtml(item.requesterName || item.requesterEmail || "Unknown user")}</span>
        </div>
        <div class="action-group">
          <button class="btn btn-primary accept-button" data-request-id="${escapeHtml(item.id)}">Accept</button>
          <button class="btn btn-secondary turn-down-button" data-request-id="${escapeHtml(item.id)}">Turn down</button>
        </div>
      </li>`;
    })
    .join("");

  document.querySelectorAll(".accept-button").forEach((button) => {
    button.addEventListener("click", () => {
      const requestId = button.getAttribute("data-request-id");
      acceptRequest(requestId, button);
    });
  });

  document.querySelectorAll(".turn-down-button").forEach((button) => {
    button.addEventListener("click", () => {
      const requestId = button.getAttribute("data-request-id");
      turnDownRequest(requestId, button);
    });
  });
}

async function propagateNickname(nickname) {
  const ticketsQuery = query(collection(db, "tickets"), where("ownerId", "==", currentUser.uid));
  const outgoingRequestsQuery = query(
    collection(db, "requests"),
    where("requesterId", "==", currentUser.uid)
  );
  const incomingRequestsQuery = query(
    collection(db, "requests"),
    where("ownerId", "==", currentUser.uid)
  );

  const [ticketSnapshot, outgoingSnapshot, incomingSnapshot] = await Promise.all([
    getDocs(ticketsQuery),
    getDocs(outgoingRequestsQuery),
    getDocs(incomingRequestsQuery)
  ]);

  const updates = [];

  ticketSnapshot.forEach((docSnapshot) => {
    updates.push(
      updateDoc(doc(db, "tickets", docSnapshot.id), {
        ownerName: nickname,
        updatedAt: serverTimestamp()
      })
    );
  });

  outgoingSnapshot.forEach((docSnapshot) => {
    updates.push(
      updateDoc(doc(db, "requests", docSnapshot.id), {
        requesterName: nickname,
        updatedAt: serverTimestamp()
      })
    );
  });

  incomingSnapshot.forEach((docSnapshot) => {
    updates.push(
      updateDoc(doc(db, "requests", docSnapshot.id), {
        ownerName: nickname,
        updatedAt: serverTimestamp()
      })
    );
  });

  if (updates.length) {
    await Promise.all(updates);
  }
}

nicknameForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const nickname = nicknameInput.value.trim();

  if (nickname.length < 2) {
    setNicknameMessage("Nickname must be at least 2 characters.", "error");
    return;
  }

  setNicknameMessage("Saving nickname...");

  try {
    await upsertUserProfile(currentUser, nickname);
    await propagateNickname(nickname);
    currentNickname = nickname;
    welcomeTitle.textContent = `Hello, ${currentNickname}`;
    setNicknameMessage("Nickname updated.", "success");
  } catch (error) {
    setNicknameMessage(error.message || "Unable to update nickname.", "error");
  }
});

async function rejectOtherPendingRequests(ticketId, acceptedRequestId) {
  const pendingQuery = query(
    collection(db, "requests"),
    where("ticketId", "==", ticketId),
    where("status", "==", "pending")
  );

  const snapshot = await getDocs(pendingQuery);
  const batch = writeBatch(db);
  let updates = 0;

  snapshot.forEach((docSnapshot) => {
    if (docSnapshot.id === acceptedRequestId) return;

    batch.update(doc(db, "requests", docSnapshot.id), {
      status: "rejected",
      updatedAt: serverTimestamp()
    });
    updates += 1;
  });

  if (updates > 0) {
    await batch.commit();
  }
}

async function rejectAllPendingRequestsForTicket(ticketId) {
  const pendingQuery = query(
    collection(db, "requests"),
    where("ticketId", "==", ticketId),
    where("status", "==", "pending")
  );

  const snapshot = await getDocs(pendingQuery);
  const batch = writeBatch(db);
  let updates = 0;

  snapshot.forEach((docSnapshot) => {
    batch.update(doc(db, "requests", docSnapshot.id), {
      status: "rejected",
      updatedAt: serverTimestamp()
    });
    updates += 1;
  });

  if (updates > 0) {
    await batch.commit();
  }
}

async function syncTicketStatusWithPendingRequests(ticketId) {
  const pendingQuery = query(
    collection(db, "requests"),
    where("ticketId", "==", ticketId),
    where("status", "==", "pending")
  );

  const pendingSnapshot = await getDocs(pendingQuery);
  const ticketRef = doc(db, "tickets", ticketId);

  await updateDoc(ticketRef, {
    status: pendingSnapshot.empty ? "available" : "requested",
    updatedAt: serverTimestamp()
  });
}

async function acceptRequest(requestId, button) {
  button.disabled = true;
  const requestRef = doc(db, "requests", requestId);

  try {
    const acceptedTicketId = await runTransaction(db, async (transaction) => {
      const requestSnapshot = await transaction.get(requestRef);
      if (!requestSnapshot.exists()) {
        throw new Error("This request no longer exists.");
      }

      const requestData = requestSnapshot.data();
      if (requestData.ownerId !== currentUser.uid) {
        throw new Error("You are not authorized to accept this request.");
      }

      if (requestData.status !== "pending") {
        throw new Error("This request is no longer pending.");
      }

      const ticketRef = doc(db, "tickets", requestData.ticketId);
      const ticketSnapshot = await transaction.get(ticketRef);
      if (!ticketSnapshot.exists()) {
        throw new Error("Ticket no longer exists.");
      }

      const ticketData = ticketSnapshot.data();
      if (ticketData.ownerId !== currentUser.uid) {
        throw new Error("You are not the owner of this ticket.");
      }

      if (ticketData.status === "occupied") {
        throw new Error("This ticket is already occupied.");
      }

      transaction.update(ticketRef, {
        status: "occupied",
        occupiedBy: requestData.requesterId,
        occupiedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      transaction.update(requestRef, {
        status: "accepted",
        acceptedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      return requestData.ticketId;
    });

    await rejectOtherPendingRequests(acceptedTicketId, requestId);
  } catch (error) {
    alert(error.message || "Failed to accept request.");
  } finally {
    button.disabled = false;
  }
}

async function turnDownRequest(requestId, button) {
  button.disabled = true;
  const requestRef = doc(db, "requests", requestId);

  try {
    const ticketId = await runTransaction(db, async (transaction) => {
      const requestSnapshot = await transaction.get(requestRef);
      if (!requestSnapshot.exists()) {
        throw new Error("This request no longer exists.");
      }

      const requestData = requestSnapshot.data();
      if (requestData.ownerId !== currentUser.uid) {
        throw new Error("You are not authorized to update this request.");
      }

      if (requestData.status !== "pending") {
        throw new Error("This request is no longer pending.");
      }

      transaction.update(requestRef, {
        status: "rejected",
        updatedAt: serverTimestamp()
      });

      return requestData.ticketId;
    });

    await syncTicketStatusWithPendingRequests(ticketId);
  } catch (error) {
    alert(error.message || "Failed to turn down request.");
  } finally {
    button.disabled = false;
  }
}

async function deleteTicket(ticketId, button) {
  const confirmed = window.confirm("Delete this ticket? Pending requests for it will be turned down.");
  if (!confirmed) {
    return;
  }

  button.disabled = true;
  const ticketRef = doc(db, "tickets", ticketId);

  try {
    await runTransaction(db, async (transaction) => {
      const ticketSnapshot = await transaction.get(ticketRef);
      if (!ticketSnapshot.exists()) {
        throw new Error("This ticket no longer exists.");
      }

      const ticketData = ticketSnapshot.data();
      if (ticketData.ownerId !== currentUser.uid) {
        throw new Error("You can only delete tickets you created.");
      }

      transaction.delete(ticketRef);
    });

    await rejectAllPendingRequestsForTicket(ticketId);
    setFormMessage("Ticket deleted.", "success");
  } catch (error) {
    setFormMessage(error.message || "Unable to delete ticket.", "error");
  } finally {
    button.disabled = false;
  }
}

function activateTabs() {
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.getAttribute("data-tab");
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      tabPanels.forEach((panel) => panel.classList.remove("active"));
      button.classList.add("active");
      document.getElementById(target).classList.add("active");
    });
  });
}

function bindRealtimeListeners() {
  const myTicketsQuery = query(collection(db, "tickets"), where("ownerId", "==", currentUser.uid));
  onSnapshot(myTicketsQuery, (snapshot) => {
    const items = snapshot.docs
      .map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }))
      .sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      });

    renderMyTickets(items);
  });

  const incomingQuery = query(
    collection(db, "requests"),
    where("ownerId", "==", currentUser.uid)
  );

  onSnapshot(incomingQuery, (snapshot) => {
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

    renderIncoming(items);
  });

  const receivedQuery = query(
    collection(db, "requests"),
    where("requesterId", "==", currentUser.uid)
  );

  onSnapshot(receivedQuery, (snapshot) => {
    const items = snapshot.docs
      .map((docSnapshot) => ({
        id: docSnapshot.id,
        ...docSnapshot.data()
      }))
      .filter((item) => item.status === "accepted")
      .sort((a, b) => {
        const aTime = a.updatedAt?.seconds || 0;
        const bTime = b.updatedAt?.seconds || 0;
        return bTime - aTime;
      });

    renderReceived(items);
  });
}

ticketForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const showDetails = showDetailsSelect.value;

  if (!showDetails) {
    setFormMessage("Please select a show.", "error");
    return;
  }

  setFormMessage("Publishing ticket...");

  try {
    await addDoc(collection(db, "tickets"), {
      ownerId: currentUser.uid,
      ownerEmail: currentUser.email || "",
      ownerName: currentNickname || currentUser.email || "User",
      showDetails,
      status: "available",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    ticketForm.reset();
    setFormMessage("Ticket listed successfully.", "success");
  } catch (error) {
    setFormMessage(error.message || "Could not publish ticket.", "error");
  }
});

(async function init() {
  currentUser = await requireAuth();
  const profile = await getUserProfile(currentUser.uid);
  currentNickname = getDisplayName(profile);
  nicknameInput.value = currentNickname;
  welcomeTitle.textContent = `Hello, ${currentNickname}`;

  activateTabs();
  bindLogout();
  bindRealtimeListeners();

  // Normalize stale requested tickets without pending requests.
  const staleRequestedQuery = query(
    collection(db, "tickets"),
    where("ownerId", "==", currentUser.uid),
    where("status", "==", "requested")
  );

  onSnapshot(staleRequestedQuery, async (snapshot) => {
    for (const docSnapshot of snapshot.docs) {
      const pendingQuery = query(
        collection(db, "requests"),
        where("ticketId", "==", docSnapshot.id),
        where("status", "==", "pending")
      );

      const pendingSnapshot = await getDocs(pendingQuery);
      if (pendingSnapshot.empty) {
        await updateDoc(doc(db, "tickets", docSnapshot.id), {
          status: "available",
          updatedAt: serverTimestamp()
        });
      }
    }
  });
})();
