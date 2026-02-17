import { defineStore } from 'pinia'
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signOut,
} from 'firebase/auth'
import { auth } from '../boot/firebase.js'
import { api } from '../services/httpClient.js'

let initPromise = null

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    role: null,
    profileComplete: false,
    loading: false,
    error: null,
    isAuthReady: false,
    /** Set when admin uses "Bekijk als atleet" — dashboard can load this user's data */
    impersonatingUser: null,
    /** Strava: from GET /api/profile data.strava */
    stravaConnected: false,
    stravaLastSyncAt: null,
  }),

  getters: {
    isAdmin: (state) => state.role === 'admin',
    isCoach: (state) => state.role === 'coach',
  },

  actions: {
    init() {
      if (initPromise) return initPromise

      initPromise = new Promise((resolve) => {
        let resolved = false

        onAuthStateChanged(auth, async (firebaseUser) => {
          if (firebaseUser) {
            this.user = {
              uid: firebaseUser.uid,
              email: firebaseUser.email ?? null,
              displayName: firebaseUser.displayName ?? null,
              photoURL: firebaseUser.photoURL ?? null,
            }
            await this.fetchUserProfile()
          } else {
            this.user = null
            this.role = null
            this.profileComplete = false
          }
          this.isAuthReady = true
          if (!resolved) {
            resolved = true
            resolve()
          }
        })
      })

      return initPromise
    },

    async fetchUserProfile() {
      if (!this.user?.uid) return
      try {
        const res = await api.get('/api/profile')
        const data = res.data?.data
        if (data) {
          this.role = data.role ?? data.profile?.role ?? this.role
          this.profileComplete = data.profileComplete === true
          this.stravaConnected = data.strava?.connected === true
          this.stravaLastSyncAt = data.strava?.lastSuccessAt ?? null
        }
      } catch {
        // Keep existing state on profile fetch failure
      }
    },

    async signInWithGoogle() {
      this.loading = true
      this.error = null
      try {
        const provider = new GoogleAuthProvider()
        await signInWithPopup(auth, provider)
        // onAuthStateChanged will run and set user + fetchUserProfile
      } catch (err) {
        this.error = err?.message ?? 'Google login mislukt'
        throw err
      } finally {
        this.loading = false
      }
    },

    loginWithGoogle() {
      return this.signInWithGoogle()
    },

    async signIn(email, password) {
      this.loading = true
      this.error = null
      try {
        await signInWithEmailAndPassword(auth, email, password)
      } catch (err) {
        this.error = err?.message ?? 'Inloggen mislukt'
        throw err
      } finally {
        this.loading = false
      }
    },

    loginWithEmail(email, password) {
      return this.signIn(email, password)
    },

    async logout() {
      this.loading = true
      try {
        await signOut(auth)
        this.user = null
        this.role = null
        this.profileComplete = false
        this.error = null
        this.impersonatingUser = null
        this.stravaConnected = false
        this.stravaLastSyncAt = null
      } finally {
        this.loading = false
      }
    },

    /** Admin: switch view to another user's dashboard (Shadow Mode) */
    startImpersonation(user) {
      this.impersonatingUser = user ?? null
    },

    clearImpersonation() {
      this.impersonatingUser = null
    },
  },
})
