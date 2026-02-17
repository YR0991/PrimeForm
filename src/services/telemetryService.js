import { api } from './httpClient.js'

/**
 * Recompute and persist aggregated stats (readiness, RHR, acute/chronic load, ACWR) on the user document.
 * Call after saveCheckIn or saveWorkout so the coach dashboard shows up-to-date telemetry.
 * @param {string} userId - Firebase UID
 * @returns {Promise<{ stats }>}
 */
export async function updateUserStats(userId) {
  if (!userId) return
  const res = await api.post('/api/update-user-stats', { userId })
  return res?.data ?? res
}
