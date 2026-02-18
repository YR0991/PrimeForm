<template>
  <q-page class="join-team-page">
    <div class="join-container">
      <q-card flat bordered class="join-card">
        <q-card-section class="join-header">
          <h1 class="join-title">Join team</h1>
          <p class="join-subtitle">Vul je teamcode in om bij een team te komen.</p>
        </q-card-section>

        <q-card-section v-if="!verifiedTeam" class="join-form">
          <q-input
            v-model="code"
            outlined
            dark
            dense
            label="Teamcode"
            placeholder="Bijv. TEAM-ABCD"
            class="code-input"
            :disable="loading"
            :error="!!error"
            :error-message="error"
            clearable
            @keyup.enter="handleVerify"
          />
          <q-btn
            class="submit-btn"
            label="Verder"
            unelevated
            no-caps
            :loading="loading"
            :disable="!codeTrimmed"
            @click="handleVerify"
          />
        </q-card-section>

        <q-card-section v-else class="join-success">
          <div class="success-icon">
            <q-icon name="check_circle" size="48px" color="positive" />
          </div>
          <p class="success-team-label">Je bent gekoppeld aan</p>
          <p class="success-team-name">{{ verifiedTeam.name || 'Team' }}</p>
          <!-- Logged in: claim here. Not logged in: go to /auth?code= to log in and claim -->
          <q-btn
            v-if="authStore.user"
            class="auth-cta"
            label="Team koppelen"
            unelevated
            no-caps
            :loading="claimLoading"
            @click="handleClaim"
          />
          <q-btn
            v-else
            class="auth-cta"
            label="Ga door naar inloggen"
            unelevated
            no-caps
            @click="goToAuth"
          />
          <p v-if="claimError" class="claim-error">{{ claimError }}</p>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { verifyTeamInvite } from '../../services/teamService.js'
import { useAuthStore } from '../../stores/auth.js'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const code = ref('')
const loading = ref(false)
const error = ref('')
const verifiedTeam = ref(null)
const claimLoading = ref(false)
const claimError = ref('')

const codeTrimmed = computed(() => (code.value || '').trim())

function mapError(err) {
  const msg = err?.message || err?.response?.data?.error || ''
  if (err?.response?.status === 404 || msg.toLowerCase().includes('niet gevonden') || msg.toLowerCase().includes('ongeldig')) {
    return 'Deze teamcode is ongeldig of niet gevonden.'
  }
  if (msg.toLowerCase().includes('verlopen')) {
    return 'Deze teamcode is verlopen.'
  }
  return msg || 'Er ging iets mis. Controleer de code of probeer het later opnieuw.'
}

async function handleVerify() {
  const raw = codeTrimmed.value
  if (!raw) return
  error.value = ''
  loading.value = true
  try {
    const data = await verifyTeamInvite(raw)
    verifiedTeam.value = { id: data.id, name: data.name || null }
  } catch (e) {
    error.value = mapError(e)
  } finally {
    loading.value = false
  }
}

function goToAuth() {
  const c = codeTrimmed.value
  router.push({ path: '/auth', query: c ? { code: c } : {} })
}

async function handleClaim() {
  const c = codeTrimmed.value
  if (!c) return
  claimError.value = ''
  claimLoading.value = true
  try {
    const result = await authStore.claimTeamInvite(c)
    if (result.ok) {
      await authStore.fetchUserProfile(authStore.user?.uid)
      if (!authStore.onboardingLockedAt) {
        router.replace('/intake')
      } else {
        router.replace('/dashboard')
      }
      return
    }
    if (result.code === 'TEAM_ALREADY_SET') {
      claimError.value = result.message || 'Je bent al gekoppeld aan een ander team. Neem contact op met je coach of support.'
      return
    }
    claimError.value = result.message || 'Teamcode ongeldig.'
  } catch (e) {
    claimError.value = e?.message || 'Koppelen mislukt.'
  } finally {
    claimLoading.value = false
  }
}

onMounted(() => {
  const q = route.query?.code
  if (q && typeof q === 'string') {
    code.value = q.trim()
  }
})
</script>

<style scoped lang="scss">
@use '../../css/quasar.variables' as q;

.join-team-page {
  min-height: 100vh;
  background: q.$prime-black;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.join-container {
  width: 100%;
  max-width: 400px;
}

.join-card {
  background: q.$prime-surface;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: q.$radius-sm;
}

.join-header {
  padding-bottom: 8px;
}

.join-title {
  font-family: q.$typography-font-family;
  font-weight: 700;
  font-size: 1.25rem;
  color: #fff;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0 0 8px 0;
}

.join-subtitle {
  font-size: 0.9rem;
  color: q.$prime-gray;
  margin: 0;
}

.join-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.code-input {
  font-family: q.$mono-font;
}

.submit-btn {
  background: q.$prime-gold;
  color: #050505;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.join-success {
  text-align: center;
  padding-top: 8px;
}

.success-icon {
  margin-bottom: 12px;
}

.success-team-label {
  font-size: 0.85rem;
  color: q.$prime-gray;
  margin: 0 0 4px 0;
}

.success-team-name {
  font-family: q.$typography-font-family;
  font-weight: 700;
  font-size: 1.1rem;
  color: #fff;
  margin: 0 0 20px 0;
}

.auth-cta {
  background: q.$prime-gold;
  color: #050505;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.claim-error {
  font-size: 0.8rem;
  color: #ef4444;
  margin: 12px 0 0 0;
}
</style>
