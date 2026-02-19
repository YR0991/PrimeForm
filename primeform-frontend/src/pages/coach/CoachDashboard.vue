<!-- CoachDashboard (ACTIVE)
  Deze coach view wordt gebruikt door de Quasar SPA in primeform-frontend
  via primeform-frontend/src/router/routes.js (route pad '/coach').
  Pas voor de live coachervaring ALLEEN deze versie aan.
-->
<template>
  <q-page class="coach-dashboard elite-page">
    <div class="engineer-container">
      <header class="engineer-header">
        <h1 class="engineer-title">Overzicht team</h1>
        <q-btn
          flat
          round
          icon="refresh"
          color="white"
          size="sm"
          @click="loadSquad"
          :loading="squadronStore.loading"
        />
      </header>

      <q-card class="squadron-card" flat>
        <q-table
          :rows="filteredRows"
          :columns="columns"
          row-key="id"
          :loading="squadronStore.loading"
          v-model:pagination="pagination"
          flat
          dark
          class="squadron-table"
          @row-click="onRowClick"
        >
          <template #top>
            <div class="squadron-toolbar">
              <q-input
                v-model="search"
                debounce="250"
                dense
                clearable
                filled
                dark
                class="squadron-search"
                placeholder="Zoek (naam/email)"
                prepend-inner-icon="search"
              />
              <q-select
                v-model="activeFilter"
                :options="filterOptions"
                dense
                filled
                dark
                emit-value
                map-options
                class="squadron-filter"
                label="Filter"
              />
            </div>
          </template>
          <template #body-cell-athlete="props">
            <q-td :props="props">
              <div class="athlete-cell">
                <AthleteAvatar
                  :avatar="props.row.profile?.avatar"
                  :name="props.row.name"
                  size="32px"
                />
                <div class="athlete-info">
                  <span class="athlete-name">{{ props.row.name }}</span>
                  <span class="athlete-level" :class="`level-${props.row.level}`">
                    <q-icon :name="getLevelIcon(props.row.level)" size="12px" />
                    {{ props.row.level }}
                  </span>
                </div>
              </div>
            </q-td>
          </template>

          <template #body-cell-attention="props">
            <q-td :props="props" class="attention-td">
              <div v-if="props.row.attention" class="attention-cell attention-cell-single">
                <span
                  class="attention-badge"
                  :class="`attention-${props.row.attention.level}`"
                >
                  {{
                    props.row.attention.level === 'ok'
                      ? 'OK'
                      : props.row.attention.level === 'watch'
                        ? 'LET OP'
                        : 'ACTIE'
                  }}
                </span>
                <span class="attention-score elite-data">
                  {{ props.row.attention.score }}
                </span>
                <span
                  v-if="(props.row.attention.reasons || []).length"
                  class="attention-reason-inline"
                >
                  {{ (props.row.attention.reasons || [])[0] }}
                  <q-tooltip anchor="top middle" self="bottom middle" max-width="280px">
                    <span style="white-space: pre-line;">{{ (props.row.attention.reasons || []).join('\n') }}</span>
                  </q-tooltip>
                </span>
              </div>
              <div v-else class="attention-cell attention-cell-single attention-none">
                <span class="attention-badge attention-ok">OK</span>
                <span class="attention-score elite-data">0</span>
              </div>
            </q-td>
          </template>

          <template #body-cell-cycle="props">
            <q-td :props="props">
              <span class="elite-data">
                {{ formatCyclePhaseLabel(props.row.cyclePhaseLabel) }} · D{{ formatCycleDayValue(props.row.cycleDay) }}
              </span>
            </q-td>
          </template>

          <template #body-cell-loadBalance="props">
            <q-td :props="props">
              <span
                class="load-balance-cell elite-data"
                :class="loadBalanceClassFromValue(props.row.loadRatio)"
              >
                {{ props.row.loadRatio != null ? Number(props.row.loadRatio).toFixed(2) : '—' }}
              </span>
              <q-tooltip anchor="top middle" self="bottom middle" max-width="240px">
                {{ loadBalanceBandFromValue(props.row.loadRatio) }}
                <template v-if="props.row.loadRatio != null">
                  — Acute/chronic load ratio; 0.80–1.30 is de sweet spot.
                </template>
              </q-tooltip>
            </q-td>
          </template>

          <template #body-cell-compliance="props">
            <q-td :props="props">
              <span
                class="compliance-badge"
                :class="props.row.hasCheckinToday ? 'done' : 'pending'"
              >
                {{ props.row.hasCheckinToday ? 'GEDAAN' : 'NIET GEDAAN' }}
              </span>
            </q-td>
          </template>

          <template #body-cell-lastActivity="props">
            <q-td :props="props">
              <span v-if="props.row.lastActivityDate != null || props.row.lastActivityType != null" class="last-activity-cell elite-data">
                {{ formatLastActivityNorm(props.row) }}
              </span>
              <span v-else class="elite-data" style="color: #9ca3af">—</span>
            </q-td>
          </template>
        </q-table>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth.js'
