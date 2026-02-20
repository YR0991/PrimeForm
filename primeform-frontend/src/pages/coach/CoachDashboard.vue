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
          :rows="rows"
          :columns="columns"
          row-key="id"
          :loading="squadronStore.loading"
          v-model:pagination="pagination"
          flat
          dark
          class="squadron-table"
          @row-click="onRowClick"
        >
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

          <template #body-cell-directive="props">
            <q-td :props="props">
              <!-- Render props.row.directive as delivered by API. Fallback — if falsy. -->
              <!-- TODO: if directive not on row, log which keys exist (do not derive). -->
              <span class="elite-data">{{ props.row.directive || '—' }}</span>
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
              <span class="last-activity-cell elite-data">
                {{ formatLastActivityDateOnly(props.row) }}
              </span>
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

const pagination = ref({
  sortBy: 'name',
  descending: false,
  page: 1,
  rowsPerPage: 25,
})

const rows = computed(() => squadronStore.squadRows || [])

const columns = [
  {
    name: 'athlete',
    label: 'ATLEET',
    field: 'name',
    align: 'left',
  },
  {
    name: 'directive',
    label: 'DIRECTIVE',
    field: 'directive',
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
    field: 'lastActivityDate',
    align: 'left',
  },
]

const getLevelIcon = (level) => {
  if (level === 'elite') return 'emoji_events'
  if (level === 'active') return 'directions_run'
  return 'person'
}

/** Last activity: date only (no type, no PrimeLoad). */
function formatLastActivityDateOnly(row) {
  if (!row || typeof row !== 'object') return '—'
  const dateStr = row.lastActivity?.date ?? row.lastActivity?.time ?? row.lastActivityDate
  if (dateStr == null || dateStr === '') return '—'
  const str = String(dateStr).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return '—'
  const d = new Date(str)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
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
