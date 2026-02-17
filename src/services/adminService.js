// Admin Service — uses api (Bearer token) from httpClient
import { api } from './httpClient.js'

/**
 * Fetch all users (admin only). Uses Firebase Bearer token via api.
 * @returns {Promise<Array>} Array of user documents
 */
export async function fetchAllUsers() {
  const res = await api.get('/api/admin/users')
  const data = res.data?.data
  return Array.isArray(data) ? data : []
}

/**
 * Get user details including intake data. Uses api (Bearer token).
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} User profile with intake data
 */
export async function getUserDetails(userId) {
  const res = await api.get('/api/profile', { params: { userId } })
  return res.data?.data?.profile ?? null
}

/**
 * Fetch admin dashboard stats (totalMembers, newThisWeek, checkinsToday).
 * @returns {Promise<{ totalMembers: number, newThisWeek: number, checkinsToday: number }>}
 */
export async function fetchAdminStats() {
  const res = await api.get('/api/admin/stats')
  const data = res.data?.data ?? {}
  return {
    totalMembers: Number(data.totalMembers) || 0,
    newThisWeek: Number(data.newThisWeek) || 0,
    checkinsToday: Number(data.checkinsToday) || 0,
  }
}

/**
 * Calculate statistics from users array (fallback when stats API not used).
 * @param {Array} users - Array of user documents
 * @returns {Object} Statistics object
 */
export function calculateStats(users) {
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const newThisWeek = (users || []).filter((user) => {
    const createdAt = user.createdAt?.toDate ? user.createdAt.toDate() : new Date(user.createdAt)
    return createdAt >= weekAgo
  }).length

  return {
    totalMembers: (users || []).length,
    newThisWeek,
    checkinsToday: 0,
  }
}

/**
 * Import historical HRV/RHR data for a user.
 * @param {string} userId - User ID
 * @param {Array} entries - Array of {date, hrv, rhr} objects
 * @returns {Promise<Object>} Import result
 */
export async function importHistory(userId, entries) {
  const res = await api.post('/api/admin/import-history', {
    userId,
    entries,
  })
  return res.data?.data
}

/**
 * Update user profile (e.g. role) — admin only. Uses PUT /api/admin/profile-patch.
 * @param {string} userId - User ID
 * @param {Object} profilePatch - e.g. { role: 'user'|'coach'|'admin', teamId?, ... }
 * @returns {Promise<Object>}
 */
export async function updateUserProfile(userId, profilePatch) {
  const res = await api.put('/api/admin/profile-patch', {
    userId,
    profilePatch,
  })
  return res.data?.data
}

/**
 * Fetch all teams (admin only).
 * @returns {Promise<Array>}
 */
export async function fetchAllTeams() {
  const res = await api.get('/api/admin/teams')
  const data = res.data?.data
  return Array.isArray(data) ? data : []
}

/**
 * Create a team (admin only). Backend generates inviteCode.
 * @param {{ name: string, coachEmail?: string, memberLimit?: number }} payload
 * @returns {Promise<{ id: string }>}
 */
export async function createTeam(payload) {
  const res = await api.post('/api/admin/teams', payload)
  const data = res.data?.data || {}
  return { id: data.id }
}

/**
 * Assign user to team (admin only). PATCH /api/admin/users/:id.
 * @param {string} userId
 * @param {string|null} teamId
 * @returns {Promise<Object>}
 */
export async function assignUserToTeam(userId, teamId) {
  const res = await api.patch(`/api/admin/users/${encodeURIComponent(userId)}`, {
    teamId: teamId ?? null,
  })
  return res.data?.data || {}
}

/**
 * Rename a team (admin only). PATCH /api/admin/teams/:id
 * @param {string} teamId
 * @param {string} name
 */
export async function renameTeam(teamId, name) {
  const res = await api.patch(`/api/admin/teams/${encodeURIComponent(teamId)}`, { name })
  return res.data?.data || {}
}

/**
 * Delete a team (admin only). Backend should set users' teamId to null.
 * @param {string} teamId
 */
export async function deleteTeam(teamId) {
  const res = await api.delete(`/api/admin/teams/${encodeURIComponent(teamId)}`)
  return res.data?.data || {}
}

/**
 * Delete a user (Auth + Firestore) — admin only. Requires body.confirm === true.
 * @param {string} uid - User ID
 * @returns {Promise<Object>}
 */
export async function deleteUser(uid) {
  const res = await api.delete(`/api/admin/users/${encodeURIComponent(uid)}`, {
    data: { confirm: true },
  })
  return res.data?.data
}

