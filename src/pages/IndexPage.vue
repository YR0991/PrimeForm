<template>
  <CoachDashboard v-if="authStore.isCoach" />
  <q-page v-else class="dashboard-page">
    <div class="dashboard-container">
      <!-- Header -->
      <div class="dashboard-header">
        <div class="brand">PRIMEFORM</div>
        <div class="subtitle">Atleet dashboard</div>
      </div>

      <!-- Dagelijkse briefing -->
      <q-card class="dashboard-card q-mb-md" flat>
        <q-card-section class="pre-briefing">
          <div class="pre-brief-header">
            <div class="widget-title">Dagelijkse briefing</div>
            <div class="mono pre-brief-summary">
              <template v-if="hasTodayCheckIn">
                <template v-if="lastDirective.status">
                  <span class="directive-label">Directief:</span>
                  <span :class="['directive-status', 'directive-' + (lastDirective.status || '').toLowerCase()]">
                    {{ lastDirective.status }}
                  </span>
                  — Je readiness-score is <span class="highlight">{{ readinessTodayDisplay }}</span>.
                  HRV <span class="highlight">{{ hrvStatusLabel }}</span> ten opzichte van 7 dagen.
                </template>
                <template v-else>
                  Dagelijkse briefing voltooid. Je readiness-score is <span class="highlight">{{ readinessTodayDisplay }}</span>.
                  HRV <span class="highlight">{{ hrvStatusLabel }}</span> ten opzichte van 7 dagen.
                </template>
                <div v-if="lastDirective.aiMessage" class="directive-message">
                  <div v-html="renderedAiMessage" class="markdown-content" />
                </div>
              </template>
              <template v-else>
                Doe je dagelijkse check-in om je persoonlijke advies te krijgen.
              </template>
            </div>
          </div>
          <div class="pre-brief-actions">
            <q-btn
              v-if="!hasTodayCheckIn"
              label="Start dagelijkse check-in"
              no-caps
              unelevated
              class="btn-prebrief"
              @click="checkinDialog = true"
            />
            <q-btn
              v-else
              label="Bekijk dagelijkse check-in"
              flat
              no-caps
              class="btn-prebrief-secondary"
              @click="checkinDialog = true"
            />
          </div>
        </q-card-section>
      </q-card>

      <q-card class="dashboard-card" flat>
        <q-inner-loading :showing="dashboardStore.loading" color="#fbbf24">
          <q-spinner-gears size="48px" color="#fbbf24" />
        </q-inner-loading>

        <q-card-section>
          <div class="dashboard-grid">
            <!-- Widget 1: Biologische klok -->
            <div class="widget bio-clock">
              <div class="widget-title">De biologische klok</div>
              <div class="bio-main">
                <div class="bio-line mono">
                  {{ phaseSentence }}
                </div>
                <div class="bio-line mono">
                  Dag
                  <span class="highlight">
                    {{ phaseDisplay.dayDisplay }}
                  </span>
                  van
                  <span class="highlight">
                    {{ phaseDisplay.length }}
                  </span>
                </div>
              </div>

              <div class="cycle-bar">
                <div class="cycle-rail">
                  <div
                    class="cycle-marker"
                    :style="{ left: phaseDisplay.progress + '%' }"
                  />
                </div>
                <div class="cycle-scale mono">
                  <span>1</span>
                  <span>{{ Math.round(phaseDisplay.length / 2) }}</span>
                  <span>{{ phaseDisplay.length }}</span>
                </div>
              </div>

              <div class="prime-tip mono">
                Advies:
                <span class="prime-tip-text">{{ primeTip }}</span>
              </div>
            </div>

            <!-- Widget 2: Load meter -->
            <div class="widget load-meter">
              <div class="widget-title">
                De load meter
                <q-icon
                  name="help_outline"
                  size="16px"
                  class="q-ml-xs"
                >
                  <q-tooltip anchor="top middle" self="bottom middle" class="mono">
                    De verhouding tussen je belasting van de afgelopen 7 dagen versus 28 dagen.
                  </q-tooltip>
                </q-icon>
              </div>
              <div class="load-content">
                <div class="acwr-label mono">ACWR</div>
                <div class="acwr-value mono">
                  {{ acwrDisplay }}
                </div>
                <div class="gauge">
                  <div class="gauge-ring">
                    <div
                      class="gauge-fill"
                      :class="['zone-' + (loadZone || 'neutral')]"
                    />
                  </div>
                  <div class="gauge-zones mono">
                    <span class="zone-tag zone-optimal">0.8–1.3 optimaal</span>
                    <span class="zone-tag zone-over">1.3–1.5 overreaching</span>
                    <span class="zone-tag zone-danger">1.5+ risico</span>
                  </div>
                </div>
                <div class="acwr-status mono">
                  Status:
                  <span :class="['status-pill', 'zone-' + (loadZone || 'neutral')]">
                    {{ loadStatusDisplay }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Widget 2c: Readiness-meter -->
            <div class="widget readiness-meter">
              <div class="widget-title">Readiness-meter</div>
              <div class="readiness-content mono">
                <div class="readiness-label-row">
                  <span class="readiness-label">Vandaag</span>
                  <span class="readiness-value">
                    {{ hasTodayCheckIn ? readinessTodayDisplay : 'Nog niet ingevuld' }}
                  </span>
                </div>
                <div class="readiness-gauge">
                  <div class="readiness-rail">
                    <div
                      class="readiness-fill"
                      :style="{ width: readinessFillWidth }"
                      :class="readinessZoneClass"
                    />
                  </div>
                  <div class="readiness-scale">
                    <span>1</span>
                    <span>5</span>
                    <span>10</span>
                  </div>
                </div>
                <div class="readiness-status-row">
                  <span class="readiness-label">Status</span>
                  <span class="readiness-status" :class="readinessZoneClass">
                    {{ hasTodayCheckIn ? readinessZoneLabel : 'Nog niet ingevuld' }}
                  </span>
                </div>
              </div>
            </div>

            <!-- RHR TILE (next to Readiness) -->
            <RHRTile
              :rhr-current="rhrCurrent"
              :rhr-baseline28d="telemetry.raw?.rhr_baseline_28d ?? null"
            />

            <!-- Widget 2b: Handmatige workout toevoegen (primary when no Strava) -->
            <div
              v-if="showManualInjectionPrimary"
              class="widget manual-injection"
            >
              <div class="widget-title">Handmatig workout toevoegen</div>
              <div class="manual-body mono">
                <div class="manual-row">
                  <span class="manual-label">Duur (min)</span>
                  <q-input
                    v-model.number="manualDuration"
                    type="number"
                    dense
                    borderless
                    class="manual-input"
                    input-class="manual-input-field"
                    :min="0"
                    :step="5"
                  />
                </div>
                <div class="manual-row manual-rpe-row">
                  <span class="manual-label">RPE</span>
                  <q-slider
                    v-model.number="manualRpe"
                    :min="1"
                    :max="10"
                    :step="1"
                    color="#fbbf24"
                    track-color="grey-8"
                    thumb-color="amber-5"
                  />
                  <span class="manual-rpe-value">
                    {{ manualRpe }}
                  </span>
                </div>
                <div class="manual-row manual-actions">
                  <div class="manual-load-preview">
                    PRIME LOAD:
                    <span class="highlight">
                      {{ manualPrimeLoadPreview }}
                    </span>
                  </div>
                  <q-btn
                    dense
                    unelevated
                    class="manual-submit-btn"
                    :disable="!canSubmitManual || manualSubmitting"
                    :loading="manualSubmitting"
                    label="Toevoegen"
                    @click="handleManualInject"
                  />
                </div>
              </div>
            </div>

            <!-- HRV TREND (full-width below Load Meter row) -->
            <div class="hrv-chart-full">
              <HRVHistoryChart :history-logs="historyLogs" />
            </div>

            <!-- Widget 3: Recente telemetrie -->
              <div class="widget telemetry-feed">
              <div class="telemetry-header">
                <div class="widget-title">Recente telemetrie</div>
                <q-btn
                  v-if="hasStravaConnection"
                  dense
                  flat
                  class="manual-toggle-btn mono"
                  label="Handmatig workout toevoegen"
                  @click="manualPanelOpen = !manualPanelOpen"
                />
              </div>

              <!-- Inline manual injection panel when Strava is connected -->
              <div
                v-if="hasStravaConnection && manualPanelOpen"
                class="manual-inline mono"
              >
                <div class="manual-row">
                  <span class="manual-label">Duur (min)</span>
                  <q-input
                    v-model.number="manualDuration"
                    type="number"
                    dense
                    borderless
                    class="manual-input"
                    input-class="manual-input-field"
                    :min="0"
                    :step="5"
                  />
                </div>
                <div class="manual-row manual-rpe-row">
                  <span class="manual-label">RPE</span>
                  <q-slider
                    v-model.number="manualRpe"
                    :min="1"
                    :max="10"
                    :step="1"
                    color="#fbbf24"
                    track-color="grey-8"
                    thumb-color="amber-5"
                  />
                  <span class="manual-rpe-value">
                    {{ manualRpe }}
                  </span>
                </div>
                <div class="manual-row manual-actions">
                  <div class="manual-load-preview">
                    Prime load:
                    <span class="highlight">
                      {{ manualPrimeLoadPreview }}
                    </span>
                  </div>
                  <q-btn
                    dense
                    unelevated
                    class="manual-submit-btn"
                    :disable="!canSubmitManual || manualSubmitting"
                    :loading="manualSubmitting"
                    label="Toevoegen"
                    @click="handleManualInject"
                  />
                </div>
              </div>

              <div
                v-if="hasStravaConnection && recentActivities.length === 0"
                class="telemetry-sync-state"
              >
                <q-spinner v-if="dashboardStore.syncing" size="24" color="amber-5" class="q-mr-sm" />
                <span v-if="dashboardStore.syncing" class="mono">Historie synchroniseren…</span>
                <template v-else>
                  <span class="mono telemetry-empty">Nog geen activiteiten.</span>
                  <q-btn
                    dense
                    flat
                    no-caps
                    class="manual-toggle-btn q-mt-sm"
                    label="Data importeren"
                    :loading="dashboardStore.syncing"
                    @click="triggerStravaSync"
                  />
                </template>
              </div>
              <div v-else-if="!hasStravaConnection && recentActivities.length === 0" class="telemetry-empty mono">
                Geen recente activiteiten.
              </div>
              <q-list v-else dense class="telemetry-list">
                <q-item
                  v-for="act in recentActivities"
                  :key="act.id"
                  class="telemetry-item"
                >
                  <q-item-section avatar>
                    <div class="telemetry-icon-wrapper">
                      <q-icon
                        :name="activityIcon(act.type)"
                        size="sm"
                        color="orange"
                      />
                      <q-icon
                        v-if="act.source === 'manual'"
                        name="build"
                        size="xs"
                        class="manual-source-icon"
                      />
                    </div>
                  </q-item-section>
                  <q-item-section>
                    <div class="mono telemetry-line">
                      <span class="telemetry-type">
                        {{ act.type || 'Session' }}
                      </span>
                      <span class="telemetry-date">
                        {{ formatActivityDate(act.date) }}
                      </span>
                    </div>
                    <div class="mono telemetry-load">
                      Prime load:
                      <span class="highlight">
                        {{ act.primeLoad ?? '—' }}
                      </span>
                    </div>
                  </q-item-section>
                </q-item>
              </q-list>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- Daily Check-in Dialog -->
      <q-dialog v-model="checkinDialog" persistent class="checkin-dialog-dark">
        <q-card class="checkin-dialog-card" dark>
          <q-card-section class="checkin-dialog-section text-white">
            <div class="checkin-dialog-title">Dagelijkse check-in</div>
            <div class="mono checkin-subtitle text-white">
              Vul je readiness en bio-signalen in voor vandaag.
            </div>
          </q-card-section>
          <q-card-section class="q-pt-none checkin-dialog-section text-white">
            <div class="checkin-field">
              <div class="field-label mono">Trainingsbereidheid (1–10)</div>
              <div class="row items-center q-gutter-sm">
                <q-slider
                  v-model.number="checkinReadiness"
                  :min="1"
                  :max="10"
                  :step="1"
                  color="#fbbf24"
                  track-color="grey-8"
                  thumb-color="amber-5"
                  class="col"
                />
                <span class="mono readiness-slider-value">
                  {{ checkinReadiness }}/10 — {{ readinessLabelFor(checkinReadiness) }}
                </span>
              </div>
              <div class="mono readiness-hints">
                <div class="readiness-scale-row">
                  <span class="readiness-scale-label">1–3:</span>
                  <span class="readiness-scale-text">Herstel / Buiten gebruik</span>
                </div>
                <div class="readiness-scale-row">
                  <span class="readiness-scale-label">4–6:</span>
                  <span class="readiness-scale-text">Lage energie / Matig</span>
                </div>
                <div class="readiness-scale-row">
                  <span class="readiness-scale-label">7–8:</span>
                  <span class="readiness-scale-text">Stabiel / Heel goed</span>
                </div>
                <div class="readiness-scale-row">
                  <span class="readiness-scale-label">9–10:</span>
                  <span class="readiness-scale-text">Topvorm / Onstuitbaar</span>
                </div>
              </div>
            </div>

            <div class="checkin-field">
              <div class="field-label mono">HRV (ms)</div>
              <q-input
                v-model.number="checkinHrv"
                type="number"
                dense
                outlined
                dark
                class="checkin-input"
                input-class="mono"
                :min="0"
              />
            </div>

            <div class="checkin-field">
              <div class="field-label mono">RHR (bpm)</div>
              <q-input
                v-model.number="checkinRhr"
                type="number"
                dense
                outlined
                dark
                class="checkin-input"
                input-class="mono"
                :min="0"
              />
            </div>

            <div class="checkin-field">
              <div class="field-label mono">SLAAP (uur)</div>
              <div class="row items-center q-gutter-sm">
                <q-slider
                  v-model.number="checkinSleep"
                  :min="3"
                  :max="12"
                  :step="0.5"
                  color="#fbbf24"
                  track-color="grey-8"
                  thumb-color="amber-5"
                  class="col"
                />
                <span class="mono readiness-slider-value">{{ checkinSleep }}h</span>
              </div>
            </div>

            <div class="checkin-toggles">
              <q-btn
                :outline="!checkinMenstruationStarted"
                :unelevated="checkinMenstruationStarted"
                no-caps
                class="checkin-toggle-btn"
                :class="{ 'toggle-active': checkinMenstruationStarted }"
                label="Menstruatie gestart"
                @click="checkinMenstruationStarted = !checkinMenstruationStarted"
              />
              <q-btn
                :outline="!checkinIsSick"
                :unelevated="checkinIsSick"
                no-caps
                class="checkin-toggle-btn checkin-toggle-sick"
                :class="{ 'toggle-active': checkinIsSick }"
                label="Ziek / handrem"
                @click="checkinIsSick = !checkinIsSick"
              />
            </div>
          </q-card-section>
          <q-card-actions align="right" class="checkin-dialog-actions">
            <q-btn flat no-caps label="Annuleren" class="text-white" @click="checkinDialog = false" />
            <q-btn
              unelevated
              no-caps
              class="btn-prebrief"
              label="Check-in opslaan"
              :disable="!canSubmitCheckin"
              :loading="checkinSubmitting"
              @click="handleSubmitCheckin"
            />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { marked } from 'marked'
import { useAuthStore } from '../stores/auth'
import { useDashboardStore } from '../stores/dashboard'
import CoachDashboard from './coach/CoachDashboard.vue'
import RHRTile from '../components/RHRTile.vue'
import HRVHistoryChart from '../components/HRVHistoryChart.vue'

const $q = useQuasar()
const authStore = useAuthStore()
const dashboardStore = useDashboardStore()

onMounted(() => {
  if (!dashboardStore.telemetry && !dashboardStore.loading) {
    dashboardStore.fetchUserDashboard().catch(() => {
      // error stored in store; UI stays graceful
    })
  }
})

// Auto-trigger Strava sync once when connected but no activities (so Recent Telemetry fills)
const stravaSyncTriggered = ref(false)
watch(
  () => ({
    loading: dashboardStore.loading,
    connected: authStore.stravaConnected,
    activities: (dashboardStore.telemetry?.activities || []).length,
  }),
  (curr) => {
    if (curr.loading || stravaSyncTriggered.value) return
    if (curr.connected && curr.activities === 0) {
      stravaSyncTriggered.value = true
      dashboardStore.syncStrava().catch(() => {
        stravaSyncTriggered.value = false
      })
    }
  },
  { immediate: true }
)

function triggerStravaSync() {
  dashboardStore.syncStrava().catch(() => {})
}

const telemetry = computed(() => dashboardStore.telemetry || {})

const rhrCurrent = computed(() => {
  const raw = telemetry.value.raw || {}
  const rhr = raw.last_checkin?.rhr ?? raw.rhr_today
  return rhr != null && Number.isFinite(Number(rhr)) ? Number(rhr) : null
})

const historyLogs = computed(() => telemetry.value.raw?.history_logs || [])

// Phase display
const phaseDisplay = computed(() => {
  const cp = dashboardStore.currentPhase
  const day = cp.day && cp.day > 0 ? cp.day : null
  const len = cp.length || 28
  const progress = day ? Math.min(Math.max((day / len) * 100, 0), 100) : 0

  return {
    name: cp.name || 'Unknown',
    dayDisplay: day ?? '?',
    day,
    length: len,
    progress,
  }
})

// Sentence-case phase for Dutch: "Je bent in de menstruele fase"
const phaseSentence = computed(() => {
  const name = (phaseDisplay.value.name || '').toLowerCase()
  if (name.includes('menstrual')) return 'Je bent in de menstruele fase.'
  if (name.includes('follicular')) return 'Je bent in de folliculaire fase.'
  if (name.includes('luteal')) return 'Je bent in de luteale fase.'
  if (name.includes('ovulation')) return 'Je bent in de ovulatie.'
  return 'Je bent in de ' + (phaseDisplay.value.name || 'onbekende') + ' fase.'
})

// Prime Tip based on phase (Dutch, sentence case)
const primeTip = computed(() => {
  const name = (phaseDisplay.value.name || '').toLowerCase()
  if (name.includes('follicular')) {
    return 'Oestrogeen stijgt — hoge intensiteit wordt goed verdragen.'
  }
  if (name.includes('ovulation')) {
    return 'Venster voor piekvermogen — korte, explosieve training is ideaal.'
  }
  if (name.includes('luteal')) {
    return 'Luteale fase — respecteer herstel en beperk pieken.'
  }
  if (name.includes('menstrual')) {
    return 'Focus op comfort — lage intensiteit en techniek.'
  }
  return 'Sluit je belasting aan op hoe je je vandaag voelt.'
})

// ACWR + load status
const acwr = computed(() => {
  const val = Number(telemetry.value.acwr)
  return Number.isFinite(val) ? val : null
})

const acwrDisplay = computed(() => {
  if (acwr.value == null) return '--'
  const v = Number(acwr.value)
  if (!Number.isFinite(v) || v === 0) return '--'
  return v.toFixed(2)
})

const loadZone = computed(() => {
  const status = dashboardStore.loadStatus
  if (!status) return null
  return status.toLowerCase()
})

const loadStatusDisplay = computed(() => {
  const v = acwr.value
  if (v == null || !Number.isFinite(Number(v)) || Number(v) === 0) {
    return 'Geen data'
  }
  const status = dashboardStore.loadStatus || ''
  if (status === 'OPTIMAL') return 'optimaal'
  if (status === 'OVERREACHING') return 'overreaching'
  if (status === 'DANGER') return 'risico'
  return status ? status.toLowerCase() : 'Geen data'
})

// --- Dagelijkse briefing / Readiness-meter ---
const readinessToday = computed(() => {
  const t = telemetry.value
  if (t.readinessToday != null) return t.readinessToday
  const raw = t.raw || {}
  if (raw.readiness_today != null) return raw.readiness_today
  if (raw.readiness != null) return raw.readiness
  return null
})

const hasTodayCheckIn = computed(() => readinessToday.value != null)

const lastDirective = computed(() => {
  const raw = telemetry.value.raw || {}
  const d = raw.last_directive || {}
  return {
    status: d.status || null,
    aiMessage: d.aiMessage || null,
    cycleInfo: d.cycleInfo || null,
  }
})

// Safely render AI markdown advice
marked.setOptions({
  mangle: false,
  headerIds: false,
})

const renderedAiMessage = computed(() => {
  const msg = lastDirective.value.aiMessage
  if (!msg || typeof msg !== 'string') return ''
  return marked.parse(msg)
})

const readinessTodayDisplay = computed(() => {
  if (readinessToday.value == null) return '—'
  const v = Number(readinessToday.value)
  if (!Number.isFinite(v)) return '—'
  return `${Math.round(v)}/10`
})

const hrvStatusLabel = computed(() => {
  const raw = telemetry.value.raw || {}
  const today = Number(raw.hrv_today ?? raw.last_checkin?.hrv)
  const avg7 = Number(
    raw.hrv_avg_7d ??
      raw.metrics?.hrv7d ??
      raw.metrics?.hrv_7d ??
      raw.metrics?.hrv_avg_7d
  )
  if (!Number.isFinite(today) || !Number.isFinite(avg7) || avg7 <= 0) {
    return '—'
  }
  const deltaPct = ((today - avg7) / avg7) * 100
  if (deltaPct > 5) return 'hoog'
  if (deltaPct < -5) return 'laag'
  return 'stabiel'
})

const readinessZoneClass = computed(() => {
  const v = Number(readinessToday.value)
  if (!Number.isFinite(v)) return 'zone-neutral'
  if (v >= 7) return 'zone-high'
  if (v <= 4) return 'zone-low'
  return 'zone-mid'
})

const readinessZoneLabel = computed(() => {
  const v = Number(readinessToday.value)
  if (!Number.isFinite(v)) return 'Nog niet ingevuld'
  if (v >= 7) return 'Topvorm'
  if (v <= 4) return 'Lage energie'
  return 'In balans'
})

const readinessFillWidth = computed(() => {
  const v = Number(readinessToday.value)
  if (!Number.isFinite(v) || v <= 0) return '0%'
  const pct = Math.min(Math.max((v / 10) * 100, 0), 100)
  return `${pct}%`
})

// Daily Check-in dialog state
const checkinDialog = ref(false)
const checkinReadiness = ref(7)
const checkinSleep = ref(8)
const checkinHrv = ref(null)
const checkinRhr = ref(null)
const checkinMenstruationStarted = ref(false)
const checkinIsSick = ref(false)
const checkinSubmitting = ref(false)

const canSubmitCheckin = computed(() => {
  const r = Number(checkinReadiness.value)
  const h = Number(checkinHrv.value)
  const rr = Number(checkinRhr.value)
  const s = Number(checkinSleep.value)
  if (!Number.isFinite(r) || r < 1 || r > 10) return false
  if (!Number.isFinite(h) || h <= 0) return false
  if (!Number.isFinite(rr) || rr <= 0) return false
  if (!Number.isFinite(s) || s < 3 || s > 12) return false
  return true
})

function readinessLabelFor(vRaw) {
  const v = Number(vRaw)
  if (!Number.isFinite(v)) return ''
  if (v === 10) return 'Onstuitbaar'
  if (v === 9) return 'Topvorm'
  if (v === 8) return 'Heel goed'
  if (v === 7) return 'Stabiel'
  if (v === 6) return 'Voldoende'
  if (v === 5) return 'Matig'
  if (v === 4) return 'Lage energie'
  if (v === 3) return 'Herstel nodig'
  if (v === 2) return 'Overbelast'
  if (v === 1) return 'Buiten gebruik'
  return ''
}

const handleSubmitCheckin = async () => {
  if (!canSubmitCheckin.value || checkinSubmitting.value) return
  try {
    checkinSubmitting.value = true
    await dashboardStore.submitDailyCheckIn({
      readiness: checkinReadiness.value,
      hrv: checkinHrv.value,
      rhr: checkinRhr.value,
      sleep: checkinSleep.value,
      menstruationStarted: checkinMenstruationStarted.value,
      isSick: checkinIsSick.value,
    })
    await dashboardStore.fetchUserDashboard().catch(() => {})
    $q.notify({
      type: 'positive',
      color: 'amber-5',
      message: 'Daily check-in opgeslagen',
    })
    checkinDialog.value = false
  } catch (err) {
    console.error('submitDailyCheckIn failed', err)
    $q.notify({
      type: 'negative',
      message: err?.message || 'Daily check-in opslaan mislukt',
    })
  } finally {
    checkinSubmitting.value = false
  }
}

// Strava connection: use auth store so connection status is visible even before dashboard payload
const hasStravaConnection = computed(() => Boolean(authStore.stravaConnected))

// Manual injection state
const manualDuration = ref(null)
const manualRpe = ref(5)
const manualSubmitting = ref(false)
const manualPanelOpen = ref(false)

const showManualInjectionPrimary = computed(() => !hasStravaConnection.value)

const manualPrimeLoadPreview = computed(() => {
  const d = Number(manualDuration.value)
  const r = Number(manualRpe.value)
  if (!Number.isFinite(d) || d <= 0 || !Number.isFinite(r)) return '--'
  return Math.round(d * r)
})

const canSubmitManual = computed(() => {
  const d = Number(manualDuration.value)
  const r = Number(manualRpe.value)
  if (!Number.isFinite(d) || d <= 0) return false
  if (!Number.isFinite(r) || r < 1 || r > 10) return false
  return true
})

const handleManualInject = async () => {
  if (!canSubmitManual.value || manualSubmitting.value) return
  try {
    manualSubmitting.value = true
    await dashboardStore.injectManualSession({
      duration: manualDuration.value,
      rpe: manualRpe.value,
    })
    // reset duration, keep RPE where it is
    manualDuration.value = null
  } catch (e) {
    // error already surfaced via store or console; keep dashboard silent
    console.error('Manual injection failed', e)
  } finally {
    manualSubmitting.value = false
  }
}

// Recent activities (Date, Type, Prime Load) — support backend _primeLoad and _dateStr
const recentActivities = computed(() => {
  const list = telemetry.value.activities || []
  return list.slice(0, 10).map((a) => ({
    id: a.id || a.activity_id || `${a.date || a.start_date || a._dateStr || ''}-${a.type || ''}`,
    type: a.type || a.sport_type || 'Session',
    date: a.date || a.start_date || a.start_date_local || a._dateStr || null,
    primeLoad: a.prime_load ?? a.primeLoad ?? a._primeLoad ?? a.load ?? null,
    source: a.source || a.activity_source || null,
  }))
})

const activityIcon = (type) => {
  const t = (type || '').toLowerCase()
  if (t.includes('run')) return 'directions_run'
  if (t.includes('ride') || t.includes('bike')) return 'directions_bike'
  if (t.includes('swim')) return 'pool'
  if (t.includes('strength') || t.includes('gym')) return 'fitness_center'
  return 'insights'
}

const formatActivityDate = (raw) => {
  if (!raw) return 'Unknown'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return String(raw)
  return d.toLocaleDateString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
  })
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=JetBrains+Mono:wght@400;600&display=swap');

