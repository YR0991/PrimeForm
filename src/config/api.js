// API base URL: development → localhost, productie → hardcoded Render (geen trailing slash)
const RENDER_BACKEND_URL = 'https://primeform-backend.onrender.com'
const API_URL = import.meta.env.DEV
  ? 'http://localhost:3000'
  : RENDER_BACKEND_URL.replace(/\/$/, '')

export { API_URL, RENDER_BACKEND_URL }
export const API_BASE_URL = API_URL
