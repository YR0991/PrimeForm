# Strava-implementatie – status

## Backend (PrimeForm-API / PrimeForm-backed)

**Volledig aanwezig.** Alle Strava-logica zit in de API.

| Onderdeel | Status | Details |
|-----------|--------|---------|
| **OAuth** | ✅ | `GET /api/strava/connect-url` (JSON met `url`), `GET /auth/strava/connect` (redirect), `GET /auth/strava/callback` (code → tokens, schrijft naar `users/{uid}.strava`) |
| **Token refresh** | ✅ | `stravaService.refreshAccessToken`, gebruikt bij sync |
| **Sync (atleet)** | ✅ | `POST /api/strava/sync-now` (eigen uid, rate limit 10 min), cold start 30d of incremental |
| **Sync (admin)** | ✅ | `POST /api/admin/users/:uid/strava/sync-now` (admin/coach), cold start 90d mogelijk |
| **Disconnect** | ✅ | `PUT /api/strava/disconnect` (eigen uid, zet `strava.connected: false`) |
| **Status (admin/coach)** | ✅ | `GET /api/admin/users/:uid/strava-status` (connected, lastSuccess, lastError, enz.) |
| **Activiteiten opslag** | ✅ | `users/{uid}/activities` + root `activities` (userId); Prime Load via reportService |
| **Webhook** | ✅ | `app.use('/webhooks/strava', ...)` voor real-time events |
| **401/403 afhandeling** | ✅ | Sync-now retourneert 409 + `STRAVA_REAUTH_REQUIRED`; `stravaSync.lastError`, `reauthRequired` |

Env: `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REDIRECT_URI` (callback moet naar backend, daarna redirect naar frontend).

---

## Frontend: primeform-frontend (deze app)

**Alleen admin/coach-zicht; geen atleet OAuth-flow.**

| Onderdeel | Status | Waar |
|-----------|--------|------|
| **Admin: Strava-status atleet** | ✅ | `StravaStatusPanel.vue` in AtleetDetailDialog (Status-tab): verbonden ja/nee, laatste sync, fout, knop “Force sync” |
| **Admin: Force sync** | ✅ | `adminService.syncUserStravaNow(uid)` → POST …/strava/sync-now |
| **Intake** | ⚠️ Alleen link | IntakeStepper: veld “Strava-link (optioneel)” → wordt als `stravaLink` in profiel opgeslagen. **Geen OAuth-koppeling.** |
| **Atleet: Koppel Strava** | ❌ | Geen “Koppel Strava”-knop, geen `stravaConnect.js`, geen redirect naar `/api/strava/connect-url` |
| **Atleet: Sync nu** | ❌ | Geen knop voor `POST /api/strava/sync-now` op het atleet-dashboard |
| **Atleet: Ontkoppel Strava** | ❌ | Geen aanroep van `PUT /api/strava/disconnect` |
| **Auth store** | ❌ | Geen `stravaConnected` of `disconnectStrava`; profiel-response bevat wel `strava` (backend) maar wordt niet in store gezet voor Strava-UI |

Conclusie: in **primeform-frontend** kan een atleet Strava **niet** koppelen/ontkoppelen/syncen; alleen admin/coach ziet status en kan force sync doen.

---

## Frontend: PrimeForm (andere codebase, submodule)

**Volledige atleet-UI.**

| Onderdeel | Status | Waar |
|-----------|--------|------|
| **Koppel Strava** | ✅ | `startStravaConnect()` in `stravaConnect.js` → GET /api/strava/connect-url → redirect; gebruikt o.a. op IndexPage en ProfilePage |
| **Ontkoppel** | ✅ | ProfilePage: “Disconnect Strava” → `authStore.disconnectStrava()` → PUT /api/strava/disconnect |
| **Status** | ✅ | `authStore.stravaConnected` uit profiel; IndexPage toont “Strava gekoppeld”, webhook/sync-tijd, fout, backoff |
| **Sync nu** | ✅ | IndexPage: knop “Sync nu” → POST /api/strava/sync-now |
| **Na callback** | ✅ | Redirect naar `FRONTEND_APP_URL/loading?status=strava_connected`; LoginPage/IndexPage afhandeling `strava_connected` |

---

## Wat ontbreekt in primeform-frontend (als je atleet-Strava wilt)

1. **Auth store**  
   - Uit `GET /api/profile` response `data.strava` gebruiken en een getter `stravaConnected` (bijv. `data.strava?.connected === true`) zetten.

