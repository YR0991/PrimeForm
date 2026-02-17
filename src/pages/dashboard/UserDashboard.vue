<template>
  <q-page class="user-dashboard elite-page">
    <div class="pilot-container">
      <!-- Header: Greeting + Cycle Phase -->
      <header class="pilot-header">
        <h1 class="pilot-greeting">{{ data.greeting }}</h1>
        <div class="cycle-phase-badge">
          {{ data.cyclePhase }} – Dag {{ data.cycleDay }} {{ data.cycleEmoji }}
        </div>
      </header>

      <!-- Primary KPI: Readiness / Daily Advice (Daily Brief) -->
      <q-card class="kpi-card" flat>
        <q-card-section class="kpi-section">
          <div class="kpi-label">READINESS</div>
          <div class="kpi-value">{{ data.readiness }}/10</div>
          <div class="advice-badge" :class="`advice-${data.dailyAdvice?.toLowerCase()}`">
            {{ data.dailyAdvice }}
          </div>
        </q-card-section>
      </q-card>

      <!-- Recente Activiteiten (Laatste 7) — strakke tabel -->
      <q-card class="history-card" flat>
        <q-card-section>
          <div class="history-label">RECENTE ACTIVITEITEN (LAATSTE 7)</div>
          <table v-if="activities.length" class="activity-table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Type</th>
                <th class="th-right">PrimeLoad</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(act, i) in activities" :key="act.id || i">
                <td class="elite-data activity-date">{{ formatActivityDate(act) }}</td>
                <td>
                  <span class="activity-type-cell">
                    <q-icon :name="activityIcon(act.type)" size="14px" class="q-mr-xs" />
                    {{ act.type || 'Workout' }}
                  </span>
                </td>
                <td class="elite-data activity-load">{{ act.loadUsed ?? act.load ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else-if="activitiesLoading" class="activity-empty">Laden...</div>
          <div v-else class="activity-empty">Nog geen activiteiten</div>
        </q-card-section>
      </q-card>

      <!-- Telemetry: Prime Load + ACWR -->
      <div class="telemetry-row">
        <q-card class="telemetry-card" flat>
          <q-card-section>
            <div class="telemetry-label">PRIME LOAD (7D)</div>
            <div class="telemetry-value elite-data">{{ data.primeLoad7d }}</div>
          </q-card-section>
        </q-card>
        <q-card class="telemetry-card" flat>
          <q-card-section>
            <div class="telemetry-label">ACWR</div>
            <div class="telemetry-value elite-data">{{ data.acwr?.toFixed(2) }}</div>
            <div class="acwr-indicator" :class="`acwr-${data.acwrStatus}`">
              <q-icon v-if="data.acwrStatus === 'sweet'" name="check_circle" size="16px" />
              <q-icon v-else name="warning" size="16px" />
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Telemetrie: Strava Koppeling -->
      <q-card class="telemetry-card strava-card" flat>
        <q-card-section>
          <div class="telemetry-label">TELEMETRIE</div>
          <template v-if="authStore.stravaConnected">
            <div class="strava-status-row">
              <span class="strava-badge connected">Gekoppeld</span>
              <span v-if="stravaLastSyncFormatted" class="strava-meta">{{ stravaLastSyncFormatted }}</span>
            </div>
            <q-btn
              flat
              dense
              no-caps
              class="strava-sync-btn"
              :loading="stravaSyncing"
              @click="syncStravaNow"
            >
              Sync nu
            </q-btn>
          </template>
          <template v-else>
            <q-btn
              flat
              dense
              no-caps
              class="strava-connect-btn"
              :loading="stravaConnecting"
              @click="connectStrava"
            >
              Koppel Strava
            </q-btn>
          </template>
        </q-card-section>
      </q-card>

      <!-- Primary Action: START CHECK-IN -->
      <router-link to="/" class="action-link">
        <q-btn class="checkin-btn" unelevated no-caps>
          START CHECK-IN
        </q-btn>
      </router-link>

      <!-- HRV & RHR Trends (7d en 28d rollend gemiddelde) -->
      <q-card class="trend-card" flat>
        <q-card-section class="trend-card-header">
          <div class="history-label">HRV & RHR TRENDS</div>
        </q-card-section>
        <q-card-section class="trend-card-body">
          <div v-if="historyLoading" class="activity-empty">Data laden...</div>
          <template v-else-if="hasHrvRhrData">
            <div class="chart-block">
              <div class="chart-title">HRV (7d / 28d gem.)</div>
              <div class="apex-wrap">
                <VueApexCharts
                  type="line"
                  height="180"
                  :options="hrvChartOptions"
                  :series="hrvChartSeries"
                />
              </div>
            </div>
            <div class="chart-block">
              <div class="chart-title">RHR (7d / 28d gem.)</div>
              <div class="apex-wrap">
                <VueApexCharts
                  type="line"
                  height="180"
                  :options="rhrChartOptions"
                  :series="rhrChartSeries"
                />
              </div>
            </div>
          </template>
          <div v-else class="activity-empty">
            Nog geen biometrische data. Doe check-ins om trends te zien.
          </div>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import { useAuthStore } from '../../stores/auth.js'
import { api } from '../../services/httpClient.js'
import { getAthleteDashboard } from '../../services/userService.js'

const authStore = useAuthStore()

const getOrCreateUserId = () => {
  const key = 'primeform_user_id'
  return localStorage.getItem(key) || `pf_${Date.now()}`
}

const data = ref({
  greeting: 'Goedemorgen',
  cyclePhase: 'Luteal Phase',
  cycleDay: 22,
  cycleEmoji: '🩸',
  readiness: 7,
  dailyAdvice: 'MAINTAIN',
  primeLoad7d: 0,
  acwr: 0,
  acwrStatus: 'sweet',
})

const activities = ref([])
const activitiesLoading = ref(false)
const historyLoading = ref(false)
const historyLogs = ref([])
const stravaSyncing = ref(false)
const stravaConnecting = ref(false)

const stravaLastSyncFormatted = computed(() => {
  const raw = authStore.stravaLastSyncAt
  const d = parseFirestoreDate(raw)
  if (!d) return ''
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
})

function parseFirestoreDate(value) {
  if (!value) return null
  if (typeof value?.toDate === 'function') {
    const d = value.toDate()
    return isNaN(d.getTime()) ? null : d
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value)
    return isNaN(d.getTime()) ? null : d
  }
  if (typeof value === 'object') {
    const seconds = value._seconds ?? value.seconds
    const nanos = value._nanoseconds ?? value.nanoseconds ?? 0
    if (typeof seconds === 'number') {
      const d = new Date(seconds * 1000 + nanos / 1e6)
      return isNaN(d.getTime()) ? null : d
    }
  }
  return null
}

function formatActivityDate(act) {
  const raw = act.start_date ?? act._dateStr ?? act.date ?? act.timestamp
  const d = parseFirestoreDate(raw)
  if (!d) return '—'
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

function activityIcon(type) {
  if (!type) return 'fitness_center'
  const t = String(type).toLowerCase()
  if (t.includes('run')) return 'directions_run'
  if (t.includes('ride') || t.includes('cycl')) return 'directions_bike'
  if (t.includes('swim')) return 'pool'
  if (t.includes('weight') || t.includes('strength')) return 'fitness_center'
  return 'fitness_center'
}

// --- HRV/RHR chart: history_logs met 7d en 28d rollend gemiddelde ---
function toDateStr(val) {
  if (!val) return ''
  if (typeof val === 'string') return val.slice(0, 10)
  if (typeof val?.toDate === 'function') return val.toDate().toISOString().slice(0, 10)
  if (typeof val === 'number') return new Date(val).toISOString().slice(0, 10)
  return String(val).slice(0, 10)
}

function rollingAvg(arr, idx, window) {
  let sum = 0
  let count = 0
  for (let i = Math.max(0, idx - window + 1); i <= idx; i++) {
    const v = arr[i]
    if (v != null && Number.isFinite(v)) {
      sum += v
      count += 1
    }
  }
  return count > 0 ? Math.round((sum / count) * 10) / 10 : null
}

const hrvRhrPoints = computed(() => {
  const logs = Array.isArray(historyLogs.value) ? historyLogs.value : []
  const cleaned = logs
    .map((l) => {
      const dateStr = toDateStr(l.date ?? l.timestamp)
      const hrv = l.hrv ?? l.metrics?.hrv ?? (typeof l.metrics?.hrv === 'object' ? l.metrics?.hrv?.current : null)
      const rhr = l.rhr ?? l.metrics?.rhr ?? (typeof l.metrics?.rhr === 'object' ? l.metrics?.rhr?.current : null)
      return {
        dateStr,
        ts: dateStr ? new Date(dateStr).getTime() : 0,
        hrv: hrv != null && Number.isFinite(Number(hrv)) ? Number(hrv) : null,
        rhr: rhr != null && Number.isFinite(Number(rhr)) ? Number(rhr) : null
      }
    })
    .filter((p) => p.dateStr && p.ts > 0)
    .sort((a, b) => a.ts - b.ts)
  return cleaned
})

const hrvChartSeries = computed(() => {
  const points = hrvRhrPoints.value
  const hrv7 = points.map((p, i) => ({ x: p.ts, y: rollingAvg(points.map((x) => x.hrv), i, 7) })).filter((d) => d.y != null)
  const hrv28 = points.map((p, i) => ({ x: p.ts, y: rollingAvg(points.map((x) => x.hrv), i, 28) })).filter((d) => d.y != null)
  return [
    { name: 'HRV 7d', data: hrv7 },
    { name: 'HRV 28d', data: hrv28 }
  ]
})

const rhrChartSeries = computed(() => {
  const points = hrvRhrPoints.value
  const rhr7 = points.map((p, i) => ({ x: p.ts, y: rollingAvg(points.map((x) => x.rhr), i, 7) })).filter((d) => d.y != null)
  const rhr28 = points.map((p, i) => ({ x: p.ts, y: rollingAvg(points.map((x) => x.rhr), i, 28) })).filter((d) => d.y != null)
  return [
    { name: 'RHR 7d', data: rhr7 },
    { name: 'RHR 28d', data: rhr28 }
  ]
})

const hasHrvRhrData = computed(() => {
  const a = hrvChartSeries.value[0].data.length
  const b = hrvChartSeries.value[1].data.length
  const c = rhrChartSeries.value[0].data.length
  const d = rhrChartSeries.value[1].data.length
  return a > 0 || b > 0 || c > 0 || d > 0
})

const eliteChartOptions = (colors) => ({
  chart: {
    type: 'line',
    background: 'transparent',
    toolbar: { show: false },
    zoom: { enabled: false },
    foreColor: 'rgba(255,255,255,0.75)'
  },
  theme: { mode: 'dark' },
  stroke: { curve: 'smooth', width: 2 },
  colors: colors || ['#22c55e', '#16a34a'],
  grid: {
    borderColor: 'rgba(255,255,255,0.08)',
    strokeDashArray: 4,
    xaxis: { lines: { show: false } },
    yaxis: { lines: { show: true } }
  },
  xaxis: {
    type: 'datetime',
    labels: { style: { colors: 'rgba(255,255,255,0.55)' } },
    axisBorder: { color: 'rgba(255,255,255,0.08)' },
    axisTicks: { color: 'rgba(255,255,255,0.08)' }
  },
  yaxis: {
    labels: { style: { colors: 'rgba(255,255,255,0.55)' } }
  },
  legend: {
    labels: { colors: '#9ca3af' },
    fontSize: '11px'
  },
  tooltip: { theme: 'dark', x: { format: 'dd MMM' } }
})

const hrvChartOptions = computed(() => eliteChartOptions(['#22c55e', '#16a34a']))
const rhrChartOptions = computed(() => eliteChartOptions(['#ef4444', '#dc2626']))

async function connectStrava() {
  stravaConnecting.value = true
  try {
    const res = await api.get('/api/strava/connect-url')
    const url = res.data?.url ?? res.data?.data?.url
    if (url && typeof url === 'string') {
      window.location.href = url
      return
    }
    throw new Error('Geen koppel-URL ontvangen.')
  } catch (e) {
    console.error('Strava connect failed', e)
    stravaConnecting.value = false
  }
}

async function syncStravaNow() {
  stravaSyncing.value = true
  try {
    await api.post('/api/strava/sync-now')
    await authStore.fetchUserProfile()
  } catch (e) {
    console.error('Strava sync failed', e)
  } finally {
    stravaSyncing.value = false
  }
}

async function loadActivities() {
  activitiesLoading.value = true
  try {
    const res = await api.get('/api/history')
    const list = res.data?.data ?? []
    const out = list
      .map((item) => ({
        id: item.id,
        timestamp: item.timestamp,
        date: item.date ?? (parseFirestoreDate(item.timestamp)?.toISOString?.()?.slice(0, 10) ?? null),
        type: item.type ?? 'Check-in',
        loadUsed: item.metrics?.primeLoad ?? item.primeLoad ?? item.load ?? null,
        load: item.metrics?.primeLoad ?? item.primeLoad ?? item.load ?? null,
      }))
      .sort((a, b) => {
        const ta = parseFirestoreDate(a.timestamp)?.getTime() ?? 0
        const tb = parseFirestoreDate(b.timestamp)?.getTime() ?? 0
        return tb - ta
      })
      .slice(0, 7)
    activities.value = out
  } catch (e) {
    console.error('History load failed', e)
    activities.value = []
  } finally {
    activitiesLoading.value = false
  }
}

async function loadDashboard() {
  historyLoading.value = true
  try {
    const res = await api.get('/api/dashboard')
    const payload = res.data?.data
    if (payload) {
      const readiness = payload.readiness_today ?? payload.readiness ?? data.value.readiness
      const phase = payload.phase ?? payload.current_phase ?? data.value.cyclePhase
      const phaseDay = payload.phaseDay ?? payload.current_phase_day ?? data.value.cycleDay
      const acwr = payload.acwr
      data.value = {
        ...data.value,
        readiness: readiness ?? data.value.readiness,
        cyclePhase: phase ?? data.value.cyclePhase,
        cycleDay: phaseDay ?? data.value.cycleDay,
        acwr: acwr != null ? acwr : data.value.acwr,
        acwrStatus: acwr != null ? (acwr > 1.5 ? 'spike' : acwr > 1.3 ? 'overreaching' : acwr < 0.8 ? 'undertraining' : 'sweet') : data.value.acwrStatus,
        primeLoad7d: payload.recent_activities?.reduce((s, a) => s + (a.loadUsed ?? a._primeLoad ?? 0), 0) ?? data.value.primeLoad7d
      }
      historyLogs.value = payload.history_logs || []
    }
  } catch (e) {
    console.error('Dashboard API failed', e)
  } finally {
    historyLoading.value = false
  }
}

onMounted(async () => {
  try {
    const userId = getOrCreateUserId()
    const dashboardData = await getAthleteDashboard(userId)
    data.value = { ...data.value, ...dashboardData }
  } catch (e) {
    console.error('Dashboard load failed', e)
  }
  loadActivities()
  loadDashboard()
})
</script>

<style scoped lang="scss">
@use '../../css/quasar.variables' as q;

.user-dashboard {
  background: q.$prime-black;
  min-height: 100vh;
  padding: 24px 16px;
}

.pilot-container {
  max-width: 420px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.pilot-header {
  margin-bottom: 8px;
}

.pilot-greeting {
  font-family: q.$typography-font-family;
  font-weight: 700;
  font-size: 1.5rem;
  color: #ffffff;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 8px 0;
}

.cycle-phase-badge {
  font-family: q.$mono-font;
  font-size: 0.8rem;
  color: q.$prime-gray;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.kpi-card {
  background: q.$prime-surface !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: q.$radius-sm !important;
  box-shadow: none !important;
}

.kpi-section {
  text-align: center;
  padding: 24px 16px;
}

.kpi-label {
  font-family: q.$typography-font-family;
  font-size: 0.65rem;
  font-weight: 700;
  color: q.$prime-gray;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  margin-bottom: 8px;
}

.kpi-value {
  font-family: q.$mono-font;
  font-size: 2.5rem;
  font-weight: 700;
  color: q.$prime-gold;
  margin-bottom: 12px;
}

.advice-badge {
  display: inline-block;
  border: 1px solid;
  padding: 4px 12px;
  font-size: 0.7rem;
  font-weight: 800;
  font-family: q.$mono-font;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  border-radius: 2px;
}

.advice-rest {
  color: q.$status-recover;
  border-color: q.$status-recover;
  background: rgba(239, 68, 68, 0.1);
}

.advice-recover {
  color: q.$status-maintain;
  border-color: q.$status-maintain;
  background: rgba(249, 115, 22, 0.1);
}

.advice-maintain {
  color: q.$prime-gold;
  border-color: q.$prime-gold;
  background: rgba(251, 191, 36, 0.1);
}

.advice-push {
  color: q.$status-push;
  border-color: q.$status-push;
  background: rgba(34, 197, 94, 0.1);
}

.telemetry-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.telemetry-card {
  background: q.$prime-surface !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: q.$radius-sm !important;
  box-shadow: none !important;
}

.telemetry-card .q-card__section {
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.telemetry-label {
  font-family: q.$typography-font-family;
  font-size: 0.6rem;
  font-weight: 700;
  color: q.$prime-gray;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.telemetry-value {
  font-family: q.$mono-font;
  font-size: 1.5rem;
  font-weight: 700;
  color: #ffffff;
}

.acwr-indicator {
  margin-top: 4px;
}

.acwr-sweet {
  color: q.$status-push;
}

.acwr-undertraining,
.acwr-overreaching {
  color: q.$status-maintain;
}

.acwr-spike {
  color: q.$status-recover;
}

.action-link {
  text-decoration: none;
}

.checkin-btn {
  width: 100%;
  background: q.$prime-gold !important;
  color: #050505 !important;
  font-family: q.$typography-font-family !important;
  font-weight: 700 !important;
  font-size: 1rem !important;
  text-transform: uppercase !important;
  letter-spacing: 0.2em !important;
  padding: 18px 24px !important;
  border-radius: q.$radius-sm !important;
  border: none !important;
  box-shadow: none !important;
}

.checkin-btn:hover {
  background: #f59e0b !important;
}

.history-card {
  background: q.$prime-surface !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: q.$radius-sm !important;
  box-shadow: none !important;
}

.history-label {
  font-family: q.$typography-font-family;
  font-size: 0.65rem;
  font-weight: 700;
  color: q.$prime-gray;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 12px;
}

.activity-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}

.activity-table thead tr {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.activity-table th {
  font-family: q.$typography-font-family;
  font-size: 0.6rem;
  font-weight: 700;
  color: q.$prime-gray;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  text-align: left;
  padding: 8px 0;
}

.activity-table th.th-right {
  text-align: right;
}

.activity-table tbody tr {
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.activity-table tbody tr:last-child {
  border-bottom: none;
}

.activity-table td {
  padding: 8px 0;
  vertical-align: middle;
}

.activity-date {
  color: q.$prime-gray;
  font-size: 0.75rem;
  font-family: q.$mono-font;
}

.activity-type-cell {
  font-family: q.$typography-font-family;
  color: #ffffff;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
}

.activity-load {
  text-align: right;
  font-family: q.$mono-font;
  color: q.$prime-gold;
}

.activity-empty {
  font-family: q.$typography-font-family;
  color: q.$prime-gray;
  font-size: 0.9rem;
  padding: 16px 0;
}

.strava-card .q-card__section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.strava-status-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.strava-badge.connected {
  font-family: q.$mono-font;
  font-size: 0.7rem;
  color: q.$status-push;
  border: 1px solid q.$status-push;
  padding: 2px 8px;
  border-radius: 2px;
}

.strava-meta {
  font-family: q.$mono-font;
  font-size: 0.7rem;
  color: q.$prime-gray;
}

.strava-sync-btn,
.strava-connect-btn {
  font-size: 0.75rem;
  color: q.$prime-gold;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.strava-connect-btn {
  width: 100%;
}

.trend-card {
  background: q.$prime-surface !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: q.$radius-sm !important;
  box-shadow: none !important;
}

.trend-card-header {
  padding-bottom: 0;
}

.trend-card-body {
  padding-top: 8px;
}

.chart-block {
  margin-bottom: 20px;
}

.chart-block:last-child {
  margin-bottom: 0;
}

.chart-title {
  font-family: q.$typography-font-family;
  font-size: 0.6rem;
  font-weight: 700;
  color: q.$prime-gray;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 8px;
}

.apex-wrap :deep(.apexcharts-canvas) {
  border-radius: 2px;
}
</style>
