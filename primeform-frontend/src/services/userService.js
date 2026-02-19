/**
 * User Service — Deep dive for Coach modal (mock until API exists);
 * getAthleteDashboard — fetches dashboard data for UserDashboard.vue
 */

import { api } from './httpClient.js'

/**
 * Normaliseert cyclusfase en dag uit diverse mogelijke velden in het dashboard-payload.
 * Geeft altijd dezelfde vorm terug:
 * - phase: genormaliseerde fase-key (NL label, bv. 'Menstruatie', 'Folliculair', 'Ovulatie', 'Luteaal')
 * - phaseLabel: label in het Nederlands voor UI
 * - cycleDay: dagnummer als getal (of null als onbekend)
 */
export function normalizeCycle(payload = {}) {
  const phaseSources = [
    payload.phase,
    payload.current_phase,
    payload.cyclePhase,
    payload.cycleData?.currentPhase,
    payload.profile?.cycleData?.currentPhase,
  ]

  const daySources = [
    payload.phaseDay,
    payload.current_phase_day,
    payload.cycleDay,
    payload.cycleData?.cycleDay,
    payload.profile?.cycleData?.cycleDay,
  ]

  const rawPhase = phaseSources.find((v) => v != null && v !== '')
  const rawDay = daySources.find((v) => v != null && v !== '')

  let cycleDay = null
  if (rawDay != null && rawDay !== '') {
    const n = Number(rawDay)
    cycleDay = Number.isFinite(n) && n > 0 ? n : null
  }

  let phaseLabel = null
  if (rawPhase != null && rawPhase !== '') {
    const s = String(rawPhase).toLowerCase()

    if (s.includes('menstr')) {
      phaseLabel = 'Menstruatie'
    } else if (s.includes('follic')) {
      phaseLabel = 'Folliculair'
    } else if (s.includes('ovu')) {
      phaseLabel = 'Ovulatie'
    } else if (s.includes('lut')) {
      phaseLabel = 'Luteaal'
    } else if (s === 'menstruatie') {
      phaseLabel = 'Menstruatie'
    } else if (s === 'folliculair') {
      phaseLabel = 'Folliculair'
    } else if (s === 'ovulatie') {
      phaseLabel = 'Ovulatie'
    } else if (s === 'luteaal') {
      phaseLabel = 'Luteaal'
    } else if (s === 'unknown' || s === 'onbekend') {
      // Behandel expliciet als "geen cyclus ingesteld"
      phaseLabel = null
    } else {
      // Laat andere custom strings door
      phaseLabel = String(rawPhase)
    }
  }

  return {
    phase: phaseLabel,
    phaseLabel,
    cycleDay,
  }
}

/**
 * Get date string YYYY-MM-DD from an activity (dayKey, _dateStr, date, or start_date).
 */
function activityDayKey(activity) {
  const raw =
    activity.dayKey ??
    activity._dateStr ??
    activity.date ??
    activity.start_date_local ??
    activity.start_date ??
    activity.start
  if (typeof raw === 'string' && raw.length >= 10) return raw.slice(0, 10)
  if (typeof raw === 'number') return new Date(raw).toISOString().slice(0, 10)
  if (raw && typeof raw.toISOString === 'function') return raw.toISOString().slice(0, 10)
  return null
}

/**
 * Last 7 calendar days (todayStr backwards). Returns Set of 'YYYY-MM-DD'.
 */
function last7DayKeys(todayStr) {
  const set = new Set()
  const d = todayStr ? new Date(todayStr) : new Date()
  if (isNaN(d.getTime())) return set
  for (let i = 0; i < 7; i++) {
    const x = new Date(d)
    x.setDate(x.getDate() - i)
    set.add(x.toISOString().slice(0, 10))
  }
  return set
}

/**
 * Compute trainingVolume7d (sum loadUsed) and primeLoad7d (sum primeLoad/_primeLoad/loadUsed)
 * from recent_activities for last 7 days, includeInAcwr only.
 * Exported for use in UserDashboard loadDashboard.
 */
