<template>
  <q-page class="login-page">
    <div class="login-container">
      <q-card class="login-card">
        <div class="login-header">
          <div class="logo-text">PRIMEFORM // SYSTEM ACCESS</div>
        </div>

        <div class="section-label">AANMELDEN</div>

        <div class="action-area">
          <q-btn
            class="login-button login-button-google"
            :loading="authStore.loading"
            no-caps
            unelevated
            @click="handleGoogleLogin"
          >
            <template #loading>
              <q-spinner size="24px" color="#050505" />
            </template>
            <q-icon name="login" class="login-button-icon" />
            <span class="login-button-label">Inloggen met Google</span>
          </q-btn>
        </div>

        <q-separator dark class="login-sep" />

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
            v-model="password"
            type="password"
            label="Wachtwoord"
            outlined
            dark
            dense
            class="manual-input"
            :disable="authStore.loading"
            @keyup.enter="handleEmailLogin"
          />
          <div v-if="authStore.error" class="auth-error">
            {{ authStore.error }}
          </div>
          <q-btn
            class="login-button login-button-email"
            :loading="authStore.loading"
            no-caps
            unelevated
            :disable="!email || !password"
            @click="handleEmailLogin"
          >
            <template #loading>
              <q-spinner size="20px" color="#050505" />
            </template>
            <q-icon name="mail" class="login-button-icon" />
            <span class="login-button-label">Inloggen</span>
          </q-btn>
        </div>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')

async function handleGoogleLogin() {
  if (authStore.loading) return
  const fn = authStore.signInWithGoogle ?? authStore.loginWithGoogle
  if (typeof fn === 'function') await fn()
  if (authStore.user) {
    router.push(authStore.isAdmin ? '/admin' : authStore.isCoach ? '/coach' : '/dashboard')
  }
}

async function handleEmailLogin() {
  if (authStore.loading || !email.value || !password.value) return
  const fn = authStore.signIn ?? authStore.loginWithEmail
  if (typeof fn === 'function') await fn(email.value, password.value)
  if (authStore.user && !authStore.error) {
    router.push(authStore.isAdmin ? '/admin' : authStore.isCoach ? '/coach' : '/dashboard')
  }
}
</script>

<style lang="scss" scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #050505;
}

.login-container {
  width: 100%;
  max-width: 420px;
  padding: 1.5rem;
}

.login-card {
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

.login-card :deep(.q-card__section) {
  padding: 0;
}

.login-page :deep(.q-page) {
  background: #050505 !important;
}

.login-header {
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

.login-sep {
  border-color: rgba(255, 255, 255, 0.08);
  margin: 0.25rem 0;
}

.action-area {
  display: flex;
  justify-content: center;
}

.login-button {
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

.login-button-google {
  height: 3.5rem;
  font-size: 0.9rem;
}

.login-button:hover:not(.q-btn--disabled):not(.q-btn--loading) {
  background: #fbbf24;
  color: #050505;
  border-color: #fbbf24;
}

.login-button:active:not(.q-btn--disabled) {
  opacity: 0.95;
}

.login-button-icon {
  font-size: 1.25rem;
}

.login-button-label {
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
</style>
