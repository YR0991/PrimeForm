/**
 * Coach Service — API client for Coach Dashboard (Squadron View)
 * Uses api (Bearer token) and coach email from authStore.
 */

import { api } from './httpClient.js'

/**
 * Get squadron data for coach dashboard.
 * @param {string} coachEmail - Coach email (use authStore.user.email)
 * @returns {Promise<Array>} Squadron rows: id, name, avatar, level, cyclePhase, cycleDay, acwr, acwrStatus, compliance, lastActivity
 */
export async function getCoachSquad(coachEmail) {
  if (!coachEmail || !String(coachEmail).trim()) {
    throw new Error('Coach email not found. Log in as coach.')
  }

  const res = await api.get('/api/coach/squadron', {
    headers: {
      'x-coach-email': String(coachEmail).trim(),
    },
  })

  const data = res.data?.data ?? []

  return data.map((row) => ({
    id: row.id,
    name: row.name || 'Onbekend',
    avatar: row.avatar || null,
    level: row.level || 'rookie',
    cyclePhase: row.cyclePhase || 'Unknown',
    cycleDay: row.cycleDay ?? 0,
    acwr: Number(row.acwr) || 0,
    acwrStatus: row.acwrStatus || 'sweet',
    compliance: Boolean(row.compliance),
    lastActivity: row.lastActivity
      ? {
          time: row.lastActivity.time || '',
          type: row.lastActivity.type || 'Workout',
          date: row.lastActivity.date || ''
        }
      : null
  }))
}
