<template>
  <q-layout view="hHh lpR fFf">
    <q-header class="premium-header">
      <q-toolbar>
        <router-link to="/dashboard" class="premium-title-link">
          <q-toolbar-title class="premium-title">
            PRIMEFORM
          </q-toolbar-title>
        </router-link>
        <q-space />
        <div v-if="!hideNav" class="nav-links">
          <router-link v-if="showDashboard" to="/dashboard" class="nav-link">Dashboard</router-link>
          <router-link v-if="showCoach" to="/coach" class="nav-link">Coach</router-link>
          <router-link v-if="showAdmin" to="/admin" class="nav-link">Admin</router-link>
        </div>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const authStore = useAuthStore()

const hideNav = computed(() => {
  const path = route.path ?? ''
  return path === '/login' || path === '/intake'
})

const showAdmin = computed(() => authStore.isAdmin)

const showCoach = computed(() => authStore.isCoach || authStore.isAdmin)

const showDashboard = computed(() => authStore.role === 'user')
</script>

<style scoped lang="scss">
@use '../css/quasar.variables' as q;

.premium-header {
  background: q.$prime-black;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.premium-title-link {
  text-decoration: none;
}

.premium-title {
  font-family: q.$typography-font-family;
  font-weight: 700;
  color: q.$prime-gold;
  letter-spacing: 0.15em;
  font-size: 1.25rem;
  text-transform: uppercase;
}

.nav-links {
  display: flex;
  gap: 20px;
}

.nav-link {
  font-family: q.$typography-font-family;
  font-size: 0.7rem;
  font-weight: 600;
  color: q.$prime-gray;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-decoration: none;
}

.nav-link:hover,
.nav-link.router-link-active {
  color: q.$prime-gold;
}
</style>
