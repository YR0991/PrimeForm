# Code Audit — Module B (Data-integriteit) & Module C (Codekwaliteit)

**Scope:** server.js, services/stravaService.js, services/userService.js (zie opmerking)  
**Datum:** 2026-02-06

---

## Opmerking: userService.js

**services/userService.js bestaat niet** in de codebase. Profiel- en cycle-updates zitten in **server.js** (o.a. `PUT /api/profile`, `PUT /api/admin/profile-patch`, en de Menstruatie Reset in de daily-advice flow). Onderstaande “Cycle Sync” is daarop gebaseerd.

---

# DEEL 1: DATA INTEGRITEIT (Module B)

## 1. Strava-duplicaten (opslag activiteiten)

**Gevraagd:** Gebruiken we `db.collection(...).doc(activity.id).set(...)`? Risico: `.add()` → duplicaten; `.set()` zonder merge → overschrijven van handmatige edits.

**Bevindingen:**

- **stravaService.js** is de enige plek waar activiteiten worden weggeschreven:
  - `getRecentActivities`: `activitiesRef.doc(id).set(mapped, { merge: true })` (regel 208)
  - `syncRecentActivities`: `activitiesRef.doc(id).set(mapped, { merge: true })` (regel 255)
- **server.js** schrijft nergens naar `users/{uid}/activities`; de Strava-routes roepen alleen `stravaService.getRecentActivities` resp. `stravaService.syncRecentActivities` aan. Er is **geen** aparte Strava-webhook-handler die activiteiten schrijft (geen `webhook`/`event`-route gevonden).

**Conclusie:** Veilig. We gebruiken overal `doc(activity.id).set(..., { merge: true })`: geen duplicaten (vaste doc-id), en merge behoudt bestaande velden bij handmatige edits.

**Actie:** Geen fix nodig.

---

## 2. Cycle-sync consistentie (lastPeriod / lastPeriodDate)

**Gevraagd:** Bij `periodStarted` worden zowel `profile.cycleData.lastPeriod` (legacy) als `profile.cycleData.lastPeriodDate` (nieuw) geüpdatet?

**Bevindingen:**

- **server.js — daily-advice (Menstruatie Reset), ca. regels 1100–1118:**  
  Bij `periodStarted` wordt `userDocRef.set(..., { merge: true })` aangeroepen met:
  - `profile.cycleData.lastPeriod: effectiveLastPeriodDate`
  - `profile.cycleData.lastPeriodDate: effectiveLastPeriodDate`
  - `profile.cycleData.avgDuration: cycleLengthNum`  
  Beide velden worden dus gezet.
- **server.js — PUT /api/profile (regels 376–391):**  
  Merge van `profilePatch.cycleData` met bestaande `cycleData`; er wordt geen expliciete “Menstruatie Reset”-logica uitgevoerd. Als de frontend `lastPeriod` en `lastPeriodDate` allebei meestuurt, blijven ze consistent.
- **server.js — PUT /api/admin/profile-patch (regels 1597–1603):**  
  Idem: merge van `profilePatch.cycleData` met bestaande; geen aparte reset.

**Conclusie:** In de daily-advice flow (de enige plek waar “Menstruatie begonnen” direct een profile-update triggert) worden **zowel** `lastPeriod` **als** `lastPeriodDate` geüpdatet. Consistent.

**Actie:** Geen fix nodig.

---

## 3. Error handling Strava

**Gevraagd:** Webhook-handler: try/catch? Als Strava API faalt tijdens sync: crasht de server of alleen error loggen?

**Bevindingen:**

- Er is **geen** Strava webhook-endpoint in server.js. Sync gebeurt via:
  - `GET /api/strava/sync/:uid` → `stravaService.getRecentActivities(...)`
  - `POST /api/admin/strava/sync/:uid` → `stravaService.syncRecentActivities(...)`
- Beide routes zitten in een **try/catch**:
  - Bij fout: `console.error(...)`, dan `res.status(500).json({ success: false, error: err.message })`.
  - De server **crasht niet**; de fout wordt gelogd en als HTTP 500 aan de client teruggegeven.
- In **stravaService.js** gooien `getRecentActivities` en `syncRecentActivities` bij Strava API-fouten een **Error** (o.a. `if (!res.ok) throw new Error(...)`). Die wordt niet lokaal opgevangen en komt dus in de route-catch terecht.

**Conclusie:** Geen webhook; sync-routes hebben try/catch. Bij Strava API-fout: server blijft draaien, error wordt gelogd en 500 teruggegeven.

**Actie:** Geen fix nodig. Optioneel: in stravaService foutmeldingen verrijken (bijv. statuscode meeloggen) voor betere debugging.

---

# DEEL 2: CODE KWALITEIT (Module C)

## 4. server.js “obesitas”

