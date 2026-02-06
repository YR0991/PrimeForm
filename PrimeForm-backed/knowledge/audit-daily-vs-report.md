# Code-audit: Daily (server.js) vs reportService.js vs logic.md

**Datum:** 2026-02-06  
**Scope:** Consistentie (Luteale Fase, HRV Baseline), Duplicatie (Load, fase), Conflict (Elite Override)

---

## 1. Consistentie: Zelfde interpretatie van concepten?

### 1.1 Luteale Fase

| Bron | Definitie / Gebruik |
|------|----------------------|
| **logic.md** | Phase == Luteal = na bevestigde ovulatie of berekend na dag 14 (28d cyclus). |
| **server.js** | `calculateLutealPhase()`: `ovulationDay = Math.floor(cycleLength/2)` (bij 28 → 14), Luteal = `currentCycleDay >= ovulationDay + 1` t/m `cycleLength`. Phase-namen: `Menstrual` (dag 1–5 + wrap), `Follicular`, `Luteal`. |
| **reportService.js** | Ontvangt `phase` per dag uit `dailyLogs` (van daily-advice). Gebruikt voor Prime Load: `lutealPhases = ['mid_luteal', 'late_luteal', 'luteal']`; vergelijkt met `(cyclePhase \|\| '').toLowerCase()`. |

**Conclusie:**  
- **Consistent:** Daily is de enige bron van fase; report gebruikt die fase alleen voor Prime Load. `phaseName === 'Luteal'` (server) wordt opgeslagen en komt in logs als `phase`; na `toLowerCase()` is dat `'luteal'` → zit in `lutealPhases`.  
- **Risico:** logic.md noemt geen `mid_luteal` / `late_luteal`; server levert die nu niet. Als je later granulair wordt (mid/late luteal), moet reportService diezelfde waarden krijgen en blijft de lijst `lutealPhases` de single source of truth (beter: gedeelde constante).

### 1.2 HRV Baseline

| Bron | Definitie / Gebruik |
|------|----------------------|
| **logic.md** | Baseline (28d) gebruikt voor Luteal Offset (Adjusted_HRV = Raw_HRV × 1.12), voor Lethargy (HRV > 105% van Baseline) en Elite Override (HRV ≥ 98% van Baseline). |
| **server.js** | Baseline komt uit de request: `hrvBaseline` (en `rhrBaseline`). Wordt gebruikt in: (1) `calculateRedFlags` → Luteal: `adjustedHrvBaseline = hrvBaseline * 1.12`; (2) Lethargy: `currentHRV >= (adjustedBaseline \|\| baseline) * 1.05`; (3) Elite: `currentHRV >= baseline * 0.98` (expliciet **raw** baseline). |
| **reportService.js** | Geen 28d HRV-baseline. Alleen `hrv_avg` over laatste 7 dagen voor de weekstats. Geen Lethargy/Elite-Override-logica. |

**Conclusie:**  
- **Daily vs logic:** Interpretatie is consistent: één “baseline” per dag (verondersteld 28d), Luteal offset +12% op baseline voor drempels, Lethargy met adjusted baseline, Elite met raw baseline.  
- **Spec-nuance Lethargy:** logic.md: “HRV > 105% van Baseline (28d)”. In code: Lethargy gebruikt `adjustedBaseline` (dus in Luteal al ×1.12). Daarmee is de voorwaarde strikter dan “105% van raw 28d baseline”. Als de bedoeling letterlijk “105% van 28d baseline” is, gebruik dan voor Lethargy de **raw** baseline; anders is de huidige (strengere) interpretatie bewust en documenteer dat in logic.md.

### 1.3 RHR Baseline (korte noot)

logic.md 2.2: `Adjusted_RHR = Raw_RHR - (Baseline_RHR_Follicular * 0.03)`.  
server.js: `adjustedRhrBaseline = isLuteal ? rhrBaseline + 3 : rhrBaseline` (vast +3 bpm).  
Dus: spec = 3% van baseline als correctie op de **meting**; code = vaste +3 op de **drempel**. Formeel anders; functioneel vergelijkbaar voor typische baseline (~60). Wil je 1-op-1 met de spec: overweeg `rhrBaseline * 0.03` i.p.v. `3`.

---

## 2. Duplicatie: Berekeningen op twee plekken?

### 2.1 Fase-bepaling (Luteal / Follicular / Menstrual)

- **server.js:** Enige plek waar fase wordt berekend: `calculateLutealPhase(lastPeriodDate, cycleLength)`.  
- **reportService.js:** Berekent fase niet; leest `phase` uit elke `dailyLog` (afkomstig van daily-advice).

Geen duplicatie. Wel: de **naamlijst** voor “wat telt als luteal voor load” staat alleen in reportService (`lutealPhases`). Als server ooit `mid_luteal`/`late_luteal` gaat teruggeven, moet die lijst meegroeien. Aanbeveling: gedeelde constante, bijv. in `calculationService.js` of `constants.js`:

```js
// bijv. constants.js of calculationService.js
const LUTEAL_PHASE_NAMES = ['mid_luteal', 'late_luteal', 'luteal'];
```

En in server.js bij phase-name ook deze set gebruiken (of een map phaseName → isLutealForLoad).

### 2.2 Load-formule (activity load)

- **reportService.js:**  
  - `calculateActivityLoad(activity, profile)`: suffer_score → anders TRIMP → anders RPE-fallback.  
  - `calculatePrimeLoad(rawLoad, cyclePhase, readinessScore, avgHr, maxHr)`: phase penalty (luteal +5%), intensity penalty (HR > 85% max +5%), symptom penalty (readiness).  
- **server.js:** Alleen `getDetectedWorkoutForAI`: gebruikt `suffer_score` voor een **label** (Low/Medium/High), geen TRIMP/Prime Load.