2. **Strava connect flow**  
   - Service `stravaConnect.js` (of equivalent): `startStravaConnect()` die GET `/api/strava/connect-url` aanroept (met auth header) en naar `data.url` redirect.

3. **Plaats voor “Koppel Strava”**  
   - Bijv. op atleet-dashboard (UserDashboard) of een instellingen-/profielpagina: knop die `startStravaConnect()` aanroept.

4. **Callback-afhandeling**  
   - Backend redirect na OAuth naar een URL die de frontend bedient (bijv. `/loading?status=strava_connected` of `/dashboard?status=strava_connected`). Die route moet even profiel opnieuw laden en eventueel een toast tonen.

5. **Ontkoppel + Sync nu**  
   - Ontkoppel: aanroep `PUT /api/strava/disconnect` (na bevestiging).  
   - Sync nu: aanroep `POST /api/strava/sync-now` (eigen uid via token), plus rate limit/feedback in UI.

6. **Environment**  
   - `STRAVA_REDIRECT_URI` op de backend moet wijzen naar het backend-callback-endpoint (bijv. `https://api.jouwdomein.nl/auth/strava/callback`), niet naar de frontend.

---

## Samenvatting

| Laag | Atleet (koppel / sync / ontkoppel) | Admin/coach (status / force sync) |
|------|------------------------------------|-----------------------------------|
| **Backend** | ✅ Klaar | ✅ Klaar |
| **primeform-frontend** | ❌ Geen UI/logic | ✅ StravaStatusPanel + sync in AtleetDetailDialog |
| **PrimeForm (andere app)** | ✅ Volledig | ✅ (o.a. CoachDeepDive, live-load) |

---

## Recente Strava-code: wat wordt wél / niet gebruikt

Overzicht van Strava-gerelateerde code in **primeform-frontend** en of die nu ergens wordt gebruikt.

### Wél in gebruik

| Wat | Waar | Gebruik |
|-----|------|--------|
| **StravaStatusPanel.vue** | AtleetDetailDialog (Status-tab) | Toont voor een atleet: gekoppeld ja/nee, laatste sync, fout; admin kan "Force sync" doen. |
| **adminService.getStravaStatus(uid)** | StravaStatusPanel | Haalt `GET /api/admin/users/:uid/strava-status` op. |
| **adminService.syncUserStravaNow(uid)** | StravaStatusPanel | Roept `POST .../strava/sync-now` aan bij klik op Force sync. |
| **CoachDashboard: "ACTIVITEITEN (Strava vs Prime)"** | Deep-dive modal | Toont activiteiten met badge Strava vs PrimeForm. Data komt uit **getAthleteDeepDive** (userService). |
| **IntakeStepper: stravaLink** | Stap 3 (training) | Veld "Strava-link (optioneel)" wordt in profiel opgeslagen. Geen OAuth, alleen een link. |

### Niet in gebruik (dode of vervangen code)

| Wat | Reden |
|-----|--------|
| **userService.getSystemHealth()** | Nergens geïmporteerd of aangeroepen. Bevat mock o.a. `stravaApiCallsToday`, `stravaRateLimit`, `errorLogs`. Was bedoeld voor oude Admin "System Health". |
| **userService.getWeeklyReportForUser(uid)** | Nergens geïmporteerd of aangeroepen. Bevat mock o.a. `stravaVsPrime`. Was bedoeld voor oude Admin "Algorithm Verification Lab". Die lab-sectie zit niet meer in de huidige AdminPage (Mission Control). |
| **Coach deep-dive activiteiten** | De *UI* (Strava vs Prime badges) staat er, maar **getAthleteDeepDive** in userService is nog **volledig mock** (geen echte API). Coach-squad komt wél van de API (coachService.getCoachSquad); alleen de deep-dive van één atleet is nog mock. |

### Kort per bestand

- **StravaStatusPanel.vue** – In gebruik (alleen in Atleet Dossier, admin/coach).
- **adminService.js** (getStravaStatus, syncUserStravaNow) – In gebruik door StravaStatusPanel.
- **userService.js** – getAthleteDashboard (atleet) en getAthleteDeepDive (coach) zijn mock; getSystemHealth en getWeeklyReportForUser worden nergens gebruikt.
- **CoachDashboard.vue** – Squad van API; deep-dive activiteiten van mock userService.
- **IntakeStepper.vue** – stravaLink wordt gebruikt en opgeslagen (als profielveld, geen OAuth).

---

Als je in **primeform-frontend** dezelfde atleet-Strava-ervaring wilt als in PrimeForm, moeten de punten onder “Wat ontbreekt in primeform-frontend” worden ingevuld.
