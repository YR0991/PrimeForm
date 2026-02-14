# Strava OAuth connect flow — hardened

Exact steps and security rationale for linking a Strava account to a PrimeForm user.

---

## Flow (step-by-step)

1. **User clicks “Connect Strava”** in the app (e.g. Settings).
2. **Frontend** obtains a Firebase ID token (`currentUser.getIdToken()`) and calls:
   - `GET /auth/strava/connect` with header `Authorization: Bearer <idToken>`.
   - No query params (no `userId`). User identity comes only from the token.
3. **Backend (/auth/strava/connect)**  
   - Runs `verifyIdToken` + `requireUser()`. No token or invalid token → **401**.  
   - Generates a **cryptographically strong state**: `crypto.randomBytes(32).toString('hex')`.  
   - Stores `state → { uid: req.user.uid, createdAt }` server-side (in-memory, 10 min TTL).  
   - Redirects **302** to Strava’s authorize URL with `state=<that value>` (and client_id, redirect_uri, scope, etc.).
4. **User** authorizes on Strava; Strava redirects to:
   - `GET /auth/strava/callback?code=...&state=<same state>` (or `error=access_denied`).
5. **Backend (/auth/strava/callback)**  
   - Reads only `code` and `state` from the query. **Does not use any uid/userId from query or body.**  
   - **Validates state:** looks up state in the store.  
     - Missing/empty state → redirect to settings with `message=state_missing`.  
     - Unknown or already-used state → `state_invalid` (covers reuse).  
     - State older than 10 minutes → `state_expired`.  
   - On valid state: **consumes** it (one-time use: removed from store), gets **uid** from the stored mapping.  
   - Exchanges `code` for tokens with Strava, writes tokens to `users/{uid}` (and athleteId etc.).  
   - Redirects to frontend (e.g. `/intake?status=strava_connected`).

---

## Security rationale

| Risk | Mitigation |
|------|------------|
| **Token / user mismatch** | uid is bound at **connect** (from verified token) and stored with state. Callback **never** trusts query/body; uid comes only from **validated state** lookup. |
| **CSRF / wrong user** | State is **random**, **bound to uid** when the flow starts, and **one-time use**. Attacker cannot forge a valid state for another user. |
| **Replay** | State is **deleted** on first consumption; reuse returns `invalid`. |
| **Stale flow** | **10-minute expiry** on state; expired state returns `expired`. |
| **Starting flow without being logged in** | `/auth/strava/connect` requires **requireUser()**; no token → 401. |

---

## Frontend requirement

- **Connect** must be triggered with the ID token in the header (e.g. `fetch('/auth/strava/connect', { headers: { Authorization: 'Bearer ' + idToken }, redirect: 'manual' })` then `window.location = response.headers.get('Location')`), **not** by opening `/auth/strava/connect?userId=...` in the browser (that would 401 and no longer passes a user identifier to Strava).

---

## Backend touchpoints

- **State store:** `services/stravaOAuthState.js` — `createState(uid)`, `consumeState(state)` (expiry, one-time use).  
- **Connect:** `routes/stravaRoutes.js` — GET `/auth/strava/connect` (auth required, create state, redirect to Strava).  
- **Callback:** GET `/auth/strava/callback` — resolve uid only from `consumeState(state)`; never from query/body.
