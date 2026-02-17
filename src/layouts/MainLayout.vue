<template>
  <q-layout view="hHh lpR fFf">
    <div v-if="isImpersonating" class="shadow-banner">
      <div class="shadow-text">
        <span class="shadow-badge">SHADOW</span>
        <span class="shadow-sep">·</span>
        <span class="shadow-name">{{ shadowUidDisplay }}</span>
      </div>
      <q-btn
        dense
        flat
        no-caps
        color="black"
        class="shadow-stop-btn"
        label="Exit"
        @click="handleStopImpersonation"
      />
    </div>

    <q-header class="premium-header">
      <q-toolbar>
        <router-link :to="isAdmin ? '/admin' : '/dashboard'" class="premium-title-link">
          <q-toolbar-title class="premium-title">
            PRIMEFORM
          </q-toolbar-title>
        </router-link>
        <q-space />

        <q-btn
          v-if="isImpersonating"
          dense
          flat
          no-caps
          class="header-stop-shadow-btn"
          label="Exit"
          @click="handleStopImpersonation"
        />

        <div v-if="showNavContainer" class="nav-links">
          <router-link v-if="showDashboard" to="/dashboard" class="nav-link">Dashboard</router-link>
          <router-link v-if="showDashboard" to="/insights" class="nav-link">Insights</router-link>
          <router-link v-if="showDashboard" to="/profile" class="nav-link">Profile</router-link>
          <router-link v-if="showCoach" to="/coach" class="nav-link">Coach</router-link>
          <router-link v-if="showAdmin" to="/admin" class="nav-link">Admin</router-link>
        </div>

        <q-btn
          v-if="isAuthenticated"
          flat
          dense
          round
          :icon="profileIcon"
          :to="isAdmin ? '/admin' : '/profile'"
          class="header-profile-btn"
          :aria-label="profileAriaLabel"
        >
          <q-tooltip v-if="profileTooltip">
            {{ profileTooltip }}
          </q-tooltip>
        </q-btn>

        <q-btn-dropdown
          v-if="isAuthenticated"
          flat
          dense
          no-caps
          class="identity-dropdown"
        >
          <template #label>
            <div class="identity-label">
              <span class="identity-role">{{ userRole }}</span>
              <span v-if="userEmail" class="identity-email">
                {{ userEmail }}
              </span>
            </div>
          </template>

          <q-list dark class="identity-menu">
            <template v-if="isAdmin">
              <q-item clickable v-close-popup to="/admin">
                <q-item-section avatar>
                  <q-icon name="admin_panel_settings" color="amber" />
                </q-item-section>
                <q-item-section>
                  <q-item-label class="identity-item-label">TEAM ADMIN</q-item-label>
                </q-item-section>
              </q-item>
              <q-item clickable v-close-popup to="/coach">
                <q-item-section>
                  <q-item-label class="identity-item-label">COACH DASHBOARD</q-item-label>
                </q-item-section>
              </q-item>
            </template>
            <template v-else-if="isCoach">
              <q-item clickable v-close-popup to="/coach">
                <q-item-section>
                  <q-item-label class="identity-item-label">SQUADRON DASHBOARD</q-item-label>
                </q-item-section>
              </q-item>
              <q-item clickable v-close-popup to="/insights">
                <q-item-section>
                  <q-item-label class="identity-item-label">INSIGHTS</q-item-label>
                </q-item-section>
              </q-item>
              <q-item clickable v-close-popup to="/profile">
                <q-item-section>
                  <q-item-label class="identity-item-label">ATLEET PROFIEL</q-item-label>
                </q-item-section>
              </q-item>
            </template>
            <template v-else>
              <q-item clickable v-close-popup to="/dashboard">
                <q-item-section>
                  <q-item-label class="identity-item-label">DASHBOARD</q-item-label>
                </q-item-section>
              </q-item>
              <q-item clickable v-close-popup to="/insights">
                <q-item-section>
                  <q-item-label class="identity-item-label">INSIGHTS</q-item-label>
                </q-item-section>
              </q-item>
              <q-item clickable v-close-popup to="/profile">
                <q-item-section>
                  <q-item-label class="identity-item-label">ATLEET PROFIEL</q-item-label>
                </q-item-section>
              </q-item>
            </template>

            <q-separator dark />

            <q-item clickable v-close-popup @click="handleLogout">
              <q-item-section avatar>
                <q-icon name="logout" color="negative" />
              </q-item-section>
              <q-item-section>
                <q-item-label class="identity-item-danger">
                  TERMINATE SESSION
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-btn-dropdown>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>

    <CoachDeepDive v-if="isAdmin" />
  </q-layout>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { useAdminStore } from '../stores/admin.js'
