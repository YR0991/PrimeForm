/**
 * User Service - Data layer for athlete/coach dashboards
 * Structure designed for easy swap from mock to real API.
 * TODO: Replace mock functions with API calls when backend endpoints are ready.
 */

import { API_URL } from '../config/api.js'

// ---------------------------------------------------------------------------
// MOCK DATA (replace with API calls)
// ---------------------------------------------------------------------------

const CYCLE_PHASES = {
  follicular: 'Follicular Phase',
  ovulation: 'Ovulation',
  luteal: 'Luteal Phase',
  menstrual: 'Menstrual Phase',
}

/**
 * Get current user dashboard data (The Pilot)
 * @param {string} userId
 * @returns {Promise<Object>}
 */
export async function getAthleteDashboard(userId) {
  // TODO: const res = await fetch(`${API_URL}/api/athlete/dashboard?userId=${encodeURIComponent(userId)}`)
  // return (await res.json()).data
  void userId // reserved for API call

  await simulateDelay(300)

  return {
    greeting: getGreeting(),
    cyclePhase: CYCLE_PHASES.luteal,
    cycleDay: 22,
    cycleEmoji: '🩸',
    readiness: 7,
    dailyAdvice: 'MAINTAIN', // REST | RECOVER | MAINTAIN | PUSH
    primeLoad7d: 342,
    acwr: 1.15,
    acwrStatus: 'sweet', // sweet | undertraining | overreaching | spike
    lastCheckInDone: false,
    lastActivities: [
      { date: '2025-02-07', type: 'Run', duration: 45, load: 78 },
      { date: '2025-02-05', type: 'Strength', duration: 60, load: 92 },
      { date: '2025-02-03', type: 'Cycling', duration: 90, load: 145 },
    ],
  }
}

/**
 * Get squad overview for coach (Squadron View)
 * @returns {Promise<Array>}
 */
export async function getCoachSquad() {
  // TODO: const res = await fetch(`${API_URL}/api/coach/squad`, { headers: { Authorization: ... } })
  // return (await res.json()).data

  await simulateDelay(400)

  return [
    {
      id: 'pf_001',
      name: 'Emma van der Berg',
      avatar: null,
      level: 'elite',
      cyclePhase: 'Luteal',
      cycleDay: 22,
      acwr: 1.52,
      acwrStatus: 'spike',
      compliance: true,
      lastActivity: { time: '09:45', type: 'Run', date: '2025-02-08' },
    },
    {
      id: 'pf_002',
      name: 'Sophie Jansen',
      avatar: null,
      level: 'active',
      cyclePhase: 'Follicular',
      cycleDay: 8,
      acwr: 0.95,
      acwrStatus: 'sweet',
      compliance: true,
      lastActivity: { time: '08:20', type: 'Strength', date: '2025-02-08' },
    },
    {
      id: 'pf_003',
      name: 'Lotte de Vries',
      avatar: null,
      level: 'rookie',
      cyclePhase: 'Menstrual',
      cycleDay: 3,
      acwr: 0.72,
      acwrStatus: 'undertraining',
      compliance: false,
      lastActivity: { time: '18:30', type: 'Yoga', date: '2025-02-06' },
    },
    {
      id: 'pf_004',
      name: 'Iris Bakker',
      avatar: null,
      level: 'elite',
      cyclePhase: 'Luteal',
      cycleDay: 18,
      acwr: 1.28,
      acwrStatus: 'overreaching',
      compliance: false,
      lastActivity: null,
    },
  ]
}

/**
 * Get deep-dive data for a single athlete (Coach modal)
 * @param {string} athleteId
 * @returns {Promise<Object>}
 */
export async function getAthleteDeepDive(athleteId) {
  // TODO: API call
  await simulateDelay(250)

  return {
    id: athleteId,
    name: 'Emma van der Berg',
    cyclePhase: 'Luteal',
    cycleDay: 22,
    acwr: 1.52,
    primeLoad7d: 412,
    primeLoad28d: 361,
    readiness: 6,
    lastCheckIn: '2025-02-08T08:30:00',
    activities: [
      { date: '2025-02-08', type: 'Run', load: 98, rawLoad: 93 },
      { date: '2025-02-06', type: 'Strength', load: 85, rawLoad: 85 },
      { date: '2025-02-04', type: 'Cycling', load: 142, rawLoad: 135 },
    ],
  }
}

/**
 * Get admin system health
 */
export async function getSystemHealth() {
  // TODO: const res = await fetch(`${API_URL}/api/admin/health`)
  await simulateDelay(200)

  return {
    totalUsers: 24,
    stravaApiCallsToday: 156,
    stravaRateLimit: 200,
    errorLogs: [
      { time: '14:32', message: 'Strava token refresh failed: pf_012' },
      { time: '13:15', message: 'Webhook timeout: activity sync' },
      { time: '11:02', message: 'Invalid HRV value in check-in: pf_007' },
      { time: '09:45', message: 'Profile fetch 404: pf_099' },
      { time: '08:20', message: 'Rate limit warning: 180/200' },
    ],
  }
}

/**
 * Generate weekly report for algorithm verification (Admin Lab)
 * @param {string} uid
 * @returns {Promise<Object>}
 */
export async function getWeeklyReportForUser(uid) {
  try {
    const res = await fetch(
      `${API_URL}/api/admin/weekly-report?uid=${encodeURIComponent(uid)}`,
      {
        headers: {
          'x-admin-email': localStorage.getItem('admin_email') || '',
        },
      }
    )
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || res.statusText)
    }
    const data = await res.json()
    return data.data
  } catch (e) {
    // Fallback mock when endpoint not yet implemented
    if (e.message?.includes('fetch')) {
      return getMockWeeklyReport(uid)
    }
    throw e
  }
}

function getMockWeeklyReport(uid) {
  return {
    uid,
    generatedAt: new Date().toISOString(),
    raw: {
      acuteLoad: 320,
      chronicLoad: 290,
      acwr: 1.10,
      stravaRawLoad7d: 305,
      primeLoad7d: 320,
      activities: [
        { date: '2025-02-08', type: 'Run', sufferScore: 62, primeLoad: 68 },
        { date: '2025-02-06', type: 'Strength', sufferScore: 45, primeLoad: 45 },
      ],
    },
    stravaVsPrime: [
      { date: '2025-02-08', stravaRaw: 62, primeLoad: 68, multiplier: 1.097 },
      { date: '2025-02-06', stravaRaw: 45, primeLoad: 45, multiplier: 1.0 },
    ],
  }
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Goedemorgen'
  if (h < 18) return 'Goedemiddag'
  return 'Goedenavond'
}

function simulateDelay(ms) {
  return new Promise((r) => setTimeout(r, ms))
}
