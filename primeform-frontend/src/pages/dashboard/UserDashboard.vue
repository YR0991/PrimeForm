<template>
  <q-page class="user-dashboard elite-page">
    <div class="pilot-container">
      <!-- Header: Greeting + Cycle Phase -->
      <header class="pilot-header">
        <AthleteAvatar
          :avatar="authStore.profile?.avatar"
          :name="greetingName || authStore.user?.displayName"
          size="40px"
          class="pilot-header-avatar q-mr-sm"
        />
        <h1 class="pilot-greeting">
          Hoi<span v-if="greetingName">, {{ greetingName }}</span>
        </h1>
        <div class="cycle-phase-badge">
          <template v-if="cycle.phaseLabel">
            {{ cycle.phaseLabel }} – Dag {{ cycle.cycleDay || '—' }} {{ cycleEmoji }}
          </template>
          <template v-else>
            Cyclus: n.v.t.
          </template>
        </div>
      </header>

      <!-- Primary KPI: Vandaag — Opdracht (dagadvies) -->
      <q-card class="kpi-card today-card" flat>
        <q-card-section class="kpi-section today-section today-advice-card">
          <div class="kpi-label">VANDAAG — OPDRACHT</div>

          <template v-if="!todayHasMessage">
            <div class="today-empty-text">Nog geen check-in vandaag.</div>
            <q-btn
              class="today-primary-btn"
              unelevated
              no-caps
              @click="openCheckinDialog"
            >
              START CHECK-IN
            </q-btn>
          </template>

          <template v-else>
            <div class="advice-status-row">
              <span class="today-status-dot" :class="`today-status-${todayStatusLevel}`"></span>
              <span class="today-status-label">
                {{ todayStatusLabel }}
              </span>
            </div>

            <div class="advice-text">
              {{ formatAiAdvice(data.dailyAdvice) }}
            </div>

            <q-btn
              flat
              dense
              no-caps
              class="today-secondary-btn action-link"
              @click="openCheckinResult"
            >
              BEKIJK CHECK-IN
            </q-btn>
          </template>
        </q-card-section>
      </q-card>

      <!-- Recente Activiteiten (laatste 7) -->
      <q-card class="history-card" flat>
        <q-card-section>
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
                <td class="elite-data activity-date">{{ formatActivityDate(act.startDate ?? act.date) }}</td>
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

      <!-- KPI strip: 4 tiles — ACWR, Trainingsvolume (7d), PrimeLoad (7d), Readiness -->
      <div class="kpi-strip">
        <!-- 1. ACWR -->
        <q-card class="kpi-tile" flat>
          <q-card-section class="kpi-tile-section">
            <div class="kpi-tile-label">ACWR</div>
            <div class="kpi-tile-value">
              {{ hasAcwr ? Number(data.acwr).toFixed(1) : '—' }}
            </div>
            <div class="kpi-tile-subtext">Belastingbalans</div>
            <template v-if="hasAcwr">
              <div class="acwr-scale acwr-scale-compact">
                <div class="acwr-scale-bar">
                  <div class="acwr-band acwr-band-under"></div>
                  <div class="acwr-band acwr-band-sweet"></div>
                  <div class="acwr-band acwr-band-risk"></div>
                  <div class="acwr-band acwr-band-high"></div>
                  <div class="acwr-marker" :style="{ left: acwrMarkerPosition + '%' }"></div>
                </div>
                <div class="acwr-scale-labels">
                  <span>0.5</span><span>1.0</span><span>1.5</span><span>2.0</span>
                </div>
              </div>
            </template>
          </q-card-section>
        </q-card>
        <!-- 2. Trainingsvolume (7d) -->
        <q-card class="kpi-tile" flat>
          <q-card-section class="kpi-tile-section">
            <div class="kpi-tile-label">Trainingsvolume (7d)</div>
            <div class="kpi-tile-value">{{ formatKpiDecimal(data.trainingVolume7d) }}</div>
            <div class="kpi-tile-subtext">Som loadUsed</div>
          </q-card-section>
        </q-card>
        <!-- 3. PrimeLoad (7d) -->
        <q-card class="kpi-tile" flat>
          <q-card-section class="kpi-tile-section">
            <div class="kpi-tile-label">PrimeLoad (7d)</div>
            <div class="kpi-tile-value">{{ formatKpiDecimal(data.primeLoad7d) }}</div>
            <div class="kpi-tile-subtext">Som PrimeLoad</div>
          </q-card-section>
        </q-card>
        <!-- 4. Readiness -->
        <q-card class="kpi-tile" flat>
          <q-card-section class="kpi-tile-section">
            <div class="kpi-tile-label">Readiness</div>
            <div class="kpi-tile-value">{{ readinessDisplayValue }}</div>
            <div class="kpi-tile-subtext">{{ readinessSubtext }}</div>
            <div v-if="lastCheckinDateDisplay" class="kpi-tile-extra">{{ lastCheckinDateDisplay }}</div>
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
      <q-dialog v-model="showCheckinDialog" persistent class="checkin-dialog">
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

            <div class="checkin-field checkin-row">
              <q-checkbox
                v-model="checkinForm.isSickOrInjured"
                color="red-5"
                keep-color
                label="Handrem (ziek of geblesseerd)"
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
import { getAthleteDashboard, compute7dFromActivities } from '../../services/userService.js'
import AthleteAvatar from '../../components/AthleteAvatar.vue'

