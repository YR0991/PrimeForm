<template>
  <q-page class="coach-deep-dive elite-page">
    <div class="engineer-container">
      <header class="engineer-header">
        <q-btn flat round icon="arrow_back" color="white" size="sm" @click="goBack" />
        <h1 class="engineer-title">DEEP DIVE</h1>
      </header>

      <q-card v-if="athlete" class="deep-dive-card" flat>
        <q-card-section class="deep-dive-header">
          <div class="deep-dive-title">{{ athlete.name }}</div>
        </q-card-section>
        <q-card-section class="deep-dive-body">
          <div class="deep-dive-row">
            <span class="label">Cyclus</span>
            <span class="value elite-data">
              {{ athlete.metrics?.cyclePhase ?? '—' }} · D{{ athlete.metrics?.cycleDay ?? '—' }}
            </span>
          </div>
          <div class="deep-dive-row">
            <span class="label">Belastingsbalans</span>
            <span
              class="value elite-data"
              :class="loadBalanceClass"
            >
              {{ athlete.metrics?.acwr != null ? athlete.metrics.acwr.toFixed(2) : '—' }}
            </span>
          </div>
          <div class="deep-dive-row">
            <span class="label">Trainingsvolume (7d)</span>
            <span class="value elite-data">{{ athlete.metrics?.acuteLoad ?? '—' }}</span>
          </div>
          <div class="deep-dive-row">
            <span class="label">Readiness</span>
            <span class="value elite-data">{{ athlete.readiness != null ? `${athlete.readiness}/10` : '—' }}</span>
          </div>
          <div class="deep-dive-section-label">LAATSTE 7 ACTIVITEITEN (MET PRIMELOAD)</div>
          <table v-if="athlete.activities?.length" class="deep-dive-activity-table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Type</th>
                <th class="th-right">PrimeLoad</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(act, i) in athlete.activities" :key="act.id || i">
                <td class="elite-data">{{ act.date }}</td>
                <td>
                  <span class="activity-source-inline">
                    <q-badge
                      v-if="act.source === 'manual' || act.source === 'primeform'"
                      class="source-badge primeform-badge"
                      outline
                      dense
                    >
                      PF
                    </q-badge>
                    <q-badge v-else class="source-badge strava-badge" outline dense>Strava</q-badge>
                    <span class="activity-type">{{ act.type || 'Workout' }}</span>
                  </span>
                </td>
                <td class="elite-data prime-load">{{ act.load ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="deep-dive-empty">
            Geen activiteiten in de laatste 7 dagen.
          </div>

          <div class="deep-dive-section-label">HRV & RHR TRENDS (7D / 28D GEM.)</div>
          <template v-if="hasHrvRhrData">
            <div class="chart-block">
              <div class="chart-title">HRV</div>
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
              <div class="chart-title">RHR</div>
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
          <div v-else class="deep-dive-empty">
            Nog geen biometrische data voor deze atleet.
          </div>
        </q-card-section>
      </q-card>

      <div v-else-if="loading" class="loading-row">
        <q-spinner color="primary" size="32px" />
        <span>Atleet laden…</span>
      </div>
      <div v-else-if="error" class="error-row">
        <span>{{ error }}</span>
        <q-btn flat label="Terug" @click="goBack" />
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import VueApexCharts from 'vue3-apexcharts'
import { useAuthStore } from '../../stores/auth.js'
import { getAthleteDetail } from '../../services/coachService.js'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const athlete = ref(null)
const loading = ref(false)
const error = ref(null)

const athleteId = computed(() => route.params.id)

const loadBalanceClass = computed(() => {
  const acwr = athlete.value?.metrics?.acwr
  if (acwr == null || !Number.isFinite(acwr)) return 'load-balance-unknown'
  if (acwr >= 0.8 && acwr <= 1.3) return 'load-balance-optimal'
  return 'load-balance-outside'
})

// --- HRV/RHR uit history_logs (zelfde diepgang als atleet-dashboard) ---
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

const historyLogs = computed(() => athlete.value?.history_logs ?? [])

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

async function loadAthlete() {
  const id = athleteId.value
  const email = authStore.user?.email
  if (!id || !email) {
    error.value = 'Atleet of coach niet gevonden.'
    return
  }
  loading.value = true
  error.value = null
  athlete.value = null
  try {
    athlete.value = await getAthleteDetail(id, email)
  } catch (e) {
    console.error('Deep dive load failed:', e)
    error.value = e?.response?.status === 404 ? 'Atleet niet gevonden.' : (e?.message || 'Laden mislukt.')
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push({ path: '/coach' })
}

watch(athleteId, (id) => {
  if (id) loadAthlete()
}, { immediate: true })
</script>

<style scoped lang="scss">
@use '../../css/quasar.variables' as q;

.coach-deep-dive {
  background: q.$prime-black;
  min-height: 100vh;
  padding: 24px;
}

.engineer-container {
  max-width: 640px;
  margin: 0 auto;
}

.engineer-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.engineer-title {
  font-family: q.$typography-font-family;
  font-weight: 700;
  font-size: 1.25rem;
  color: #ffffff;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  margin: 0;
}

.deep-dive-card {
  background: q.$prime-surface !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: q.$radius-sm !important;
  box-shadow: none !important;
}

.deep-dive-header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding: 20px;
}

.deep-dive-title {
  font-family: q.$typography-font-family;
  font-weight: 700;
  font-size: 1rem;
  color: #ffffff;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.deep-dive-body {
  padding: 20px;
}

.deep-dive-row {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.deep-dive-row .label {
  font-family: q.$typography-font-family;
  font-size: 0.7rem;
  color: q.$prime-gray;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.deep-dive-row .value {
  font-family: q.$mono-font;
  font-size: 0.9rem;
  color: #ffffff;
}

.load-balance-optimal {
  color: q.$status-push;
}

.load-balance-outside {
  color: #f97316;
}

.load-balance-unknown {
  color: q.$prime-gray;
}

.prime-load {
  color: q.$prime-gold;
}

.deep-dive-section-label {
  font-family: q.$typography-font-family;
  font-size: 0.65rem;
  font-weight: 700;
  color: q.$prime-gray;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin: 20px 0 12px 0;
}

.deep-dive-activity-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}

.deep-dive-activity-table thead tr {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.deep-dive-activity-table th {
  font-family: q.$typography-font-family;
  font-size: 0.6rem;
  font-weight: 700;
  color: q.$prime-gray;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  text-align: left;
  padding: 8px 0;
}

.deep-dive-activity-table th.th-right {
  text-align: right;
}

.deep-dive-activity-table tbody tr {
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.deep-dive-activity-table td {
  padding: 8px 0;
  vertical-align: middle;
}

.activity-source-inline {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.source-badge {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.6rem;
  border-radius: 2px;
}

.primeform-badge {
  border-color: rgba(255, 255, 255, 0.6);
  color: rgba(249, 250, 251, 0.9);
}

.strava-badge {
  border-color: #fc4c02;
  color: #fc4c02;
}

.activity-type {
  color: #e5e7eb;
}

.deep-dive-empty {
  font-family: q.$typography-font-family;
  font-size: 0.8rem;
  color: q.$prime-gray;
  padding: 12px 0;
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

.loading-row,
.error-row {
  display: flex;
  align-items: center;
  gap: 12px;
  color: q.$prime-gray;
  padding: 24px;
}

.error-row {
  color: q.$status-recover;
}
</style>
