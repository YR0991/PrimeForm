// API base URL configuration
// Set VITE_API_URL in Vercel dashboard to your Render backend URL
// Example: https://primeform-backend.onrender.com

// In production, use VITE_API_URL if set, otherwise use Render backend
// In development, fallback to localhost
const getApiUrl = () => {
  // Priority 1: Explicitly set VITE_API_URL
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  
  // Priority 2: Production fallback (if we're in production but VITE_API_URL not set)
  if (import.meta.env.PROD) {
    console.warn('⚠️ VITE_API_URL not set in production! Using Render backend fallback.')
    return 'https://primeform-backend.onrender.com'
  }
  
  // Development: use localhost
  return 'http://localhost:3000'
}

const API_URL = getApiUrl()

// Log the API URL in development for debugging
if (import.meta.env.DEV) {
  console.log('🔗 API_URL:', API_URL)
}

export { API_URL }
export const API_BASE_URL = API_URL // Keep for backwards compatibility
