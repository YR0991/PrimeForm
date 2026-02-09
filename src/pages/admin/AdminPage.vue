<template>
  <q-page class="admin-page">
    <!-- Simple admin gate -->
    <div v-if="!isAdminAuthenticated" class="admin-container q-pa-lg">
      <q-card class="admin-login-card" flat dark>
        <q-card-section>
          <div class="text-h6 q-mb-md">Super Admin Access</div>
          <p class="text-body2 text-grey q-mb-md">
            Voer je beheerder e-mailadres in om Mission Control te openen.
          </p>
          <q-input
            v-model="adminEmailInput"
            type="email"
            label="E-mailadres"
            outlined
            dark
            class="q-mb-md"
            :error="!!adminLoginError"
            :error-message="adminLoginError"
            @keyup.enter="submitAdminLogin"
          />
          <div class="row q-gutter-sm">
            <q-btn color="primary" label="Toegang" @click="submitAdminLogin" />
            <q-btn flat label="Terug naar app" to="/" />
          </div>
        </q-card-section>
      </q-card>
    </div>

    <div v-else class="admin-container">
      <!-- Header -->
      <div class="admin-header">
        <div>
          <div class="admin-title">SUPER ADMIN • MISSION CONTROL</div>
          <div class="admin-subtitle">
            Global Telemetry • Squadrons • Pilots
          </div>
        </div>
        <q-btn
          flat
          round
          icon="refresh"
          color="white"
          :loading="adminStore.loading"
          @click="adminStore.fetchAllData"
        />
      </div>

      <!-- KPI Row -->
      <div class="kpi-grid q-mb-lg">
        <q-card class="kpi-card" flat>
          <q-card-section>
            <div class="kpi-label">TOTAL SQUADRONS</div>
            <div class="kpi-value">{{ adminStore.totalTeams }}</div>
          </q-card-section>
        </q-card>

        <q-card class="kpi-card" flat>
          <q-card-section>
            <div class="kpi-label">ACTIVE PILOTS</div>
            <div class="kpi-value">{{ adminStore.totalUsers }}</div>
          </q-card-section>
        </q-card>

        <q-card class="kpi-card" flat>
          <q-card-section>
            <div class="kpi-label">SYSTEM LOAD</div>
            <div class="kpi-value">
              <span v-if="systemCapacity > 0">
                {{ systemLoadPercent.toFixed(0) }}%
              </span>
              <span v-else>—</span>
            </div>
            <div class="kpi-caption" v-if="systemCapacity > 0">
              {{ adminStore.totalUsers }} / {{ systemCapacity }} pilots
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Ghost Grid: Orphaned Users -->
      <q-card
        v-if="orphanedUsers.length > 0"
        class="ghost-card q-mb-lg"
        flat
      >
        <q-card-section>
          <div class="ghost-header row items-center justify-between q-mb-md">
            <div>
              <div class="ghost-title">
                ⚠️ UNASSIGNED PILOTS (ACTION REQUIRED)
              </div>
              <div class="ghost-subtitle">
                Pilots without a Constructor assignment are invisible to squad telemetry.
              </div>
            </div>
            <div class="ghost-count">
              {{ orphanedUsers.length }}
            </div>
          </div>

          <q-table
            :rows="orphanedUsers"
            :columns="ghostColumns"
            :row-key="(row) => row.id"
            flat
            dark
            dense
            class="ghost-table"
            :loading="adminStore.loading"
            :rows-per-page-options="[5, 10, 25]"
          >
            <template #body-cell-joinedAt="props">
              <q-td :props="props">
                {{ formatJoinedAt(props.row) }}
              </q-td>
            </template>

            <template #body-cell-team="props">
              <q-td :props="props">
                <q-select
                  v-model="userAssignments[props.row.id]"
                  :options="teamOptions"
                  emit-value
                  map-options
                  dense
                  outlined
                  dark
                  options-dense
                  placeholder="Assign Squad"
                  @update:model-value="(val) => onAssignTeam(props.row.id, val)"
                />
              </q-td>
            </template>

            <template #no-data>
              <div class="text-grey text-caption q-pa-md">
                All pilots are assigned. No ghosts in the system.
              </div>
            </template>
          </q-table>
        </q-card-section>
      </q-card>

      <!-- Constructor Configuration -->
      <q-card class="teams-card" flat>
        <q-card-section class="row items-center justify-between">
          <div class="teams-header">
            <div class="teams-title">CONSTRUCTOR CONFIGURATION</div>
            <div class="teams-subtitle">
              Active Squadrons • Coaches • Codes • Occupancy
            </div>
          </div>
          <q-btn
            class="new-team-btn"
            color="primary"
            outline
            no-caps
            :loading="teamsLoading"
            @click="openTeamDialog"
          >
            [+] DEPLOY NEW TEAM
          </q-btn>
        </q-card-section>

        <q-card-section>
          <q-table
            :rows="teamsWithOccupancy"
            :columns="teamColumns"
            row-key="id"
            flat
            dark
            :loading="adminStore.loading || teamsLoading"
            :rows-per-page-options="[5, 10, 25]"
            class="teams-table"
          >
            <template #body-cell-inviteCode="props">
              <q-td :props="props">
                <span class="team-code">{{ props.row.inviteCode || '—' }}</span>
                <q-btn
                  v-if="props.row.inviteCode"
                  flat
                  dense
                  round
                  icon="content_copy"
                  size="sm"
                  class="q-ml-xs"
                  @click="copyTeamInvite(props.row.inviteCode)"
                >
                  <q-tooltip>Copy invite code</q-tooltip>
                </q-btn>
              </q-td>
            </template>

            <template #body-cell-occupancy="props">
              <q-td :props="props">
                <div class="row items-center no-wrap">
                  <q-linear-progress
                    :value="props.row.occupancyRatio"
                    :color="occupancyColor(props.row.occupancyRatio)"
                    class="flex-grow-1 q-mr-sm"
                    track-color="rgba(255,255,255,0.12)"
                  />
                  <div class="occupancy-label">
                    {{ props.row.memberCount }}/{{ props.row.memberLimit || '∞' }}
                  </div>
                </div>
              </q-td>
            </template>

            <template #no-data>
              <div class="text-grey text-caption q-pa-md">
                Nog geen teams geregistreerd. Gebruik de knop
                <span class="text-white">DEPLOY NEW TEAM</span>
                om een eerste squadron te activeren.
              </div>
            </template>
          </q-table>
        </q-card-section>
      </q-card>

      <!-- Team dialog (existing logic) -->
      <q-dialog v-model="teamDialogOpen" persistent>
        <q-card class="user-dialog-card" dark style="min-width: 360px">
          <q-card-section>
            <div class="text-h6">Nieuw Team</div>
            <div class="text-caption text-grey q-mt-xs">
              Koppel een coach en stel een limiet voor leden in.
            </div>
          </q-card-section>
          <q-card-section class="q-pt-none">
            <q-input
              v-model="teamForm.name"
              label="Teamnaam"
              outlined
              dark
              class="q-mb-md"
            />
            <q-input
              v-model="teamForm.coachEmail"
              label="Coach e-mail"
              type="email"
              outlined
              dark
              class="q-mb-md"
            />
            <q-input
              v-model.number="teamForm.memberLimit"
              label="Max leden (default 10)"
              type="number"
              outlined
              dark
              class="q-mb-md"
            />
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat label="Annuleren" :disable="teamsLoading" v-close-popup />
            <q-btn
              label="Bevestigen"
              color="primary"
              :loading="teamsLoading"
              @click="submitTeam"
            />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </div>
  </q-page>
