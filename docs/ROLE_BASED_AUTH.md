# Role-based authorization (custom claims + break-glass)

## Overview

- **requireRole(role)** middleware checks Firebase custom claims on `req.user.claims[role] === true`. Use after `verifyIdToken(admin)` and `requireUser()`.
- **Break-glass:** If `BREAKGLASS_ENABLED === "true"` and `req.user.email === BREAKGLASS_ADMIN_EMAIL`, access is allowed and `BREAKGLASS_USED` is logged. Intended for admin-only escape hatch so the owner is not locked out before claims are set.

## Middleware (implemented, not applied to routes yet)

- **middleware/auth.js:** `requireRole(role)` — 403 unless `req.user.claims[role] === true` or break-glass allows.
- **Env:** `BREAKGLASS_ENABLED` (string `"true"` to enable), `BREAKGLASS_ADMIN_EMAIL` (email for break-glass; compared case-insensitive).

## Example (how to apply later)

```javascript
const { verifyIdToken, requireUser, requireRole } = require('./middleware/auth');
const auth = [verifyIdToken(admin), requireUser()];
const adminAuth = [verifyIdToken(admin), requireUser(), requireRole('admin')];

// Example: protect a future admin-only route
router.get('/api/admin/foo', adminAuth, (req, res) => { ... });
```

## Setting claims (owner migration)

Use **tools/setClaims.js** to set custom claims by email so the owner gets `admin: true` before switching routes to requireRole:

```bash
node tools/setClaims.js owner@example.com admin true
```

This looks up the user by email and calls `setCustomUserClaims(uid, { admin: true })`. User must sign in again (or refresh ID token) for new claims to appear in `req.user.claims`.

## Debugging

- **GET /api/whoami** (requires valid token) returns `{ uid, email, claims }` so you can confirm claims after setting them.
