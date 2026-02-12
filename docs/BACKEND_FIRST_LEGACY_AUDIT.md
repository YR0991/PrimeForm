# PrimeForm — Backend-First Legacy Audit

Audit of **Legacy Islands** in `src/` that bypass the Backend API or perform logic that should live on the Node.js backend. Goal: roadmap to remove the Firebase SDK from the frontend.

---

## 1. Direct Firestore Writes

| File | Legacy Pattern | Recommendation |
|------|----------------|----------------|
| **src/stores/auth.js** | `setDoc` — bootstrap new user doc when no Firestore doc exists (init flow). | Backend: expose e.g. `POST /api/user/bootstrap` or have login callback create user server-side; frontend only calls API after sign-in. |
| **src/stores/auth.js** | `setDoc` — create/overwrite user profile in `_applyCoachAssignmentIfNeeded` and related flows (lines ~193, ~238, ~281). | Backend: `PUT /api/profile` or dedicated coach-assignment endpoint; frontend only sends payload. |
| **src/stores/auth.js** | `updateDoc` — persist coach assignment patch (line ~148). | Replace with `PATCH /api/user/:uid` or `PUT /api/profile` including `teamId`/role. |
| **src/stores/auth.js** | `updateDoc` — save onboarding data, role, teamId (lines ~475, ~549). | Use existing `PUT /api/profile`; extend backend to accept `teamId`, `role`, onboarding fields. |
| **src/stores/auth.js** | `updateDoc` — `completeOnboarding` sets `onboardingComplete: true` (line ~578). | Remove; use `PUT /api/profile` with `onboardingCompleted: true` (already supported). |
| **src/stores/auth.js** | `updateDoc` — `updatePilotProfile` writes `profile` (lastPeriodDate, cycleLength) (line ~607). | Replace with `PUT /api/profile` and `profilePatch` containing cycle fields. |
| **src/stores/auth.js** | `updateDoc` — disconnect Strava `{ strava: { connected: false } }` (line ~634). | Backend: `POST /api/strava/disconnect` or `PUT /api/profile` with strava flag. |
| **src/stores/auth.js** | `updateDoc` — generic profile/settings updates (line ~695). | Route all through `PUT /api/profile` or a dedicated settings endpoint. |
| **src/stores/admin.js** | `updateDoc` — assign user to team: `updateDoc(userRef, { teamId })` (line ~68). | Backend: `PATCH /api/admin/users/:userId` or `PUT /api/admin/assign-team` with `userId`, `teamId`. |
| **src/stores/dashboard.js** | `addDoc` — manual workout written to `activities` subcollection (line ~192). | Backend: `POST /api/activities` or `POST /api/dashboard/activity`; backend writes to Firestore and returns id. |
| **src/stores/teams.js** | `addDoc` — create team in `teams` collection (line ~53). | Backend: `POST /api/teams` (or under admin); return new team id. |

---

## 2. Direct Firestore Reads

| File | Legacy Pattern | Recommendation |
|------|----------------|----------------|
| **src/stores/auth.js** | `getDoc(userRef)` — `fetchUserProfile(uid)` reads `users/{uid}` (line ~310). | Backend: use `GET /api/profile?userId=...`; auth store calls API and maps response to state (role, teamId, onboardingComplete, profile). |
| **src/stores/auth.js** | `getDoc` — used in `_applyCoachAssignmentIfNeeded`, profile checks (lines ~168, ~213). | Same as above; all profile/role/team/onboarding data from API. |
| **src/stores/auth.js** | `getDocs(qTeams)` — `_detectCoachTeamIdForEmail` queries `teams` where `coachEmail == email` (lines ~117–118). | Backend: `GET /api/teams/by-coach?email=...` or include `teamId` in `GET /api/profile` when user is coach. |
| **src/stores/auth.js** | `getDocs(q)` — join by invite code: `teams` where `inviteCode == raw` (lines ~430–432). | Backend: `POST /api/teams/join` with `inviteCode` (and auth); return team id. |
| **src/stores/admin.js** | `getDocs(usersRef)`, `getDocs(teamsRef)` — fetch all users and all teams (lines ~39–42). | Backend: `GET /api/admin/users`, `GET /api/admin/teams`; admin store uses API only. |
| **src/stores/teams.js** | `getDocs(colRef)` — fetch all teams (line ~23). | Backend: `GET /api/teams`; teams store uses API. |

---

## 3. Logic Leaks (sports-science / business logic on frontend)