import { useSquadronStore } from '../../stores/squadron.js'
import AthleteAvatar from '../../components/AthleteAvatar.vue'

const router = useRouter()
const authStore = useAuthStore()
const squadronStore = useSquadronStore()

const search = ref('')
const activeFilter = ref('all')
const filterOptions = [
  { label: 'Alle', value: 'all' },
  { label: 'Alleen aandacht (score ≥3)', value: 'attention' },
  { label: 'Hoog risico', value: 'highRisk' },
  { label: 'Geen check-in vandaag', value: 'noCheckinToday' },
  { label: 'Strava issues', value: 'stravaIssues' },
  { label: 'Geen data', value: 'noData' },
]

const pagination = ref({
  sortBy: 'attention',
  descending: true,
  page: 1,
  rowsPerPage: 25,
})

const columns = [
  {
    name: 'athlete',
    label: 'ATLEET',
    field: 'name',
    align: 'left',
  },
  {
    name: 'attention',
    label: 'AANDACHT',
    field: (row) => row.attention?.score ?? -1,
    align: 'left',
    sortable: true,
    sort: (a, b) => (b.attention?.score ?? -1) - (a.attention?.score ?? -1),
  },
  {
    name: 'cycle',
    label: 'CYCLUS',
    field: 'cyclePhase',
    align: 'left',
  },
  {
    name: 'loadBalance',
    label: 'BELASTINGSBALANS',
    field: (row) => row.loadRatio ?? null,
    align: 'center',
    sortable: true,
  },
  {
    name: 'compliance',
    label: 'CHECK-IN',
    field: 'compliance',
    align: 'center',
  },
  {
    name: 'lastActivity',
    label: 'LAATSTE ACTIVITEIT',
    field: 'lastActivity',
    align: 'left',
  },
]

const getLevelIcon = (level) => {
  if (level === 'elite') return 'emoji_events'
  if (level === 'active') return 'directions_run'
  return 'person'
}

/** Format normalized last activity row to "DD mmm · Type · PL value" */
function formatLastActivityNorm(row) {
  if (!row || typeof row !== 'object') return '—'
  const dateStr = row.lastActivityDate
  let datePart = '—'
  if (dateStr && typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr.slice(0, 10))) {
    const d = new Date(dateStr.slice(0, 10))
    if (!Number.isNaN(d.getTime())) datePart = d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
  }
  const typePart = row.lastActivityType != null && row.lastActivityType !== '' ? row.lastActivityType : 'Workout'
  const loadPart =
    row.lastActivityPrimeLoad != null && Number.isFinite(Number(row.lastActivityPrimeLoad))
      ? (Number(row.lastActivityPrimeLoad) % 1 === 0
          ? String(Math.round(row.lastActivityPrimeLoad))
          : Number(row.lastActivityPrimeLoad).toFixed(1))
      : '—'
  return `${datePart} · ${typePart} · PL ${loadPart}`
}

function formatCyclePhaseLabel(cyclePhaseLabel) {
  if (cyclePhaseLabel == null || cyclePhaseLabel === '') return 'Niet ingesteld'
  const s = String(cyclePhaseLabel).trim()
  if (s.toLowerCase() === 'unknown' || s.toLowerCase() === 'onbekend') return 'Niet ingesteld'
  return s
}

function formatCycleDayValue(cycleDay) {
  if (cycleDay == null || !Number.isFinite(Number(cycleDay)) || Number(cycleDay) <= 0) return '—'
  return Number(cycleDay)
}

function loadBalanceBandFromValue(loadRatio) {
  if (loadRatio == null) return 'Geen data'
  const v = Number(loadRatio)
  if (!Number.isFinite(v)) return 'Geen data'
  if (v < 0.8) return '<0.80 Onder'
  if (v < 1.3) return '0.80–1.30 In balans'
  if (v < 1.5) return '1.30–1.50 Hoog'
  return '>1.50 Piek'
}

function loadBalanceClassFromValue(loadRatio) {
  if (loadRatio == null) return 'load-balance-unknown'
  const v = Number(loadRatio)
  if (!Number.isFinite(v)) return 'load-balance-unknown'
  if (v >= 0.8 && v <= 1.3) return 'load-balance-optimal'
  return 'load-balance-outside'
}

function matchesSearch(row, term) {
  const q = term.trim().toLowerCase()
  if (!q) return true
  const name = row.name || row.profile?.fullName || ''
  const email = row.email || row.profile?.email || ''
  return (
    String(name).toLowerCase().includes(q) ||
    String(email).toLowerCase().includes(q)
  )
}

