<template>
  <q-page class="login-page">
    <div class="login-container">
      <q-card class="login-card">
        <div class="login-header">
          <div class="logo-text">PRIMEFORM // SYSTEM ACCESS</div>
        </div>

        <div class="status-line">
          <span class="status-label">AWAITING IDENTITY VERIFICATION</span>
          <span class="status-cursor"></span>
        </div>

        <div class="action-area">
          <q-btn
            class="login-button"
            :loading="isLoading"
            no-caps
            unelevated
            @click="handleLogin"
          >
            <template #loading>
              <q-spinner size="20px" color="primary" />
            </template>
            <q-icon name="vpn_key" class="login-button-icon" />
            <span class="login-button-label">
              INITIATE SESSION [GOOGLE]
            </span>
          </q-btn>
        </div>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const isLoading = computed(() => authStore.loading)

const handleLogin = async () => {
  if (authStore.loading) return
  try {
    await authStore.loginWithGoogle()
    router.push('/dashboard')
  } catch (err) {
    // Telemetry / toast can be added later
    console.error('Login failed', err)
  }
}

onMounted(() => {
  authStore.init()
})
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
  max-width: 480px;
  padding: 1.5rem;
}

.login-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  box-shadow: none;
  padding: 2.5rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.login-header {
  text-align: center;
}

.logo-text {
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 0.85rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #fbbf24;
}

.status-line {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco,
    Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.75rem;
  color: #22c55e;
  text-transform: uppercase;
}

.status-cursor {
  width: 8px;
  height: 1rem;
  background: #22c55e;
  animation: blink-cursor 1s steps(2, start) infinite;
}

@keyframes blink-cursor {
  0%,
  50% {
    opacity: 1;
  }
  50.01%,
  100% {
    opacity: 0;
  }
}

.action-area {
  display: flex;
  justify-content: center;
}

.login-button {
  width: 100%;
  max-width: 320px;
  height: 3.25rem;
  border-radius: 2px;
  border: 1px solid #fbbf24;
  background: transparent;
  color: #fbbf24;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco,
    Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.78rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  transition: background-color 0.15s ease, color 0.15s ease,
    border-color 0.15s ease, transform 0.05s ease;
}

.login-button:hover:not(.q-btn--disabled) {
  background: #fbbf24;
  color: #050505;
  border-color: #fbbf24;
  transform: translateY(-1px);
}

.login-button:active:not(.q-btn--disabled) {
  transform: translateY(0);
}

.login-button-icon {
  font-size: 1.1rem;
}

.login-button-label {
  white-space: nowrap;
}
</style>

