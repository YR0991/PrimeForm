# UI-werk terugvinden – overzicht en herstel

## Twee plekken met dashboard-code

1. **primeform-frontend** (deze map)  
   - Admin: `src/pages/admin/AdminPage.vue` (~1000 regels)  
   - Coach: `src/pages/coach/CoachDashboard.vue`  
   - Atleet: `src/pages/dashboard/UserDashboard.vue`  
   - Auth, LoginPage, router, MainLayout, api/httpClient, stores/auth

2. **PrimeForm** (submodule, map `../PrimeForm`)  
   - Uitgebreide Admin: `src/pages/admin/AdminPage.vue` (~1900 regels)  
   - Coach: o.a. `CoachDeepDive.vue`, coach-routes  
   - Atleet: `ProfilePage.vue`, `InsightsPage.vue`, intake, etc.  
   - AtleetDetailDialog, team-dialogen, rol-UI

Welke van de twee je gebruikt (Vercel vs. andere deploy), bepaalt waar het “verloren” UI-werk zit.

---

## Wat zit er in de tweede plek (PrimeForm, ~1900 regels Admin + componenten)

Dit is een **inventaris** van de UI die in **PrimeForm** (submodule) staat. Veel daarvan heb je mogelijk “kwijt” als je nu vooral in primeform-frontend werkt.

### Admin (AdminPage.vue + componenten)

| Onderdeel | Wat het doet |
|-----------|--------------|
| **Header** | “SUPER ADMIN • MISSION CONTROL”, refresh-knop |
| **KPI-rij** | Totaal teams, Actieve atleten, System load % (capaciteit) |
| **Master lijst** | Tabel alle atleten: zoeken, directive-dot (PUSH/MAINTAIN/RECOVER), **rol-chip** (Atleet/Coach/Admin, klik → userDialog), naam, e-mail, team, acties (Bekijk als atleet, Verwijderen). Rij-klik → Atleet Dossier (deep-dive) |
| **Ghost-grid** | “Ongekoppelde atleten”: tabel + team-dropdown om aan team te koppelen, `userAssignments`, `onAssignTeam` |
| **Teamconfiguratie** | Tabel teams met expand: naam, coachEmail, inviteCode (copy), occupancy (progress + limiet), acties (rename, delete). Uitklappen = ledenlijst, klik lid → Atleet Dossier |
| **Team-dialog** | Nieuw/bewerk team: teamnaam, coach e-mail, max leden; bij bewerken: **ledenlijst met “Verwijder uit team”** |
| **User-dialog** | Rol wijzigen: **roleOptions** (Atleet/Coach/Admin met icon + beschrijving), naam/e-mail read-only, opslaan → `updateUserProfile` |
| **AtleetDetailDialog** | Full-screen dialog: tabs **Profiel / Status / Timeline / Geschiedenis-Import**, team-select, telemetry-injector |
| **Stijl** | Elite Dark: kpi-card, ghost-card, teams-card, role-chip, occupancy bar, etc. |

### Coach

| Bestand | Wat het doet |
|---------|--------------|
| **CoachDashboard.vue** | Squad-overzicht, klik atleet → deep-dive |
| **CoachDeepDive.vue** | Rechter drawer: atleetnaam, **directive-badge**, **7-dagen consistentie (compliance bars)**, streak; **ATL-bar chart**; **Belastingsbalans (live ACWR)** + uitklap “Bijdragers 7d”; verdere fysio/acties |
| **coach/WeekReportDialog.vue** | Weekrapport-dialog |

### Atleet / overig

| Bestand | Wat het doet |
|---------|--------------|
| **ProfilePage.vue** | Profielpagina atleet (~674 regels) |
| **InsightsPage.vue** | Inzichten |
| **IntakeStepper.vue** | Intake-flow (~567 regels) |
| **IndexPage.vue** | O.a. profile-incomplete banner |

### Componenten (PrimeForm/src/components)

- **AtleetDetailDialog.vue** – Atleet Dossier (profiel, status, timeline, import)
- **CoachDeepDive.vue** – Coach deep-dive (ATL, ACWR, compliance, etc.)
- **CycleComparisonChart.vue**, **CycleCalendar.vue**, **HRVHistoryChart.vue**, **RHRTile.vue**
- **StravaStatusPanel.vue**, **DebugTimeline.vue**
- **coach/WeekReportDialog.vue**