function getAcwr(row) {
  const v = row.metrics?.acwr ?? row.acwr
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function hasStravaIssue(row) {
  const meta = row.stravaMeta || row.strava || row.metricsMeta?.strava || {}
  const err = meta.lastError || meta.error || row.stravaError || row.strava_error
  return !!err
}

function hasNoData(row) {
  const acwr = getAcwr(row)
  const acute = Number(row.metrics?.acuteLoad ?? row.acuteLoad)
  const chronic = Number(row.metrics?.chronicLoad ?? row.chronicLoad)
  const hasLoad =
    (acwr != null) ||
    Number.isFinite(acute) ||
    Number.isFinite(chronic)
  const hasHistory =
    Array.isArray(row.history_logs) && row.history_logs.length > 0
  return !hasLoad && !hasHistory
}

function matchesFilter(row, mode) {
  switch (mode) {
    case 'attention':
      return (row.attention?.score ?? 0) >= 3
    case 'highRisk':
      return (row.loadRatio ?? getAcwr(row) ?? 0) > 1.5
    case 'noCheckinToday':
      return row.hasCheckinToday !== true
    case 'stravaIssues':
      return hasStravaIssue(row)
    case 'noData':
      return hasNoData(row)
    case 'all':
    default:
      return true
  }
}

const filteredRows = computed(() => {
  const base = squadronStore.squadRows || []
  const term = search.value
  const mode = activeFilter.value
  return base.filter((row) => matchesSearch(row, term) && matchesFilter(row, mode))
})

const loadSquad = async () => {
  try {
    await squadronStore.fetchSquadron()
  } catch (e) {
    console.error('Squad load failed:', e)
  }
}

const onRowClick = (_evt, row) => {
  router.push({ name: 'CoachDeepDive', params: { id: row.id } })
}

// Pas laden zodra auth klaar is én coach-e-mail uit authStore beschikbaar is (geen localStorage)
watch(
  () => ({ ready: authStore.isAuthReady, email: authStore.user?.email }),
  ({ ready, email }) => {
    if (ready && email) loadSquad()
  },
  { immediate: true },
)
</script>

<style scoped lang="scss">
@use '../../css/quasar.variables' as q;

.coach-dashboard {
  background: q.$prime-black;
  min-height: 100vh;
  padding: 24px;
}

.engineer-container {
  max-width: 1100px;
  margin: 0 auto;
}

.engineer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
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

.squadron-card {
  background: q.$prime-surface !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: q.$radius-sm !important;
  box-shadow: none !important;
}

.squadron-table :deep(.q-table__top) {
  background: transparent;
}

.squadron-table :deep(thead tr th) {
  background: rgba(255, 255, 255, 0.04) !important;
  color: q.$prime-gray !important;
  font-family: q.$typography-font-family !important;
  font-size: 0.7rem !important;
  text-transform: uppercase !important;
  letter-spacing: 0.1em !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
}

.squadron-table :deep(tbody tr) {
  cursor: pointer;
}

.squadron-table :deep(tbody tr:hover) {
  background: rgba(255, 255, 255, 0.04) !important;
}

.athlete-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.athlete-name {
  font-family: q.$typography-font-family;
  font-weight: 500;
  color: #ffffff;
  display: block;
}

.athlete-level {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: q.$prime-gray;
}

.athlete-level.level-elite {
  color: q.$prime-gold;
}

.attention-td {
  max-height: 2.5em;
  vertical-align: middle;
}

.attention-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.attention-cell-single {
  flex-wrap: nowrap;
  min-height: 0;
  line-height: 1.3;
}

.attention-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 2px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  font-size: 0.6rem;
  font-weight: 700;
  font-family: q.$mono-font;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.attention-badge.attention-ok {
  color: q.$status-push;
  border-color: q.$status-push;
}

.attention-badge.attention-watch {
  color: #f97316;
  border-color: #f97316;
}

.attention-badge.attention-act {
  color: q.$status-recover;
  border-color: q.$status-recover;
}

.attention-score {
  font-family: q.$mono-font;
  font-size: 0.8rem;
}

.attention-reason-inline {
  font-size: 0.65rem;
  color: q.$prime-gray;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

.load-balance-cell.load-balance-optimal {
  color: q.$status-push;
}

.load-balance-cell.load-balance-outside {
  color: #f97316;
}

.load-balance-cell.load-balance-unknown {
  color: q.$prime-gray;
}

.compliance-badge {
  display: inline-block;
  border: 1px solid;
  padding: 2px 8px;
  font-size: 0.65rem;
  font-weight: 700;
  font-family: q.$mono-font;
  text-transform: uppercase;
  border-radius: 2px;
}

.compliance-badge.done {
  color: q.$status-push;
  border-color: q.$status-push;
  background: rgba(34, 197, 94, 0.1);
}

.compliance-badge.pending {
  color: q.$prime-gray;
  border-color: rgba(255, 255, 255, 0.2);
}

.last-activity-cell {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
}
</style>
