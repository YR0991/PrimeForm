<template>
  <q-page class="coach-deep-dive elite-page">
    <div class="engineer-container">
      <header class="engineer-header">
        <q-btn flat round icon="arrow_back" color="white" size="sm" @click="goBack" />
        <h1 class="engineer-title">DEEP DIVE</h1>
      </header>

      <q-card v-if="athlete" class="deep-dive-card" flat>
        <q-card-section class="deep-dive-header">
          <div class="deep-dive-title-row">
            <div class="row items-center no-wrap q-gutter-sm">
              <AthleteAvatar
                :avatar="athlete.profile?.avatar"
                :name="athleteDisplayName"
                size="40px"
              />
              <div class="deep-dive-title">{{ athleteDisplayName }}</div>
            </div>
            <div class="deep-dive-header-meta">
              <span class="header-pill" :class="hasCheckinToday(athlete) ? 'pill-ok' : 'pill-warn'">
                Check-in: {{ headerCheckinLabel }}
              </span>
              <span class="header-pill">
                {{ headerLastSyncText }}
              </span>
              <q-btn
                flat
                dense
                no-caps
                color="amber"
                icon="description"
                label="Weekadvies"
                class="weekadvies-cta"
                @click="openWeekReport"
              />
            </div>
          </div>
        </q-card-section>
        <q-card-section class="deep-dive-body">
          <!-- KPI strip: single source, no duplication -->
          <div class="kpi-strip">
            <div class="kpi-card">
              <div class="kpi-label">Belastingsbalans</div>
              <div class="kpi-value elite-data" :class="loadBalanceClass(athlete)">
                {{ formatAcwr(athlete) }}
              </div>
              <span class="kpi-pill" :class="loadBalanceClass(athlete)">{{ getLoadBalanceBand(athlete) }}</span>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Trainingsvolume (7d)</div>
              <div class="kpi-value elite-data">{{ formatLoad7d(athlete) }}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">PrimeLoad (7d)</div>
              <div class="kpi-value elite-data">{{ formatLoad7d(athlete) }}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Readiness</div>
              <div class="kpi-value elite-data">{{ formatReadiness(athlete) }}</div>
              <div class="kpi-sub">{{ lastCheckinLabel }}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Strava</div>
              <div class="kpi-value elite-data strava-one-line" :class="stravaStatusClass">
                {{ stravaStatusText }}
              </div>
              <q-tooltip v-if="stravaTooltipText" anchor="top middle" self="bottom middle" max-width="280px">
                {{ stravaTooltipText }}
              </q-tooltip>
            </div>
          </div>

          <div class="deep-dive-section-label">BELASTING</div>
          <q-card flat bordered class="load-card">
            <q-card-section class="load-card-header">
              <div class="load-card-title">Belasting per periode</div>
              <div class="timeframe-segmented">
                <button
                  v-for="option in loadRangeOptions"
                  :key="option.value"
                  type="button"
                  class="timeframe-seg-item"
                  :class="{ active: loadRange === option.value }"
                  @click="loadRange = option.value"
                >
                  {{ option.label }}
                </button>
              </div>
            </q-card-section>
            <q-card-section class="load-card-body">
              <div class="load-chart-block">
                <div class="deep-dive-section-label load-subtitle">Belasting per dag</div>
                <PrimeLoadDailyChart
                  :activities="athlete.activities || []"
                  :days="loadRange"
                  @day-click="handleDayClick"
                />
                <div class="prime-load-detail" v-if="selectedDayKey">
                  <div class="prime-load-detail-header">
                    <span class="prime-load-date">{{ selectedDayLabel }}</span>
                    <span class="prime-load-total elite-data">
                      Totaal PrimeLoad: {{ formatPrimeLoad(selectedDayTotal) }}
                    </span>
                  </div>
                  <table v-if="selectedDayActivities.length" class="prime-load-activity-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Naam</th>
                        <th class="th-right">PrimeLoad</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="(act, idx) in selectedDayActivities"
                        :key="act.id || act.name || idx"
                      >
                        <td class="elite-data">
                          {{ act.type || 'Workout' }}
                        </td>
                        <td class="elite-data">
                          {{ act.name || act.title || act.date || '—' }}
                        </td>
                        <td class="elite-data prime-load">
                          {{ formatPrimeLoad(act._primeLoad) }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div v-else class="deep-dive-empty">
                    Geen workouts met PrimeLoad voor deze dag.
                  </div>
                </div>
              </div>

              <div class="load-table-block">
                <div class="deep-dive-section-label load-subtitle">Laatste activiteiten</div>
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
                      <td class="elite-data activity-date">
                        <span
                          :title="act.date || ''"
                        >
                          {{ formatShortDate(act.date) }}
                        </span>
                      </td>
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
                      <td class="elite-data prime-load activity-load">
                        {{ act.load ?? '—' }}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div v-else class="deep-dive-empty">
                  Geen activiteiten in de laatste 7 dagen.
                </div>
              </div>
            </q-card-section>
          </q-card>

          <div class="deep-dive-section-label trends-label">
            <span>HRV & RHR TRENDS</span>
            <q-toggle
              v-model="showDebugTimelines"
              color="grey-5"
              keep-color
              dense
              label="Debug: toon tijdslijnen"
            />
          </div>
          <template v-if="hasHrvRhrData">
            <div class="chart-block">
              <div class="chart-title">HRV</div>
              <div class="apex-wrap">
                <VueApexCharts
                  type="line"
                  height="180"
                  :options="displayHrvOptions"
                  :series="displayHrvSeries"
                />
              </div>
            </div>
            <div class="chart-block">
              <div class="chart-title">RHR</div>
              <div class="apex-wrap">
                <VueApexCharts
                  type="line"
                  height="180"
                  :options="displayRhrOptions"
                  :series="displayRhrSeries"
                />
              </div>
            </div>
          </template>
          <div v-else class="deep-dive-empty">
            Nog geen biometrische data voor deze atleet.
          </div>
        </q-card-section>
      </q-card>

      <div v-else-if="squadronStore.deepDiveLoading" class="loading-row">
        <q-spinner color="primary" size="32px" />
        <span>Atleet laden…</span>
      </div>
      <div v-else-if="error" class="error-row">
        <span>{{ error }}</span>
        <q-btn flat label="Terug" @click="goBack" />
      </div>

      <WeekReportDialog
        v-model="showWeekReportDialog"
        :athlete-id="athleteId"
        :athlete-name="athleteDisplayName"
        :default-week-range="weekReportDefaultRange"
      />
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import VueApexCharts from 'vue3-apexcharts'
import { useSquadronStore } from '../../stores/squadron.js'
import PrimeLoadDailyChart from '../../components/coach/PrimeLoadDailyChart.vue'
import WeekReportDialog from '../../components/coach/WeekReportDialog.vue'
import AthleteAvatar from '../../components/AthleteAvatar.vue'

const route = useRoute()
const router = useRouter()
const squadronStore = useSquadronStore()
const error = ref(null)
const showDebugTimelines = ref(false)
const selectedDayKey = ref(null)
const selectedDayActivities = ref([])
const selectedDayTotal = ref(null)
const loadRange = ref(14)

const loadRangeOptions = [
  { label: '7d', value: 7 },
  { label: '28d', value: 28 },
  { label: '90d', value: 90 },
]
const showWeekReportDialog = ref(false)
const weekReportDefaultRange = ref(null)

const athleteId = computed(() => route.params.id)
const athlete = computed(() => squadronStore.selectedAtleet || squadronStore.getAthlete(athleteId.value))

const athleteDisplayName = computed(() => {
  const a = athlete.value || {}
  return (
    a.name ||
    a.profile?.fullName ||
    a.displayName ||
    a.email ||
    'Onbekende atleet'
  )
})

const selectedDayLabel = computed(() => {
  if (!selectedDayKey.value) return 'Geen dag geselecteerd'
  const d = new Date(selectedDayKey.value)
  if (Number.isNaN(d.getTime())) return selectedDayKey.value
  return d.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' })
})

function formatPrimeLoad(val) {
  const n = Number(val)
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(1)
}

function formatShortDate(raw) {
  if (!raw) return '—'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) {
    const s = String(raw)
    return s.length >= 10 ? s.slice(0, 10) : s
  }
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

function handleDayClick(dateKey, activities, totalLoad) {
  selectedDayKey.value = dateKey
  selectedDayTotal.value = Number.isFinite(Number(totalLoad)) ? Number(totalLoad) : null
  const list = Array.isArray(activities) ? activities : []
  selectedDayActivities.value = list
    .map((a) => {
      const loadRaw = a._loadUsed ?? a.loadUsed ?? a.load ?? null
      const loadNum = loadRaw != null && Number.isFinite(Number(loadRaw)) ? Number(loadRaw) : null
      return {
        ...a,
        _primeLoad: loadNum,
      }
    })
    .filter((a) => a._primeLoad != null)
    .sort((a, b) => b._primeLoad - a._primeLoad)
}

function getAcwr(row) {
  const v = row.metrics?.acwr ?? row.acwr
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function formatAcwr(row) {
  const v = getAcwr(row)
  return v != null ? v.toFixed(2) : '—'
}

function getLoadBalanceBand(row) {
  const v = getAcwr(row)
  if (v == null) return 'Geen data'
  if (v < 0.8) return '<0.80 Onder'
  if (v < 1.3) return '0.80–1.30 In balans'
  if (v < 1.5) return '1.30–1.50 Hoog'
  return '>1.50 Piek'
}

function loadBalanceClass(row) {
  const v = getAcwr(row)
  if (v == null) return 'load-balance-unknown'
  if (v >= 0.8 && v <= 1.3) return 'load-balance-optimal'
  return 'load-balance-outside'
}

function formatLoad7d(row) {
  const v = row.metrics?.acuteLoad ?? row.acuteLoad
  const n = v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null
  if (n != null) return n.toFixed(1)
  const sum = primeLoad7dFromActivities(row)
  return sum != null ? sum.toFixed(1) : '—'
}

function primeLoad7dFromActivities(row) {
  const activities = row?.activities ?? row?.recent_activities ?? []
  if (!Array.isArray(activities) || activities.length === 0) return null
  let sum = 0
  for (const a of activities) {
    const load = a.load ?? a.loadUsed ?? a._primeLoad ?? a.primeLoad
    const n = load != null && Number.isFinite(Number(load)) ? Number(load) : null
    if (n != null) sum += n
  }
  return Number.isFinite(sum) ? sum : null
}

function formatReadiness(row) {
  const v = row?.metrics?.readiness ?? row?.readiness
  if (v == null || v === '') return '—'
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 && n <= 10 ? `${n}/10` : '—'
}

const lastCheckinLabel = computed(() => {
  const a = athlete.value
  if (!a) return 'Laatste check-in'
  const dateStr = getLastCheckinDate(a)
  if (!dateStr) return 'Laatste check-in: —'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return 'Laatste check-in: —'
  const label = d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
  return `Laatste check-in: ${label}`
})

const stravaStatusText = computed(() => {
  const m = stravaMeta.value || {}
  const connected = m.connected === true
  const hasError = !!(m.lastError || m.error)
  if (hasError) return 'Strava: Fout'
  if (!connected && !m.lastWebhookAt && !m.lastSyncedAt) return 'Strava: Niet gekoppeld'
  return 'Strava: OK'
})

const stravaStatusClass = computed(() => {
  const m = stravaMeta.value || {}
  const hasError = !!(m.lastError || m.error)
  const connected = m.connected === true
  if (hasError) return 'triage-bad'
  if (!connected && !m.lastWebhookAt && !m.lastSyncedAt) return 'triage-unknown'
  return 'triage-ok'
})

const stravaTooltipText = computed(() => {
  const m = stravaMeta.value || {}
  const parts = []
  if (m.lastSyncedAt || m.lastSyncAt || m.lastWebhookAt || m.lastSuccessAt) {
    const raw = m.lastSyncedAt || m.lastSyncAt || m.lastWebhookAt || m.lastSuccessAt
    const d = parseMaybeTimestamp(raw)
    if (d) parts.push(`Laatste sync: ${d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`)
  }
  if (m.lastError || m.error) parts.push(`Fout: ${(m.lastError || m.error || '').toString().slice(0, 120)}`)
  return parts.length ? parts.join('\n') : null
})

function parseMaybeTimestamp(v) {
  if (!v) return null
  if (typeof v?.toDate === 'function') {
    const d = v.toDate()
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? null : v
  }
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof v === 'object') {
    const s = v._seconds ?? v.seconds
    if (Number.isFinite(Number(s))) {
      const d = new Date(Number(s) * 1000)
      return Number.isNaN(d.getTime()) ? null : d
    }
  }
  return null
}

const stravaMeta = computed(() => athlete.value?.stravaMeta || athlete.value?.strava || {})

const headerLastSyncText = computed(() => {
  const m = stravaMeta.value || {}
  const raw =
    m.lastWebhookAt ||
    m.lastSyncedAt ||
    m.lastSyncAt ||
    m.lastSuccessAt
  const d = parseMaybeTimestamp(raw)
  if (!d) return 'Laatste sync: —'
  const ts = d.toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `Laatste sync: ${ts}`
})

function getLastCheckinDate(row) {
  if (!row) return null
  const candidates = [
    row.lastCheckinDate,
    row.last_checkin_date,
    row.lastCheckin,
    row.last_checkin,
    row.lastCheckinAt,
    row.metrics?.lastCheckinDate,
    row.metrics?.last_checkin_date,
    row.todayLog?.date,
  ]
  for (const v of candidates) {
    const d = parseMaybeTimestamp(v)
    if (d) return d.toISOString().slice(0, 10)
  }
  const ts = row.metrics?.readiness_ts ?? row.readiness_ts
  const d = parseMaybeTimestamp(ts)
  if (d) return d.toISOString().slice(0, 10)
  const logs = row.history_logs ?? []
  if (Array.isArray(logs) && logs.length > 0) {
    const withDate = logs
      .map((l) => (l.date ?? l.timestamp ?? '').toString().slice(0, 10))
      .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s))
    if (withDate.length > 0) {
      withDate.sort((a, b) => b.localeCompare(a))
      return withDate[0]
    }
  }
  return null
}

