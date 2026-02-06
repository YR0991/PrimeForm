/**
 * Weekly Report Generator v2.0 — aggregate user data + knowledge base, call OpenAI "Race Engineer".
 * Used by GET /api/admin/reports/weekly/:uid
 */

const fs = require('fs');
const path = require('path');

/**
 * Load PrimeForm Knowledge Base (logic, science, lingo) into one string.
 * @param {string} [knowledgeDir] - Path to knowledge folder (default: ../knowledge relative to this file)
 * @returns {string} Combined content or empty string if files missing
 */
function loadKnowledgeContext(knowledgeDir) {
  const dir = knowledgeDir || path.join(__dirname, '..', 'knowledge');
  const files = ['logic.md', 'science.md', 'lingo.md'];
  const parts = [];
  for (const file of files) {
    try {
      const filePath = path.join(dir, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        parts.push(`--- ${file} ---\n${content}`);
      }
    } catch {
      // Fallback: geen crash bij ontbrekend bestand
    }
  }
  return parts.length ? parts.join('\n\n') : '';
}

/**
 * Format user profile / intake to a readable athlete context string.
 * @param {object} profile - User profile or intake (goals, injuryHistory, trainingPreferences, etc.)
 * @returns {string}
 */
function formatAthleteContext(profile) {
  if (!profile || typeof profile !== 'object') return 'Geen intake of profiel beschikbaar.';
  const lines = [];
  if (profile.fullName) lines.push(`Naam: ${profile.fullName}`);
  if (profile.goals && (Array.isArray(profile.goals) ? profile.goals.length : profile.goals)) {
    lines.push(`Doelen: ${Array.isArray(profile.goals) ? profile.goals.join(', ') : String(profile.goals)}`);
  }
  if (profile.injuryHistory) lines.push(`Blessure-/klachtenhistorie: ${String(profile.injuryHistory)}`);
  if (profile.injuries) lines.push(`Blessures/klachten: ${String(profile.injuries)}`);
  if (profile.trainingPreferences) lines.push(`Trainingsvoorkeuren: ${String(profile.trainingPreferences)}`);
  if (profile.programmingType) lines.push(`Type programma: ${String(profile.programmingType)}`);
  if (profile.redFlags && Array.isArray(profile.redFlags) && profile.redFlags.length) {
    lines.push(`Red flags (intake): ${profile.redFlags.join(', ')}`);
  }
  if (profile.cycleData && typeof profile.cycleData === 'object') {
    const cd = profile.cycleData;
    if (cd.avgDuration) lines.push(`Gem. cyclusduur: ${cd.avgDuration} dagen`);
    if (cd.contraception) lines.push(`Anticonceptie: ${cd.contraception}`);
  }
  if (profile.successScenario) lines.push(`Successcenario (12 weken): ${String(profile.successScenario)}`);
  if (profile.painPoint) lines.push(`Pijnpunt: ${String(profile.painPoint)}`);
  return lines.length ? lines.join('\n') : 'Geen intake of profiel beschikbaar.';
}

/**
 * Get user profile (intake) from Firestore.
 */
async function getUserProfile(db, uid) {
  const snap = await db.collection('users').doc(String(uid)).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  return {
    profile: data.profile || null,
    profileComplete: data.profileComplete === true,
    strava: data.strava || null
  };
}

/**
 * Get daily logs for the last 7 days (HRV, RHR, cycle, subjective/readiness).
 */
async function getLast7DaysLogs(db, admin, uid) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(startOfToday);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const startTs = admin.firestore.Timestamp.fromDate(sevenDaysAgo);
  const endTs = admin.firestore.Timestamp.fromDate(now);

  const snap = await db
    .collection('users')
    .doc(String(uid))
    .collection('dailyLogs')
    .orderBy('timestamp', 'desc')
    .where('timestamp', '>=', startTs)
    .where('timestamp', '<=', endTs)
    .get();

  return snap.docs.map((doc) => {
    const d = doc.data() || {};
    const ts = d.timestamp;
    const timestamp = ts && typeof ts.toDate === 'function' ? ts.toDate().toISOString() : (d.date || null);
    const metrics = d.metrics || {};
    const hrv = typeof metrics.hrv === 'number' ? metrics.hrv : (metrics.hrv && metrics.hrv.current) ?? null;
    const rhr = metrics.rhr != null ? (typeof metrics.rhr === 'object' ? metrics.rhr.current : metrics.rhr) : null;
    const readiness = metrics.readiness ?? null;
    const cycleInfo = d.cycleInfo || {};
    return {
      id: doc.id,
      date: d.date,
      timestamp,
      hrv,
      rhr,
      readiness,
      sleep: metrics.sleep ?? null,
      phase: cycleInfo.phase,
      isLuteal: cycleInfo.isLuteal,
      recommendation: d.recommendation ? d.recommendation.status : null
    };
  });
}

