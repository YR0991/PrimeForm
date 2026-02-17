/**
 * User Service — Deep dive for Coach modal (mock until API exists);
 * getAthleteDashboard — fetches dashboard data for UserDashboard.vue
 */

import { api } from './httpClient.js'

/**
 * Fetches athlete dashboard data from /api/dashboard.
 * Used by UserDashboard.vue for initial load (userId kept for API compatibility; backend uses auth token).
 */
export async function getAthleteDashboard(/* userId */) {
  const res = await api.get('/api/dashboard')
  const payload = res.data?.data ?? res.data ?? {}
  const acwr = payload.acwr
  const readiness = payload.readiness_today ?? payload.readiness
  const cyclePhase = payload.phase ?? payload.current_phase
  const cycleDay = payload.phaseDay ?? payload.current_phase_day
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
  if (cyclePhase != null) out.cyclePhase = cyclePhase
  if (cycleDay != null) out.cycleDay = cycleDay
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
