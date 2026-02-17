import { defineStore } from 'pinia'
import { useAuthStore } from './auth'
import { getCoachSquad, getAthleteDetail } from '../services/coachService'
import { getLiveLoadMetrics } from '../services/adminService'

const TODAY_STR = () => new Date().toISOString().slice(0, 10)
const MS_PER_DAY = 86400000

function parseDate(val) {
  if (!val) return null
  if (typeof val === 'string') return val.slice(0, 10)
  if (typeof val?.toDate === 'function') return val.toDate().toISOString().slice(0, 10)
  if (val instanceof Date) return val.toISOString().slice(0, 10)
  if (typeof val === 'number') {
    const d = new Date(val)
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
  }
  return null
}

/**
 * Single source of truth: attention score + level + reasons for coach triage.
 * @param {Object} athlete - Row from athletesById (may include deepDive: history_logs, todayLog, stravaMeta)
 * @returns {{ score: number, level: 'ok'|'watch'|'act', reasons: string[] }}
 */
export function computeAttention(athlete) {
  const reasons = []
  let score = 0

  if (!athlete || typeof athlete !== 'object') {
    return { score: 0, level: 'ok', reasons: [] }
  }

  const today = TODAY_STR()

  // --- A) Compliance: daysSinceCheckin ---
  let lastCheckinDate = null
  const checkinCandidates = [
    athlete.lastCheckinDate,
    athlete.last_checkin_date,
    athlete.lastCheckin,
    athlete.last_checkin,
    athlete.lastCheckinAt,
    athlete.metrics?.lastCheckinDate,
    athlete.metrics?.last_checkin_date,
  ]
  for (const v of checkinCandidates) {
    const d = parseDate(v)
    if (d) {
      lastCheckinDate = d
      break
    }
  }
  if (!lastCheckinDate && athlete.metrics?.readiness_ts != null) {
    lastCheckinDate = parseDate(athlete.metrics.readiness_ts) || parseDate(athlete.readiness_ts)
  }
  const hasCheckinToday =
    (lastCheckinDate && lastCheckinDate === today) ||
    athlete.hasCheckinToday === true ||
    athlete.checkinToday === true ||
    athlete.todayCheckin === true ||
    (athlete.todayLog != null && typeof athlete.todayLog === 'object')
  const daysSinceCheckin = hasCheckinToday
    ? 0
    : lastCheckinDate
      ? Math.floor((Date.now() - new Date(lastCheckinDate).getTime()) / MS_PER_DAY)
      : null

  if (daysSinceCheckin != null) {
    if (daysSinceCheckin >= 4) {
      score += 4
      reasons.push('≥4 dagen geen check-in')
    } else if (daysSinceCheckin >= 2) {
      score += 2
      reasons.push('≥2 dagen geen check-in')
    }
  }

  // --- B) Load (Belastingbalans) ---
  const acwrRaw = athlete.metrics?.acwr ?? athlete.acwr
  const acwr = acwrRaw != null && Number.isFinite(Number(acwrRaw)) ? Number(acwrRaw) : null
  if (acwr != null && acwr >= 1.35) {
    score += 3
    reasons.push('Belastingbalans hoog (≥1.35)')
  }

  const logs = Array.isArray(athlete.history_logs) ? athlete.history_logs : []
  const sortedLogs = [...logs].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const lastTwoDays = sortedLogs.slice(0, 2).filter((l) => l.date && (l.hrv != null || l.rhr != null))

  const acwrDeltaDay =
    athlete.acwrDeltaDay != null && Number.isFinite(Number(athlete.acwrDeltaDay))
      ? Number(athlete.acwrDeltaDay)
      : null
  if (acwrDeltaDay != null && acwrDeltaDay >= 0.2) {
    score += 2
    reasons.push('Belastingbalans sprong (+0.20)')
  }

  // --- C) Physio deltas (only when we have 2 days from history_logs) ---
  let rhrDeltaDay = null
  let hrvDeltaPctDay = null
  if (lastTwoDays.length >= 2) {
    const d0 = lastTwoDays[0]
    const d1 = lastTwoDays[1]
    const rhr0 = d0.rhr != null && Number.isFinite(Number(d0.rhr)) ? Number(d0.rhr) : null
    const rhr1 = d1.rhr != null && Number.isFinite(Number(d1.rhr)) ? Number(d1.rhr) : null
    if (rhr0 != null && rhr1 != null) rhrDeltaDay = rhr0 - rhr1
    const hrv0 = d0.hrv != null && Number.isFinite(Number(d0.hrv)) ? Number(d0.hrv) : null
    const hrv1 = d1.hrv != null && Number.isFinite(Number(d1.hrv)) ? Number(d1.hrv) : null
    if (hrv0 != null && hrv1 != null && hrv1 !== 0) {
      hrvDeltaPctDay = ((hrv0 - hrv1) / hrv1) * 100
    }
  }
  if (rhrDeltaDay != null && rhrDeltaDay >= 6) {
    score += 2
    reasons.push('RHR stijging (+6 bpm)')
  }
  if (hrvDeltaPctDay != null && hrvDeltaPctDay <= -15) {
    score += 2
    reasons.push('HRV daling (≤ -15%)')
  }

  // --- D) Data quality ---
  const stravaMeta = athlete.stravaMeta ?? athlete.strava ?? athlete.metricsMeta?.strava ?? {}
  const connected = stravaMeta.connected === true
  const lastSyncRaw =
    stravaMeta.lastWebhookAt ?? stravaMeta.lastSyncedAt ?? stravaMeta.lastSyncAt ?? stravaMeta.lastSuccessAt
  const lastSyncTs =
    lastSyncRaw != null
      ? typeof lastSyncRaw === 'number'
        ? lastSyncRaw
        : typeof lastSyncRaw?.toMillis === 'function'
          ? lastSyncRaw.toMillis()
          : typeof lastSyncRaw?.toDate === 'function'
            ? lastSyncRaw.toDate().getTime()
            : new Date(lastSyncRaw).getTime()
      : null
  const syncStale = lastSyncTs != null && Date.now() - lastSyncTs > 48 * 3600 * 1000
  const stravaError = !!(stravaMeta.lastError ?? stravaMeta.error ?? athlete.stravaError ?? athlete.strava_error)
  const stravaNotUpToDate = !connected || syncStale || stravaError
  if (stravaNotUpToDate) {
    score += 2
    reasons.push('Strava niet up-to-date')
  }

  const todayHrv =
    athlete.todayLog?.hrv ??
    athlete.todayLog?.metrics?.hrv ??
    (logs.find((l) => (l.date || '').slice(0, 10) === today)?.hrv ?? null)
  const todayRhr =
    athlete.todayLog?.rhr ??
    athlete.todayLog?.metrics?.rhr ??
    (logs.find((l) => (l.date || '').slice(0, 10) === today)?.rhr ?? null)
  const missingHrvRhrToday = (todayHrv == null || todayRhr == null) && !hasCheckinToday
  if (missingHrvRhrToday) {
    score += 1
    reasons.push('Ontbrekende HRV/RHR vandaag')
  }

  score = Math.max(0, Math.min(10, score))
  const level = score <= 2 ? 'ok' : score <= 5 ? 'watch' : 'act'
  return { score, level, reasons }
}

