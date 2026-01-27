<template>
  <q-page class="admin-page">
    <div class="admin-container">
      <div class="admin-header">
        <h1 class="admin-title">Admin Dashboard</h1>
        <q-btn
          flat
          round
          icon="refresh"
          color="white"
          @click="loadUsers"
          :loading="loading"
        />
      </div>

      <!-- Statistics Cards -->
      <div class="stats-grid q-mb-lg">
        <q-card class="stat-card" flat>
          <q-card-section>
            <div class="stat-value">{{ stats.totalMembers }}</div>
            <div class="stat-label">Totaal Leden</div>
          </q-card-section>
        </q-card>

        <q-card class="stat-card" flat>
          <q-card-section>
            <div class="stat-value">{{ stats.newThisWeek }}</div>
            <div class="stat-label">Nieuw deze week</div>
          </q-card-section>
        </q-card>

        <q-card class="stat-card" flat>
          <q-card-section>
            <div class="stat-value">{{ stats.checkinsToday }}</div>
            <div class="stat-label">Check-ins vandaag</div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Users Table -->
      <q-card class="users-card" flat>
        <q-card-section>
          <div class="text-h6 q-mb-md">Gebruikers</div>
          
            <q-table
            :rows="users"
            :columns="columns"
            :row-key="row => row.id || row.userId"
            :loading="loading"
            :rows-per-page-options="[10, 25, 50]"
            flat
            dark
            class="admin-table"
          >
            <template v-slot:body-cell-actions="props">
              <q-td :props="props">
                <q-btn
                  flat
                  dense
                  round
                  icon="visibility"
                  color="primary"
                  @click="openUserDialog(props.row)"
                >
                  <q-tooltip>Bekijk details</q-tooltip>
                </q-btn>
              </q-td>
            </template>
          </q-table>
        </q-card-section>
      </q-card>

      <!-- User Detail Dialog -->
      <q-dialog v-model="userDialogOpen" maximized>
        <q-card class="user-dialog-card" dark>
          <q-card-section class="row items-center q-pb-none">
            <div class="text-h6">Gebruiker Details</div>
            <q-space />
            <q-btn icon="close" flat round dense v-close-popup />
          </q-card-section>

          <q-card-section v-if="selectedUser">
            <div class="user-header q-mb-md">
              <div class="text-h6">{{ selectedUser.profile?.fullName || 'Geen naam' }}</div>
              <div class="text-caption text-grey">{{ selectedUser.profile?.email || 'Geen e-mail' }}</div>
            </div>

            <q-tabs v-model="dialogTab" align="left" class="text-grey" active-color="primary">
              <q-tab name="intake" label="Intake" />
              <q-tab name="history" label="Historie" />
            </q-tabs>

            <q-separator />

            <q-tab-panels v-model="dialogTab" animated>
              <!-- Intake Tab -->
              <q-tab-panel name="intake">
                <div v-if="loadingDetails" class="text-center q-pa-lg">
                  <q-spinner color="primary" size="3em" />
                </div>
                <q-list v-else-if="userDetails" dark separator>
                  <q-item>
                    <q-item-section>
                      <q-item-label>Naam</q-item-label>
                      <q-item-label caption>{{ userDetails.fullName || 'Niet ingevuld' }}</q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-item>
                    <q-item-section>
                      <q-item-label>E-mail</q-item-label>
                      <q-item-label caption>{{ userDetails.email || 'Niet ingevuld' }}</q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-item>
                    <q-item-section>
                      <q-item-label>Geboortedatum</q-item-label>
                      <q-item-label caption>{{ userDetails.birthDate || 'Niet ingevuld' }}</q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-item>
                    <q-item-section>
                      <q-item-label>Doelen</q-item-label>
                      <q-item-label caption>
                        <q-chip
                          v-for="goal in (userDetails.goals || [])"
                          :key="goal"
                          size="sm"
                          color="primary"
                          class="q-mr-xs q-mt-xs"
                        >
                          {{ goal }}
                        </q-chip>
                        <span v-if="!userDetails.goals || userDetails.goals.length === 0">Geen doelen geselecteerd</span>
                      </q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-item>
                    <q-item-section>
                      <q-item-label>Training Frequentie</q-item-label>
                      <q-item-label caption>{{ userDetails.trainingFrequency || 'Niet ingevuld' }} dagen/week</q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-item>
                    <q-item-section>
                      <q-item-label>Programma Type</q-item-label>
                      <q-item-label caption>{{ userDetails.programmingType || 'Niet ingevuld' }}</q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-item>
                    <q-item-section>
                      <q-item-label>Gemiddelde Slaap</q-item-label>
                      <q-item-label caption>{{ userDetails.sleepAvg || 'Niet ingevuld' }} uur</q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-item>
                    <q-item-section>
                      <q-item-label>Cyclus Duur</q-item-label>
                      <q-item-label caption>{{ userDetails.cycleData?.avgDuration || 'Niet ingevuld' }} dagen</q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-item>
                    <q-item-section>
                      <q-item-label>Laatste Menstruatie</q-item-label>
                      <q-item-label caption>{{ userDetails.cycleData?.lastPeriod || 'Niet ingevuld' }}</q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-item>
                    <q-item-section>
                      <q-item-label>Anticonceptie</q-item-label>
                      <q-item-label caption>{{ userDetails.cycleData?.contraception || 'Niet ingevuld' }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
                <div v-else class="text-center q-pa-lg text-grey">
                  Geen intake data beschikbaar
                </div>
              </q-tab-panel>

              <!-- History Tab -->
              <q-tab-panel name="history">
                <div v-if="loadingHistory" class="text-center q-pa-lg">
                  <q-spinner color="primary" size="3em" />
                </div>
                <q-timeline v-else-if="userHistory && userHistory.length > 0" color="primary" side="right">
                  <q-timeline-entry
                    v-for="(entry, index) in userHistory"
                    :key="index"
                    :title="formatDate(entry.timestamp || entry.date)"
                    :subtitle="`Status: ${entry.recommendation?.status || 'N/A'}`"
                  >
                    <div class="history-entry">
                      <div class="q-mb-sm">
                        <strong>Readiness:</strong> {{ entry.metrics?.readiness || 'N/A' }}/10
                      </div>
                      <div class="q-mb-sm">
                        <strong>Slaap:</strong> {{ entry.metrics?.sleep || 'N/A' }} uur
                      </div>
                      <div class="q-mb-sm">
                        <strong>RHR:</strong> {{ entry.metrics?.rhr?.current || entry.metrics?.rhr || 'N/A' }} bpm
                      </div>
                      <div class="q-mb-sm">
                        <strong>HRV:</strong> {{ entry.metrics?.hrv?.current || entry.metrics?.hrv || 'N/A' }}
                      </div>
                      <div v-if="entry.redFlags?.count > 0" class="q-mt-sm">
                        <q-chip color="negative" size="sm">
                          {{ entry.redFlags.count }} Red Flag(s)
                        </q-chip>
                      </div>
                    </div>
                  </q-timeline-entry>
                </q-timeline>
                <div v-else class="text-center q-pa-lg text-grey">
                  Geen check-in geschiedenis beschikbaar
                </div>
              </q-tab-panel>
            </q-tab-panels>
          </q-card-section>
        </q-card>
      </q-dialog>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { fetchAllUsers, getUserDetails, getUserHistory, calculateStats } from '../../services/adminService.js'

const loading = ref(false)
const users = ref([])
const stats = ref({
  totalMembers: 0,
  newThisWeek: 0,
  checkinsToday: 0
})

const userDialogOpen = ref(false)
const selectedUser = ref(null)
const userDetails = ref(null)
const userHistory = ref([])
const loadingDetails = ref(false)
const loadingHistory = ref(false)
const dialogTab = ref('intake')

const columns = [
  {
    name: 'name',
    required: true,
    label: 'Naam',
    align: 'left',
    field: row => row.profile?.fullName || 'Geen naam',
    sortable: true
  },
  {
    name: 'email',
    label: 'E-mail',
    align: 'left',
    field: row => row.profile?.email || 'Geen e-mail',
    sortable: true
  },
  {
    name: 'createdAt',
    label: 'Aangemeld',
    align: 'left',
    field: row => {
      if (!row.createdAt) return 'Onbekend'
      const date = row.createdAt?.toDate ? row.createdAt.toDate() : new Date(row.createdAt)
      return date.toLocaleDateString('nl-NL')
    },
    sortable: true
  },
  {
    name: 'actions',
    label: 'Acties',
    align: 'center',
    field: () => ''
  }
]

const loadUsers = async () => {
  loading.value = true
  try {
    // For now, we'll need to create a backend endpoint
    // This is a placeholder - you'll need to implement /api/admin/users
    const allUsers = await fetchAllUsers()
    users.value = allUsers
    stats.value = calculateStats(allUsers)
  } catch (error) {
    console.error('Failed to load users:', error)
    // Fallback: show empty state or error message
    users.value = []
  } finally {
    loading.value = false
  }
}

const openUserDialog = async (user) => {
  selectedUser.value = user
  userDialogOpen.value = true
  dialogTab.value = 'intake'
  userDetails.value = null
  userHistory.value = []

  // Load user details
  loadingDetails.value = true
  try {
    userDetails.value = await getUserDetails(user.id || user.userId)
  } catch (error) {
    console.error('Failed to load user details:', error)
  } finally {
    loadingDetails.value = false
  }

  // Load user history
  loadingHistory.value = true
  try {
    userHistory.value = await getUserHistory(user.id || user.userId)
  } catch (error) {
    console.error('Failed to load user history:', error)
  } finally {
    loadingHistory.value = false
  }
}

const formatDate = (dateString) => {
  if (!dateString) return 'Onbekend'
  const date = new Date(dateString)
  return date.toLocaleDateString('nl-NL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

onMounted(() => {
  loadUsers()
})
</script>

<style scoped>
.admin-page {
  background: #000000;
  min-height: 100vh;
  padding: 24px;
}

.admin-container {
  max-width: 1400px;
  margin: 0 auto;
}

.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.admin-title {
  font-family: 'Montserrat', sans-serif;
  font-weight: 900;
  font-style: italic;
  color: #D4AF37;
  font-size: 2rem;
  margin: 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.stat-card {
  background: rgba(18, 18, 18, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.stat-value {
  font-size: 2.5rem;
  font-weight: 900;
  color: #D4AF37;
  font-family: 'Montserrat', sans-serif;
}

.stat-label {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.7);
  margin-top: 8px;
}

.users-card {
  background: rgba(18, 18, 18, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.user-dialog-card {
  background: #000000;
  min-width: 90vw;
}

.user-header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 16px;
}

.history-entry {
  background: rgba(18, 18, 18, 0.5);
  padding: 12px;
  border-radius: 4px;
  margin-top: 8px;
}

.admin-table :deep(.q-table__top) {
  background: transparent;
}

.admin-table :deep(.q-table thead tr th) {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
}

.admin-table :deep(.q-table tbody tr) {
  background: rgba(255, 255, 255, 0.02);
}

.admin-table :deep(.q-table tbody tr:hover) {
  background: rgba(255, 255, 255, 0.05);
}
</style>