function hasCheckinToday(row) {
  const today = new Date().toISOString().slice(0, 10)
  const last = getLastCheckinDate(row)
  return !!last && last === today
}

const headerCheckinLabel = computed(() => {
  if (!athlete.value) return 'Onbekend'
  return hasCheckinToday(athlete.value) ? 'Vandaag' : 'Niet gedaan'
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

// Cycle-aligned variants: dag-index 1..N voor snelle cycle-overview
const cycleHrvSeries = computed(() => {
  const points = hrvRhrPoints.value
  const hrvVals = points.map((x) => x.hrv)
  const hrv7 = points
    .map((_, i) => ({ x: i + 1, y: rollingAvg(hrvVals, i, 7) }))
    .filter((d) => d.y != null)
  const hrv28 = points
    .map((_, i) => ({ x: i + 1, y: rollingAvg(hrvVals, i, 28) }))
    .filter((d) => d.y != null)
  return [
    { name: 'HRV 7d', data: hrv7 },
    { name: 'HRV 28d', data: hrv28 },
  ]
})

const cycleRhrSeries = computed(() => {
  const points = hrvRhrPoints.value
  const rhrVals = points.map((x) => x.rhr)
  const rhr7 = points
    .map((_, i) => ({ x: i + 1, y: rollingAvg(rhrVals, i, 7) }))
    .filter((d) => d.y != null)
  const rhr28 = points
    .map((_, i) => ({ x: i + 1, y: rollingAvg(rhrVals, i, 28) }))
    .filter((d) => d.y != null)
  return [
    { name: 'RHR 7d', data: rhr7 },
    { name: 'RHR 28d', data: rhr28 },
  ]
})

const hasHrvRhrData = computed(() => {
  const a = hrvChartSeries.value[0].data.length
  const b = hrvChartSeries.value[1].data.length
  const c = rhrChartSeries.value[0].data.length
  const d = rhrChartSeries.value[1].data.length
  return a > 0 || b > 0 || c > 0 || d > 0
})

const PRIME_GOLD = '#fbbf24'
const goldRgba = (opacity) => `rgba(251, 191, 36, ${opacity})`

function eliteChartOptions(colors) {
  const primary = colors?.[0] || PRIME_GOLD
  const secondaryRgba = (() => {
    const hex = (colors?.[1] || primary).replace(/^#/, '')
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    return `rgba(${r},${g},${b},0.45)`
  })()
  return {
    chart: {
      type: 'line',
      background: 'transparent',
      toolbar: { show: false },
      zoom: { enabled: false },
      foreColor: 'rgba(255,255,255,0.75)',
    },
    theme: { mode: 'dark' },
    stroke: { curve: 'smooth', width: [3, 1.5], dashArray: [0, 6] },
    colors: [primary, secondaryRgba],
    markers: { size: [4, 0], hover: { sizeOffset: 4 } },
    grid: {
      borderColor: 'rgba(255,255,255,0.08)',
      strokeDashArray: 4,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
    },
    xaxis: {
      type: 'datetime',
      labels: { style: { colors: 'rgba(255,255,255,0.55)' } },
      axisBorder: { color: 'rgba(255,255,255,0.08)' },
      axisTicks: { color: 'rgba(255,255,255,0.08)' },
    },
    yaxis: { labels: { style: { colors: 'rgba(255,255,255,0.55)' } } },
    legend: { labels: { colors: '#9ca3af' }, fontSize: '11px' },
    tooltip: { theme: 'dark', x: { format: 'dd MMM' } },
  }
}

const hrvChartOptions = computed(() => eliteChartOptions([PRIME_GOLD, goldRgba(0.45)]))
const rhrChartOptions = computed(() => eliteChartOptions([PRIME_GOLD, goldRgba(0.45)]))

function eliteCycleChartOptions(colors) {
  const primary = colors?.[0] || PRIME_GOLD
  const secondaryRgba = (() => {
    const hex = (colors?.[1] || primary).replace(/^#/, '')
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    return `rgba(${r},${g},${b},0.45)`
  })()
  return {
    chart: {
      type: 'line',
      background: 'transparent',
      toolbar: { show: false },
      zoom: { enabled: false },
      foreColor: 'rgba(255,255,255,0.75)',
    },
    theme: { mode: 'dark' },
    stroke: { curve: 'smooth', width: [3, 1.5], dashArray: [0, 6] },
    colors: [primary, secondaryRgba],
    markers: { size: [4, 0], hover: { sizeOffset: 4 } },
    grid: {
      borderColor: 'rgba(255,255,255,0.08)',
      strokeDashArray: 4,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
    },
    xaxis: {
      type: 'numeric',
      labels: { style: { colors: 'rgba(255,255,255,0.55)' } },
      axisBorder: { color: 'rgba(255,255,255,0.08)' },
      axisTicks: { color: 'rgba(255,255,255,0.08)' },
      title: {
        text: 'Dag-index',
        style: { color: 'rgba(255,255,255,0.55)', fontSize: '10px' },
      },
    },
    yaxis: { labels: { style: { colors: 'rgba(255,255,255,0.55)' } } },
    legend: { labels: { colors: '#9ca3af' }, fontSize: '11px' },
    tooltip: { theme: 'dark' },
  }
}

const hrvCycleChartOptions = computed(() => eliteCycleChartOptions([PRIME_GOLD, goldRgba(0.45)]))
const rhrCycleChartOptions = computed(() => eliteCycleChartOptions([PRIME_GOLD, goldRgba(0.45)]))

const displayHrvSeries = computed(() =>
  showDebugTimelines.value ? hrvChartSeries.value : cycleHrvSeries.value
)
const displayRhrSeries = computed(() =>
  showDebugTimelines.value ? rhrChartSeries.value : cycleRhrSeries.value
)

const displayHrvOptions = computed(() =>
  showDebugTimelines.value ? hrvChartOptions.value : hrvCycleChartOptions.value
)
const displayRhrOptions = computed(() =>
  showDebugTimelines.value ? rhrChartOptions.value : rhrCycleChartOptions.value
)

async function loadAthlete() {
  const id = athleteId.value
  if (!id) {
    error.value = 'Atleet niet gevonden.'
    return
  }
  error.value = null
  try {
    await squadronStore.fetchAthleteDeepDive(id)
  } catch (e) {
    console.error('Deep dive load failed:', e)
    error.value = e?.response?.status === 404 ? 'Atleet niet gevonden.' : (e?.message || 'Laden mislukt.')
  }
}

function goBack() {
  router.push({ path: '/coach' })
}

function computeDefaultWeekRange() {
  const today = new Date()
  const day = today.getDay()
  const base = new Date(today)
  if (day === 0) base.setDate(base.getDate() - 7)
  const baseDay = base.getDay() || 7
  const monday = new Date(base)
  monday.setDate(base.getDate() - (baseDay - 1))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (d) => d.toISOString().slice(0, 10)
  return { from: fmt(monday), to: fmt(sunday) }
}

function openWeekReport() {
  const a = athlete.value
  if (!a?.id) return
  weekReportDefaultRange.value = computeDefaultWeekRange()
  showWeekReportDialog.value = true
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
  padding: 24px;
}

.deep-dive-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.deep-dive-header-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.weekadvies-cta {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
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
  padding: 24px;
}

.kpi-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}

.kpi-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: q.$radius-sm;
  padding: 20px;
  min-width: 0;
}

.kpi-label {
  font-family: q.$typography-font-family;
  font-size: 0.6rem;
  font-weight: 700;
  color: q.$prime-gray;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-bottom: 6px;
}

.kpi-value {
  font-family: q.$mono-font;
  font-size: 1.35rem;
  font-weight: 700;
  color: #ffffff;
  line-height: 1.2;
}

.kpi-pill {
  display: inline-block;
  margin-top: 6px;
  font-family: q.$typography-font-family;
  font-size: 0.6rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 2px 8px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.06);
  color: q.$prime-gray;
}

.kpi-pill.load-balance-optimal {
  background: rgba(34, 197, 94, 0.15);
  color: q.$status-push;
}

.kpi-pill.load-balance-outside {
  background: rgba(249, 115, 22, 0.15);
  color: q.$status-maintain;
}

.kpi-sub {
  font-size: 0.65rem;
  color: q.$prime-gray;
  margin-top: 4px;
}

.load-balance-optimal {
  color: q.$status-push;
}

.load-balance-outside {
  color: q.$status-maintain;
}

.load-balance-unknown {
  color: q.$prime-gray;
}

.triage-ok {
  color: q.$status-push;
}

.triage-bad {
  color: q.$status-recover;
}

.triage-unknown {
  color: q.$prime-gray;
}

.strava-one-line {
  white-space: nowrap;
}

.prime-load {
  color: q.$prime-gold;
}

.prime-load-section {
  margin-bottom: 8px;
}

.prime-load-detail {
  margin-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 10px;
}

.prime-load-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 6px;
}

