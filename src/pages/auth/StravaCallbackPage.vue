<template>
  <q-page class="strava-callback-page">
    <div class="callback-container">
      <q-spinner color="primary" size="48px" />
      <p class="callback-text">Verbinding met Strava verifiëren...</p>
    </div>
  </q-page>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Notify } from 'quasar'
import { useAuthStore } from '../../stores/auth.js'

const router = useRouter()
const authStore = useAuthStore()

onMounted(async () => {
  try {
    await authStore.init()
    await authStore.fetchUserProfile()
    Notify.create({
      type: 'positive',
      message: 'Strava is gekoppeld.',
    })
    router.replace('/dashboard')
  } catch (e) {
    console.error('Strava callback error:', e)
    Notify.create({
      type: 'warning',
      message: e?.message || 'Verbinding kon niet worden voltooid.',
    })
    router.replace('/dashboard')
  }
})
</script>

<style scoped lang="scss">
@use '../../css/quasar.variables' as q;

.strava-callback-page {
  background: q.$prime-black;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.callback-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.callback-text {
  font-family: q.$typography-font-family;
  font-size: 0.875rem;
  color: q.$prime-gray;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0;
}
</style>
