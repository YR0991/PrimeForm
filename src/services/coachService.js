/**
 * Coach Service — API client for Coach Dashboard (Squadron View)
 */

import axios from 'axios'
import { API_URL } from '../config/api.js'
import { useAuthStore } from '../stores/auth.js'

/**
 * Get squadron data for coach dashboard.
 * Requires admin/coach email in localStorage (same as admin routes).
 */
export async function getCoachSquad() {
  const coachEmail = localStorage.getItem('admin_email')
  if (!coachEmail) {
    throw new Error('Coach email not found. Log in via Admin first.')
  }

  const res = await fetch(`${API_URL}/api/coach/squadron`, {
    headers: {
      'x-admin-email': coachEmail,
      'Content-Type': 'application/json'
    }
  })

  if (!res.ok) {
    if (res.status === 403) {
      localStorage.removeItem('admin_email')
      throw new Error('Unauthorized: Coach access required')
    }
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || err.message || `Request failed: ${res.status}`)
  }

  const json = await res.json()
  const data = json.data || []

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
    readiness:
      row.readiness != null && Number.isFinite(Number(row.readiness))
        ? Number(row.readiness)
        : null,
    lastActivity: row.lastActivity
      ? {
          time: row.lastActivity.time || '',
          type: row.lastActivity.type || 'Workout',
          date: row.lastActivity.date || ''
        }
      : null
  }))
}

/**
 * Get first available email: localStorage (admin_email, coach_email, user_email) or auth store.
 */
function getEmailForRequest() {
  const fromStorage =
    (localStorage.getItem('admin_email') || '').trim() ||
    (localStorage.getItem('coach_email') || '').trim() ||
    (localStorage.getItem('user_email') || '').trim()
  if (fromStorage) return fromStorage

  const authStore = useAuthStore()
  return (authStore.user?.email || '').trim()
}

/**
 * Generate AI weekly report for an athlete.
 * Uses any available email: admin_email, coach_email, user_email (localStorage) or auth store.
 * @param {string} athleteId - Firestore user document ID
 * @returns {Promise<{ stats: string, message: string }>}
 */
export async function fetchWeekReport(athleteId) {
  const email = getEmailForRequest()

  if (!email) {
    throw new Error('Coach email not found. Log in via Admin first.')
  }

  try {
    const res = await axios.post(
      `${API_URL}/api/ai/week-report`,
      { athleteId },
      {
        headers: {
          'x-admin-email': email,
        },
      }
    )
    return res.data
  } catch (err) {
    if (err.response?.status === 403) {
      localStorage.removeItem('admin_email')
      localStorage.removeItem('coach_email')
      localStorage.removeItem('user_email')
      throw new Error('Unauthorized: Admin or Coach access required')
    }
    const msg = err.response?.data?.error || err.response?.data?.message || err.message
    throw new Error(msg || 'Request failed')
  }
}
