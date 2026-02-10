import { API_URL } from '../config/api.js'

/**
 * Recompute and persist aggregated stats (readiness, RHR, acute/chronic load, ACWR) on the user document.
 * Call after saveCheckIn or saveWorkout so the coach dashboard shows up-to-date telemetry.
 * @param {string} userId - Firebase UID
 * @returns {Promise<{ stats }>}
 */
export async function updateUserStats(userId) {
  if (!userId) return
  const res = await fetch(`${API_URL}/api/update-user-stats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
    credentials: 'include',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error || err?.message || 'Failed to update user stats')
  }
  return res.json()
}
