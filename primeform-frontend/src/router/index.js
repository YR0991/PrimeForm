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

    // Niet ingelogd? → /login
    if (!authStore.user) {
      if (to.path !== '/login') {
        return { path: '/login', query: to.path !== '/' ? { redirect: to.fullPath } : undefined }
      }
      return true
    }

    // Role Bypass: Coach en Admin gaan nooit naar /intake; direct door
    if (authStore.isCoach || authStore.isAdmin) {
      if (to.path === '/') return { path: authStore.isAdmin ? '/admin' : '/coach' }
      return true
    }

    // Onboarding lock: intake is one-way zodra onboardingComplete of onboardingLockedAt is gezet
    const onboardingLocked =
      authStore.onboardingComplete === true ||
      Boolean(authStore.onboardingLockedAt)

    // Alleen voor atleten (rol 'user'): intake / dashboard routing; coaches/admins zijn hier al doorgelaten
    const isAthlete = authStore.role === 'user' || (!authStore.isAdmin && !authStore.isCoach)
    if (isAthlete) {
      // A) Locked atleet mag nooit terug naar /intake
      if (to.path === '/intake' && onboardingLocked) {
        return { path: '/dashboard' }
      }

      // B) Intake onboarding voor niet-locked atleet
      if (to.path === '/' || to.path === '/dashboard') {
        // Alleen als onboarding NIET gelocked is en profiel nog niet compleet is → naar intake
        if (!onboardingLocked && authStore.profileComplete === false) {
          return { path: '/intake' }
        }

        // Als je naar root ('/') gaat en je hoeft niet naar intake → altijd naar dashboard
        if (to.path === '/') {
          return { path: '/dashboard' }
        }

        // Als je al op '/dashboard' bent en onboardingLocked true is, blijf je gewoon op dashboard
      }
    }

    return true
  })

  return Router
})
// History mode enforced - no hash
