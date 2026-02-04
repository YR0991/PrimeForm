// API base URL: development → localhost, productie → env of fallback Render (nooit undefined)
const RENDER_BACKEND_URL = 'https://primeform-backend.onrender.com'
const raw = import.meta.env.DEV
  ? 'http://localhost:3000'
  : (import.meta.env.VITE_API_URL || RENDER_BACKEND_URL)
const API_URL = (raw || RENDER_BACKEND_URL).replace(/\/$/, '')

export { API_URL, RENDER_BACKEND_URL }
export const API_BASE_URL = API_URL