</template>

<script setup>
import { ref as vueRef, computed, onMounted as onMountedHook } from 'vue'
import { Notify, copyToClipboard } from 'quasar'
import { useTeamsStore } from '../../stores/teams'
import { useAdminStore } from '../../stores/admin'

const ADMIN_EMAIL = 'yoramroemersma50@gmail.com'

const adminStore = useAdminStore()

const isAdminAuthenticated = vueRef(false)
const adminEmailInput = vueRef('')
const adminLoginError = vueRef('')

// Team creation (reuse existing logic)
const teamsStore = useTeamsStore()
const teamDialogOpen = vueRef(false)
const teamForm = vueRef({
  name: '',
  coachEmail: '',
  memberLimit: 10,
})

const teamsLoading = computed(() => teamsStore.loading)

const resetTeamForm = () => {
  teamForm.value = {
    name: '',
    coachEmail: '',
    memberLimit: 10,
  }
}

const openTeamDialog = () => {
  resetTeamForm()
  teamDialogOpen.value = true
}

const submitTeam = async () => {
  if (!teamForm.value.name) {
    Notify.create({
      type: 'negative',
      message: 'Teamnaam is verplicht.',
    })
    return
  }

  try {
    await teamsStore.createTeam({
      name: teamForm.value.name,
      coachEmail: teamForm.value.coachEmail || null,
      memberLimit: teamForm.value.memberLimit ?? 10,
    })

    // Refresh Admin telemetry
    await adminStore.fetchAllData()

    Notify.create({
      type: 'positive',
      message: 'Team aangemaakt.',
    })

    teamDialogOpen.value = false
  } catch (error) {
    console.error('Failed to create team:', error)
    Notify.create({
      type: 'negative',
      message: error?.message || 'Team aanmaken mislukt.',
    })
  }
}

