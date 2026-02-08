<template>
  <q-page class="user-dashboard elite-page">
    <div class="pilot-container">
      <!-- Header: Greeting + Cycle Phase -->
      <header class="pilot-header">
        <h1 class="pilot-greeting">{{ data.greeting }}</h1>
        <div class="cycle-phase-badge">
          {{ data.cyclePhase }} – Dag {{ data.cycleDay }} {{ data.cycleEmoji }}
        </div>
      </header>

      <!-- Primary KPI: Readiness / Daily Advice -->
      <q-card class="kpi-card" flat>
        <q-card-section class="kpi-section">
          <div class="kpi-label">READINESS</div>
          <div class="kpi-value">{{ data.readiness }}/10</div>
          <div class="advice-badge" :class="`advice-${data.dailyAdvice?.toLowerCase()}`">
            {{ data.dailyAdvice }}
          </div>
        </q-card-section>
      </q-card>

      <!-- Telemetry: Prime Load + ACWR -->
      <div class="telemetry-row">
        <q-card class="telemetry-card" flat>
          <q-card-section>
            <div class="telemetry-label">PRIME LOAD (7D)</div>
            <div class="telemetry-value elite-data">{{ data.primeLoad7d }}</div>
          </q-card-section>
        </q-card>
        <q-card class="telemetry-card" flat>
          <q-card-section>
            <div class="telemetry-label">ACWR</div>
            <div class="telemetry-value elite-data">{{ data.acwr?.toFixed(2) }}</div>
            <div class="acwr-indicator" :class="`acwr-${data.acwrStatus}`">
              <q-icon v-if="data.acwrStatus === 'sweet'" name="check_circle" size="16px" />
              <q-icon v-else name="warning" size="16px" />
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Primary Action: START CHECK-IN -->
      <router-link to="/" class="action-link">
        <q-btn class="checkin-btn" unelevated no-caps>
          START CHECK-IN
        </q-btn>
      </router-link>

      <!-- History: Last 3 Activities -->
      <q-card class="history-card" flat>
        <q-card-section>
          <div class="history-label">LAATSTE ACTIVITEITEN</div>
          <div v-if="data.lastActivities?.length" class="activity-list">
            <div
              v-for="(act, i) in data.lastActivities"
              :key="i"
              class="activity-row"
            >
              <span class="activity-date elite-data">{{ formatDate(act.date) }}</span>
              <span class="activity-type">{{ act.type }}</span>
              <span class="activity-meta elite-data">{{ act.duration }}min · Load {{ act.load }}</span>
            </div>
          </div>
          <div v-else class="activity-empty">Nog geen activiteiten</div>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getAthleteDashboard } from '../../services/userService.js'

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
  lastActivities: [],
})

const formatDate = (d) => {
  if (!d) return '—'
  const date = new Date(d)
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

onMounted(async () => {
  try {
    const userId = getOrCreateUserId()
    data.value = await getAthleteDashboard(userId)
  } catch (e) {
    console.error('Dashboard load failed:', e)
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

.cycle-phase-badge {
  font-family: q.$mono-font;
  font-size: 0.8rem;
  color: q.$prime-gray;
  text-transform: uppercase;
  letter-spacing: 0.1em;
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
  font-size: 2.5rem;
  font-weight: 700;
  color: q.$prime-gold;
  margin-bottom: 12px;
}

.advice-badge {
  display: inline-block;
  border: 1px solid;
  padding: 4px 12px;
  font-size: 0.7rem;
  font-weight: 800;
  font-family: q.$mono-font;
  text-transform: uppercase;
  letter-spacing: 0.15em;
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

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.activity-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 0.9rem;
}

.activity-row:last-child {
  border-bottom: none;
}

.activity-date {
  color: q.$prime-gray;
  font-size: 0.75rem;
  min-width: 48px;
}

.activity-type {
  font-family: q.$typography-font-family;
  color: #ffffff;
  font-weight: 500;
  flex: 1;
  padding: 0 12px;
}

.activity-meta {
  color: q.$prime-gray;
  font-size: 0.75rem;
}

.activity-empty {
  font-family: q.$typography-font-family;
  color: q.$prime-gray;
  font-size: 0.9rem;
  padding: 16px 0;
}
</style>