/**
 * Squadron store — Backend-First. Storage only; no metric calculations.
 * State: athletesById (dict). Data stored exactly as the API sends.
 * Attention is computed on read via squadRows.
 */
export const useSquadronStore = defineStore('squadron', {
  state: () => ({
    athletesById: {},
    loading: false,
    error: null,
    selectedAtleetId: null,
    deepDiveLoading: false,
  }),

  getters: {
    /** List of athletes (for table). */
    squadronList(state) {
      return Object.values(state.athletesById)
    },

    /** Alias for table binding; each row gets attention computed on read. */
    squadRows(state) {
      return Object.values(state.athletesById).map((a) => ({
        ...a,
        attention: computeAttention(a),
      }))
    },

    squadronSize(state) {
      return Object.keys(state.athletesById).length
    },

    /** Count of athletes with stored acwr > 1.5 (read-only, no calculation). */
    atRiskCount(state) {
      return Object.values(state.athletesById).reduce((count, a) => {
        const acwr = a?.metrics?.acwr ?? a?.acwr ?? null
        const v = Number(acwr)
        if (Number.isFinite(v) && v > 1.5) return count + 1
        return count
      }, 0)
    },

    /** Athlete by id. */
    getAthlete: (state) => (id) => {
      if (!id) return null
      return state.athletesById[id] ?? null
    },

    /** Selected athlete (for modal). */
    selectedAtleet(state) {
      if (!state.selectedAtleetId) return null
      return state.athletesById[state.selectedAtleetId] ?? null
    },
  },

  actions: {
    /**
     * Fetch squadron from API. Map array to athletesById (key = athlete.id).
     * Stores exactly what the API sends; no transformation.
     */
    async fetchSquadron() {
      this.loading = true
      this.error = null

      const authStore = useAuthStore()
      const teamId = authStore.teamId ?? authStore.user?.teamId

      try {
        if (!teamId) {
          this.error = 'No Team Assigned'
          throw new Error('No Team Assigned')
        }

        const list = await getCoachSquad()
        if (!Array.isArray(list)) {
          this.error = 'Invalid squadron response'
          throw new Error('Invalid squadron response')
        }
        const filtered = list.filter((row) => row.teamId === teamId)

        const nextById = {}
        for (const athlete of filtered) {
          const id = athlete.id ?? athlete.uid
          if (!id) continue
          // Preserve full API response; only fill name/profile/metrics when missing (never overwrite with empty)
          const name = athlete.name ?? athlete.profile?.fullName ?? athlete.displayName ?? (athlete.email ? athlete.email.split('@')[0] : null)
          const profile = {
            fullName: athlete.profile?.fullName ?? athlete.name ?? athlete.displayName ?? null,
            firstName: athlete.profile?.firstName ?? null,
            lastName: athlete.profile?.lastName ?? null,
            avatar: athlete.profile?.avatar ?? athlete.avatar ?? null,
          }
          const metrics = {
            acwr: athlete.metrics?.acwr ?? athlete.acwr ?? null,
            acuteLoad: athlete.metrics?.acuteLoad ?? athlete.acuteLoad ?? null,
            chronicLoad: athlete.metrics?.chronicLoad ?? athlete.chronicLoad ?? null,
            form: athlete.metrics?.form ?? athlete.form ?? null,
            cyclePhase: athlete.metrics?.cyclePhase ?? athlete.cyclePhase ?? null,
            cycleDay: athlete.metrics?.cycleDay ?? athlete.cycleDay ?? null,
            readiness: athlete.metrics?.readiness ?? athlete.readiness ?? null,
          }
          const metricsMeta = athlete.metricsMeta ?? { loadMetricsStale: true }
          nextById[id] = { ...athlete, id, name, profile, metrics, metricsMeta }
        }
        this.athletesById = nextById
      } catch (err) {
        console.error('SquadronStore: fetchSquadron failed', err)
        this.error = err?.message ?? 'Failed to fetch squadron'
        throw err
      } finally {
        this.loading = false
      }
    },

    /**
     * Fetch one athlete detail from API and merge into athletesById.
     * Does not mutate API response; merges into a new object.
     */
    async fetchAthleteDeepDive(id) {
      if (!id) {
        this.selectedAtleetId = null
        return
      }

      this.deepDiveLoading = true
      this.selectedAtleetId = id

      try {
        const data = await getAthleteDetail(id)
        const existing = this.athletesById[id]
        this.athletesById = {
          ...this.athletesById,
          [id]: { ...existing, ...data },
        }
      } catch (err) {
        console.error('SquadronStore: fetchAthleteDeepDive failed', err)
        this.selectedAtleetId = null
        throw err
      } finally {
        this.deepDiveLoading = false
      }
    },

    async fetchAtleetDeepDive(atleetId) {
      return this.fetchAthleteDeepDive(atleetId)
    },

    setSelectedAtleetFromRow(row) {
      if (!row) {
        this.selectedAtleetId = null
        return
      }
      this.selectedAtleetId = row.id ?? row.uid ?? null
    },

    clearSelectedAtleet() {
      this.selectedAtleetId = null
    },

    /**
     * Refresh live load metrics for one athlete; updates row.metrics.acwr and metricsMeta (stale=false).
     * Calls GET /api/admin/users/:uid/live-load-metrics?days=28 and merges result into athletesById.
     */
    async refreshLiveLoadMetrics(athleteId) {
      if (!athleteId) return
      try {
        const data = await getLiveLoadMetrics(athleteId, 28)
        if (!data || !data.success) return
        const existing = this.athletesById[athleteId]
        if (!existing) return
        const now = Date.now()
        this.athletesById = {
          ...this.athletesById,
          [athleteId]: {
            ...existing,
            metrics: {
              ...existing.metrics,
              acwr: data.acwr ?? existing.metrics?.acwr ?? null,
            },
            metricsMeta: {
              ...(existing.metricsMeta || {}),
              loadMetricsStale: false,
              loadMetricsComputedAt: now,
              loadMetricsWindowDays: data.windowDays ?? 28,
            },
          },
        }
      } catch (err) {
        console.error('SquadronStore: refreshLiveLoadMetrics failed', err)
        throw err
      }
    },
  },
})
