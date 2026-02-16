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
 * Get user check-in history.
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of check-in logs
 */
export async function getUserHistory(userId) {
  const res = await api.get('/api/history', { params: { userId } })
  return res.data?.data ?? []
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
