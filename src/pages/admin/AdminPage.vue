<template>
  <q-page class="admin-page elite-page">
    <div class="admin-container">
      <div class="admin-header">
        <h1 class="admin-title">SYSTEM ARCHITECT</h1>
        <q-btn
          flat
          round
          icon="refresh"
          color="white"
          size="sm"
          @click="refreshAll"
          :loading="loading"
        />
      </div>

      <!-- System Health -->
      <q-card class="admin-card health-card" flat>
        <q-card-section>
          <div class="section-label">SYSTEM HEALTH</div>
          <div class="health-grid">
            <div class="health-metric">
              <div class="health-value elite-data">{{ systemHealth.totalUsers }}</div>
              <div class="health-label">Totaal gebruikers</div>
            </div>
            <div class="health-metric">
              <div class="health-value elite-data">{{ systemHealth.stravaApiCallsToday }}/{{ systemHealth.stravaRateLimit }}</div>
              <div class="health-label">Strava API calls vandaag</div>
            </div>
          </div>
          <div class="error-logs">
            <div class="error-logs-label">Error logs (laatste 5)</div>
            <div
              v-for="(log, i) in systemHealth.errorLogs"
              :key="i"
              class="error-log-row elite-data"
            >
              <span class="error-time">{{ log.time }}</span>
              <span class="error-msg">{{ log.message }}</span>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- Algorithm Verification Lab -->
      <q-card class="admin-card lab-card" flat>
        <q-card-section>
          <div class="section-label">ALGORITHM VERIFICATION LAB</div>
          <div class="lab-input-row">
            <q-input
              v-model="algorithmUid"
              outlined
              dark
              dense
              placeholder="Voer uid in"
              class="lab-uid-input"
              input-class="elite-data"
            />
            <q-btn
              label="GENERATE REPORT"
              unelevated
              no-caps
              class="lab-fetch-btn"
              :loading="labLoading"
              @click="fetchWeeklyReport"
            />
          </div>
          <div v-if="weeklyReport" class="lab-results">
            <div class="lab-json-block">
              <div class="lab-block-label">Raw JSON (generateWeeklyReport)</div>
              <pre class="lab-json elite-data">{{ jsonPreview }}</pre>
            </div>
            <div class="lab-comparison">
              <div class="lab-block-label">Strava Raw vs Prime Load</div>
              <q-table
                :rows="weeklyReport.stravaVsPrime || []"
                :columns="comparisonColumns"
                row-key="date"
                flat
                dark
                dense
                class="comparison-table"
                :pagination="{ rowsPerPage: 0 }"
              />
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- Statistics Cards -->
      <div class="stats-grid q-mb-lg">
        <q-card class="admin-card stat-card" flat>
          <q-card-section>
            <div class="stat-value elite-data">{{ stats.totalMembers }}</div>
            <div class="stat-label">Totaal Leden</div>
          </q-card-section>
        </q-card>

        <q-card class="admin-card stat-card" flat>
          <q-card-section>
            <div class="stat-value elite-data">{{ stats.newThisWeek }}</div>
            <div class="stat-label">Nieuw deze week</div>
          </q-card-section>
        </q-card>

        <q-card class="admin-card stat-card" flat>
          <q-card-section>
            <div class="stat-value elite-data">{{ stats.checkinsToday }}</div>
            <div class="stat-label">Check-ins vandaag</div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Users Table -->
      <q-card class="admin-card users-card" flat>
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
              <q-tab name="import" label="Import Historie" />
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

              <!-- Import Historie Tab -->
              <q-tab-panel name="import">
                <div class="import-section">
                  <div class="text-h6 q-mb-md">Batch Import Historische Data</div>
                  <div class="text-caption text-grey q-mb-lg">
                    Importeer HRV en RHR data voor baseline berekening. Kies een startdatum en vul de waarden in.
                  </div>

                  <div class="q-mb-md">
                    <q-input
                      v-model="importStartDate"
                      outlined
                      dark
                      label="Startdatum"
                      type="date"
                      @update:model-value="generateImportRows"
                      class="q-mb-md"
                    />
                  </div>

                  <div v-if="importRows.length > 0" class="import-table-container">
                    <q-table
                      :rows="importRows"
                      :columns="importColumns"
                      row-key="date"
                      flat
                      dark
                      class="import-table"
                      :pagination="{ rowsPerPage: 0 }"
                    >
                      <template v-slot:body-cell-hrv="props">
                        <q-td :props="props">
                          <q-input
                            v-model.number="props.row.hrv"
                            outlined
                            dense
                            dark
                            type="number"
                            placeholder="HRV"
                            @update:model-value="validateImportRow(props.row)"
                          />
                        </q-td>
                      </template>
                      <template v-slot:body-cell-rhr="props">
                        <q-td :props="props">
                          <q-input
                            v-model.number="props.row.rhr"
                            outlined
                            dense
                            dark
                            type="number"
                            placeholder="RHR"
                            @update:model-value="validateImportRow(props.row)"
                          />
                        </q-td>
                      </template>
                    </q-table>
                  </div>

                  <div class="q-mt-lg">
                    <q-linear-progress
                      v-if="importing"
                      :value="importProgress"
                      color="primary"
                      class="q-mb-md"
                    />
                    <div class="row justify-end q-gutter-sm">
                      <q-btn
                        flat
                        label="Annuleren"
                        color="white"
                        @click="resetImport"
                      />
                      <q-btn
                        label="Opslaan"
                        color="primary"
                        :loading="importing"
                        :disable="!canImport"
                        @click="saveImport"
                      />
                    </div>
                  </div>

                  <q-banner
                    v-if="importMessage"
                    :class="importSuccess ? 'bg-positive' : 'bg-negative'"
                    class="q-mt-md"
                  >
                    {{ importMessage }}
                  </q-banner>
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
import { ref, computed, onMounted, watch } from 'vue'
import { fetchAllUsers, getUserDetails, getUserHistory, calculateStats, importHistory } from '../../services/adminService.js'
import { getSystemHealth, getWeeklyReportForUser } from '../../services/userService.js'

