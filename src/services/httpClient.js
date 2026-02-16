import axios from 'axios'
import { signOut } from 'firebase/auth'
import { API_URL } from '../config/api.js'
import { auth } from '../boot/firebase.js'

/**
 * HTTP client for /api/* calls. Injects Authorization: Bearer <idToken> from Firebase currentUser.
 */
export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
})

api.interceptors.request.use(
  async (config) => {
    const user = auth.currentUser
    if (user) {
      try {
        const token = await user.getIdToken(false)
        if (token) {
          config.headers = config.headers || {}
          config.headers.Authorization = `Bearer ${token}`
        }
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn('[httpClient] getIdToken failed:', e?.message)
        }
      }
    }
    return config
  },
  (error) => Promise.reject(error),
)

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status
    if (status === 401) {
      await signOut(auth)
      if (typeof window !== 'undefined' && window.location) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)
