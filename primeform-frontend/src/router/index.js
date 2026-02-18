import { defineRouter } from '#q-app/wrappers'
import {
  createRouter,
  createMemoryHistory,
  createWebHistory,
} from 'vue-router'
import routes from './routes'
import { useAuthStore } from '../stores/auth.js'

/*
 * If not building with SSR mode, you can
 * directly export the Router instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Router instance.
 */

export default defineRouter(function (/* { store, ssrContext } */) {
  // HARD FORCE history mode - NO HASH, NO CONDITIONALS
  let history
  if (process.env.SERVER) {
    history = createMemoryHistory()
  } else {
    // ALWAYS use createWebHistory in browser - NO hash mode
    history = createWebHistory('/')
  }

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,
    history,
  })

  Router.beforeEach(async (to) => {
    if (process.env.SERVER) return true

    const authStore = useAuthStore()

    // Auth Sync: wacht tot rol bekend is (init haalt profile + role op)
    if (!authStore.isAuthReady) {
      if (typeof authStore.init === 'function') await authStore.init()
      if (!authStore.isAuthReady) return true
    }

    // Niet ingelogd: alleen /join en /auth (en callback) toegestaan
    if (!authStore.user) {
      const publicPaths = ['/login', '/join', '/auth', '/auth/strava/callback']
      if (!publicPaths.includes(to.path)) {
        const query = { ...(to.query?.code ? { code: to.query.code } : {}) }
        if (to.path !== '/' && to.fullPath !== '/') query.redirect = to.fullPath
        return { path: '/auth', query: Object.keys(query).length ? query : undefined }
      }
      return true
    }

    // Ingelogd maar geen teamId: alleen /join en /auth (geen dashboard/intake)
    if (!authStore.teamId) {
      const allowedWithoutTeam = ['/join', '/auth', '/login']
      if (!allowedWithoutTeam.includes(to.path)) {
        return { path: '/join' }
      }
      return true
    }

    // Role Bypass: Coach en Admin gaan nooit naar /intake; direct door
    if (authStore.isCoach || authStore.isAdmin) {
      if (to.path === '/') return { path: authStore.isAdmin ? '/admin' : '/coach' }
      return true
    }

    // Atleet met teamId: onboardingLockedAt bepaalt toegang tot /intake
    const onboardingLocked =
      authStore.onboardingComplete === true ||
      Boolean(authStore.onboardingLockedAt)

    const isAthlete = authStore.role === 'user' || (!authStore.isAdmin && !authStore.isCoach)
    if (isAthlete) {
      // Locked atleet mag /intake niet zien → dashboard
      if (to.path === '/intake' && onboardingLocked) {
        return { path: '/dashboard' }
      }

      // Niet-locked: /intake en /dashboard beide toegestaan
      if (to.path === '/' || to.path === '/dashboard') {
        if (!onboardingLocked && authStore.profileComplete === false) {
          return { path: '/intake' }
        }
        if (to.path === '/') {
          return { path: '/dashboard' }
        }
      }
    }

    return true
  })

  return Router
})
// History mode enforced - no hash