Geen duplicatie van de echte load- of Prime Load-berekening. Die zit alleen in reportService. Aanbeveling: als je ooit in de daily flow ook een getal voor “load vandaag” wilt (bijv. voor compliance of weektotaal), **hergebruik** dan `calculateActivityLoad` en eventueel `calculatePrimeLoad` uit een gedeelde module (zie hieronder), in plaats van iets nieuws in server.js te bouwen.

### 2.3 Luteal-offset (HRV/RHR) en Red Flags

Alleen in **server.js**: `calculateRedFlags(..., isLuteal)` met `adjustedHrvBaseline = isLuteal ? hrvBaseline * 1.12 : hrvBaseline` en `adjustedRhrBaseline = isLuteal ? rhrBaseline + 3 : rhrBaseline`. reportService doet geen red flags, geen offset.

Geen duplicatie.

### 2.4 Aanbeveling: centrale calculationService.js / utils

- **Samenbrengen in één module (bijv. `calculationService.js`):**
  - **Load:** `calculateActivityLoad`, `calculatePrimeLoad` (nu alleen in reportService) → verplaatsen en in reportService importeren.
  - **Fase (voor load):** `LUTEAL_PHASE_NAMES` (of `isLutealPhaseForLoad(phase)`) als single source of truth; server blijft fase berekenen, report (en eventueel server) gebruikt deze constante/functie.
- **Optioneel in dezelfde module of utils:**
  - Luteal HRV-offset: `adjustedHrvBaseline(hrvBaseline, isLuteal)` (1.12).
  - Luteal RHR-offset: `adjustedRhrBaseline(rhrBaseline, isLuteal)` (+3 of 0.03*baseline, afhankelijk van spec-keuze).

Dan blijft alle “wat is luteal voor load” en “hoe corrigeren we load/baseline” op één plek en vermijd je drift tussen daily en weekly.

---

## 3. Conflict: Elite Override daily vs weekrapport?

### 3.1 Waar zit de logica?

- **Daily (server.js):**  
  - Lethargy Override: Luteal + readiness 4–6 + HRV ≥ 105% (adjusted) baseline → status `MAINTAIN`.  
  - Elite Override: Menstrual + readiness ≥ 8 + HRV ≥ 98% baseline → status `PUSH`.  
  - Noodrem: Ziek/Geblesseerd → `REST`.  
  Deze status wordt opgeslagen in `dailyLogs` en bepaalt het dagelijkse advies.

- **Weekrapport (reportService.js):**  
  - Geen herberekening van REST/RECOVER/MAINTAIN/PUSH.  
  - Leest laatste 7 dagen logs (inclusief `recommendation.status`), aggregeert activiteiten, berekent Prime Load, bouwt `stats` en geeft alles (inclusief knowledge base met logic.md) aan de AI.  
  - De AI schrijft de wekelijkse narratieve tekst op basis van die data + logic.md (waar o.a. Lethargy en Elite Override in staan).

### 3.2 Is er een technisch conflict?

- **Nee:** Er is geen tweede code-pad dat opnieuw Elite/Lethargy uitrekent en een andere status zou geven. De daily status is leidend en wordt in de weekdata getoond.
- **Mogelijk narratief conflict:** De weekly AI ziet alleen wat er in de prompt zit: logs (met per-dag status), activiteiten, Prime Load, en de tekst van logic.md. Ze heeft **niet** per dag de 28d-baseline of de exacte override-reden. Als de AI bijvoorbeeld “je had wat vaker rust moeten nemen” suggereert terwijl op bepaalde dagen bewust MAINTAIN (Lethargy) of PUSH (Elite Rebound) is gegeven, kan dat tegenstrijdig voelen. Dat is geen bug in de code, maar een risico op inconsistent **verwoording** als de AI de dagelijkse overrides niet herkent.

### 3.3 Aanbeveling

- In de system prompt van het weekrapport expliciet maken dat **dagelijkse status (REST/RECOVER/MAINTAIN/PUSH) leidend is** en dat Lethargy Override en Elite Override bewuste uitzonderingen zijn; de AI moet het weekbeeld niet tegenspreken op dagen waar die overrides van toepassing waren.
- Optioneel: in de weekdata die naar de AI gaat per logregel een korte reden meesturen (bijv. “Lethargy Override” / “Elite Rebound” als die van toepassing waren), zodat de AI haar verhaal kan afstemmen op die context.

---

## 4. Korte samenvatting

| Vraag | Antwoord |
|-------|----------|
| **Consistentie Luteale Fase** | Ja. Daily is bron; report gebruikt dezelfde fase voor Prime Load. Enige risico: toekomstige mid/late luteal alleen consistent als fase-namen gedeeld zijn (constante). |
| **Consistentie HRV Baseline** | Ja. Daily gebruikt één baseline (request), Luteal offset +12%, Lethargy met adjusted, Elite met raw. Spec Lethargy “105% van Baseline (28d)” kan worden geïnterpreteerd als raw → nu is code strikter (adjusted). |
| **Duplicatie Load / fase** | Geen duplicatie van fase-berekening of van Load/Prime Load-formule. Wel: luteal-fase-lijst alleen in reportService → centraliseren aanbevolen. |
| **Centralisatie** | Aanbevolen: `calculationService.js` (of gelijknamige utils) met o.a. `calculateActivityLoad`, `calculatePrimeLoad`, `LUTEAL_PHASE_NAMES` (of `isLutealPhaseForLoad`). |
| **Conflict Elite Override** | Geen conflict in code. Wel: weekly AI kan narratief afwijken van daily overrides; prompt verduidelijken en eventueel override-reden in weekdata meesturen. |