export function compute7dFromActivities(recentActivities, todayStr) {
  const list = Array.isArray(recentActivities) ? recentActivities : []
  const includeInAcwr = (a) => a && a.includeInAcwr !== false
  const sevenDays = last7DayKeys(todayStr || new Date().toISOString().slice(0, 10))
  let volume = 0
  let prime = 0
  for (const a of list) {
    if (!includeInAcwr(a)) continue
    const key = activityDayKey(a)
    if (!key || !sevenDays.has(key)) continue
    const loadUsed = Number(a.loadUsed)
    const primeLoad = Number(a.primeLoad ?? a._primeLoad ?? a.loadUsed ?? a.load ?? 0)
    if (Number.isFinite(loadUsed)) volume += loadUsed
    if (Number.isFinite(primeLoad)) prime += primeLoad
  }
  return { trainingVolume7d: volume, primeLoad7d: prime }
}

/**
 * Fetches athlete dashboard data from /api/dashboard.
 * Used by UserDashboard.vue for initial load (userId kept for API compatibility; backend uses auth token).
 * Contract: { success, data: { acwr, readiness_today, todayLog, recent_activities, cycleContext, ... } }
 */
export async function getAthleteDashboard(/* userId */) {
  const res = await api.get('/api/dashboard')
  const payload = res.data?.data ?? res.data ?? {}
  const ctx = payload.cycleContext ?? null
  const acwr = payload.acwr
  const readiness = payload.readiness_today ?? payload.readiness
  const acwrStatus =
    acwr != null
      ? acwr > 1.5
        ? 'spike'
        : acwr > 1.3
          ? 'overreaching'
          : acwr < 0.8
            ? 'undertraining'
            : 'sweet'
      : null

  const todayStr = new Date().toISOString().slice(0, 10)
  let trainingVolume7d =
    payload.trainingVolume7d ??
    payload.training_volume_7d ??
    payload.trainingLoad7d ??
    undefined
  let primeLoad7d =
    payload.primeLoad7d ?? payload.primeLoad_7d ?? undefined
  if (
    trainingVolume7d == null ||
    primeLoad7d == null ||
    !Number.isFinite(Number(trainingVolume7d)) ||
    !Number.isFinite(Number(primeLoad7d))
  ) {
    const computed = compute7dFromActivities(payload.activitiesLast7Days ?? payload.recent_activities ?? [], todayStr)
    if (trainingVolume7d == null || !Number.isFinite(Number(trainingVolume7d))) {
      trainingVolume7d = computed.trainingVolume7d
    }
    if (primeLoad7d == null || !Number.isFinite(Number(primeLoad7d))) {
      primeLoad7d = computed.primeLoad7d
    }
  }

  const out = {}
  if (readiness != null) out.readiness = readiness
  if (payload.readiness_today != null) out.readiness_today = payload.readiness_today
  out.cycleContext = ctx
  if (payload.todayLog != null) out.todayLog = payload.todayLog
  if (payload.lastCheckin != null) out.lastCheckinDate = payload.lastCheckin
  if (payload.last_checkin != null) out.lastCheckinDate = out.lastCheckinDate ?? payload.last_checkin
  if (payload.lastDailyLogDate != null) out.lastCheckinDate = out.lastCheckinDate ?? payload.lastDailyLogDate
  // Header: alleen fase/dag tonen bij HIGH confidence en phaseName != null; profile.lastPeriodDate negeren
  if (ctx?.confidence === 'HIGH' && ctx?.phaseName != null && String(ctx.phaseName).trim() !== '') {
    const phaseLabel = ctx.phaseLabelNL ?? ctx.phaseName ?? ''
    const cycleDay = ctx.phaseDay != null && Number.isFinite(Number(ctx.phaseDay)) && Number(ctx.phaseDay) > 0
      ? Number(ctx.phaseDay)
      : null
    out.cyclePhase = phaseLabel
    out.cycle = { phase: phaseLabel, phaseLabel, cycleDay }
    if (cycleDay != null) out.cycleDay = cycleDay
  }
  if (acwr != null) out.acwr = acwr
  if (acwrStatus != null) out.acwrStatus = acwrStatus
  if (trainingVolume7d != null && Number.isFinite(Number(trainingVolume7d))) out.trainingVolume7d = Number(trainingVolume7d)
  if (primeLoad7d != null && Number.isFinite(Number(primeLoad7d))) out.primeLoad7d = Number(primeLoad7d)
  return out
}

export async function getAthleteDeepDive(athleteId) {
  await new Promise((r) => setTimeout(r, 250))
  return {
    id: athleteId,
    name: '—',
    cyclePhase: '—',
    cycleDay: 0,
    acwr: 0,
    acwrStatus: 'sweet',
    primeLoad7d: 0,
    readiness: 0,
    activities: []
  }
}
