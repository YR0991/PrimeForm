<template>
  <q-page class="user-dashboard elite-page">
    <div class="pilot-container">
      <!-- Header: Greeting + Cycle Phase -->
      <header class="pilot-header">
        <h1 class="pilot-greeting">
          Goedemorgen<span v-if="greetingName">, {{ greetingName }}</span>
        </h1>
        <div class="cycle-phase-badge">
          <template v-if="cycle.phaseLabel">
            {{ cycle.phaseLabel }} – Dag {{ cycle.cycleDay || '—' }} {{ cycleEmoji }}
          </template>
          <template v-else>
            Cyclus niet ingesteld
            <router-link to="/profile" class="cycle-cta">Vul cyclus in</router-link>
          </template>
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

      <!-- Recente Activiteiten (Strava, laatste 7 dagen) -->
      <q-card class="history-card" flat>
        <q-card-section>
          <div class="strava-mini-status">
            <span class="strava-mini-text">{{ stravaStatusText }}</span>
            <span v-if="stravaHasError" class="strava-mini-error">
              <q-icon name="warning" size="14px" class="q-mr-xs" />
              {{ stravaErrorText }}
            </span>
          </div>
          <div class="history-label">RECENTE ACTIVITEITEN (LAATSTE 7)</div>
          <table v-if="activities.length" class="activity-table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Activiteit</th>
                <th class="th-right">PrimeLoad</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(act, i) in activities" :key="act.id || i">
                <td class="elite-data activity-date">{{ formatActivityDate(act) }}</td>
                <td>
                  <span class="activity-type-cell">
                    <q-icon :name="activityIcon(act.type)" size="14px" class="q-mr-xs" />
                    <span>
                      {{ act.type || 'Workout' }}
                      <span v-if="act.name"> — {{ act.name }}</span>
                    </span>
                  </span>
                </td>
                <td class="elite-data activity-load">{{ formatPrimeLoad(act.primeLoad) }}</td>
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
            <div class="telemetry-label">
              Trainingbelasting (7 dagen)
              <q-icon name="info_outline" size="14px" class="q-ml-xs">
                <q-tooltip anchor="top middle" self="bottom middle">
                  Hoger = meer totale trainingsprikkel. Vergelijk met je belastingbalans (ACWR) voor risico op overbelasting.
                </q-tooltip>
              </q-icon>
            </div>
            <div class="telemetry-value elite-data">{{ data.primeLoad7d }}</div>
            <div class="telemetry-subtext">
              Som van je PrimeLoad over de laatste 7 dagen. Gebruik dit om pieken te zien.
            </div>
          </q-card-section>
        </q-card>
        <q-card class="telemetry-card" flat>
          <q-card-section>
            <div class="telemetry-label">
              Belastingbalans
              <q-icon name="info_outline" size="14px" class="q-ml-xs">
                <q-tooltip anchor="top middle" self="bottom middle">
                  &lt; 0.80 = Onderbelasting<br>
                  0.80–1.30 = In balans<br>
                  1.30–1.50 = Verhoogd risico<br>
                  &gt; 1.50 = Hoog risico
                </q-tooltip>
              </q-icon>
            </div>

            <template v-if="hasAcwr">
              <div class="telemetry-value elite-data">
                {{ Number(data.acwr).toFixed(2) }}
              </div>

              <div class="acwr-scale">
                <div class="acwr-scale-bar">
                  <div class="acwr-band acwr-band-under"></div>
                  <div class="acwr-band acwr-band-sweet"></div>
                  <div class="acwr-band acwr-band-risk"></div>
                  <div class="acwr-band acwr-band-high"></div>
                  <div class="acwr-marker" :style="{ left: acwrMarkerPosition + '%' }"></div>
                </div>
                <div class="acwr-scale-labels">
                  <span>0.5</span>
                  <span>1.0</span>
                  <span>1.5</span>
                  <span>2.0</span>
                </div>
              </div>

              <div class="acwr-legend">
                <span>&lt; 0.80 = Onderbelasting</span>
                <span>0.80–1.30 = In balans</span>
                <span>1.30–1.50 = Verhoogd risico</span>
                <span>&gt; 1.50 = Hoog risico</span>
              </div>
            </template>

            <template v-else>
              <div class="telemetry-value elite-data">—</div>
              <div class="acwr-empty">Nog geen data</div>
              <div class="acwr-cta-row">
                <q-btn
                  v-if="authStore.stravaConnected"
                  flat
                  dense
                  no-caps
                  class="acwr-cta"
                  :loading="stravaSyncing"
                  @click="syncStravaNow"
                >
                  Sync Strava
                </q-btn>
                <router-link v-else to="/" class="acwr-cta-link">
                  Log check-in
                </router-link>
              </div>
            </template>
          </q-card-section>
        </q-card>
      </div>

      <!-- Primary Action: START CHECK-IN -->
      <q-btn
        class="checkin-btn"
        unelevated
        no-caps
        @click="openCheckinDialog"
      >
        START CHECK-IN
      </q-btn>

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

      <!-- Check-in Dialog -->
      <q-dialog v-model="showCheckinDialog" persistent>
        <q-card class="checkin-card">
          <q-card-section>
            <div class="checkin-title">Dagelijkse check-in</div>
            <div class="checkin-subtitle">
              Vul je readiness en kernwaardes in. Deze check-in voedt je AI-coach.
            </div>
          </q-card-section>

          <q-card-section class="checkin-body">
            <div class="checkin-field">
              <label class="checkin-label">Readiness (1–10)</label>
              <q-input
                v-model.number="checkinForm.readiness"
                type="number"
                outlined
                dark
                dense
                :min="1"
                :max="10"
              />
            </div>

            <div class="checkin-field">
              <label class="checkin-label">Slaap (uren, optioneel)</label>
              <q-input
                v-model.number="checkinForm.sleep"
                type="number"
                outlined
                dark
                dense
                :min="3"
                :max="12"
              />
            </div>

            <div class="checkin-field">
              <label class="checkin-label">HRV</label>
              <q-input
                v-model.number="checkinForm.hrv"
                type="number"
                outlined
                dark
                dense
              />
            </div>

            <div class="checkin-field">
              <label class="checkin-label">RHR (rusthartslag)</label>
              <q-input
                v-model.number="checkinForm.rhr"
                type="number"
                outlined
                dark
                dense
              />
            </div>

            <div class="checkin-field checkin-row">
              <q-checkbox
                v-model="checkinForm.menstruationStarted"
                color="pink-5"
                keep-color
                label="Menstruatie vandaag begonnen"
              />
            </div>

            <div class="checkin-field">
              <label class="checkin-label">Laatste menstruatie (YYYY-MM-DD)</label>
              <q-input
                v-model="checkinForm.lastPeriodDate"
                type="date"
                outlined
                dark
                dense
              />
            </div>

            <div class="checkin-field">
              <label class="checkin-label">Gemiddelde cyclusduur (dagen)</label>
              <q-input
                v-model.number="checkinForm.cycleLength"
                type="number"
                outlined
                dark
                dense
                :min="21"
                :max="35"
              />
            </div>

            <div class="checkin-baseline-hint">
              <div class="checkin-label">Baselines (RHR / HRV)</div>
              <div class="checkin-baseline-values">
                RHR-baseline: {{ effectiveRhrBaseline }} • HRV-baseline: {{ effectiveHrvBaseline }}
              </div>
              <div v-if="usesTempBaselines" class="checkin-baseline-warning">
                We gebruiken tijdelijk je huidige waardes als baseline. Stel later je echte baselines in onder Profiel.
              </div>
            </div>

            <div v-if="checkinError" class="checkin-error">
              {{ checkinError }}
            </div>

            <div v-if="checkinResult" class="checkin-result">
              <div class="checkin-result-status">
                Advies: {{ checkinResult.recommendation?.status || checkinResult.status || '—' }}
              </div>
              <div v-if="checkinResult.aiMessage" class="checkin-result-message">
                {{ checkinResult.aiMessage }}
              </div>
            </div>
          </q-card-section>

          <q-card-actions align="between" class="checkin-actions">
            <q-btn flat no-caps color="grey-5" @click="closeCheckinDialog">
              Annuleren
            </q-btn>
            <q-btn
              class="checkin-submit-btn"
              unelevated
              no-caps
              :loading="checkinLoading"
              @click="submitCheckin"
            >
              Verstuur check-in
            </q-btn>
          </q-card-actions>
        </q-card>
      </q-dialog>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import { useAuthStore } from '../../stores/auth.js'
