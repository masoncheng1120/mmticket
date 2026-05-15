# Ticket Transfer System (Firebase + Vanilla JS)

A production-ready three-page ticket transfer web app using:
- HTML5, CSS3, vanilla JavaScript
- Firebase Authentication (email/password)
- Cloud Firestore (users, tickets, requests)

## Files Included

- `index.html` - login and registration page
- `dashboard.html` - personal dashboard (list ticket + my transactions)
- `transfer.html` - marketplace page (available tickets)
- `css/styles.css` - shared modern styling
- `js/firebase-config.js` - Firebase initialization (fill placeholders)
- `js/auth-guard.js` - route protection, logout, profile upsert
- `js/index.js` - auth page logic
- `js/dashboard.js` - dashboard logic with real-time Firestore listeners
- `js/transfer.js` - marketplace logic with real-time Firestore listeners
- `firestore.rules` - recommended security rules

## Firestore Collections

### users
Document ID: `uid`

Suggested fields:
- `uid`
- `email`
- `createdAt`
- `updatedAt`

### tickets
Auto document ID.

Fields:
- `ownerId` (string)
- `ownerEmail` (string)
- `showDetails` (string)
- `status` (string: `available`, `requested`, `occupied`)
- `occupiedBy` (string, optional)
- `occupiedAt` (timestamp, optional)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

### requests
Auto document ID.

Fields:
- `ticketId` (string)
- `requesterId` (string)
- `requesterEmail` (string)
- `ownerId` (string)
- `ownerEmail` (string)
- `showDetails` (string)
- `status` (string: `pending`, `accepted`, `rejected`)
- `acceptedAt` (timestamp, optional)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

## Setup Steps

1. Create a Firebase project in Firebase Console.
2. Enable Authentication -> Sign-in method -> Email/Password.
3. Create Firestore Database in production mode.
4. In `js/firebase-config.js`, replace placeholders with your Firebase config.
5. In Firestore Rules, paste the rules from `firestore.rules` and publish.
6. Deploy static files to Firebase Hosting, Netlify, Vercel, or serve locally.

## Required Firestore Composite Indexes

When the app runs first time, Firestore may prompt index creation links in the browser console.
Create indexes for these query patterns:
- `requests`: `ownerId` + `status`
- `requests`: `requesterId` + `status`
- `requests`: `ticketId` + `status`
- `tickets`: `ownerId` + `status`

## Behavior Notes

- Unauthenticated users are redirected to `index.html`.
- Authenticated users on `index.html` are redirected to `dashboard.html`.
- Marketplace only shows `available` tickets not owned by current user.
- Requesting a ticket creates a `requests` doc and marks ticket as `requested`.
- Accepting request marks ticket `occupied`, marks selected request `accepted`, and rejects remaining pending requests for the same ticket.
- Real-time snapshots keep dashboard and marketplace synchronized.

## Hardening Recommendations

- Add Firebase App Check before production launch.
- Add email verification flow in auth.
- Add Cloud Functions for server-side transactional enforcement and audit logs.
- Add request throttling and abuse prevention with callable functions.