.prime-load-date {
  font-family: q.$typography-font-family;
  font-size: 0.8rem;
  color: #ffffff;
}

.prime-load-total {
  font-family: q.$mono-font;
  font-size: 0.8rem;
}

.prime-load-activity-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}

.prime-load-activity-table thead tr {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.prime-load-activity-table th {
  font-family: q.$typography-font-family;
  font-size: 0.6rem;
  font-weight: 700;
  color: q.$prime-gray;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  text-align: left;
  padding: 4px 0;
}

.prime-load-activity-table th.th-right {
  text-align: right;
}

.prime-load-activity-table tbody tr {
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.prime-load-activity-table td {
  padding: 4px 0;
  vertical-align: middle;
}

.deep-dive-section-label {
  font-family: q.$typography-font-family;
  font-size: 0.65rem;
  font-weight: 700;
  color: q.$prime-gray;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin: 0 0 12px 0;
}

.deep-dive-section-label.trends-label {
  margin-top: 28px;
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

.activity-date span,
.activity-load {
  font-feature-settings: 'tnum' 1;
}

.timeframe-segmented {
  display: inline-flex;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: q.$radius-sm;
  padding: 2px;
  gap: 0;
}

.timeframe-seg-item {
  font-family: q.$typography-font-family;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: q.$prime-gray;
  background: transparent;
  border: none;
  padding: 6px 14px;
  border-radius: 2px;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}

.timeframe-seg-item:hover {
  color: rgba(255, 255, 255, 0.9);
}

.timeframe-seg-item.active {
  background: q.$prime-gold;
  color: #050505;
}

.load-card {
  margin-top: 0;
  background: q.$prime-surface;
  border-radius: q.$radius-sm;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.load-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.load-card-title {
  font-family: q.$typography-font-family;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #ffffff;
}

.load-card-body {
  padding: 20px 24px 24px;
}

.load-subtitle {
  margin: 0 0 8px 0;
}

.load-chart-block {
  margin-bottom: 12px;
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
