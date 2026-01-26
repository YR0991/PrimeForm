// API base URL configuration
// Set VITE_API_URL in Vercel dashboard to your Render backend URL
// Example: https://primeform-backend.onrender.com
const getApiBaseUrl = () => {
  // Priority 1: Vite env var (set in Vercel dashboard Environment Variables)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  
  // Priority 2: Auto-detect production
  if (import.meta.env.PROD) {
    // Fallback: try common Render URL pattern
    // IMPORTANT: Set VITE_API_URL in Vercel to avoid this fallback
    console.warn('VITE_API_URL not set. Using fallback. Set VITE_API_URL in Vercel dashboard.')
    return 'https://primeform-backend.onrender.com'
  }
  
  // Development: use localhost
  return 'http://127.0.0.1:3000'
}

export const API_BASE_URL = getApiBaseUrl()
