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

    // Wacht op Auth: tot Firebase weet wie de gebruiker is
    if (!authStore.isAuthReady) {
      if (typeof authStore.init === 'function') await authStore.init()
      if (!authStore.isAuthReady) return true
    }

    // Login redirect: niet ingelogd en niet op /login → naar /login
    if (!authStore.user && to.path !== '/login') {
      return { path: '/login', query: to.path !== '/' ? { redirect: to.fullPath } : undefined }
    }

    // Alleen voor ingelogde gebruikers hierna
    if (!authStore.user) return true

    // Admin: landt op / → /admin
    if (authStore.isAdmin && to.path === '/') {
      return { path: '/admin' }
    }

    // Coach: landt op / of /dashboard → /coach
    if (authStore.isCoach && (to.path === '/' || to.path === '/dashboard')) {
      return { path: '/coach' }
    }

    // Atleet (user): landing / of /dashboard
    if (!authStore.isAdmin && !authStore.isCoach) {
      if (to.path === '/' || to.path === '/dashboard') {
        if (authStore.profileComplete === false) return { path: '/intake' }
        if (authStore.profileComplete === true && to.path === '/') return { path: '/dashboard' }
      }
    }

    return true
  })

  return Router
})
// History mode enforced - no hash