const copyTeamInvite = (code) => {
  if (!code) return
  copyToClipboard(code)
    .then(() => {
      Notify.create({
        type: 'positive',
        message: 'Invite code gekopieerd.',
      })
    })
    .catch(() => {
      Notify.create({
        type: 'negative',
        message: 'Kopiëren van invite code mislukt.',
      })
    })
}

// Firestore timestamp helper
const toDateFromFirestore = (value) => {
  if (!value) return null

  if (typeof value.toDate === 'function') {
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
      const millis = seconds * 1000 + nanos / 1e6
      const d = new Date(millis)
      return isNaN(d.getTime()) ? null : d
    }
  }

  return null
}

// Ghost Grid data
const orphanedUsers = computed(() => adminStore.orphanedUsers || [])

const formatJoinedAt = (user) => {
  const raw = user.createdAt || user.joinedAt
  const date = toDateFromFirestore(raw)
  if (!date) return '—'
  return date.toLocaleDateString('nl-NL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

const ghostColumns = [
  {
    name: 'email',
    label: 'Email',
    field: (row) => row.email || row.profile?.email || '—',
    align: 'left',
    sortable: true,
  },
  {
    name: 'name',
    label: 'Name',
    field: (row) => row.displayName || row.profile?.fullName || '—',
    align: 'left',
    sortable: true,
  },
  {
    name: 'joinedAt',
    label: 'Joined',
    field: () => '',
    align: 'left',
    sortable: false,
  },
  {
    name: 'team',
    label: 'Assign Squad',
    field: () => '',
    align: 'right',
  },
]

// Local select state for assignments
const userAssignments = vueRef({})

const teamOptions = computed(() =>
  (adminStore.teams || []).map((team) => ({
    label: team.name || 'Unnamed Squad',
    value: team.id,
  })),
)

const onAssignTeam = async (userId, teamId) => {
  if (!userId || !teamId) return
  try {
    await adminStore.assignUserToTeam(userId, teamId)
    Notify.create({
      type: 'positive',
      message: 'Pilot assigned to squad.',
    })
  } catch (err) {
    console.error('Failed to assign user to team', err)
    Notify.create({
      type: 'negative',
      message: err?.message || 'Toewijzen mislukt.',
    })
  }
}

// Teams telemetry
const teamsWithOccupancy = computed(() => {
  const users = adminStore.users || []
  const teams = adminStore.teams || []

  return teams.map((team) => {
    const limit = Number(team.memberLimit)
    const memberLimit = Number.isFinite(limit) && limit > 0 ? limit : null
    const memberCount = users.filter((u) => u.teamId === team.id).length
    const occupancyRatio =
      memberLimit && memberLimit > 0 ? Math.min(memberCount / memberLimit, 1) : 0

    return {
      ...team,
      memberCount,
      memberLimit,
      occupancyRatio,
    }
  })
})

const teamColumns = [
  {
    name: 'name',
    label: 'Name',
    field: 'name',
    align: 'left',
    sortable: true,
  },
  {
    name: 'coachEmail',
    label: 'Coach Email',
    field: (row) => row.coachEmail || '—',
    align: 'left',
    sortable: true,
  },
  {
    name: 'inviteCode',
    label: 'Invite Code',
    field: 'inviteCode',
    align: 'left',
    sortable: true,
  },
  {
    name: 'occupancy',
    label: 'Occupancy',
    field: () => '',
    align: 'right',
  },
]

const occupancyColor = (ratio) => {
  if (!Number.isFinite(ratio)) return 'grey-7'
  if (ratio >= 1) return 'negative' // 100%+
  if (ratio >= 0.8) return 'orange-5' // >80%
  return 'positive' // <80%
}

// KPIs
const systemCapacity = computed(() => adminStore.systemCapacity || 0)
const systemLoadPercent = computed(() => {
  if (!systemCapacity.value) return 0
  return (adminStore.totalUsers / systemCapacity.value) * 100
})

// Admin auth
const checkAdminAuth = () => {
  const stored = (localStorage.getItem('admin_email') || '').trim()
  isAdminAuthenticated.value = stored === ADMIN_EMAIL
  if (isAdminAuthenticated.value) {
    adminEmailInput.value = stored
  }
}

const submitAdminLogin = () => {
  adminLoginError.value = ''
  const email = adminEmailInput.value.trim()
  if (!email) {
    adminLoginError.value = 'Voer een e-mailadres in.'
    return
  }
  if (email !== ADMIN_EMAIL) {
    adminLoginError.value = 'Geen toegang. Alleen beheerders hebben toegang.'
    return
  }
  localStorage.setItem('admin_email', email)
  isAdminAuthenticated.value = true
  adminStore.fetchAllData()
}

onMountedHook(() => {
  checkAdminAuth()
  if (isAdminAuthenticated.value) {
    adminStore.fetchAllData()
  }
})
</script>

<style scoped lang="scss">
.admin-page {
  background: #050505;
  min-height: 100vh;
  padding: 24px;
}

.admin-container {
  max-width: 1440px;
  margin: 0 auto;
}

.admin-login-card {
  max-width: 420px;
  margin: 0 auto;
  background: rgba(255, 255, 255, 0.03) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 2px !important;
  box-shadow: none !important;
}

.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.admin-title {
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
    sans-serif;
  font-weight: 900;
  font-style: italic;
  color: #fbbf24;
  font-size: 1.4rem;
  margin: 0;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.admin-subtitle {
  margin-top: 4px;
  font-size: 0.8rem;
  color: rgba(156, 163, 175, 0.9);
  text-transform: uppercase;
  letter-spacing: 0.16em;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  grid-auto-rows: 1fr;
  gap: 16px;
}

.kpi-card {
  background: rgba(255, 255, 255, 0.03) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 2px !important;
  box-shadow: none !important;
}

.kpi-label {
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
    sans-serif;
  font-size: 0.75rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(156, 163, 175, 0.9);
  margin-bottom: 8px;
}

.kpi-value {
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco,
    Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 2.4rem;
  font-weight: 800;
  color: #fbbf24;
  line-height: 1.1;
}

.kpi-caption {
  margin-top: 8px;
  font-size: 0.75rem;
  color: rgba(156, 163, 175, 0.9);
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco,
    Consolas, 'Liberation Mono', 'Courier New', monospace;
}

.ghost-card {
  background: rgba(255, 255, 255, 0.03) !important;
  border: 1px solid rgba(239, 68, 68, 0.7) !important;
  border-radius: 2px !important;
  box-shadow: none !important;
}

.ghost-header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding-bottom: 8px;
}

.ghost-title {
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
    sans-serif;
  font-size: 0.85rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #fbbf24;
}

.ghost-subtitle {
  margin-top: 4px;
  font-size: 0.75rem;
  color: rgba(156, 163, 175, 0.9);
}

.ghost-count {
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco,
    Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 1.6rem;
  font-weight: 800;
  color: #ef4444;
}

.ghost-table :deep(.q-table thead tr th) {
  background: rgba(255, 255, 255, 0.04) !important;
  color: rgba(255, 255, 255, 0.9) !important;
  font-weight: 600;
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
    sans-serif;
  border-color: rgba(255, 255, 255, 0.1) !important;
}

.ghost-table :deep(.q-table tbody tr) {
  background: rgba(255, 255, 255, 0.02) !important;
}

.ghost-table :deep(.q-table tbody tr:hover) {
  background: rgba(255, 255, 255, 0.05) !important;
}

.ghost-table :deep(.q-table tbody td) {
  color: rgba(255, 255, 255, 0.9) !important;
  border-color: rgba(255, 255, 255, 0.08) !important;
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco,
    Consolas, 'Liberation Mono', 'Courier New', monospace;
}

.teams-card {
  margin-top: 8px;
  background: rgba(255, 255, 255, 0.03) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  border-radius: 2px !important;
  box-shadow: none !important;
}

.teams-header {
  display: flex;
  flex-direction: column;
}

.teams-title {
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
    sans-serif;
  font-size: 0.9rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #fbbf24;
}

.teams-subtitle {
  margin-top: 4px;
  font-size: 0.75rem;
  color: rgba(156, 163, 175, 0.9);
}

.new-team-btn {
  border-radius: 2px !important;
  border-width: 1px;
  border-color: #fbbf24;
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco,
    Consolas, 'Liberation Mono', 'Courier New', monospace !important;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.teams-table :deep(.q-table thead tr th) {
  background: rgba(255, 255, 255, 0.04) !important;
  color: rgba(255, 255, 255, 0.9) !important;
  font-weight: 600;
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
    sans-serif;
  border-color: rgba(255, 255, 255, 0.1) !important;
}

.teams-table :deep(.q-table tbody tr) {
  background: rgba(255, 255, 255, 0.02) !important;
}

.teams-table :deep(.q-table tbody tr:hover) {
  background: rgba(255, 255, 255, 0.05) !important;
}

.teams-table :deep(.q-table tbody td) {
  color: rgba(255, 255, 255, 0.9) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco,
    Consolas, 'Liberation Mono', 'Courier New', monospace;
}

.team-code {
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco,
    Consolas, 'Liberation Mono', 'Courier New', monospace !important;
}

.user-dialog-card {
  background: #050505 !important;
  color: #e5e5e5 !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 2px !important;
  box-shadow: none !important;
}

.occupancy-label {
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco,
    Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.9);
}
</style>