const loading = ref(false)
const systemHealth = ref({
  totalUsers: 0,
  stravaApiCallsToday: 0,
  stravaRateLimit: 200,
  errorLogs: [],
})
const algorithmUid = ref('')
const weeklyReport = ref(null)
const labLoading = ref(false)

const comparisonColumns = [
  { name: 'date', label: 'DATUM', field: 'date', align: 'left' },
  { name: 'stravaRaw', label: 'STRAVA RAW', field: 'stravaRaw', align: 'right' },
  { name: 'primeLoad', label: 'PRIME LOAD', field: 'primeLoad', align: 'right' },
  { name: 'multiplier', label: 'MULT', field: (r) => r.multiplier?.toFixed(2), align: 'right' },
]

const jsonPreview = computed(() => {
  if (!weeklyReport.value) return ''
  return JSON.stringify(weeklyReport.value, null, 2)
})

const refreshAll = async () => {
  await loadUsers()
  await loadSystemHealth()
}

const loadSystemHealth = async () => {
  try {
    systemHealth.value = await getSystemHealth()
  } catch (e) {
    console.error('System health load failed:', e)
  }
}

const fetchWeeklyReport = async () => {
  if (!algorithmUid.value.trim()) return
  labLoading.value = true
  weeklyReport.value = null
  try {
    weeklyReport.value = await getWeeklyReportForUser(algorithmUid.value.trim())
  } catch (e) {
    console.error('Weekly report fetch failed:', e)
  } finally {
    labLoading.value = false
  }
}
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

// Import state
const importStartDate = ref('')
const importRows = ref([])
const importing = ref(false)
const importProgress = ref(0)
const importMessage = ref('')
const importSuccess = ref(false)

const importColumns = [
  {
    name: 'date',
    label: 'Datum',
    field: 'date',
    align: 'left',
    sortable: true
  },
  {
    name: 'hrv',
    label: 'HRV',
    field: 'hrv',
    align: 'left'
  },
  {
    name: 'rhr',
    label: 'RHR',
    field: 'rhr',
    align: 'left'
  }
]

const canImport = computed(() => {
  return importRows.value.length > 0 && 
         importRows.value.some(row => row.hrv !== null && row.rhr !== null)
})

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
  await loadUserHistory(user.id || user.userId)
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

const generateImportRows = () => {
  if (!importStartDate.value) {
    importRows.value = []
    return
  }

  const startDate = new Date(importStartDate.value)
  const rows = []

  for (let i = 0; i < 30; i++) {
    const currentDate = new Date(startDate)
    currentDate.setDate(startDate.getDate() + i)
    
    const dateStr = currentDate.toISOString().split('T')[0]
    
    rows.push({
      date: dateStr,
      hrv: null,
      rhr: null,
      valid: false
    })
  }

  importRows.value = rows
}

const validateImportRow = (row) => {
  row.valid = row.hrv !== null && row.rhr !== null && 
              row.hrv > 0 && row.rhr > 0
}

const resetImport = () => {
  importStartDate.value = ''
  importRows.value = []
  importMessage.value = ''
  importSuccess.value = false
  importProgress.value = 0
}

const saveImport = async () => {
  if (!selectedUser.value) return

  const userId = selectedUser.value.id || selectedUser.value.userId
  const validEntries = importRows.value
    .filter(row => row.hrv !== null && row.rhr !== null && row.hrv > 0 && row.rhr > 0)
    .map(row => ({
      date: row.date,
      hrv: Number(row.hrv),
      rhr: Number(row.rhr)
    }))

  if (validEntries.length === 0) {
    importMessage.value = 'Geen geldige data om te importeren'
    importSuccess.value = false
    return
  }

  importing.value = true
  importProgress.value = 0
  importMessage.value = ''

  try {
    // Simulate progress
    const progressInterval = setInterval(() => {
      if (importProgress.value < 0.9) {
        importProgress.value += 0.1
      }
    }, 100)

    await importHistory(userId, validEntries)

    clearInterval(progressInterval)
    importProgress.value = 1

    importMessage.value = `${validEntries.length} dagen historie succesvol toegevoegd`
    importSuccess.value = true

    // Refresh history tab
    await loadUserHistory(userId)

    // Reset form after 2 seconds
    setTimeout(() => {
      resetImport()
      dialogTab.value = 'history'
    }, 2000)
  } catch (error) {
    console.error('Import failed:', error)
    importMessage.value = `Import mislukt: ${error.message}`
    importSuccess.value = false
  } finally {
    importing.value = false
  }
}