/**
 * Normalize activity date to YYYY-MM-DD for filtering (ISO string, timestamp, or Firestore Timestamp).
 */
function activityDateString(a) {
  const raw = a.start_date_local ?? a.start_date;
  if (raw == null) return '';
  if (typeof raw === 'string') return raw.slice(0, 10);
  if (typeof raw.toDate === 'function') return raw.toDate().toISOString().slice(0, 10);
  if (typeof raw === 'number') return new Date(raw * 1000).toISOString().slice(0, 10);
  return String(raw).slice(0, 10);
}

/**
 * Get Strava activities for the last 7 days from Firestore (users/{uid}/activities).
 * Date filtering uses start_date_local or start_date (ISO string or timestamp).
 * Returns empty array if no activities or no Strava; no throw.
 */
async function getLast7DaysActivities(db, uid) {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoff = sevenDaysAgo.toISOString().slice(0, 10);

  const snap = await db
    .collection('users')
    .doc(String(uid))
    .collection('activities')
    .get();

  const activities = snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((a) => {
      const dateStr = activityDateString(a);
      return dateStr.length >= 10 && dateStr >= cutoff;
    })
    .sort((a, b) => activityDateString(b).localeCompare(activityDateString(a)));

  return activities;
}

/**
 * Berekent load voor één activiteit: Strava suffer_score, of TRIMP-fallback, of RPE-schatting.
 * TRIMP (Banister): hrReserve = (avgHr - restHr) / (maxHr - restHr); trimp = duration_min * hrReserve * 0.64 * exp(1.92 * hrReserve); load = trimp (raw TRIMP komt overeen met Garmin/Strava schaal).
 * Geen hartslag: RPE-schatting = (moving_time / 60) * 40.
 * @param {object} activity - { suffer_score, moving_time, average_heartrate }
 * @param {object} profile - user profile met max_heart_rate, resting_heart_rate (optioneel)
 * @returns {number}
 */
function calculateActivityLoad(activity, profile = {}) {
  const sufferScore = activity.suffer_score != null ? Number(activity.suffer_score) : null;
  if (Number.isFinite(sufferScore)) return sufferScore;

  const movingTimeSec = activity.moving_time != null ? Number(activity.moving_time) : 0;
  const durationMin = movingTimeSec / 60;
  const avgHr = activity.average_heartrate != null ? Number(activity.average_heartrate) : null;

  if (avgHr != null && Number.isFinite(avgHr)) {
    const maxHr = profile.max_heart_rate != null ? Number(profile.max_heart_rate) : 190;
    const restHr = profile.resting_heart_rate != null ? Number(profile.resting_heart_rate) : 60;
    const denominator = maxHr - restHr;
    if (denominator > 0) {
      let hrReserve = (avgHr - restHr) / denominator;
      hrReserve = Math.max(0, Math.min(1, hrReserve));
      const trimp = durationMin * hrReserve * 0.64 * Math.exp(1.92 * hrReserve);
      return Math.round(trimp * 10) / 10;
    }
  }

  return Math.round(durationMin * 40 * 10) / 10;
}

/**
 * PrimeForm v2.1: corrigeer ruwe load op basis van cyclusfase, intensiteit en symptomen.
 * @param {number} rawLoad - ruwe Strava/garmin load (of TRIMP/RPE)
 * @param {string} cyclePhase - cyclusfase voor deze dag (bijv. 'follicular', 'luteal', 'mid_luteal', 'late_luteal', 'menstrual')
 * @param {number} readinessScore - subjectieve readiness 1–10
 * @param {number} avgHr - gemiddelde hartslag van de activiteit
 * @param {number} maxHr - maximale hartslag (profiel)
 * @returns {number} primeLoad - fysiologisch gecorrigeerde load
 */
