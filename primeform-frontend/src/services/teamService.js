import axios from 'axios'
import { API_URL } from '../config/api.js'

/**
 * Verify team invite code (public, no auth).
 * GET /api/teams/verify-invite?code=XXXX
 * @param {string} code - Team invite code
 * @returns {Promise<{ id: string, name?: string, ... }>}
 */
export async function verifyTeamInvite(code) {
  const raw = (code || '').toString().trim()
  if (!raw) {
    throw new Error('Vul een teamcode in.')
  }
  const res = await axios.get(`${API_URL}/api/teams/verify-invite`, {
    params: { code: raw },
    withCredentials: true,
  })
  return res.data?.data ?? res.data
}