Als je iets uit deze lijst in **primeform-frontend** wilt hebben, moet je die stukken code of componenten uit **PrimeForm** overnemen (of de app op PrimeForm bouwen/deployen).

---

## Wat er in git staat (primeform-frontend)

Recente commits die UI/dashboards raken:

| Commit    | Beschrijving |
|----------|--------------|
| 4bfd09f  | Admin: loadUsers Promise.allSettled, parseFirestoreDate, Naam-fallback |
| 643b2cc  | Coach: authStore.user.email, coachService met api |
| 393596b  | Admin gekoppeld aan API (adminService, stats, users) |
| f074520  | Firebase auth, httpClient, auth store, LoginPage |
| 54ed248  | Auth flow, Login Page, router guards |
| 6dbd13c  | Three dashboards + Coach API |
| e501502  | Batch import historical data (admin) |
| 4eb4764  | Admin dashboard + user management |

---

## Oude versie van een bestand bekijken

Vanuit **primeform-frontend**:

```bash
# Lijst van commits die een bestand hebben gewijzigd
git log --oneline -- src/pages/admin/AdminPage.vue

# Inhoud van dat bestand op een bepaalde commit
git show 393596b:src/pages/admin/AdminPage.vue

# Diff tussen nu en een oude commit voor één bestand
git diff 6dbd13c -- src/pages/admin/AdminPage.vue
```

Vanuit **PrimeForm**-submodule:

```bash
cd ../PrimeForm
git log --oneline -- src/pages/admin/AdminPage.vue
git show e284d7b8:src/pages/admin/AdminPage.vue
```

---

## Specifieke commit terugzetten voor één bestand

Als je een oude versie van **één bestand** wilt herstellen (pas op: overschrijft je huidige bestand):

```bash
# Alleen in primeform-frontend
git checkout <commit-hash> -- src/pages/admin/AdminPage.vue
```

Daarna controleren en committen als het de juiste versie is.

---

## Reflog (als je per ongeluk hebt gereset of gewisseld)

Als je bijvoorbeeld `git reset --hard` of een oude checkout hebt gedaan:

```bash
git reflog
```

Kijk welke regel de gewenste staat heeft (bijv. "commit: Feature: Admin dashboard...").  
Die commit-hash kun je gebruiken in `git show` of `git checkout` zoals hierboven.

---

## Snel checken wat er nu op main staat

```bash
# Frontend
git log -1 --oneline && wc -l src/pages/admin/AdminPage.vue src/pages/coach/CoachDashboard.vue

# PrimeForm (andere repo)
cd ../PrimeForm && git log -1 --oneline && wc -l src/pages/admin/AdminPage.vue
```

---

## PrimeForm (submodule) – UI-commits met datum

Deze commits zitten in **PrimeForm** (niet in primeform-frontend). Als je daar UI kwijt bent, kijk hier:

| Datum     | Commit    | Wat |
|----------|-----------|-----|
| 2026-02-17 | ba299327 | Admin stats error logging (backend) |
| 2026-02-16 | e284d7b8 | **Admin: userDialog met rol (Rol/Naam/E-mail), roleOptions, open op role chip** |
| 2026-02-16 | ad2a6cf3 | **Admin: role UI (chip in tabel), team dialog leden-sectie** |
| 2026-02-16 | f26650b9 | **Coach: ACWR dash, ATL fallback, setCoachClaim** |
| 2026-02-16 | 247d40e7 | **Coach: live ACWR deep-dive (Optie B)** |
| 2026-02-16 | f384a790 | IndexPage: profile incomplete banner |

Voorbeeld: oude Admin met rol-chip en dialog bekijken:
```bash
cd PrimeForm
git show ad2a6cf3:src/pages/admin/AdminPage.vue | head -200
```

---

## /intake als Admin (redirect)

Als je als Admin op `/intake` terechtkomt, komt dat vaak door oude localStorage. **Actie:** F12 → Application → Clear Site Data, daarna opnieuw inloggen. De router stuurt je dan naar `/admin` als de backend je als Admin ziet.

---

Als je zegt welk scherm of welke functionaliteit “terug in de tijd” is (bijv. “Admin tabel met rol-chip” of “Coach squadron met deep-dive”), kan er gericht een commit of bestand worden aangewezen om terug te zetten of te vergelijken.
