# Auth migration checklist — Firebase ID token + req.user

## Touched files

| File | Change |
|------|--------|
| `PrimeForm-backed/middleware/auth.js` | `verifyIdToken(admin)`, `requireUser()`, **requireRole(role)** with break-glass (BREAKGLASS_ENABLED + BREAKGLASS_ADMIN_EMAIL). |
| `PrimeForm-backed/server.js` | **GET /api/whoami** (userAuth) uid, email, claims; auth on profile, activities, history; listen skipped when `NODE_ENV=test`. |
| `PrimeForm-backed/tools/setClaims.js` | **New.** CLI: email + role + boolean; lookup uid by email, setCustomUserClaims. |
| `docs/ROLE_BASED_AUTH.md` | **New.** requireRole, break-glass, example usage, setClaims, whoami. |
| `docs/AUTH_MIGRATION_CHECKLIST.md` | Role migration steps (break-glass first, set owner claim, verify whoami, apply requireRole, remove break-glass). |
| `PrimeForm-backed/routes/dashboardRoutes.js` | Auth applied to GET /dashboard, GET /daily-brief; uid from `req.user.uid`. |
| `PrimeForm-backed/routes/dailyRoutes.js` | Auth applied to POST /save-checkin, POST /update-user-stats; uid from `req.user.uid`. |
| `PrimeForm-backed/routes/stravaRoutes.js` | Auth applied to PUT /disconnect, GET /sync/:uid, POST /sync-now, GET /activities/:uid; uid from `req.user.uid`; 403 when `params.uid !== req.user.uid`. |
| `PrimeForm-backed/tests/auth.middleware.test.js` | **New.** Smoke tests for requireUser and verifyIdToken. |
| `PrimeForm-backed/tests/routes.auth.smoke.test.js` | 401 without auth for profile/activities/history; body.userId ignored (stub app). |
| `PrimeForm-backed/tests/routes.auth.coverage.test.js` | **New.** 401 without Authorization for GET/PUT profile, GET history, POST activities, DELETE activities/:id; with mocked token asserts 200/503 and response uses req.user.uid (profile userId, activity userId). |
| `PrimeForm-backed/routes/activityRoutes.js` | DELETE /api/activities/:id: token required (verifyIdToken + requireUser); uid from req.user.uid only; query.userId removed. |
| `PrimeForm-backed/routes/adminRoutes.js` | **Admin routes:** Legacy checkAdminAuth / x-admin-email / ADMIN_EMAIL removed. Router protected with `router.use(verifyIdToken(admin), requireUser(), requireRole('admin'))`. Access only via token + claim or break-glass. |
| `PrimeForm-backed/tests/admin.role.test.js` | **New.** Admin role: 401 without token; token claims.admin=true → 200/503; claims missing/false → 403; break-glass matching email → allowed; break-glass wrong email → 403. |
| `PrimeForm-backed/package.json` | Added `test` script; devDependency `supertest`. |

## Token-required endpoints (full list)

User-data routes (uid from **req.user.uid only**; X-User-Uid, query.uid, params.uid, body.userId ignored or rejected):

- **GET /api/profile** — token required; uid from token (query.userId ignored).
- **PUT /api/profile** — token required; uid from token (body.userId ignored).
- **GET /api/history** — token required; uid from token (query.userId ignored).
- **POST /api/activities** — token required; manual session; uid from token (body.userId ignored).
- **DELETE /api/activities/:id** — token required; user may only delete own manual activities (data.userId === req.user.uid); query.userId ignored.

Other token-required:

- **GET /api/whoami** — debugging: returns uid, email, claims.
- GET /api/dashboard, GET /api/daily-brief, POST /api/save-checkin, POST /api/update-user-stats.
- PUT /api/strava/disconnect, GET /api/strava/sync/:uid, POST /api/strava/sync-now, GET /api/strava/activities/:uid (path :uid must equal token uid).

**Admin routes (/api/admin/*):** Now protected by **token + requireRole('admin')** only. No legacy x-admin-email or ADMIN_EMAIL. All admin routes use `router.use(verifyIdToken(admin), requireUser(), requireRole('admin'))`. Access is **only** via Firebase ID token with custom claim `admin: true`, or break-glass (see below). **GET /auth/strava/connect** requires ID token; state bound to req.user.uid. `/auth/strava/callback` is called by Strava (no token).

## Diff summary

- **Auth flow:** Protected routes require `Authorization: Bearer <firebaseIdToken>`. Middleware sets `req.user = { uid, email, claims }`. Missing or invalid token → 401.
- **User identifier:** Only `req.user.uid`. No use of X-User-Uid, query.uid, params.uid, or body.userId for these routes.
- **Backwards compatibility:** Sending query.userId or body.userId is not rejected; the value is ignored and token uid is used for Firestore paths.

## Frontend action required

- **All `/api/*` calls** that hit the endpoints above must send `Authorization: Bearer <idToken>` (e.g. from `firebase.auth().currentUser.getIdToken()`). Prefer a **shared HTTP client or request interceptor** that attaches the header for every authenticated request so no route is missed.

---

## Admin routes: claim-protected (custom claims + break-glass)

**Applied:** All `/api/admin/*` routes are protected with `verifyIdToken(admin)`, `requireUser()`, and `requireRole('admin')` at router level. Legacy checks (x-admin-email, ADMIN_EMAIL, checkAdminAuth) have been **removed**. Access is **only** via:
- Firebase ID token with custom claim **admin: true**, or
- **Break-glass** (temporary): when `BREAKGLASS_ENABLED=true` and `BREAKGLASS_ADMIN_EMAIL` equals the token holder's email, access is allowed without the claim (logs `BREAKGLASS_USED`).

### Exact steps (already done)

1. **Break-glass (temporary):** Set `BREAKGLASS_ENABLED=true` and `BREAKGLASS_ADMIN_EMAIL=<owner-email>` so the owner can access admin before claims are set.
2. **Set owner claim:** Run `node tools/setClaims.js <owner-email> admin true` (requires FIREBASE_SERVICE_ACCOUNT_JSON or firebase-key.json).
3. **Verify:** Call GET /api/whoami with Bearer token; response should include `claims: { admin: true }`.
4. **Shutdown break-glass:** Once all admins have the `admin` claim, set **`BREAKGLASS_ENABLED=false`** (or unset the env var) and remove or change **`BREAKGLASS_ADMIN_EMAIL`**. After this, admin access is **only** via token + claim; break-glass no longer allows access.
