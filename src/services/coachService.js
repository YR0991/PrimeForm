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

  return data.map((row) => {
    const acwrVal = row.metrics?.loadBalance?.acwr ?? row.metrics?.acwr ?? row.acwr
    const numVal = acwrVal != null && Number.isFinite(Number(acwrVal)) ? Number(acwrVal) : null
    const loadBalance = numVal
    const loadBalanceStatus =
      numVal == null ? 'unknown' : numVal >= 0.8 && numVal <= 1.3 ? 'optimal' : 'outside'
    return {
      id: row.id,
      name: row.name || 'Onbekend',
      avatar: row.avatar || null,
      level: row.level || 'rookie',
      cyclePhase: row.cyclePhase || row.metrics?.cyclePhase || 'Unknown',
      cycleDay: row.cycleDay ?? row.metrics?.cycleDay ?? 0,
      acwr: numVal ?? 0,
      acwrStatus: row.acwrStatus || 'sweet',
      loadBalance,
      loadBalanceStatus,
      compliance: Boolean(row.compliance),
      lastActivity: row.lastActivity
        ? {
            time: row.lastActivity.time || '',
            type: row.lastActivity.type || 'Workout',
            date: row.lastActivity.date || ''
          }
        : null
    }
  })
}

/**
 * Get athlete detail for Coach Deep Dive (last 7 activities via API).
 * @param {string} athleteId - User document ID
 * @param {string} coachEmail - Coach email (use authStore.user.email)
 * @returns {Promise<{ id, profile, metrics, activities, ... }>}
 */
export async function getAthleteDetail(athleteId, coachEmail) {
  if (!athleteId || !coachEmail?.trim()) {
    throw new Error('Athlete id and coach email required')
  }
  const res = await api.get(`/api/coach/athletes/${encodeURIComponent(athleteId)}`, {
    headers: {
      'x-coach-email': String(coachEmail).trim()
    }
  })
  const data = res.data?.data
  if (!data) throw new Error('Invalid athlete detail response')
  // API returns activities; take last 7 for Deep Dive
  const activities = (data.activities || []).slice(0, 7)
  return {
    ...data,
    name: data.profile?.fullName || data.name || 'Onbekend',
    activities
  }
}
