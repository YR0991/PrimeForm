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
 * Fetches athlete dashboard data from /api/dashboard.
 * Used by UserDashboard.vue for initial load (userId kept for API compatibility; backend uses auth token).
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
  const primeLoad7d = payload.recent_activities?.reduce(
    (s, a) => s + (a.loadUsed ?? a._primeLoad ?? 0),
    0
  )
  const out = {}
  if (readiness != null) out.readiness = readiness
  out.cycleContext = ctx
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
  if (primeLoad7d != null) out.primeLoad7d = primeLoad7d
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