function calculatePrimeLoad(rawLoad, cyclePhase, readinessScore, avgHr, maxHr) {
  if (!Number.isFinite(rawLoad) || rawLoad <= 0) return 0;

  // 1. Base multiplier
  let multiplier = 1.0;

  // 2. Phase penalty (mid/late luteal)
  const phase = (cyclePhase || '').toLowerCase();
  const lutealPhases = ['mid_luteal', 'late_luteal', 'luteal'];
  if (lutealPhases.includes(phase)) {
    multiplier = 1.05; // +5% base tax

    // 3. Intensity penalty (HR > 85% van max)
    if (maxHr && avgHr) {
      const intensity = avgHr / maxHr;
      if (intensity >= 0.85) {
        multiplier += 0.05; // +5% intensity tax
      }
    }
  }

  // 4. Symptom penalty (op basis van readiness 1–10)
  if (readinessScore != null && Number.isFinite(Number(readinessScore))) {
    const r = Number(readinessScore);
    const symptomSeverity = Math.max(0, Math.min(9, 10 - r)); // 0–9
    const symptomTax = Math.min(symptomSeverity * 0.01, 0.04); // max +4%
    multiplier += symptomTax;
  }

  const corrected = rawLoad * multiplier;
  return Math.round(corrected); // afronden naar heel getal
}

/**
 * Build stats from logs and activities for the report.
 * load_total: som van Strava suffer_score (Relative Effort) per activiteit; ontbreekt die, dan TRIMP- of RPE-fallback.
 */
function buildStats(logs, activities, profile = {}) {
  const hrvValues = logs.map((l) => l.hrv).filter((v) => v != null && Number.isFinite(Number(v)));
  const rhrValues = logs.map((l) => l.rhr).filter((v) => v != null && Number.isFinite(Number(v)));
  const readinessValues = logs.map((l) => l.readiness).filter((v) => v != null && Number.isFinite(Number(v)));

  let load_total = 0;
  for (const a of activities) {
    load_total += calculateActivityLoad(a, profile);
  }

  return {
    load_total: Math.round(load_total * 10) / 10,
    hrv_avg: hrvValues.length ? Math.round((hrvValues.reduce((s, v) => s + Number(v), 0) / hrvValues.length) * 10) / 10 : null,
    rhr_avg: rhrValues.length ? Math.round(rhrValues.reduce((s, v) => s + Number(v), 0) / rhrValues.length) : null,
    subjective_avg: readinessValues.length ? Math.round((readinessValues.reduce((s, v) => s + Number(v), 0) / readinessValues.length) * 10) / 10 : null,
    days_with_logs: logs.length,
    activities_count: activities.length
  };
}

/**
 * Generate weekly report: aggregate data + OpenAI Race Engineer.
 * @param {object} opts - { db, admin, openai, knowledgeBaseContent, uid }
 * @returns {Promise<{ stats, message }>}
 */