**Gevraagd:** Aantal regels; logica die in een controller thuishoort; welke blokken naar routes/ of controllers/ kunnen.

**Bevindingen:**

- **Regels:** server.js telt **1851 regels**.
- De volgende logica zit nu in server.js en is geschikt om te verplaatsen:
  1. **Daily-advice / check-in (groot blok)**  
     - Vanaf ca. regel 798: `POST /api/daily-advice` (validatie, cycleInfo, redFlags, determineRecommendation, Lethargy/Elite/Sick overrides, AI-bericht, Firestore dailyLogs + cycle reset).  
     - Ca. regel 1140: `POST /api/save-checkin` (vergelijkbare validatie + redFlags + recommendation, schrijven naar `daily_logs`).  
     **Advies:** Beide naar bijv. **controllers/dailyAdviceController.js** (of **controllers/checkinController.js**), met in server.js alleen route-registratie en aanroep van controllerfuncties.
  2. **Luteal/red flags/recommendation (pure logica)**  
     - `calculateLutealPhase`, `calculateRedFlags`, `determineRecommendation` (ca. 456–739).  
     **Advies:** Verplaatsen naar **services/cycleService.js** (of **services/adviceLogicService.js**) en in server/controller require’en.
  3. **Admin-routes (meerdere blokken)**  
     - o.a. `GET /api/admin/users`, `DELETE /api/admin/users/:uid`, `GET /api/admin/stats`, `GET /api/admin/alerts`, `PUT /api/admin/profile-patch`, `PUT /api/admin/check-in`, `GET /api/admin/reports/weekly/:uid`, `POST /api/admin/import-history`, `POST /api/admin/strava/sync/:uid`.  
     **Advies:** Groeperen in **routes/adminRoutes.js** (of **controllers/adminController.js**) en in server.js mounten als `app.use('/api/admin', adminRoutes)`.
  4. **Strava-routes**  
     - `GET /auth/strava/connect`, `GET /auth/strava/callback`, `PUT /api/strava/disconnect`, `GET /api/strava/sync/:uid`, `GET /api/strava/activities/:uid` (en eventueel admin Strava sync).  
     **Advies:** Naar **routes/stravaRoutes.js** (of **controllers/stravaController.js**); stravaService blijft de laag voor token/API/sync.
  5. **Overige routes**  
     - Health, profile (GET/PUT), check-luteal-phase, history, enz. kunnen naar **routes/index.js** of per domein (profileRoutes, historyRoutes, …).

**Conclusie:** server.js is te groot en mengt routing, validatie, businesslogica en Firestore. Bovenstaande splitsing vermindert regels in server.js en maakt onderhoud eenvoudiger.

**Actie:** Geen verplichte fix; aanbevolen refactor in kleine stappen (eerst één controller/routes-module, dan uitbreiden).

---

## 5. Dead code / readiness / Load-functies

**Gevraagd:** Oude “readiness”-berekening (0–100 of sliders) die door 1–10 is vervangen? Worden calculateActivityLoad en calculatePrimeLoad uitsluitend uit calculationService gehaald? Oude versies nog uitgecommentarieerd?

**Bevindingen:**

- **Readiness:** Overal wordt readiness als **1–10** gebruikt:
  - Validatie: `numericFields.readiness < 1 || numericFields.readiness > 10` (daily-advice en save-checkin).
  - `determineRecommendation(readiness, ...)` gebruikt drempels 3, 4–6, 8.
  - Lethargy: readiness 4–6; Elite: readiness ≥ 8.  
  Geen 0–100 of slider-logica meer gevonden; **geen dead code** op dit vlak.
- **calculateActivityLoad / calculatePrimeLoad:**
  - **calculationService.js:** Beide functies zijn daar gedefinieerd en geëxporteerd.
  - **reportService.js:** Importeert ze via `require('./calculationService')` en gebruikt ze; er zijn **geen** lokale definities of uitgecommentarieerde oude versies.
  - **server.js:** Gebruikt deze functies **niet** (alleen o.a. suffer_score voor een simpele load-label in `getDetectedWorkoutForAI`). Geen dubbele of oude implementaties.

**Conclusie:** Readiness is consistent 1–10; Load/Prime Load komen uitsluitend uit calculationService; geen dode of uitgecommentarieerde versies gevonden.

**Actie:** Geen fix nodig.

---

## Samenvatting

| Onderdeel | Status | Actie |
|-----------|--------|--------|
| Strava duplicaten | Veilig | Geen |
| Cycle lastPeriod/lastPeriodDate | Consistent | Geen |
| Error handling Strava sync | try/catch, geen crash | Geen |
| server.js omvang / structuur | 1851 regels, logica in server | Optioneel: controllers + routes |
| Readiness 1–10 / Load uit calculationService | Consistent, geen dead code | Geen |