import CoachDeepDive from '../pages/coach/CoachDeepDive.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const adminStore = useAdminStore()

onMounted(() => {
  if (!authStore.isAuthReady && typeof authStore.init === 'function') {
    authStore.init()
  }
})

const hideNav = computed(() => {
  const path = route.path ?? ''
  return path === '/login' || path === '/intake'
})

const showNavContainer = computed(() => !hideNav.value && authStore.isAuthReady)

const isAuthenticated = computed(() => authStore.isAuthenticated)
const isAdmin = computed(() => authStore.isAdmin)
const isCoach = computed(() => authStore.isCoach)
const isImpersonating = computed(() => authStore.isImpersonating)
const shadowUidDisplay = computed(
  () => authStore.impersonatingUser?.id || authStore.shadowUid || '—'
)
const userEmail = computed(() => {
  const email = authStore.user?.email || ''
  if (!email) return ''
  return email.length > 24 ? `${email.slice(0, 21)}…` : email
})
const userRole = computed(() => (authStore.role || 'user').toUpperCase())

const showAdmin = computed(() => authStore.isAdmin)
const showCoach = computed(() => authStore.isCoach || authStore.isAdmin)
const showDashboard = computed(() => authStore.role === 'user')

const profileIcon = computed(() =>
  isAdmin.value ? 'admin_panel_settings' : isCoach.value ? 'engineering' : 'person'
)
const profileTooltip = computed(() =>
  isAdmin.value ? 'Team Admin' : isCoach.value ? 'Squadron' : 'Mijn Profiel'
)
const profileAriaLabel = computed(() =>
  isAdmin.value ? 'Team Admin' : isCoach.value ? 'Squadron Dashboard' : 'User Profile'
)

const handleLogout = async () => {
  await authStore.logoutUser()
  router.push('/login')
}

const handleStopImpersonation = async () => {
  authStore.stopImpersonation?.()
  await router.push('/admin')
  adminStore.fetchAllData?.()
}
</script>

<style scoped lang="scss">
@use '../css/quasar.variables' as q;

.premium-header {
  background: q.$prime-black;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.shadow-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 16px;
  position: relative;
  z-index: 9999;
  background: #fbbf24;
  color: #111827;
  font-family: q.$mono-font;
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.shadow-text {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: baseline;
}

.shadow-badge {
  font-weight: 800;
  letter-spacing: 0.14em;
}

.shadow-sep {
  opacity: 0.8;
  margin: 0 2px;
}

.shadow-name {
  font-weight: 700;
}

.shadow-stop-btn {
  font-family: q.$mono-font;
  font-size: 0.72rem;
  letter-spacing: 0.12em;
}

.header-stop-shadow-btn {
  font-family: q.$mono-font;
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  color: #fbbf24;
  margin-right: 4px;
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

.header-profile-btn {
  color: q.$prime-gray;
}

.header-profile-btn:hover {
  color: q.$prime-gold;
}

.identity-dropdown :deep(.q-btn__content) {
  font-family: q.$typography-font-family;
}

.identity-label {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.identity-role {
  font-family: q.$typography-font-family;
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: q.$prime-gold;
}

.identity-email {
  margin-top: 2px;
  font-family: q.$mono-font;
  font-size: 0.7rem;
  color: q.$prime-gray;
}

.identity-menu {
  background: #111 !important;
  min-width: 220px;
}

.identity-item-label {
  font-family: q.$mono-font;
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.identity-item-danger {
  font-family: q.$mono-font;
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #ef4444;
}
</style>