| File | Legacy Pattern | Recommendation |
|------|----------------|----------------|
| **src/stores/dashboard.js** | Manual workout: `primeLoad = durationMinutes * rpeValue` (line ~177). | Move to backend: `POST /api/activities` accepts duration + RPE; server computes prime load (and applies luteal tax if needed). |
| **src/stores/dashboard.js** | `loadStatus` getter: maps `acwr` to DANGER / OVERREACHING / OPTIMAL (lines ~31–35). | Acceptable as **display** mapping if `acwr` comes from API. Prefer backend to return a `loadStatus` or `directive` so frontend only displays. |
| **src/stores/dashboard.js** | `submitDailyCheckIn` builds `lastPeriodDate`, `cycleLength` from auth store profile (lines ~252–264). | Backend already receives these; ensure backend is source of truth for cycle and does not depend on frontend to send “correct” values; frontend can send from profile for UX. |
| **src/components/RHRTile.vue** | `baselineDelta = rhrCurrent - rhrBaseline28d` (lines ~26–31). | Display-only; baselines and current come from API. No change if backend sends `rhr_baseline_28d` and current RHR. |
| **src/pages/IndexPage.vue** | Uses `telemetry.raw?.rhr_baseline_28d`, `primeLoad` from API/dashboard data. | No local calculation; ensure all such fields are returned by backend. |

---

## 4. Thin API / Waterfall Patterns

| File | Legacy Pattern | Recommendation |
|------|----------------|----------------|
| **src/stores/squadron.js** | `fetchSquadron()` returns list; clicking a row calls `fetchAthleteDeepDive(id)` (second request). | Already Backend-First: list from `GET /api/coach/squadron`, detail from `GET /api/coach/athletes/:id`. No change; avoid adding per-row fetches for data already in the list. |
| **src/stores/admin.js** | `fetchAllData()` loads all users and teams in one go (no per-user fetch). | After moving to API, keep a single `GET /api/admin/users` and `GET /api/admin/teams` (or one combined endpoint); do not add N+1 detail calls. |

---

## 5. Auth and Onboarding Inconsistencies

| File | Legacy Pattern | Recommendation |
|------|----------------|----------------|
| **src/router/index.js** | On authenticated routes, profile/onboarding come from `authStore.fetchUserProfile(uid)`, which uses **Firestore `getDoc`** (see §2). | Use **Backend API**: `GET /api/profile?userId=...`. Auth store should have e.g. `fetchUserProfileFromApi(uid)` that calls the API and maps response to `onboardingComplete`, `role`, `teamId`, `profile`. Router keeps calling “fetch profile” before deciding intake vs dashboard; source becomes API. |
| **src/router/index.js** | Unauthenticated `/intake` branch uses `GET /api/profile?userId=...` (lines ~151–166). | Keep; this is already API-based. Align authenticated branch with same API. |
| **src/App.vue** | Only uses `authStore.isAuthReady` (no direct Firestore). | No change. |

---

## 6. Summary Table (by store/file)

| Location | Firestore writes | Firestore reads | Logic leak | Recommendation |
|----------|------------------|-----------------|------------|----------------|
| **auth.js** | setDoc (bootstrap, profile), updateDoc (coach, onboarding, Strava, profile) | getDoc (profile), getDocs (teams by coach, by inviteCode) | — | All profile/role/team/onboarding via API; add/use endpoints for bootstrap, coach assign, Strava disconnect, profile update. |
| **admin.js** | updateDoc (teamId) | getDocs (users, teams) | — | `GET /api/admin/users`, `GET /api/admin/teams`, `PATCH /api/admin/users/:id` (or assign-team). |
| **dashboard.js** | addDoc (manual activity) | — | primeLoad = duration × RPE | `POST /api/activities` (or dashboard/activity); server computes prime load. |
| **teams.js** | addDoc (create team) | getDocs (teams) | — | `GET /api/teams`, `POST /api/teams` (or admin). |
| **router/index.js** | — | Via auth.fetchUserProfile (getDoc) | — | Auth store to use `GET /api/profile` for profile/onboarding so router is fully API-driven. |

---

## 7. Recommended Migration Order

1. **Backend endpoints (no frontend change yet)**  
   Add or confirm: `GET /api/profile`, `PUT /api/profile`, `GET /api/teams`, `POST /api/teams`, `GET /api/admin/users`, `GET /api/admin/teams`, `PATCH /api/admin/users/:id` (or assign-team), `POST /api/activities`, Strava disconnect, user bootstrap (or handle in login flow).

2. **Auth store**  
   Replace all `getDoc`/`getDocs` in auth with API calls; replace all `setDoc`/`updateDoc` with API calls. Implement `fetchUserProfileFromApi` and use it in router and after login.

3. **Router**  
   Switch to API-based profile/onboarding (auth store already using API).

4. **Admin store**  
   Replace `getDocs` and `updateDoc` with admin API.

5. **Teams store**  
   Replace `getDocs` and `addDoc` with teams API.

6. **Dashboard store**  
   Replace `addDoc` (manual activity) with `POST /api/activities`; keep check-in and dashboard fetch as-is (already API).

7. **Remove Firebase from frontend**  
   Once no store or component uses Firestore, remove `firebase/firestore` (and optionally keep only Firebase Auth if you still use it for sign-in, or move to backend-only auth).

---

*Document generated from architectural audit of `src/` and backend usage. Update as endpoints and stores are migrated.*
