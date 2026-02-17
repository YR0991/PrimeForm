import { defineStore } from 'pinia'
import { api } from '../services/httpClient.js'

/** Minimal dashboard store for admin "Bekijk als atleet" and AtleetDetailDialog. */
export const useDashboardStore = defineStore('dashboard', {
  state: () => ({
    telemetry: null,
    loading: false,
    syncing: false,
  }),

  actions: {
    /** Fetch dashboard data for current user (or impersonated). No-op if not needed. */
    async fetchUserDashboard() {
      this.loading = true
      try {
        const res = await api.get('/api/dashboard')
        this.telemetry = res.data?.data ?? null
      } catch {
        this.telemetry = null
      } finally {
        this.loading = false
      }
    },
  },
})
