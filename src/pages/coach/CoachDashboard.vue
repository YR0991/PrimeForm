<template>
  <q-page class="coach-dashboard elite-page">
    <div class="engineer-container">
      <header class="engineer-header">
        <h1 class="engineer-title">SQUADRON VIEW</h1>
        <q-btn
          flat
          round
          icon="refresh"
          color="white"
          size="sm"
          @click="loadSquad"
          :loading="loading"
        />
      </header>

      <q-card class="squadron-card" flat>
        <q-table
          :rows="squad"
          :columns="columns"
          row-key="id"
          :loading="loading"
          flat
          dark
          class="squadron-table"
          @row-click="onRowClick"
        >
          <template #body-cell-athlete="props">
            <q-td :props="props">
              <div class="athlete-cell">
                <q-avatar size="32px" color="rgba(255,255,255,0.1)" text-color="#9ca3af">
                  {{ getInitials(props.row.name) }}
                </q-avatar>
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

          <template #body-cell-cycle="props">
            <q-td :props="props">
              <span class="elite-data">{{ props.row.cyclePhase }} · D{{ props.row.cycleDay }}</span>
            </q-td>
          </template>

          <template #body-cell-loadBalance="props">
            <q-td :props="props">
              <span
                class="load-balance-cell elite-data"
                :class="`load-balance-${props.row.loadBalanceStatus}`"
              >
                {{ props.row.loadBalance != null ? props.row.loadBalance.toFixed(2) : '—' }}
              </span>
              <span v-if="props.row.loadBalanceStatus === 'optimal'" class="load-balance-hint">Optimale opbouw</span>
            </q-td>
          </template>

          <template #body-cell-compliance="props">
            <q-td :props="props">
              <span
                class="compliance-badge"
                :class="props.row.compliance ? 'done' : 'pending'"
              >
                {{ props.row.compliance ? 'Gedaan' : '—' }}
              </span>
            </q-td>
          </template>

          <template #body-cell-lastActivity="props">
            <q-td :props="props">
              <span v-if="props.row.lastActivity" class="elite-data">
                {{ props.row.lastActivity.time }} · {{ props.row.lastActivity.type }}
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
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth.js'
import { getCoachSquad } from '../../services/coachService.js'

const router = useRouter()
const authStore = useAuthStore()
const loading = ref(false)
const squad = ref([])

const columns = [
  {
    name: 'athlete',
    label: 'ATLEET',
    field: 'name',
    align: 'left',
  },
  {
    name: 'cycle',
    label: 'CYCUS',
    field: 'cyclePhase',
    align: 'left',
  },
  {
    name: 'loadBalance',
    label: 'BELASTINGSBALANS',
    field: 'loadBalance',
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

const getInitials = (name) => {
  return name
    ?.split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?'
}

const getLevelIcon = (level) => {
  if (level === 'elite') return 'emoji_events'
  if (level === 'active') return 'directions_run'
  return 'person'
}

const loadSquad = async () => {
  const email = authStore.user?.email ?? null
  if (!email || !String(email).trim()) {
    squad.value = []
    return
  }
  loading.value = true
  try {
    squad.value = await getCoachSquad(email)
  } catch (e) {
    console.error('Squad load failed:', e)
    squad.value = []
  } finally {
    loading.value = false
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

.load-balance-hint {
  display: block;
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: q.$status-push;
  margin-top: 2px;
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
</style>
