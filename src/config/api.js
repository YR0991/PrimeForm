// API base URL configuration
// Set VITE_API_URL in Vercel dashboard to your Render backend URL
// Example: https://primeform-backend.onrender.com
const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export const API_BASE_URL = apiBase