import { api } from '../../services/httpClient.js'
import { getAthleteDashboard, normalizeCycle } from '../../services/userService.js'

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
  stravaMeta: null,
  cycleLength: 28,
  phaseDay: null,
  ghostComparison: null,
})

const menstruationLengthDefault = 5

const cycle = computed(() => {
  const c = data.value.cycle || {}
  const phaseLabel = c.phaseLabel || c.phase || data.value.cyclePhase
  let cycleDay = c.cycleDay ?? data.value.cycleDay ?? null
  cycleDay = cycleDay != null ? Number(cycleDay) : null
  if (!Number.isFinite(cycleDay) || cycleDay <= 0) cycleDay = null

  return {
    phase: c.phase || phaseLabel,
    phaseLabel: phaseLabel || '',
    cycleDay,
  }
})

const cycleEmoji = computed(() => {
  const phase = cycle.value.phase || ''
  const day = cycle.value.cycleDay
  const menstruationLength = menstruationLengthDefault
  const s = String(phase).toLowerCase()

  // Bloed-icoon: alleen bij dag 1–5 of wanneer fase op menstruatie duidt
  if ((day != null && day >= 1 && day <= menstruationLength) || s.includes('menstru')) {
    return '🩸'
  }

  // Overige fase-iconen
  if (s.includes('follic')) return '🌱'
  if (s.includes('ovu')) return '⚡️'
  if (s.includes('lut')) return '🌙'
  return ''
})

