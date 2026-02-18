import axios from 'axios'
import { API_URL } from '../config/api.js'
import { auth } from '../boot/firebase.js'

function mapInviteError(error) {
  const status = error?.response?.status
  const data = error?.response?.data || {}
  const code = data.code || data.errorCode || data.reason || null

  if (status === 404 || code === 'INVITE_INVALID') {
    throw new Error('Deze uitnodigingscode is ongeldig of niet gevonden.')
  }
  if (code === 'INVITE_EXPIRED') {
    throw new Error('Deze uitnodiging is verlopen.')
  }
  if (code === 'INVITE_ALREADY_USED') {
    throw new Error('Deze uitnodiging is al gebruikt.')
  }
  if (code === 'INVITE_TEAM_ALREADY_SET') {
    throw new Error('Je bent al gekoppeld aan een team voor deze uitnodiging.')
  }

  const fallback =
    data.error ||
    data.message ||
    error.message ||
    'Er ging iets mis bij het verwerken van de uitnodiging.'
  throw new Error(fallback)
}

export async function resolveInvite(code) {
  const normalized = (code || '').toString().trim()
  if (!normalized) {
    throw new Error('Geen teamcode opgegeven.')
  }

  try {
    const res = await axios.post(`${API_URL}/api/invites/resolve`, { code: normalized }, { withCredentials: true })
    return res.data?.data ?? res.data
  } catch (err) {
    mapInviteError(err)
  }
}

export async function claimInvite(code) {
  const normalized = (code || '').toString().trim()
  if (!normalized) {
    throw new Error('Geen teamcode opgegeven.')
  }

  const user = auth.currentUser
  if (!user) {
    throw new Error('Je moet eerst inloggen om deze uitnodiging te claimen.')
  }

  try {
    const token = await user.getIdToken(false)
    const res = await axios.post(
      `${API_URL}/api/invites/claim`,
      { code: normalized },
      {
        withCredentials: true,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    )
    return res.data?.data ?? res.data
  } catch (err) {
    mapInviteError(err)
  }
}