.dashboard-page {
  background: #050505;
  min-height: 100vh;
  padding: 24px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.dashboard-container {
  max-width: 1100px;
  width: 100%;
}

.dashboard-header {
  margin-bottom: 16px;
}

.brand {
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
    sans-serif;
  font-weight: 700;
  font-style: italic;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  font-size: 0.9rem;
  color: #D4AF37;
}

.subtitle {
  margin-top: 4px;
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
    sans-serif;
  font-size: 0.7rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #F5F5F5;
}

.dashboard-card {
  background: rgba(255, 255, 255, 0.03) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 2px !important;
  box-shadow: none !important;
}

.pre-briefing {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pre-brief-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pre-brief-summary {
  font-size: 0.8rem;
  color: rgba(209, 213, 219, 0.95);
}

.pre-brief-actions {
  margin-top: 8px;
}

.btn-prebrief {
  background: #fbbf24 !important;
  color: #050505 !important;
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-radius: 2px;
}

.btn-prebrief-secondary {
  color: #fbbf24 !important;
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.directive-label {
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(156, 163, 175, 0.95);
  margin-right: 6px;
}

.directive-status {
  font-weight: 700;
  letter-spacing: 0.06em;
}

.directive-status.directive-rest {
  color: #ef4444;
}

.directive-status.directive-recover {
  color: #fbbf24;
}

.directive-status.directive-maintain {
  color: #fbbf24;
}

.directive-status.directive-push {
  color: #22c55e;
}

.directive-message {
  margin-top: 8px;
  padding: 8px 0 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(209, 213, 219, 0.95);
  font-size: 0.85rem;
  line-height: 1.4;
}

.markdown-content {
  font-size: 0.85rem;
  line-height: 1.5;
  color: rgba(229, 231, 235, 0.95);
}

.markdown-content h3 {
  margin: 4px 0 6px;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: #fbbf24;
}

.markdown-content p {
  margin: 2px 0 6px;
}

.markdown-content strong,
.markdown-content b {
  font-weight: 700;
  color: #f9fafb;
}

.markdown-content ul {
  list-style: none;
  padding-left: 0;
  margin: 4px 0 6px;
}

.markdown-content li {
  position: relative;
  padding-left: 14px;
  margin: 2px 0;
}

.markdown-content li::before {
  content: '';
  position: absolute;
  left: 3px;
  top: 0.55em;
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background-color: #fbbf24;
}

/* Daily Check-in Dialog (Elite Dark — opaque, readable) */
.checkin-dialog-dark .q-dialog__backdrop {
  background: rgba(0, 0, 0, 0.7);
}

.checkin-dialog-card {
  background: #050505 !important;
  border: 1px solid rgba(251, 191, 36, 0.4) !important;
  border-radius: 2px !important;
  min-width: 360px;
  color: #ffffff;
}

.checkin-dialog-section {
  background: #050505 !important;
  color: #ffffff;
}

.checkin-dialog-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 0.9rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #fbbf24 !important;
  margin-bottom: 4px;
}

.checkin-dialog-card .field-label {
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 4px;
}

.checkin-dialog-actions .q-btn {
  color: rgba(255, 255, 255, 0.9);
}

.checkin-dialog-actions .q-btn:hover {
  color: #fbbf24;
}

.checkin-dialog-card .q-field__control,
.checkin-dialog-card .q-field__native,
.checkin-dialog-card input {
  color: #ffffff !important;
}

.checkin-dialog-card .q-field--outlined .q-field__control:before {
  border-color: rgba(255, 255, 255, 0.2);
}

.checkin-dialog-card .q-slider__track {
  background: rgba(255, 255, 255, 0.15);
}

.checkin-field {
  margin-bottom: 16px;
}

.checkin-input {
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 2px;
}

.checkin-dialog-card .checkin-subtitle {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.85);
  margin-bottom: 10px;
}

.readiness-slider-value {
  min-width: 48px;
  color: #fbbf24;
  font-size: 0.85rem;
}

.readiness-hints {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.7rem;
  color: rgba(156, 163, 175, 0.9);
}

.readiness-scale-row {
  display: flex;
  gap: 4px;
}

.readiness-scale-label {
  width: 56px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.readiness-scale-text {
  flex: 1;
}

.checkin-toggles {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
  margin-bottom: 8px;
}

.checkin-toggle-btn {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border-radius: 2px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(156, 163, 175, 0.95);
}

.checkin-toggle-btn.toggle-active {
  background: #fbbf24 !important;
  color: #050505 !important;
  border-color: #fbbf24;
}

.checkin-toggle-btn.checkin-toggle-sick.toggle-active {
  background: #ef4444 !important;
  color: #fff !important;
  border-color: #ef4444;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.hrv-chart-full {
  grid-column: 1 / -1;
}

.widget {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  padding: 16px 14px;
  background: rgba(15, 23, 42, 0.8);
}

.widget-title {
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
    sans-serif;
  font-size: 0.7rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #D4AF37;
  margin-bottom: 10px;
}

/* Readiness Gauge */
.readiness-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 0.8rem;
  color: rgba(243, 244, 246, 0.96);
}

.readiness-label-row,
.readiness-status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.readiness-label {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: rgba(156, 163, 175, 0.9);
}

.readiness-value {
  font-weight: 600;
}

.readiness-gauge {
  margin: 4px 0;
}

.readiness-rail {
  position: relative;
  height: 4px;
  background: rgba(31, 41, 55, 0.9);
  border-radius: 2px;
  overflow: hidden;
}

.readiness-fill {
  height: 100%;
  transition: width 0.2s ease;
}

.zone-high.readiness-fill {
  background: #22c55e;
}

.zone-mid.readiness-fill {
  background: #fbbf24;
}

.zone-low.readiness-fill {
  background: #ef4444;
}

.zone-neutral.readiness-fill {
  background: rgba(156, 163, 175, 0.7);
}

.readiness-scale {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 0.7rem;
  color: rgba(156, 163, 175, 0.9);
}

.readiness-status {
  font-weight: 600;
}

.zone-high.readiness-status {
  color: #22c55e;
}

.zone-mid.readiness-status {
  color: #fbbf24;
}

.zone-low.readiness-status {
  color: #ef4444;
}

.zone-neutral.readiness-status {
  color: rgba(156, 163, 175, 0.9);
}

.mono {
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco,
    Consolas, 'Liberation Mono', 'Courier New', monospace;
}

.highlight {
  color: #fbbf24;
}

/* Bio-Clock */
.bio-main {
  margin-bottom: 12px;
}

.bio-line {
  font-size: 0.85rem;
  color: rgba(243, 244, 246, 0.96);
  margin-bottom: 4px;
}

.cycle-bar {
  margin: 10px 0 8px;
}

.cycle-rail {
  position: relative;
  height: 4px;
  background: rgba(31, 41, 55, 0.9);
  border-radius: 2px;
  overflow: hidden;
}

.cycle-marker {
  position: absolute;
  top: -4px;
  width: 2px;
  height: 12px;
  background-color: #fbbf24;
}

.cycle-scale {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 0.65rem;
  color: rgba(148, 163, 184, 0.9);
}

.prime-tip {
  margin-top: 10px;
  font-size: 0.75rem;
  color: rgba(156, 163, 175, 0.96);
}

.prime-tip-text {
  color: rgba(243, 244, 246, 0.96);
}

/* Load Meter */
.load-content {
  text-align: center;
}

.acwr-label {
  font-size: 0.75rem;
  color: rgba(148, 163, 184, 0.9);
  letter-spacing: 0.16em;
}

.acwr-value {
  font-size: 2.4rem;
  font-weight: 600;
  color: #fbbf24;
  margin: 4px 0 8px;
}

.gauge {
  margin: 8px 0 10px;
}

.gauge-ring {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  border: 2px solid rgba(55, 65, 81, 0.9);
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gauge-fill {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 3px solid rgba(148, 163, 184, 0.6);
}

.zone-optimal {
  border-color: #22c55e;
}

.zone-over {
  border-color: #fbbf24;
}

.zone-danger {
  border-color: #ef4444;
}

.gauge-zones {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.65rem;
  color: rgba(148, 163, 184, 0.95);
}

.zone-tag {
  display: inline-block;
}

.zone-tag.zone-optimal {
  color: #22c55e;
}

.zone-tag.zone-over {
  color: #fbbf24;
}

.zone-tag.zone-danger {
  color: #ef4444;
}

.acwr-status {
  margin-top: 8px;
  font-size: 0.75rem;
  color: rgba(148, 163, 184, 0.95);
}

.status-pill {
  margin-left: 4px;
  padding: 2px 8px;
  border-radius: 2px;
  border: 1px solid rgba(148, 163, 184, 0.7);
  font-size: 0.7rem;
}

.status-pill.zone-optimal {
  border-color: #22c55e;
  color: #22c55e;
}

.status-pill.zone-over {
  border-color: #fbbf24;
  color: #fbbf24;
}

.status-pill.zone-danger {
  border-color: #ef4444;
  color: #ef4444;
}

/* Recent Telemetry */
.telemetry-feed {
  display: flex;
  flex-direction: column;
}

.telemetry-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.manual-toggle-btn {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #fbbf24;
  padding: 2px 6px;
}

.telemetry-empty {
  font-size: 0.75rem;
  color: rgba(148, 163, 184, 0.95);
}

.telemetry-sync-state {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  font-size: 0.75rem;
  color: rgba(148, 163, 184, 0.95);
}

.telemetry-list {
  margin-top: 4px;
}

.telemetry-item {
  padding: 6px 4px;
}

.telemetry-icon-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.manual-source-icon {
  position: absolute;
  bottom: -4px;
  right: -4px;
  color: #fbbf24;
}

.telemetry-line {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: rgba(243, 244, 246, 0.96);
}

.telemetry-type {
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.telemetry-date {
  color: rgba(148, 163, 184, 0.95);
}

.telemetry-load {
  font-size: 0.7rem;
  color: rgba(156, 163, 175, 0.95);
}

/* Manual Injection */
.manual-injection,
.manual-inline {
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  padding: 12px 10px;
}

.manual-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 0.75rem;
  color: rgba(229, 231, 235, 0.96);
}

.manual-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.manual-label {
  min-width: 110px;
  font-size: 0.7rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(156, 163, 175, 0.95);
}

.manual-input {
  flex: 1;
  border: 1px solid rgba(75, 85, 99, 0.9);
  border-radius: 2px;
  padding-left: 6px;
  background: rgba(15, 23, 42, 0.9);
}

.manual-input-field {
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco,
    Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.8rem;
  color: #fbbf24;
}

.manual-rpe-row {
  align-items: center;
}

.manual-rpe-value {
  width: 28px;
  text-align: right;
  color: #fbbf24;
  font-size: 0.8rem;
}

.manual-actions {
  justify-content: space-between;
}

.manual-load-preview {
  font-size: 0.75rem;
  color: rgba(156, 163, 175, 0.95);
}

.manual-submit-btn {
  background-color: #fbbf24;
  color: #050505;
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
    sans-serif;
  font-size: 0.7rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  border-radius: 2px;
  padding: 4px 10px;
}
</style>