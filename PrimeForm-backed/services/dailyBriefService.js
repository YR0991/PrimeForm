/**
 * Daily Brief Service — Single aggregator for "Today-first" athlete dashboard brief.
 * Builds PrimeFormDailyBrief from reportService, Firestore (users, dailyLogs, activities), and heuristics.
 */

const reportService = require('./reportService');
const cycleService = require('./cycleService');
const { calculateActivityLoad, calculatePrimeLoad } = require('./calculationService');

/** Add days to YYYY-MM-DD, return YYYY-MM-DD */
function addDays(dateStr, delta) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Activity date string (start_date_local or start_date) */
function activityDateString(a) {
  const raw = a.start_date_local ?? a.start_date;
  if (raw == null) return '';
  if (typeof raw === 'string') return raw.slice(0, 10);
  if (typeof raw.toDate === 'function') return raw.toDate().toISOString().slice(0, 10);
  if (typeof raw === 'number') return new Date(raw * 1000).toISOString().slice(0, 10);
  return String(raw).slice(0, 10);
}

/** Root activity date (date field) */
function toIsoDateString(val) {
  if (val == null) return '';
  if (typeof val === 'string') return val.slice(0, 10);
  if (typeof val.toDate === 'function') return val.toDate().toISOString().slice(0, 10);
  if (typeof val === 'number') return new Date(val * 1000).toISOString().slice(0, 10);
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

/** ACWR -> band: LOW | SWEET | OVERREACHING | SPIKE */
function acwrBand(acwr) {
  if (acwr == null || !Number.isFinite(acwr)) return null;
  const v = Number(acwr);
  if (v < 0.8) return 'LOW';
  if (v <= 1.3) return 'SWEET';
  if (v <= 1.5) return 'OVERREACHING';
  return 'SPIKE';
}

/** status.tag from ACWR + overrides (isSick -> RADICAL REST not in brief contract; we use RECOVER) */
function statusTag(acwr, isSick) {
  if (isSick) return 'RECOVER';
  if (acwr == null || !Number.isFinite(acwr)) return 'MAINTAIN';
  const v = Number(acwr);
  if (v > 1.5) return 'RECOVER';
  if (v > 1.3) return 'RECOVER';
  if (v >= 0.8 && v <= 1.3) return 'PUSH';
  return 'MAINTAIN'; // < 0.8
}

/** signal from tag */
function signalFromTag(tag) {
  if (tag === 'PUSH') return 'GREEN';
  if (tag === 'MAINTAIN') return 'ORANGE';
  return 'RED'; // RECOVER | DELOAD
}

/** Cycle mode from profile */
function cycleMode(profile) {
  const cd = profile && profile.cycleData && typeof profile.cycleData === 'object' ? profile.cycleData : {};
  const contraception = (cd.contraception || '').toLowerCase();
  if (contraception.includes('lng') || contraception.includes('iud') || contraception.includes('spiraal')) return 'HBC_LNG_IUD';
  if (contraception.includes('pil') || contraception.includes('patch') || contraception.includes('ring') || contraception.length > 0) return 'HBC_OTHER';
  if (contraception === '' && (cd.lastPeriodDate || cd.lastPeriod)) return 'NATURAL';
  return 'UNKNOWN';
}

/** Cycle confidence: LOW (HBC), MED (NATURAL no period), HIGH (NATURAL with period) */
function cycleConfidence(mode, profile) {
  if (mode.startsWith('HBC')) return 'LOW';
  if (mode === 'UNKNOWN') return 'LOW';
  const cd = profile && profile.cycleData && typeof profile.cycleData === 'object' ? profile.cycleData : {};
  if (!(cd.lastPeriodDate || cd.lastPeriod)) return 'MED';
  return 'HIGH';
}

/**
 * Fetch dailyLog for a single date from users/{uid}/dailyLogs.
 */
async function getDailyLogForDate(db, uid, dateISO) {
  const snap = await db
    .collection('users')
    .doc(String(uid))
    .collection('dailyLogs')
    .where('date', '==', dateISO)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const d = snap.docs[0].data() || {};
  const metrics = d.metrics || {};
  const hrv = typeof metrics.hrv === 'object' && metrics.hrv && metrics.hrv.current != null ? metrics.hrv.current : (typeof metrics.hrv === 'number' ? metrics.hrv : null);
  const rhr = typeof metrics.rhr === 'object' && metrics.rhr && metrics.rhr.current != null ? metrics.rhr.current : (metrics.rhr != null ? metrics.rhr : null);
  return {
    metrics: { hrv, rhr, sleep: metrics.sleep != null ? metrics.sleep : null, readiness: metrics.readiness != null ? metrics.readiness : null },
    recommendation: d.recommendation || null,
    aiMessage: d.aiMessage != null ? d.aiMessage : null,
    cycleInfo: d.cycleInfo || null,
    isSick: d.isSick === true
  };
}

/**
 * Fetch dailyLogs in date range [startDate, endDate] (inclusive). Returns array of { date, hrv, rhr, ... }.
 */
async function getDailyLogsInRange(db, uid, startDate, endDate) {
  const snap = await db
    .collection('users')
    .doc(String(uid))
    .collection('dailyLogs')
    .where('date', '>=', startDate)
    .where('date', '<=', endDate)
    .get();
  const byDate = new Map();
  snap.docs.forEach((doc) => {
    const d = doc.data() || {};
    const date = (d.date || '').slice(0, 10);
    if (!date) return;
    const metrics = d.metrics || {};
    const hrv = typeof metrics.hrv === 'number' ? metrics.hrv : (metrics.hrv && metrics.hrv.current) ?? null;
    const rhr = metrics.rhr != null ? (typeof metrics.rhr === 'object' ? metrics.rhr.current : metrics.rhr) : null;
    byDate.set(date, { date, hrv, rhr });
  });
  return Array.from(byDate.values());
}

/**
 * Fetch activities in date range (users/{uid}/activities + root activities), with prime load for 7d stats.
 */
async function getActivitiesInRange(db, uid, startDate, endDate, profile, admin) {
  const [userSnap, rootSnap] = await Promise.all([
    db.collection('users').doc(String(uid)).collection('activities').get(),
    db.collection('activities').where('userId', '==', String(uid)).get()
  ]);
  const list = [];
  userSnap.docs.forEach((doc) => list.push({ ...doc.data(), id: doc.id }));
  rootSnap.docs.forEach((doc) => list.push({ ...doc.data(), id: doc.id }));
  const cycleData = profile && profile.cycleData && typeof profile.cycleData === 'object' ? profile.cycleData : {};
  const lastPeriodDate = cycleData.lastPeriodDate || cycleData.lastPeriod || null;
  const cycleLength = Number(cycleData.avgDuration) || 28;
  const maxHr = profile && profile.max_heart_rate != null ? Number(profile.max_heart_rate) : null;
  const out = [];
  for (const a of list) {
    const dateStr = a.start_date_local != null || a.start_date != null ? activityDateString(a) : toIsoDateString(a.date);
    if (!dateStr || dateStr < startDate || dateStr > endDate) continue;
    let primeLoad = a.prime_load != null && Number.isFinite(Number(a.prime_load)) ? Number(a.prime_load) : null;
    if (primeLoad == null && (a.source === 'manual' || a.suffer_score == null) && a.prime_load != null) primeLoad = Number(a.prime_load);
    if (primeLoad == null) {
      const rawLoad = calculateActivityLoad(a, profile || {});
      const phaseInfo = lastPeriodDate && dateStr ? cycleService.getPhaseForDate(lastPeriodDate, cycleLength, dateStr) : { phaseName: null };
      const readinessScore = 10;
      const avgHr = a.average_heartrate != null ? Number(a.average_heartrate) : null;
      primeLoad = calculatePrimeLoad(rawLoad, phaseInfo.phaseName, readinessScore, avgHr, maxHr);
    }
    const avgHr = a.average_heartrate != null ? Number(a.average_heartrate) : null;
    const hard = maxHr && avgHr ? avgHr / maxHr >= 0.85 : (a.suffer_score != null && Number(a.suffer_score) >= 80);
    out.push({ ...a, _dateStr: dateStr, _primeLoad: primeLoad, _hard: !!hard });
  }
  return out;
}

/**
 * Build compliance: checkins7dPct, checkins28dPct, missingHrvDays, missingRhrDays (last 28 ending dateISO).
 * @param {Array} logs28 - logs in [dateISO-27, dateISO]
 * @param {string} start7 - first day of last 7 (dateISO-6)
 */
function buildCompliance(logs28, start7) {
  const days28 = logs28.length;
  const withHrv = logs28.filter((l) => l.hrv != null && Number.isFinite(Number(l.hrv))).length;
  const withRhr = logs28.filter((l) => l.rhr != null && Number.isFinite(Number(l.rhr))).length;
  const checkins7 = logs28.filter((l) => l.date >= start7).length;
  const checkins7dPct = 7 > 0 ? Math.round((checkins7 / 7) * 1000) / 10 : null;
  const checkins28dPct = 28 > 0 ? Math.round((days28 / 28) * 1000) / 10 : null;
  return {
    checkins7dPct: checkins7dPct != null ? checkins7dPct : null,
    checkins28dPct: checkins28dPct != null ? checkins28dPct : null,
    missingHrvDays: Math.max(0, 28 - withHrv),
    missingRhrDays: Math.max(0, 28 - withRhr)
  };
}

/**
 * Confidence grade and blind spots from data availability.
 */
function buildConfidence(todayLog, stats, cycleConf) {
  const blindSpots = [];
  const hasHrvToday = todayLog && todayLog.metrics && todayLog.metrics.hrv != null && Number.isFinite(Number(todayLog.metrics.hrv));
  const hasRhrToday = todayLog && todayLog.metrics && todayLog.metrics.rhr != null && Number.isFinite(Number(todayLog.metrics.rhr));
  const hasBaselines = (stats.rhr_baseline_28d != null && Number.isFinite(stats.rhr_baseline_28d)) || (stats.hrv_baseline_28d != null && Number.isFinite(stats.hrv_baseline_28d));
  const hasAcwr = stats.acwr != null && Number.isFinite(stats.acwr);
  if (!hasHrvToday) blindSpots.push('HRV vandaag ontbreekt');
  if (!hasRhrToday) blindSpots.push('RHR vandaag ontbreekt');
  if (!hasBaselines) blindSpots.push('28d-baselines ontbreken');
  if (!hasAcwr) blindSpots.push('ACWR niet berekend');
  if (cycleConf === 'LOW') blindSpots.push('Cyclusvertrouwen laag (HBC/onbekend)');
  let grade = 'C';
  if (hasHrvToday && hasRhrToday && hasBaselines && hasAcwr) {
    grade = blindSpots.length === 0 ? 'A' : 'B';
  } else if (hasHrvToday && hasRhrToday && (hasBaselines || hasAcwr)) {
    grade = 'B';
  }
  return { grade, blindSpots };
}

/**
 * InternalCost: ELEVATED | NORMAL | LOW from recovery + ACWR + hard exposures. Null if missing data.
 * ELEVATED: stress signature (HRV down + RHR up) and/or stacking (3+ hard sessions) with clear explanations.
 */
function buildInternalCost(recoveryPct, rhrDelta, acwrBandVal, hardExposures7d, blindSpots) {
  if (recoveryPct == null && rhrDelta == null && acwrBandVal == null && hardExposures7d == null) return null;
  const hasRecovery = recoveryPct != null && Number.isFinite(recoveryPct);
  const hasRhrDelta = rhrDelta != null && Number.isFinite(rhrDelta);
  const hasAcwr = acwrBandVal != null;
  const hasHard = hardExposures7d != null && Number.isFinite(hardExposures7d);
  if (!hasRecovery && !hasRhrDelta && !hasHard) return null;
  const hrvLow = hasRecovery && recoveryPct < 95;
  const rhrUp = hasRhrDelta && rhrDelta >= 2;
  const hardHigh = hasHard && hardExposures7d >= 3;
  if ((hrvLow && rhrUp) || hardHigh) {
    const stressSig = hrvLow && rhrUp ? 'Stress signature: HRV down, RHR up.' : '';
    const stacking = hardHigh ? 'Stacking / hoge intensiteitsdichtheid (3+ zware sessies in 7d).' : '';
    const explanation = [stressSig, stacking].filter(Boolean).join(' ') || 'Verhoogde interne belasting.';
    return { state: 'ELEVATED', explanation };
  }
  const hrvOk = hasRecovery && recoveryPct >= 100;
  const rhrOk = hasRhrDelta && rhrDelta <= 0;
  const acwrSweet = hasAcwr && (acwrBandVal === 'LOW' || acwrBandVal === 'SWEET');
  if (hrvOk && rhrOk && acwrSweet) {
    return { state: 'LOW', explanation: 'HRV op of boven baseline, RHR stabiel, belasting in sweet spot' };
  }
  return { state: 'NORMAL', explanation: 'Geen verhoogde interne belasting' };
}

/**
 * TodayDirective: doToday, why, stopRule, detailsMarkdown (from aiMessage or template).
 */
function buildTodayDirective(statusTagVal, todayLog, blindSpots) {
  const detailsMarkdown = todayLog && todayLog.aiMessage ? todayLog.aiMessage : null;
  const doToday = [];
  const why = [];
  const stopRule = 'Bij twijfel: intensiteit omlaag. Bij pijn of ziekte: stoppen.';
  if (statusTagVal === 'PUSH') {
    doToday.push('Train volgens plan; kwaliteit voor kwantiteit.');
    why.push('Belastingsbalans in sweet spot.');
  } else if (statusTagVal === 'MAINTAIN') {
    doToday.push('Lichte tot gematigde training; focus op techniek of duur.');
    why.push('Belasting onder sweet spot of cyclus vraagt om voorzichtigheid.');
  } else {
    doToday.push('Rust of actief herstel (Zone 1). Geen zware of lange sessies.');
    why.push('Herstel prioriteit; voorkom overreaching.');
  }
  if (blindSpots.length > 0) {
    doToday.push('Check dagrapport voor ontbrekende data.');
  }
  return {
    doToday: doToday.slice(0, 5).map((s) => s.length > 120 ? s.slice(0, 117) + '...' : s),
    why: why.slice(0, 3).map((s) => s.length > 120 ? s.slice(0, 117) + '...' : s),
    stopRule,
    detailsMarkdown: detailsMarkdown || (detailsMarkdown === null && todayLog ? 'Open dagrapport voor volledig advies.' : undefined)
  };
}

/**
 * Next48h: today, tomorrow, trigger (deterministic by status.tag).
 */
function buildNext48h(statusTagVal) {
  let tomorrow = 'Rust of Zone 1';
  if (statusTagVal === 'PUSH') tomorrow = 'Aerobic Flow / techniek';
  else if (statusTagVal === 'MAINTAIN') tomorrow = 'Aerobic Flow kort + mobility';
  return {
    today: 'Volg vandaag het directief hierboven.',
    tomorrow,
    trigger: 'Als HRV daalt en RHR stijgt morgen → intensiteit laag houden.'
  };
}

/**
 * Intake from user profile (goal, eventDate, constraints, etc.).
 */
function buildIntake(profile) {
  if (!profile || typeof profile !== 'object') return null;
  const goals = profile.goals;
  const goal = Array.isArray(goals) ? (goals.length ? goals.join(', ') : null) : (goals != null ? String(goals) : null);
  return {
    goal: goal || null,
    eventDate: profile.eventDate || null,
    constraints: profile.constraints || profile.injuryHistory || null,
    availabilityDaysPerWeek: profile.availabilityDaysPerWeek != null ? profile.availabilityDaysPerWeek : null,
    sportFocus: profile.sport || profile.sportFocus || null,
    oneLineNotes: profile.oneLineNotes || null
  };
}

/**
 * getDailyBrief — Build PrimeFormDailyBrief for dateISO.
 * @param {{ db, admin, uid, dateISO, timezone }} opts
 * @returns {Promise<object>} brief (PrimeFormDailyBrief)
 */
async function getDailyBrief(opts) {
  const { db, admin, uid, dateISO } = opts;
  const generatedAt = new Date().toISOString();

  if (!db || !uid) {
    const fallbackTag = 'RECOVER';
    return {
      generatedAt,
      status: { tag: fallbackTag, signal: signalFromTag(fallbackTag), oneLiner: 'Geen data', hasBlindSpot: true },
      confidence: { grade: 'C', blindSpots: ['Geen gebruiker of database'] },
      todayDirective: { doToday: [], why: [], stopRule: 'Bij twijfel: niet doorgaan.' },
      inputs: { acwr: null, recovery: null, cycle: null, activity: null },
      compliance: { checkins7dPct: null, checkins28dPct: null, missingHrvDays: null, missingRhrDays: null },
      next48h: buildNext48h(fallbackTag),
      intake: null,
      internalCost: null
    };
  }

  const start28 = addDays(dateISO, -27);
  const start7 = addDays(dateISO, -6);

  const [stats, userSnap, todayLog, logs28] = await Promise.all([
    reportService.getDashboardStats({ db, admin, uid }),
    db.collection('users').doc(String(uid)).get(),
    getDailyLogForDate(db, uid, dateISO),
    getDailyLogsInRange(db, uid, start28, dateISO)
  ]);

  const userData = userSnap && userSnap.exists ? userSnap.data() : {};
  const profile = userData.profile || {};
  const activities7 = await getActivitiesInRange(db, uid, start7, dateISO, profile, admin);
  const compliance = buildCompliance(logs28, start7);

  const mode = cycleMode(profile);
  const cycleConf = cycleConfidence(mode, profile);
  const phase = cycleConf !== 'LOW' && stats.phase ? stats.phase : null;
  const phaseDay = cycleConf !== 'LOW' && stats.phaseDay != null ? stats.phaseDay : null;

  const acwrVal = stats.acwr != null && Number.isFinite(stats.acwr) ? stats.acwr : null;
  const band = acwrBand(acwrVal);
  const isSick = todayLog && todayLog.isSick === true;
  const tag = statusTag(acwrVal, isSick);
  const signal = signalFromTag(tag);
  const oneLiner = tag === 'PUSH' ? 'Groen licht voor kwaliteit.' : tag === 'MAINTAIN' ? 'Stabiel; train met mate.' : 'Herstel voorop.';
  const confidence = buildConfidence(todayLog, stats, cycleConf);
  if (todayLog && todayLog.isSick !== true && profile.isSick === true) {
    confidence.blindSpots.push('Ziek/handrem niet in vandaagse log; profiel heeft isSick.');
  }
  const hasBlindSpot = confidence.blindSpots.length > 0;

  const last7dLoadTotal = activities7.reduce((s, a) => s + (a._primeLoad || 0), 0);
  const hardExposures7d = activities7.filter((a) => a._hard).length;
  const largestLoad7d = activities7.length ? Math.max(...activities7.map((a) => a._primeLoad || 0)) : null;

  const hrvToday = todayLog && todayLog.metrics && todayLog.metrics.hrv != null ? Number(todayLog.metrics.hrv) : null;
  const rhrToday = todayLog && todayLog.metrics && todayLog.metrics.rhr != null ? Number(todayLog.metrics.rhr) : null;
  const hrvBaseline = stats.hrv_baseline_28d != null ? Number(stats.hrv_baseline_28d) : null;
  const rhrBaseline = stats.rhr_baseline_28d != null ? Number(stats.rhr_baseline_28d) : null;
  const recoveryPct = hrvBaseline != null && hrvBaseline > 0 && hrvToday != null ? Math.round((hrvToday / hrvBaseline) * 1000) / 10 : null;
  const rhrDelta = rhrBaseline != null && rhrToday != null ? Math.round((rhrToday - rhrBaseline) * 10) / 10 : null;

  const internalCost = buildInternalCost(recoveryPct, rhrDelta, band, hardExposures7d, confidence.blindSpots);
  if (internalCost == null) {
    confidence.blindSpots.push('InternalCost niet berekend (ontbrekende data).');
  }

  const todayDirective = buildTodayDirective(tag, todayLog, confidence.blindSpots);
  if (!todayDirective.detailsMarkdown && todayLog) {
    todayDirective.detailsMarkdown = 'Open dagrapport voor volledig advies.';
  }
  const next48h = buildNext48h(tag);
  const intake = buildIntake(profile);

  // next48h is always present (required); deterministic from status.tag
  const brief = {
    generatedAt,
    status: {
      tag,
      signal,
      oneLiner,
      hasBlindSpot
    },
    confidence: {
      grade: confidence.grade,
      blindSpots: confidence.blindSpots
    },
    todayDirective: {
      doToday: todayDirective.doToday,
      why: todayDirective.why,
      stopRule: todayDirective.stopRule,
      ...(todayDirective.detailsMarkdown ? { detailsMarkdown: todayDirective.detailsMarkdown } : {})
    },
    inputs: {
      acwr: acwrVal != null ? { value: acwrVal, band } : null,
      recovery: (recoveryPct != null || rhrDelta != null) ? { hrvVs28dPct: recoveryPct, rhrDelta } : null,
      cycle: {
        mode,
        confidence: cycleConf,
        phase,
        phaseDay,
        shiftInferred: false
      },
      activity: {
        last7dLoadTotal: Math.round(last7dLoadTotal * 10) / 10,
        hardExposures7d,
        largestLoad7d: largestLoad7d != null ? Math.round(largestLoad7d * 10) / 10 : null
      }
    },
    compliance,
    next48h,
    intake,
    internalCost
  };

  return brief;
}

module.exports = { getDailyBrief };