const greetingName = computed(() => {
  const user = authStore.user || {}
  if (user.displayName) return user.displayName

  const email = user.email || ''
  const localPart = email.split('@')[0] || ''
  if (localPart) return localPart

  return ''
})

const stravaMeta = computed(() => data.value.stravaMeta || {})

const stravaStatusText = computed(() => {
  const meta = stravaMeta.value
  const connected = authStore.stravaConnected || meta.connected === true
  const prefix = connected ? 'Strava: gekoppeld' : 'Strava: niet gekoppeld'

  const rawLast =
    meta.lastWebhookAt ||
    meta.lastSyncedAt ||
    meta.lastSyncAt ||
    meta.lastSuccessAt ||
    null
  const d = parseFirestoreDate(rawLast)
  if (!d) return prefix

  const ts = d.toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${prefix} • Laatste update: ${ts}`
})

const stravaHasError = computed(() => {
  const meta = stravaMeta.value
  return !!(meta.lastError || meta.error)
})

const stravaErrorText = computed(() => {
  const meta = stravaMeta.value
  return meta.lastError || meta.error || ''
})

const activities = ref([])
const activitiesLoading = ref(false)
const historyLoading = ref(false)
const historyLogs = ref([])
const stravaSyncing = ref(false)

// Check-in dialog state
const showCheckinDialog = ref(false)
const checkinLoading = ref(false)
const checkinError = ref('')
const checkinResult = ref(null)
const checkinForm = ref({
  readiness: null,
  sleep: 8,
  hrv: null,
  rhr: null,
  menstruationStarted: false,
  lastPeriodDate: '',
  cycleLength: 28,
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
  const raw =
    act.start ||
    act.start_date_local ||
    act.start_date ||
    act.date ||
    act.timestamp
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

function extractPrimeLoad(activity) {
  const candidates = [
    activity.primeLoad,
    activity.loadUsed,
    activity._primeLoad,
    activity.metrics?.primeLoad,
    activity.metrics?.load,
    activity.suffer_score,
  ]
  for (const v of candidates) {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return null
}

function isStravaActivity(activity) {
  if (!activity || typeof activity !== 'object') return false
  const source = (activity.source || '').toString().toLowerCase()
  if (source === 'strava') return true
  if (activity.start_date_local || activity.start_date) return true
  if (activity.type && activity.name) return true
  return false
}

function normalizeStravaActivities(list) {
  const items = Array.isArray(list) ? list : []
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const enriched = items
    .filter(isStravaActivity)
    .map((a, idx) => {
      const raw =
        a.start_date_local ||
        a.start_date ||
        a.start ||
        a.date ||
        a.timestamp
      const d = parseFirestoreDate(raw)
      return {
        src: a,
        start: d,
        index: idx,
      }
    })
    .filter((x) => x.start && x.start >= weekAgo && x.start <= now)
    .sort((a, b) => b.start - a.start)
    .slice(0, 20)

  return enriched.map((x, i) => {
    const a = x.src
    return {
      id: a.id || a.activityId || a._id || x.index || i,
      start: x.start,
      type: a.type || 'Workout',
      name: a.name || a.workout_name || '',
      primeLoad: extractPrimeLoad(a),
    }
  })
}

function formatPrimeLoad(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(1)
}

// --- HRV/RHR chart: history_logs met 7d en 28d rollend gemiddelde ---
function toDateStr(val) {
  if (!val) return ''
  if (typeof val === 'string') return val.slice(0, 10)
  if (typeof val?.toDate === 'function') return val.toDate().toISOString().slice(0, 10)
  if (typeof val === 'number') return new Date(val).toISOString().slice(0, 10)
  return String(val).slice(0, 10)
}

function toCycleDay(dateStr, lastPeriodDate, cycleLength) {
  if (!dateStr || !lastPeriodDate) return null
  const d = new Date(dateStr)
  const lp = new Date(lastPeriodDate)
  if (isNaN(d.getTime()) || isNaN(lp.getTime())) return null
  const diffDays = Math.floor((d.getTime() - lp.getTime()) / (1000 * 60 * 60 * 24))
  const len = Number(cycleLength) || 28
  const day = (diffDays % len) + 1
  return day >= 1 && day <= len ? day : null
}

// HRV/RHR cycle-aligned charts (huidige vs vorige cyclus)

const hrvChartSeries = computed(() => {
  const logs = Array.isArray(historyLogs.value) ? historyLogs.value : []
  const cycleLength = Number(data.value.cycleLength) || 28
  const phaseDay =
    Number(data.value.phaseDay) ||
    Number(data.value.cycleDay) ||
    Number(data.value.cycle?.cycleDay) ||
    null

  const profile = authStore.profile || {}
  const cd = profile.cycleData || {}
  const lastPeriod =
    profile.lastPeriodDate ||
    cd.lastPeriodDate ||
    cd.lastPeriod ||
    null

  const current = []

  if (lastPeriod) {
    logs.forEach((l) => {
      const dateStr = toDateStr(l.date ?? l.timestamp)
      const day = toCycleDay(dateStr, lastPeriod, cycleLength)
      if (!day) return
      if (phaseDay && day > phaseDay) return
      const raw = l.hrv ?? l.metrics?.hrv ?? (typeof l.metrics?.hrv === 'object' ? l.metrics?.hrv?.current : null)
      const val = Number(raw)
      if (!Number.isFinite(val)) return
      current.push({ x: day, y: val })
    })
  } else {
    // Fallback: map de laatste N logs op dagen 1..N
    const sorted = [...logs].sort((a, b) => {
      const ta = parseFirestoreDate(a.date ?? a.timestamp)?.getTime() ?? 0
      const tb = parseFirestoreDate(b.date ?? b.timestamp)?.getTime() ?? 0
      return ta - tb
    })
    const maxPoints = phaseDay && phaseDay > 0 ? phaseDay : cycleLength
    const slice = sorted.slice(-maxPoints)
    slice.forEach((l, idx) => {
      const raw = l.hrv ?? l.metrics?.hrv ?? (typeof l.metrics?.hrv === 'object' ? l.metrics?.hrv?.current : null)
      const val = Number(raw)
      if (!Number.isFinite(val)) return
      current.push({ x: idx + 1, y: val })
    })
  }

  const ghost = Array.isArray(data.value.ghostComparison) ? data.value.ghostComparison : []
  const previous = ghost.map((g, idx) => {
    const day =
      Number(g.cycleDay ?? g.day) ||
      idx + 1
    const raw = g.hrv ?? g.metrics?.hrv ?? (typeof g.metrics?.hrv === 'object' ? g.metrics?.hrv?.current : null)
    const val = Number(raw)
    return {
      x: day,
      y: Number.isFinite(val) ? val : null,
    }
  }).filter((p) => p.y != null && p.x >= 1 && p.x <= cycleLength)

  const series = [
    { name: 'Huidige cyclus', data: current.sort((a, b) => a.x - b.x) },
  ]
  if (previous.length) {
    series.push({ name: 'Vorige cyclus', data: previous.sort((a, b) => a.x - b.x) })
  }
  return series
})

const rhrChartSeries = computed(() => {
  const logs = Array.isArray(historyLogs.value) ? historyLogs.value : []
  const cycleLength = Number(data.value.cycleLength) || 28
  const phaseDay =
    Number(data.value.phaseDay) ||
    Number(data.value.cycleDay) ||
    Number(data.value.cycle?.cycleDay) ||
    null

  const profile = authStore.profile || {}
  const cd = profile.cycleData || {}
  const lastPeriod =
    profile.lastPeriodDate ||
    cd.lastPeriodDate ||
    cd.lastPeriod ||
    null

  const current = []

  if (lastPeriod) {
    logs.forEach((l) => {
      const dateStr = toDateStr(l.date ?? l.timestamp)
      const day = toCycleDay(dateStr, lastPeriod, cycleLength)
      if (!day) return
      if (phaseDay && day > phaseDay) return
      const raw = l.rhr ?? l.metrics?.rhr ?? (typeof l.metrics?.rhr === 'object' ? l.metrics?.rhr?.current : null)
      const val = Number(raw)
      if (!Number.isFinite(val)) return
      current.push({ x: day, y: val })
    })
  } else {
    const sorted = [...logs].sort((a, b) => {
      const ta = parseFirestoreDate(a.date ?? a.timestamp)?.getTime() ?? 0
      const tb = parseFirestoreDate(b.date ?? b.timestamp)?.getTime() ?? 0
      return ta - tb
    })
    const maxPoints = phaseDay && phaseDay > 0 ? phaseDay : cycleLength
    const slice = sorted.slice(-maxPoints)
    slice.forEach((l, idx) => {
      const raw = l.rhr ?? l.metrics?.rhr ?? (typeof l.metrics?.rhr === 'object' ? l.metrics?.rhr?.current : null)
      const val = Number(raw)
      if (!Number.isFinite(val)) return
      current.push({ x: idx + 1, y: val })
    })
  }

  const ghost = Array.isArray(data.value.ghostComparison) ? data.value.ghostComparison : []
  const previous = ghost.map((g, idx) => {
    const day =
      Number(g.cycleDay ?? g.day) ||
      idx + 1
    const raw = g.rhr ?? g.metrics?.rhr ?? (typeof g.metrics?.rhr === 'object' ? g.metrics?.rhr?.current : null)
    const val = Number(raw)
    return {
      x: day,
      y: Number.isFinite(val) ? val : null,
    }
  }).filter((p) => p.y != null && p.x >= 1 && p.x <= cycleLength)

  const series = [
    { name: 'Huidige cyclus', data: current.sort((a, b) => a.x - b.x) },
  ]
  if (previous.length) {
    series.push({ name: 'Vorige cyclus', data: previous.sort((a, b) => a.x - b.x) })
  }
  return series
})

const hasHrvRhrData = computed(() => {
  const a = hrvChartSeries.value[0].data.length
  const b = hrvChartSeries.value[1].data.length
  const c = rhrChartSeries.value[0].data.length
  const d = rhrChartSeries.value[1].data.length
  return a > 0 || b > 0 || c > 0 || d > 0
})

const hasAcwr = computed(() => {
  const v = Number(data.value.acwr)
  return Number.isFinite(v)
})

const acwrMarkerPosition = computed(() => {
  const v = Number(data.value.acwr)
  if (!Number.isFinite(v)) return 0
  const min = 0.5
  const max = 2.0
  const clamped = Math.min(max, Math.max(min, v))
  return ((clamped - min) / (max - min)) * 100
})

const effectiveRhrBaseline = computed(() => {
  const fromDashboard = Number(data.value.rhrBaseline)
  if (Number.isFinite(fromDashboard)) return fromDashboard
  const current = Number(checkinForm.value.rhr)
  return Number.isFinite(current) ? current : '—'
})

const effectiveHrvBaseline = computed(() => {
  const fromDashboard = Number(data.value.hrvBaseline)
  if (Number.isFinite(fromDashboard)) return fromDashboard
  const current = Number(checkinForm.value.hrv)
  return Number.isFinite(current) ? current : '—'
})

const usesTempBaselines = computed(() => {
  const dashRhr = Number(data.value.rhrBaseline)
  const dashHrv = Number(data.value.hrvBaseline)
  return !Number.isFinite(dashRhr) || !Number.isFinite(dashHrv)
})

const eliteChartOptions = (colors, cycleLength) => ({
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
    type: 'numeric',
    min: 1,
    max: cycleLength || 28,
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
  tooltip: {
    theme: 'dark',
    x: {
      formatter: (val) => `Dag ${val}`,
    },
  }
})

const hrvChartOptions = computed(() => eliteChartOptions(['#22c55e', '#16a34a'], data.value.cycleLength || 28))
const rhrChartOptions = computed(() => eliteChartOptions(['#ef4444', '#dc2626'], data.value.cycleLength || 28))

async function syncStravaNow() {
  stravaSyncing.value = true
  try {
    await api.post('/api/strava/sync-now')
    await authStore.fetchUserProfile()
    await loadDashboard()
  } catch (e) {
    console.error('Strava sync failed', e)
  } finally {
    stravaSyncing.value = false
  }
}

function openCheckinDialog() {
  checkinError.value = ''
  checkinResult.value = null

  const profile = authStore.profile || {}
  const cd = profile.cycleData || {}
  const lastPeriod =
    checkinForm.value.lastPeriodDate ||
    profile.lastPeriodDate ||
    cd.lastPeriodDate ||
    cd.lastPeriod ||
    ''
  const cycleLength =
    checkinForm.value.cycleLength ||
    profile.cycleLength ||
    cd.avgDuration ||
    28

  checkinForm.value = {
    readiness: checkinForm.value.readiness ?? data.value.readiness ?? 7,
    sleep: checkinForm.value.sleep ?? 8,
    hrv: checkinForm.value.hrv,
    rhr: checkinForm.value.rhr,
    menstruationStarted: checkinForm.value.menstruationStarted || false,
    lastPeriodDate: lastPeriod,
    cycleLength: Number.isFinite(Number(cycleLength)) ? Number(cycleLength) : 28,
  }

  showCheckinDialog.value = true
}

function closeCheckinDialog() {
  showCheckinDialog.value = false
}

async function submitCheckin() {
  checkinError.value = ''
  checkinResult.value = null

  const readinessVal = Number(checkinForm.value.readiness)
  const hrvVal = Number(checkinForm.value.hrv)
  const rhrVal = Number(checkinForm.value.rhr)
  const sleepVal = checkinForm.value.sleep != null ? Number(checkinForm.value.sleep) : NaN
  const cycleLenVal = Number(checkinForm.value.cycleLength)
  let lastPeriodDate = (checkinForm.value.lastPeriodDate || '').toString().trim()

  if (!Number.isFinite(readinessVal) || readinessVal < 1 || readinessVal > 10) {
    checkinError.value = 'Readiness moet tussen 1 en 10 liggen.'
    return
  }

  if (!Number.isFinite(hrvVal) || hrvVal <= 0) {
    checkinError.value = 'Vul een geldige HRV-waarde in.'
    return
  }

  if (!Number.isFinite(rhrVal) || rhrVal <= 0) {
    checkinError.value = 'Vul een geldige RHR-waarde in.'
    return
  }

  if (!Number.isFinite(cycleLenVal) || cycleLenVal < 21 || cycleLenVal > 35) {
    checkinError.value = 'Gemiddelde cyclusduur moet tussen 21 en 35 dagen liggen.'
    return
  }

  if (!lastPeriodDate) {
    if (!checkinForm.value.menstruationStarted) {
      checkinError.value = 'Vul je laatste menstruatiedatum in.'
      return
    }
    // Als menstruatie vandaag gestart is, gebruik vandaag als Day 1
    lastPeriodDate = new Date().toISOString().slice(0, 10)
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(lastPeriodDate)) {
    checkinError.value = 'Gebruik het formaat YYYY-MM-DD voor je laatste menstruatie.'
    return
  }

  const body = {
    lastPeriodDate,
    cycleLength: cycleLenVal,
    sleep: Number.isFinite(sleepVal) ? sleepVal : undefined,
    rhr: rhrVal,
    rhrBaseline: Number(effectiveRhrBaseline.value) || rhrVal,
    hrv: hrvVal,
    hrvBaseline: Number(effectiveHrvBaseline.value) || hrvVal,
    readiness: readinessVal,
    menstruationStarted: Boolean(checkinForm.value.menstruationStarted),
  }

  checkinLoading.value = true
  try {
    const res = await api.post('/api/save-checkin', body)
    const payload = res.data?.data ?? res.data ?? {}
    checkinResult.value = payload
    await loadDashboard()
  } catch (e) {
    console.error('Check-in save failed', e)
    const status = e.response?.status
    const data = e.response?.data || {}
    if (status === 400 && Array.isArray(data.missingFields) && data.missingFields.length) {
      checkinError.value = `Ontbrekende velden: ${data.missingFields.join(', ')}`
    } else {
      checkinError.value = data.error || data.message || 'Opslaan mislukt. Probeer opnieuw.'
    }
  } finally {
    checkinLoading.value = false
  }
}

async function loadActivities() {
  // Fallback: laad Strava-activiteiten direct als /api/dashboard geen bruikbare recent_activities had
  activitiesLoading.value = true
  try {
    const uid = authStore.user?.uid
    if (!uid) {
      activities.value = []
      return
    }
    const res = await api.get(`/api/strava/activities/${encodeURIComponent(uid)}`)
    const list = res.data?.data ?? res.data ?? []
    activities.value = normalizeStravaActivities(list)
  } catch (e) {
    console.error('Strava activities load failed:', e)
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
      const cycleInfo = normalizeCycle(payload)
      const readiness = payload.readiness_today ?? payload.readiness ?? data.value.readiness
      const acwr = payload.acwr
      const recentStrava = normalizeStravaActivities(payload.recent_activities)
      if (recentStrava.length) {
        activities.value = recentStrava
      }
      const cycleLength =
        payload.cycle_length ??
        payload.cycleLength ??
        cycleInfo.cycleLength ??
        data.value.cycleLength ??
        28
      const phaseDay =
        payload.phaseDay ??
        payload.current_phase_day ??
        cycleInfo.cycleDay ??
        data.value.phaseDay ??
        null
      const ghostComparison =
        payload.ghost_comparison ??
        payload.ghostComparison ??
        data.value.ghostComparison ??
        null
      data.value = {
        ...data.value,
        readiness: readiness ?? data.value.readiness,
        cyclePhase: cycleInfo.phaseLabel ?? data.value.cyclePhase,
        cycleDay: cycleInfo.cycleDay ?? data.value.cycleDay,
        cycle: cycleInfo,
        acwr: acwr != null ? acwr : data.value.acwr,
        acwrStatus: acwr != null ? (acwr > 1.5 ? 'spike' : acwr > 1.3 ? 'overreaching' : acwr < 0.8 ? 'undertraining' : 'sweet') : data.value.acwrStatus,
        primeLoad7d: payload.recent_activities?.reduce((s, a) => s + (a.loadUsed ?? a._primeLoad ?? 0), 0) ?? data.value.primeLoad7d,
        rhrBaseline: payload.rhr_baseline_28d ?? payload.rhrBaseline ?? data.value.rhrBaseline,
        hrvBaseline: payload.hrv_baseline_28d ?? payload.hrvBaseline ?? data.value.hrvBaseline,
        stravaMeta: payload.strava_meta ?? data.value.stravaMeta,
        cycleLength,
        phaseDay,
        ghostComparison,
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

  await loadDashboard()
  if (!activities.value.length) {
    await loadActivities()
  }
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

/* Generieke badge-typografie voor cycle + directive badges */
.elite-badge {
  font-family: q.$mono-font;
  font-size: 0.8rem;
  color: q.$prime-gray;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.cycle-phase-badge {
  @extend .elite-badge;
}

.cycle-cta {
  margin-left: 8px;
  color: q.$prime-gold;
  text-decoration: none;
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
  font-weight: 700;
  font-size: 2.5rem;
  color: q.$prime-gold;
  margin-bottom: 12px;
}

.advice-badge {
  @extend .elite-badge;
  display: inline-block;
  border: 1px solid;
  padding: 4px 12px;
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

.telemetry-subtext {
  margin-top: 4px;
  font-family: q.$typography-font-family;
  font-size: 0.7rem;
  color: q.$prime-gray;
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

.acwr-scale {
  margin-top: 6px;
  width: 100%;
}

.acwr-scale-bar {
  position: relative;
  display: flex;
  height: 4px;
  border-radius: 2px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
}

.acwr-band {
  height: 100%;
}

.acwr-band-under {
  flex: 3;
  background: rgba(q.$status-maintain, 0.4);
}

.acwr-band-sweet {
  flex: 5;
  background: rgba(q.$status-push, 0.6);
}

.acwr-band-risk {
  flex: 2;
  background: rgba(#f97316, 0.7);
}

.acwr-band-high {
  flex: 5;
  background: rgba(q.$status-recover, 0.6);
}

.acwr-marker {
  position: absolute;
  top: -2px;
  width: 2px;
  height: 8px;
  background: #ffffff;
  box-shadow: 0 0 4px rgba(255, 255, 255, 0.8);
  transform: translateX(-50%);
}

.acwr-scale-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-family: q.$mono-font;
  font-size: 0.6rem;
  color: q.$prime-gray;
}

.acwr-legend {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-family: q.$typography-font-family;
  font-size: 0.6rem;
  color: q.$prime-gray;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.acwr-empty {
  margin-top: 4px;
  font-family: q.$typography-font-family;
  font-size: 0.75rem;
  color: q.$prime-gray;
}

.acwr-cta-row {
  margin-top: 6px;
}

.acwr-cta {
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  color: q.$prime-gold;
}

.acwr-cta-link {
  font-family: q.$typography-font-family;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: q.$prime-gold;
  text-decoration: none;
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

.checkin-card {
  background: q.$prime-black;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: q.$radius-sm;
  width: 100%;
  max-width: 480px;
}

.checkin-title {
  font-family: q.$typography-font-family;
  font-weight: 700;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #ffffff;
}

.checkin-subtitle {
  margin-top: 4px;
  font-family: q.$typography-font-family;
  font-size: 0.75rem;
  color: q.$prime-gray;
}

.checkin-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.checkin-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.checkin-row {
  margin-top: 4px;
}

.checkin-label {
  font-family: q.$typography-font-family;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: q.$prime-gray;
}

.checkin-baseline-hint {
  margin-top: 8px;
  padding-top: 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.checkin-baseline-values {
  margin-top: 2px;
  font-family: q.$mono-font;
  font-size: 0.75rem;
  color: #ffffff;
}

.checkin-baseline-warning {
  margin-top: 2px;
  font-family: q.$typography-font-family;
  font-size: 0.7rem;
  color: q.$status-recover;
}

.checkin-error {
  margin-top: 8px;
  font-family: q.$typography-font-family;
  font-size: 0.75rem;
  color: q.$status-recover;
}

.checkin-result {
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.checkin-result-status {
  font-family: q.$mono-font;
  font-size: 0.8rem;
  color: q.$prime-gold;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.checkin-result-message {
  margin-top: 4px;
  font-family: q.$typography-font-family;
  font-size: 0.85rem;
  color: #ffffff;
}

.checkin-actions {
  padding: 8px 16px 16px;
}

.checkin-submit-btn {
  background: q.$prime-gold !important;
  color: #050505 !important;
  font-family: q.$typography-font-family !important;
  font-weight: 700 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.12em !important;
  border-radius: q.$radius-sm !important;
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

.strava-mini-status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  font-family: q.$typography-font-family;
  font-size: 0.7rem;
  color: q.$prime-gray;
}

.strava-mini-text {
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.strava-mini-error {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: q.$status-recover;
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
