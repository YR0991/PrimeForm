<template>
  <q-page class="auth-page">
    <div class="auth-container">
      <q-card class="auth-card">
        <div class="auth-header">
          <div class="logo-text">PRIMEFORM // SYSTEM ACCESS</div>
        </div>

        <!-- Claim error: TEAM_ALREADY_SET (409) -->
        <div v-if="claimError === 'TEAM_ALREADY_SET'" class="claim-error-box">
          <p class="claim-error-text">{{ claimErrorMessage }}</p>
          <p class="claim-error-hint">Je bent al gekoppeld aan een ander team. Voor hulp kun je contact opnemen met je coach of support.</p>
          <router-link to="/join" class="claim-link">Terug naar teamcode invoeren</router-link>
        </div>

        <!-- Claim error: NOT_FOUND (404) -->
        <div v-else-if="claimError === 'NOT_FOUND'" class="claim-error-box">
          <p class="claim-error-text">Teamcode ongeldig.</p>
          <router-link to="/join" class="claim-link">Terug naar /join</router-link>
        </div>

        <template v-else>
          <div class="section-label">AANMELDEN</div>

          <div class="action-area">
            <q-btn
              class="auth-button auth-button-google"
              :loading="authStore.loading"
              no-caps
              unelevated
              @click="handleGoogleLogin"
            >
              <template #loading>
                <q-spinner size="24px" color="#050505" />
              </template>
              <q-icon name="login" class="auth-button-icon" />
              <span class="auth-button-label">Inloggen met Google</span>
            </q-btn>
          </div>

          <q-separator dark class="auth-sep" />

          <div class="section-label">E-MAIL & WACHTWOORD</div>
          <div class="manual-form">
            <q-input
              v-model="email"
              type="email"
              label="E-mail"
              outlined
              dark
              dense
              class="manual-input"
              :disable="authStore.loading"
            />
            <q-input
              v-if="isSignUp"
              v-model="fullName"
              type="text"
              label="Volledige naam"
              outlined
              dark
              dense
              class="manual-input"
              :disable="authStore.loading"
            />
            <q-input
              v-model="password"
              type="password"
              :label="isSignUp ? 'Wachtwoord (min. 6 tekens)' : 'Wachtwoord'"
              outlined
              dark
              dense
              class="manual-input"
              :disable="authStore.loading"
              @keyup.enter="isSignUp ? handleSignUp() : handleEmailLogin()"
            />
            <div v-if="authStore.error" class="auth-error">
              {{ authStore.error }}
            </div>
            <q-btn
              v-if="isSignUp"
              class="auth-button auth-button-email"
              :loading="authStore.loading"
              no-caps
              unelevated
              :disable="!email || !password || !fullName"
              @click="handleSignUp"
            >
              <template #loading>
                <q-spinner size="20px" color="#050505" />
              </template>
              <q-icon name="person_add" class="auth-button-icon" />
              <span class="auth-button-label">Account aanmaken</span>
            </q-btn>
            <q-btn
              v-else
              class="auth-button auth-button-email"
              :loading="authStore.loading"
              no-caps
              unelevated
              :disable="!email || !password"
              @click="handleEmailLogin"
            >
              <template #loading>
                <q-spinner size="20px" color="#050505" />
              </template>
              <q-icon name="mail" class="auth-button-icon" />
              <span class="auth-button-label">Inloggen</span>
            </q-btn>
            <button type="button" class="toggle-mode" @click="isSignUp = !isSignUp">
              {{ isSignUp ? 'Al een account? Inloggen' : 'Geen account? Account aanmaken' }}
            </button>
          </div>
        </template>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/auth.js'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const fullName = ref('')
const isSignUp = ref(false)
const claimError = ref(null)
const claimErrorMessage = ref('')

const teamCode = computed(() => {
  const code = route.query?.code
  return typeof code === 'string' ? code.trim() : ''
})