const authStore = useAuthStore()

const getOrCreateUserId = () => {
  const key = 'primeform_user_id'
  return localStorage.getItem(key) || `pf_${Date.now()}`
}

const data = ref({
  greeting: 'Goedemorgen',
  cyclePhase: null,
  cycleDay: null,
  cycleEmoji: '🩸',
  readiness: 7,
  dailyAdvice: 'MAINTAIN',
  trainingVolume7d: 0,
  primeLoad7d: 0,
  acwr: 0,
  acwrStatus: 'sweet',
  stravaMeta: null,
  cycleLength: 28,
  phaseDay: null,
  ghostComparison: null,
  todayLog: null,
  cycleContext: null,
  lastCheckinDate: null,
})

const menstruationLengthDefault = 5

// Header: alleen data.cycleContext; geen history_logs, ghost_comparison, phase/phaseDay/cycleDay legacy
const cycle = computed(() => {
  const ctx = data.value.cycleContext ?? null
  if (ctx?.confidence !== 'HIGH') {
    return { phase: '', phaseLabel: '', cycleDay: null }
  }
  const phaseLabel = (ctx.phaseLabelNL ?? ctx.phaseName ?? '').trim() || ''
  const cycleDay =
    ctx.phaseDay != null && Number.isFinite(Number(ctx.phaseDay)) && Number(ctx.phaseDay) > 0
      ? Number(ctx.phaseDay)
      : null
  return {
    phase: phaseLabel,
    phaseLabel,
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

const todayLog = computed(() => data.value.todayLog || null)

function formatAiAdvice(raw) {
  if (!raw) return ''
  let t = String(raw)

  // 1) remove markdown headings like ### ...
  t = t.replace(/^#{1,6}\s*/gm, '')

  // 2) remove bullet markers ("•", "-", "*") aan begin van regels
  t = t.replace(/^\s*([•*-]|\d+\.)\s+/gm, '')

  // 3) remove bold/italic markdown
  t = t.replace(/\*\*(.*?)\*\*/g, '$1')
  t = t.replace(/\*(.*?)\*/g, '$1')
  t = t.replace(/__(.*?)__/g, '$1')
  t = t.replace(/_(.*?)_/g, '$1')

  // 4) collapse excessive blank lines
  t = t.replace(/\n{3,}/g, '\n\n').trim()

  return t
}

const todayHasMessage = computed(() => {
  const msg = todayLog.value?.aiMessage
  return typeof msg === 'string' && msg.trim().length > 0
})

function normalizeTodayStatus(raw) {
  if (!raw) return null
  const s = String(raw).trim().toUpperCase()
  if (s === 'PUSH') return 'push'
  if (s === 'MAINTAIN') return 'maintain'
  if (s === 'RECOVER') return 'recover'
  if (s === 'REST') return 'rest'
  return null
}

const todayStatusLevel = computed(() => {
  const raw = todayLog.value?.recommendation?.status || todayLog.value?.status
  return normalizeTodayStatus(raw) || 'maintain'
})

const todayStatusLabel = computed(() => {
  if (!todayHasMessage.value) return '—'
  const lvl = todayStatusLevel.value
  if (lvl === 'push') return 'PUSH'
  if (lvl === 'recover') return 'RECOVER'
  if (lvl === 'rest') return 'REST'
  return 'MAINTAIN'
})

const activities = ref([])
const activitiesLoading = ref(false)
const historyLoading = ref(false)
const historyLogs = ref([])

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
  isSickOrInjured: false,
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

function toJsDate(v) {
  if (!v) return null
  if (typeof v?.toDate === 'function') return v.toDate()
  if (v instanceof Date) return v
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v)
    return isNaN(d.getTime()) ? null : d
  }
  if (typeof v === 'object') {
    const s = v._seconds ?? v.seconds
    if (Number.isFinite(Number(s))) {
      const d = new Date(Number(s) * 1000)
      return isNaN(d.getTime()) ? null : d
    }
  }
  return null
}

/** Activity table: date only YYYY-MM-DD, or "—" when missing. */
function formatActivityDate(value) {
  const d = toJsDate(value)
  if (!d) return '—'
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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

/**
 * Map raw activities (from GET /api/dashboard payload.recent_activities or GET /api/activities)
 * to display shape. Defensive mapping; sort desc by date; slice to 7.
 */
function mapRecentActivities(list) {
  const items = Array.isArray(list) ? list : []
  const mapped = items.map((activity, idx) => {
    const dateRaw = activity.date ?? activity.start_date_local ?? activity.start_date ?? activity.start ?? activity.timestamp ?? null
    const date = toJsDate(dateRaw) || parseFirestoreDate(dateRaw)
    const type = activity.type ?? activity.sport_type ?? 'Workout'
    const primeLoad = activity.primeLoad ?? activity.loadUsed ?? activity.load ?? extractPrimeLoad(activity)
    return {
      id: activity.id ?? activity.activityId ?? activity._id ?? idx,
      startDate: date ? date.toISOString() : null,
      date,
      type,
      name: activity.name ?? activity.workout_name ?? '',
      primeLoad: primeLoad != null ? Number(primeLoad) : null,
    }
  })
  const sorted = mapped
    .filter((a) => a.date)
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 7)
  return sorted
}

function formatPrimeLoad(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(1)
}

function formatKpiDecimal(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(1)
}

const readinessDisplayValue = computed(() => {
  const r =
    data.value.readiness_today ??
    data.value.todayLog?.metrics?.readiness ??
    data.value.readiness
  if (r != null && Number.isFinite(Number(r))) return String(Number(r))
  return '—'
})

const readinessSubtext = computed(() => {
  if (data.value.todayLog != null) return 'Vandaag check-in gedaan'
  return 'Geen check-in vandaag'
})

const lastCheckinDateDisplay = computed(() => {
  const raw = data.value.lastCheckinDate
  if (!raw) return ''
  const d = toJsDate(raw) || (typeof raw === 'string' ? new Date(raw) : null)
  if (!d || isNaN(d.getTime())) return ''
  const formatted = d.toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  return `Laatste check-in: ${formatted}`
})

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

// Huidige cyclus: thick solid line, markers on. Vorige cyclus: thin dashed line, low opacity, no markers.
const eliteChartOptions = (colors, cycleLength) => {
  const baseColors = colors || ['#22c55e', '#16a34a']
  const currentColor = baseColors[0]
  const previousColorRaw = baseColors[1] || baseColors[0]
  const previousColorRgba = (() => {
    const hex = previousColorRaw.replace(/^#/, '')
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
      foreColor: 'rgba(255,255,255,0.75)'
    },
    theme: { mode: 'dark' },
    stroke: {
      curve: 'smooth',
      width: [3, 1.5],
      dashArray: [0, 6]
    },
    colors: [currentColor, previousColorRgba],
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
    markers: {
      size: [4, 0],
      hover: { sizeOffset: 4 }
    },
    legend: {
      labels: { colors: '#9ca3af' },
      fontSize: '11px',
      showForSingleSeries: false
    },
    tooltip: {
      theme: 'dark',
      x: {
        formatter: (val) => `Dag ${val}`,
      },
    }
  }
}

const hrvChartOptions = computed(() => eliteChartOptions(['#22c55e', '#16a34a'], data.value.cycleLength || 28))
const rhrChartOptions = computed(() => eliteChartOptions(['#ef4444', '#dc2626'], data.value.cycleLength || 28))

function openCheckinDialog() {
  checkinError.value = ''
  checkinResult.value = null

  checkinForm.value = {
    readiness: checkinForm.value.readiness ?? data.value.readiness ?? 7,
    sleep: checkinForm.value.sleep ?? 8,
    hrv: checkinForm.value.hrv,
    rhr: checkinForm.value.rhr,
    menstruationStarted: checkinForm.value.menstruationStarted || false,
    isSickOrInjured: checkinForm.value.isSickOrInjured || false,
  }

  showCheckinDialog.value = true
}

function openCheckinResult() {
  const tl = todayLog.value
  if (!tl) {
    openCheckinDialog()
    return
  }

  checkinError.value = ''

  checkinResult.value = {
    recommendation: {
      status: tl.recommendation?.status || tl.status || null,
    },
    status: tl.status || null,
    aiMessage: tl.aiMessage || '',
  }

  const readinessVal =
    tl.metrics?.readiness ??
    tl.readiness ??
    checkinForm.value.readiness
  const hrvVal =
    tl.metrics?.hrv ??
    tl.hrv ??
    checkinForm.value.hrv
  const rhrVal =
    tl.metrics?.rhr ??
    tl.rhr ??
    checkinForm.value.rhr
  const sleepVal =
    tl.metrics?.sleep ??
    tl.sleep ??
    checkinForm.value.sleep

  checkinForm.value = {
    ...checkinForm.value,
    readiness: readinessVal ?? checkinForm.value.readiness,
    hrv: hrvVal ?? checkinForm.value.hrv,
    rhr: rhrVal ?? checkinForm.value.rhr,
    sleep: sleepVal,
    isSickOrInjured: Boolean(tl.isSickOrInjured ?? checkinForm.value.isSickOrInjured),
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

  const body = {
    sleep: Number.isFinite(sleepVal) ? sleepVal : undefined,
    rhr: rhrVal,
    rhrBaseline: Number(effectiveRhrBaseline.value) || rhrVal,
    hrv: hrvVal,
    hrvBaseline: Number(effectiveHrvBaseline.value) || hrvVal,
    readiness: readinessVal,
    menstruationStarted: Boolean(checkinForm.value.menstruationStarted),
    isSickOrInjured: Boolean(checkinForm.value.isSickOrInjured),
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

/** Fallback: when dashboard had no recent_activities, try GET /api/activities?limit=7 if backend provides it. */
async function loadActivities() {
  if (activities.value.length) return
  activitiesLoading.value = true
  try {
    const res = await api.get('/api/activities', { params: { limit: 7 } })
    const list = res.data?.data ?? res.data ?? []
    if (Array.isArray(list) && list.length) {
      activities.value = mapRecentActivities(list)
    }
  } catch {
    // Backend may not expose GET /api/activities; leave activities from dashboard (possibly empty)
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
      const ctx = payload.cycleContext ?? null
      const readiness = payload.readiness_today ?? payload.readiness ?? data.value.readiness
      const acwr = payload.acwr
      const recent = mapRecentActivities(payload.recent_activities ?? [])
      activities.value = recent

      const todayStr = new Date().toISOString().slice(0, 10)
      let trainingVolume7d =
        payload.trainingVolume7d ??
        payload.training_volume_7d ??
        payload.trainingLoad7d ??
        undefined
      let primeLoad7d =
        payload.primeLoad7d ?? payload.primeLoad_7d ?? undefined
      if (
        trainingVolume7d == null ||
        primeLoad7d == null ||
        !Number.isFinite(Number(trainingVolume7d)) ||
        !Number.isFinite(Number(primeLoad7d))
      ) {
        const computed = compute7dFromActivities(payload.recent_activities ?? [], todayStr)
        if (trainingVolume7d == null || !Number.isFinite(Number(trainingVolume7d))) {
          trainingVolume7d = computed.trainingVolume7d
        }
        if (primeLoad7d == null || !Number.isFinite(Number(primeLoad7d))) {
          primeLoad7d = computed.primeLoad7d
        }
      }
      trainingVolume7d = Number.isFinite(Number(trainingVolume7d)) ? Number(trainingVolume7d) : data.value.trainingVolume7d
      primeLoad7d = Number.isFinite(Number(primeLoad7d)) ? Number(primeLoad7d) : data.value.primeLoad7d

      if (import.meta.env?.DEV) {
        const list = payload.recent_activities ?? []
        const withDiffering = list.filter((a) => {
          if (!a || a.includeInAcwr === false) return false
          const pl = a.primeLoad ?? a._primeLoad
          if (pl == null) return false
          return Number(a.loadUsed) !== Number(pl)
        }).length
        if (
          withDiffering >= 3 &&
          Number(trainingVolume7d) === Number(primeLoad7d)
        ) {
          console.warn(
            '[Dashboard] trainingVolume7d and primeLoad7d are equal while recent_activities have differing loadUsed vs primeLoad/_primeLoad — possible binding bug.'
          )
        }
      }

      const lastCheckinDate =
        payload.lastCheckin ??
        payload.last_checkin ??
        payload.lastDailyLogDate ??
        data.value.lastCheckinDate ??
        null

      const cycleLength =
        payload.cycle_length ??
        payload.cycleLength ??
        data.value.cycleLength ??
        28
      const ghostComparison =
        payload.ghost_comparison ??
        payload.ghostComparison ??
        data.value.ghostComparison ??
        null
      const todayLogPayload =
        payload.todayLog ??
        payload.today_log ??
        payload.today ??
        data.value.todayLog ??
        null
      const isHighCycle = ctx?.confidence === 'HIGH' && ctx?.phaseName != null && String(ctx.phaseName).trim() !== ''
      const cycleDayVal = isHighCycle && ctx.phaseDay != null && Number.isFinite(Number(ctx.phaseDay)) && Number(ctx.phaseDay) > 0
        ? Number(ctx.phaseDay)
        : null
      data.value = {
        ...data.value,
        cycleContext: ctx ?? data.value.cycleContext,
        readiness: readiness ?? data.value.readiness,
        readiness_today: payload.readiness_today ?? data.value.readiness_today,
        cyclePhase: isHighCycle ? (ctx.phaseLabelNL ?? ctx.phaseName ?? '') : null,
        cycleDay: cycleDayVal,
        cycle: null,
        acwr: acwr != null ? acwr : data.value.acwr,
        acwrStatus: acwr != null ? (acwr > 1.5 ? 'spike' : acwr > 1.3 ? 'overreaching' : acwr < 0.8 ? 'undertraining' : 'sweet') : data.value.acwrStatus,
        trainingVolume7d,
        primeLoad7d,
        lastCheckinDate,
        rhrBaseline: payload.rhr_baseline_28d ?? payload.rhrBaseline ?? data.value.rhrBaseline,
        hrvBaseline: payload.hrv_baseline_28d ?? payload.hrvBaseline ?? data.value.hrvBaseline,
        stravaMeta: payload.strava_meta ?? data.value.stravaMeta,
        cycleLength,
        phaseDay: cycleDayVal,
        ghostComparison,
        todayLog: todayLogPayload,
        dailyAdvice: todayLogPayload?.aiMessage ?? data.value.dailyAdvice,
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
  await loadActivities()
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
@media (min-width: 640px) {
  .pilot-container {
    max-width: 640px;
  }
}
@media (min-width: 960px) {
  .pilot-container {
    max-width: min(1280px, 100%);
  }
}

.pilot-header {
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
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

/* KPI strip: 4 tiles — desktop 4 cols, mobile stacked */
.kpi-strip {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}
@media (min-width: 480px) {
  .kpi-strip {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (min-width: 960px) {
  .kpi-strip {
    grid-template-columns: repeat(4, 1fr);
  }
}

.kpi-tile {
  background: q.$prime-surface !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: q.$radius-sm !important;
  box-shadow: none !important;
  min-width: 0;
}

.kpi-tile-section {
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
  min-height: 0;
}

.kpi-tile-label {
  font-family: q.$typography-font-family;
  font-size: 0.6rem;
  font-weight: 700;
  color: q.$prime-gray;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  line-height: 1.2;
  word-break: break-word;
}

.kpi-tile-value {
  font-family: q.$mono-font;
  font-size: 1.35rem;
  font-weight: 700;
  color: #ffffff;
  line-height: 1.2;
}
@media (min-width: 480px) {
  .kpi-tile-value {
    font-size: 1.5rem;
  }
}

.kpi-tile-subtext {
  font-family: q.$typography-font-family;
  font-size: 0.65rem;
  color: q.$prime-gray;
  line-height: 1.2;
}

.kpi-tile-extra {
  font-family: q.$typography-font-family;
  font-size: 0.6rem;
  color: q.$prime-gray;
  margin-top: 2px;
}

.acwr-scale-compact {
  margin-top: 6px;
  width: 100%;
  max-width: 140px;
}
.acwr-scale-compact .acwr-scale-labels {
  font-size: 0.55rem;
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

.checkin-dialog .q-dialog__backdrop {
  background: rgba(0, 0, 0, 0.75) !important;
}

.checkin-dialog .q-card {
  background: #0d0f14 !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
}

.advice-text {
  white-space: pre-wrap;
  text-align: left;
  line-height: 1.6;
  font-size: 15px;
  opacity: 0.92;
}

.today-advice-card {
  text-align: left;
}

.today-advice-card .kpi-label,
.today-advice-card .kpi-title,
.today-advice-card .kpi-subtitle,
.today-advice-card .advice-status-row,
.today-advice-card .advice-text,
.today-advice-card .action-link {
  text-align: left;
}

.advice-status-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.today-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 9999px;
  background: q.$prime-gray;
}

.today-status-push {
  background: q.$status-push;
}

.today-status-maintain {
  background: q.$prime-gold;
}

.today-status-recover,
.today-status-rest {
  background: q.$status-recover;
}

.today-status-label {
  font-family: q.$mono-font;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
</style>