/**
 * Get user check-in history (admin). GET /api/admin/users/:uid/history.
 * @param {string} userId - User ID
 * @returns {Promise<Array>}
 */
export async function getUserHistoryAdmin(userId) {
  const res = await api.get(`/api/admin/users/${encodeURIComponent(userId)}/history`)
  const data = res.data?.data
  return Array.isArray(data) ? data : []
}

/** Alias for AtleetDetailDialog / admin views. */
export const getUserHistory = getUserHistoryAdmin

/**
 * Get debug timeline for a user. GET /api/admin/users/:uid/debug-history?days=...
 * @param {string} uid - User ID
 * @param {number} [days=14]
 * @returns {Promise<{ profile: object, days: Array }>}
 */
export async function getDebugHistory(uid, days = 14) {
  const res = await api.get(`/api/admin/users/${encodeURIComponent(uid)}/debug-history`, {
    params: { days: [7, 14, 28, 56].includes(Number(days)) ? Number(days) : 14 },
  })
  return res.data?.data ?? { profile: null, days: [] }
}

/**
 * Get Strava connection + sync status. GET /api/admin/users/:uid/strava-status
 * @param {string} uid - User ID
 * @returns {Promise<Object>}
 */
export async function getStravaStatus(uid) {
  const res = await api.get(`/api/admin/users/${encodeURIComponent(uid)}/strava-status`)
  return res.data?.data ?? res.data ?? {}
}

/**
 * Force Strava sync for user. POST /api/admin/users/:uid/strava/sync-now
 * @param {string} uid - User ID
 * @returns {Promise<Object>}
 */
export async function syncUserStravaNow(uid) {
  const res = await api.post(`/api/admin/users/${encodeURIComponent(uid)}/strava/sync-now`)
  return res.data?.data ?? res.data ?? {}
}

/**
 * Delete activity (current user). DELETE /api/activities/:id
 * @param {string} activityId - Activity document id
 */
export async function deleteActivity(activityId) {
  const res = await api.delete(`/api/activities/${encodeURIComponent(activityId)}`)
  return res.data
}

/**
 * Admin delete activity for another user. DELETE /api/admin/users/:uid/activities/:id
 * @param {string} uid - User ID
 * @param {string} activityId - Activity document id
 */
export async function deleteUserActivity(uid, activityId) {
  const res = await api.delete(
    `/api/admin/users/${encodeURIComponent(uid)}/activities/${encodeURIComponent(activityId)}`
  )
  return res.data
}

/**
 * Recompute load stats from last 28d activities and save to users/{uid}.metrics.loadBalance.
 * POST /api/admin/users/:uid/recompute-stats
 * @param {string} uid - User ID
 * @returns {Promise<{ loadBalance: { sum7, sum28, acwr, acwrBand } }>}
 */
export async function recomputeStats(uid) {
  const res = await api.post(`/api/admin/users/${encodeURIComponent(uid)}/recompute-stats`)
  return res.data?.data ?? res.data ?? {}
}

/**
 * Inject historical HRV/RHR (Cold Start). POST /api/admin/users/:uid/history.
 * @param {string} uid - User ID
 * @param {Array<{date: string, hrv: number, rhr: number}>} entries
 * @returns {Promise<{ injected?: number, total?: number }>}
 */
export async function injectHistory(uid, entries) {
  const res = await api.post(`/api/admin/users/${encodeURIComponent(uid)}/history`, { entries })
  return res.data?.data || {}
}

/**
 * Baseline import (HRV/RHR). POST /api/admin/users/:uid/import-baseline.
 * @param {string} uid - User ID
 * @param {Array<{date: string, hrv: number, rhr: number}>} entries
 * @param {boolean} [overwrite=false]
 * @returns {Promise<{ success?: boolean, importedCount?: number, skippedCount?: number }>}
 */
export async function importBaseline(uid, entries, overwrite = false) {
  const res = await api.post(`/api/admin/users/${encodeURIComponent(uid)}/import-baseline`, {
    kind: 'HRV_RHR',
    entries,
    overwrite: !!overwrite,
  })
  return res.data?.data || res.data || {}
}

/**
 * Migrate data from one user to another. POST /api/admin/migrate-data.
 * @param {string} sourceUid
 * @param {string} targetUid
 * @returns {Promise<{ logsMoved?: number, activitiesMoved?: number }>}
 */
export async function migrateUserData(sourceUid, targetUid) {
  const res = await api.post('/api/admin/migrate-data', { sourceUid, targetUid })
  return res.data?.data || {}
}