const loadUserHistory = async (userId) => {
  loadingHistory.value = true
  try {
    userHistory.value = await getUserHistory(userId)
  } catch (error) {
    console.error('Failed to load user history:', error)
  } finally {
    loadingHistory.value = false
  }
}

// Watch for dialog tab changes to reset import when switching away
watch(dialogTab, (newTab) => {
  if (newTab !== 'import') {
    resetImport()
  }
})

onMounted(() => {
  loadUsers()
  loadSystemHealth()
})
</script>

<style scoped lang="scss">
@use '../../css/quasar.variables' as q;

.admin-page {
  background: q.$prime-black;
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
  font-family: q.$typography-font-family;
  font-weight: 700;
  color: q.$prime-gold;
  font-size: 1.25rem;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  margin: 0;
}

.admin-card {
  background: q.$prime-surface !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 2px !important;
  box-shadow: none !important;
}

.section-label {
  font-family: q.$typography-font-family;
  font-size: 0.65rem;
  font-weight: 700;
  color: q.$prime-gray;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  margin-bottom: 16px;
}

.health-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.health-metric {
  padding: 12px 0;
}

.health-value {
  font-family: q.$mono-font;
  font-size: 1.5rem;
  font-weight: 700;
  color: #ffffff;
}

.health-label {
  font-size: 0.7rem;
  color: q.$prime-gray;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 4px;
}

.error-logs-label {
  font-size: 0.65rem;
  color: q.$prime-gray;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 8px;
}

.error-log-row {
  display: flex;
  gap: 12px;
  padding: 6px 0;
  font-size: 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.error-time {
  color: q.$prime-gray;
  min-width: 48px;
}

.error-msg {
  color: #ffffff;
}

.lab-input-row {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 20px;
}

.lab-uid-input {
  flex: 1;
  max-width: 280px;
}

.lab-fetch-btn {
  background: q.$prime-gold !important;
  color: #050505 !important;
  font-family: q.$typography-font-family !important;
  font-weight: 700 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.1em !important;
  border-radius: 2px !important;
  box-shadow: none !important;
}

.lab-results {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

@media (max-width: 768px) {
  .lab-results {
    grid-template-columns: 1fr;
  }
}

.lab-json-block,
.lab-comparison {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.3);
}

.lab-block-label {
  font-size: 0.6rem;
  color: q.$prime-gray;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 8px;
}

.lab-json {
  font-family: q.$mono-font;
  font-size: 0.7rem;
  color: #ffffff;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.comparison-table :deep(thead tr th) {
  font-size: 0.6rem !important;
}

.comparison-table :deep(.q-td) {
  font-family: q.$mono-font !important;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.stat-card .q-card__section {
  padding: 20px;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: q.$prime-gold;
}

.stat-label {
  font-size: 0.75rem;
  color: q.$prime-gray;
  margin-top: 8px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.users-card {
  margin-top: 8px;
}

.user-dialog-card {
  background: q.$prime-black !important;
  min-width: 90vw;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
}

.user-header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding-bottom: 16px;
}

.history-entry {
  background: q.$prime-surface;
  padding: 12px;
  border-radius: 2px;
  margin-top: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.admin-table :deep(.q-table__top) {
  background: transparent;
}

.admin-table :deep(.q-table thead tr th) {
  background: rgba(255, 255, 255, 0.04) !important;
  color: q.$prime-gray !important;
  font-family: q.$typography-font-family !important;
  font-size: 0.7rem !important;
  text-transform: uppercase !important;
  letter-spacing: 0.1em !important;
}

.admin-table :deep(.q-table tbody tr) {
  background: transparent;
}

.admin-table :deep(.q-table tbody tr:hover) {
  background: rgba(255, 255, 255, 0.04) !important;
}

.admin-table :deep(.q-td) {
  font-family: q.$mono-font !important;
}

.import-section {
  padding: 16px 0;
}

.import-table-container {
  max-height: 500px;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 2px;
}

.import-table :deep(.q-table thead tr th) {
  background: rgba(255, 255, 255, 0.04) !important;
  color: q.$prime-gray !important;
  font-family: q.$typography-font-family !important;
  position: sticky;
  top: 0;
  z-index: 1;
}

.import-table :deep(.q-table tbody tr) {
  background: transparent;
}

.import-table :deep(.q-table tbody tr:hover) {
  background: rgba(255, 255, 255, 0.04) !important;
}

.import-table :deep(.q-input) {
  max-width: 120px;
}
</style>
