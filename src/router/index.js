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

    // Alleen voor atleten (rol 'user'): profileComplete-check; coaches/admins zijn hier al doorgelaten
    const isAthlete = authStore.role === 'user' || (!authStore.isAdmin && !authStore.isCoach)
    if (isAthlete && (to.path === '/' || to.path === '/dashboard')) {
      if (authStore.profileComplete === false) return { path: '/intake' }
      if (authStore.profileComplete === true && to.path === '/') return { path: '/dashboard' }
    }

    return true
  })

  return Router
})
// History mode enforced - no hash