async function generateWeeklyReport(opts) {
  const { db, admin, openai, knowledgeBaseContent, uid } = opts;
  if (!db || !openai) throw new Error('db and openai required');

  const [profileData, logs, activities] = await Promise.all([
    getUserProfile(db, uid),
    getLast7DaysLogs(db, admin, uid),
    getLast7DaysActivities(db, uid)
  ]);

  const profile = profileData?.profile || {};
  const knowledgeContext = (typeof knowledgeBaseContent === 'string' && knowledgeBaseContent.trim())
    ? knowledgeBaseContent.trim()
    : loadKnowledgeContext();
  const athleteContext = formatAthleteContext(profile);

  // Maak een lookup van log-data per datum (voor fase/readiness koppeling aan activiteiten)
  const logByDate = new Map();
  for (const l of logs) {
    const key = (l.date || (l.timestamp ? l.timestamp.slice(0, 10) : '') || '').slice(0, 10);
    if (key) {
      logByDate.set(key, l);
    }
  }

  // Verrijk activiteiten met raw load en Prime Load
  const enrichedActivities = activities.map((a) => {
    const dateStr = activityDateString(a);
    const matchingLog = logByDate.get(dateStr);
    const phase = matchingLog?.phase || null;
    const readinessScore = matchingLog?.readiness ?? null;
    const rawLoad = calculateActivityLoad(a, profile);
    const maxHr = profile.max_heart_rate != null ? Number(profile.max_heart_rate) : null;
    const avgHr = a.average_heartrate != null ? Number(a.average_heartrate) : null;
    const primeLoad = calculatePrimeLoad(rawLoad, phase, readinessScore, avgHr, maxHr);
    return {
      ...a,
      _dateStr: dateStr,
      _phase: phase,
      _readiness: readinessScore,
      raw_load: rawLoad,
      prime_load: primeLoad
    };
  });

  const primeLoadTotal = enrichedActivities.reduce((sum, a) => sum + (a.prime_load || 0), 0);

  // Basisstats bouwen en daarna load_total vervangen door Prime Load som
  const statsBase = buildStats(logs, activities, profile);
  const stats = {
    ...statsBase,
    load_total: Math.round(primeLoadTotal * 10) / 10
  };
  const logsSummary = logs.length
    ? logs.map((l) => `- ${l.date || l.timestamp?.slice(0, 10)}: HRV=${l.hrv ?? '—'} RHR=${l.rhr ?? '—'} Readiness=${l.readiness ?? '—'} Fase=${l.phase ?? '—'}`).join('\n')
    : 'Geen logdata voor de afgelopen 7 dagen.';
  const activitiesSummary = enrichedActivities.length
    ? enrichedActivities.map((a) => {
        const dateStr = a._dateStr || (a.start_date_local || a.start_date || '').toString().slice(0, 10);
        const dist = a.distance != null ? `${(a.distance / 1000).toFixed(1)} km` : '';
        const rawLoad = a.raw_load != null ? `RawLoad ${a.raw_load}` : '';
        const prime = a.prime_load != null ? `PrimeLoad ${a.prime_load}` : '';
        const phase = a._phase ? `Fase ${a._phase}` : '';
        return `- ${dateStr} ${a.type || 'Workout'} ${dist} ${rawLoad} ${prime} ${phase}`.trim();
      }).join('\n')
    : 'Geen Strava-activiteiten in de afgelopen 7 dagen.';

  const systemPrompt = `ROL: Je bent de PrimeForm Race Engineer, een elite performance coach voor vrouwen.

PRIMEFORM KNOWLEDGE BASE (Jouw absolute waarheid en regels):
${knowledgeContext || '(Geen knowledge base geladen – baseer je op algemene PrimeForm principes.)'}

ATLEET PROFIEL (Doelen en achtergrond):
${athleteContext}

INSTRUCTIE:
Analyseer de weekdata. Je advies MOET gekoppeld zijn aan de doelen van de atleet en getoetst worden aan de Knowledge Base.
Gebruik de PrimeForm terminologie.
Structuur je antwoord in 3 delen:
1. De Harde Data (Wat zien we? Analyseer de Load vs Prime Load.)
2. De Context (Cyclusfase, Herstel, en hoe dit relateert aan haar doelen.)
3. Het Plan (Concreet advies voor volgende week.)

Week Load (load_total) is fysiologisch gecorrigeerde "Prime Load". Schrijf in het Nederlands, 'jij'-vorm, natuurlijke toon.

Antwoord uitsluitend met een geldig JSON-object met exact twee velden: "stats" (object met load_total, hrv_avg, rhr_avg, subjective_avg) en "message" (string: de concepttekst voor de atleet). Geen markdown, geen codeblokken.`;

  const userPrompt = `[LOGS LAATSTE 7 DAGEN]\n${logsSummary}\n\n[STRAVA ACTIVITEITEN LAATSTE 7 DAGEN]\n${activitiesSummary}\n\n[BEREKENDE STATS]\n${JSON.stringify(stats, null, 2)}\n\nGeef het gevraagde JSON-object met "stats" en "message".`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.8,
    response_format: { type: 'json_object' }
  });

  const content = completion.choices?.[0]?.message?.content?.trim() || '{}';
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = { stats, message: content || 'Geen tekst gegenereerd.' };
  }

  // Zelfde 'laatste 7 dagen' activiteiten, geformatteerd voor de frontend (raw load + Prime Load)
  const activities_list = enrichedActivities.map((a) => {
    const dateStr = a._dateStr || activityDateString(a);
    const distance = a.distance != null ? Number(a.distance) : null;
    const movingTime = a.moving_time != null ? Number(a.moving_time) : null;
    const avgHr = a.average_heartrate != null ? Number(a.average_heartrate) : null;
    const load = a.raw_load != null ? a.raw_load : calculateActivityLoad(a, profile);
    return {
      date: dateStr,
      type: a.type || 'Workout',
      distance_km: distance != null ? Math.round((distance / 1000) * 100) / 100 : null,
      duration_min: movingTime != null ? Math.round(movingTime / 60) : null,
      avg_hr: avgHr != null ? avgHr : '-',
      load,
      prime_load: a.prime_load != null ? a.prime_load : calculatePrimeLoad(load, null, null, avgHr, profile.max_heart_rate)
    };
  });

  return {
    stats: parsed.stats || stats,
    message: typeof parsed.message === 'string' ? parsed.message : (parsed.message ? String(parsed.message) : 'Geen weekrapport gegenereerd.'),
    activities_list
  };
}

module.exports = {
  generateWeeklyReport,
  getUserProfile,
  getLast7DaysLogs,
  getLast7DaysActivities,
  buildStats,
  loadKnowledgeContext,
  formatAthleteContext
};