async function redirectAfterAuth() {
  if (authStore.isAdmin) {
    router.replace('/admin')
    return
  }
  if (authStore.isCoach) {
    router.replace('/coach')
    return
  }
  const code = teamCode.value
  if (!code) {
    router.replace('/dashboard')
    return
  }
  const result = await authStore.claimTeamInvite(code)
  if (result.ok) {
    await authStore.fetchUserProfile(authStore.user?.uid)
    if (!authStore.onboardingLockedAt) {
      router.replace('/intake')
    } else {
      router.replace('/dashboard')
    }
    return
  }
  claimError.value = result.code || 'ERROR'
  claimErrorMessage.value = result.message || 'Er ging iets mis.'
}

async function handleGoogleLogin() {
  if (authStore.loading) return
  claimError.value = null
  const fn = authStore.signInWithGoogle ?? authStore.loginWithGoogle
  if (typeof fn === 'function') await fn()
  if (authStore.user && !authStore.error) {
    await redirectAfterAuth()
  }
}

async function handleEmailLogin() {
  if (authStore.loading || !email.value || !password.value) return
  claimError.value = null
  const fn = authStore.signIn ?? authStore.loginWithEmail
  if (typeof fn === 'function') await fn(email.value, password.value)
  if (authStore.user && !authStore.error) {
    await redirectAfterAuth()
  }
}

async function handleSignUp() {
  if (authStore.loading || !email.value || !password.value || !fullName.value) return
  claimError.value = null
  const fn = authStore.registerWithEmail
  if (typeof fn === 'function') await fn(email.value, password.value, fullName.value)
  if (authStore.user && !authStore.error) {
    await redirectAfterAuth()
  }
}
</script>

<style lang="scss" scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #050505;
}

.auth-container {
  width: 100%;
  max-width: 420px;
  padding: 1.5rem;
}

.auth-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  box-shadow: none;
  padding: 2rem 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  color: #ffffff;
}

.auth-card :deep(.q-card__section) {
  padding: 0;
}

.auth-page :deep(.q-page) {
  background: #050505 !important;
}

.auth-header {
  text-align: center;
  margin-bottom: 0.25rem;
}

.logo-text {
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 0.8rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #fbbf24;
}

.section-label {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 0.65rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #9ca3af;
}

.auth-sep {
  border-color: rgba(255, 255, 255, 0.08);
  margin: 0.25rem 0;
}

.action-area {
  display: flex;
  justify-content: center;
}

.auth-button {
  width: 100%;
  height: 3rem;
  border-radius: 2px;
  border: 1px solid #fbbf24;
  background: transparent;
  color: #fbbf24;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.auth-button-google {
  height: 3.5rem;
  font-size: 0.9rem;
}

.auth-button:hover:not(.q-btn--disabled):not(.q-btn--loading) {
  background: #fbbf24;
  color: #050505;
  border-color: #fbbf24;
}

.auth-button:active:not(.q-btn--disabled) {
  opacity: 0.95;
}

.auth-button-icon {
  font-size: 1.25rem;
}

.auth-button-label {
  white-space: nowrap;
}

.manual-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.manual-input :deep(.q-field) {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
}

.manual-input :deep(.q-field__control) {
  background: rgba(15, 15, 15, 0.9);
  border-radius: 2px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.manual-input :deep(.q-field__control--focused) {
  border-color: #fbbf24;
}

.manual-input :deep(.q-field__label) {
  color: #9ca3af;
}

.manual-input :deep(.q-field__native),
.manual-input :deep(.q-field__input) {
  color: #ffffff;
}

.auth-error {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 0.75rem;
  color: #ef4444;
  text-align: center;
}

.toggle-mode {
  background: none;
  border: none;
  color: #9ca3af;
  font-size: 0.8rem;
  cursor: pointer;
  text-decoration: underline;
  padding: 0.25rem 0;
}

.toggle-mode:hover {
  color: #fbbf24;
}

/* Claim error box */
.claim-error-box {
  padding: 0.5rem 0;
}

.claim-error-text {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 0.9rem;
  color: #ef4444;
  margin: 0 0 0.5rem 0;
}

.claim-error-hint {
  font-size: 0.8rem;
  color: #9ca3af;
  margin: 0 0 0.75rem 0;
}

.claim-link {
  color: #fbbf24;
  font-size: 0.85rem;
  text-decoration: underline;
}

.claim-link:hover {
  color: #fcd34d;
}
</style>
