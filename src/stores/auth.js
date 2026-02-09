import { defineStore } from 'pinia'
import { auth, db } from 'boot/firebase'
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'

const googleProvider = new GoogleAuthProvider()

let unsubscribeAuthListener = null

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null, // { uid, email, displayName, photoURL }
    role: null, // 'user' | 'coach' | 'admin' | null
    teamId: null,
    loading: false,
    error: null,
  }),

  getters: {
    isAuthenticated: (state) => !!state.user,
    isAdmin: (state) => state.role === 'admin',
    isCoach: (state) => state.role === 'coach',
  },

  actions: {
    _setUserFromProfile(firebaseUser, profileData) {
      this.user = firebaseUser
        ? {
          uid: firebaseUser.uid,
          email: firebaseUser.email ?? null,
          displayName: firebaseUser.displayName ?? null,
          photoURL: firebaseUser.photoURL ?? null,
        }
        : null

      this.role = profileData?.role ?? null
      this.teamId = profileData?.teamId ?? null
    },

    async loginWithGoogle() {
      this.loading = true
      this.error = null
      try {
        const result = await signInWithPopup(auth, googleProvider)
        const firebaseUser = result.user
        const uid = firebaseUser.uid

        const userRef = doc(db, 'users', uid)
        const snapshot = await getDoc(userRef)

        if (snapshot.exists()) {
          const data = snapshot.data()
          this._setUserFromProfile(firebaseUser, data)
          return
        }

        const newProfile = {
          email: firebaseUser.email ?? null,
          displayName: firebaseUser.displayName ?? null,
          role: 'user',
          onboardingComplete: false,
          createdAt: serverTimestamp(),
        }

        await setDoc(userRef, newProfile)
        this._setUserFromProfile(firebaseUser, newProfile)
      } catch (err) {
        // Log and surface error for UI
        console.error('Google login failed', err)
        this.error = err?.message || 'Google login failed'
      } finally {
        this.loading = false
      }
    },

    async loginWithEmail(email, password) {
      this.loading = true
      this.error = null
      try {
        const credential = await signInWithEmailAndPassword(auth, email, password)
        const firebaseUser = credential.user
        const uid = firebaseUser.uid

        const userRef = doc(db, 'users', uid)
        const snapshot = await getDoc(userRef)

        if (snapshot.exists()) {
          const data = snapshot.data()
          this._setUserFromProfile(firebaseUser, data)
          return
        }

        const profile = {
          email: firebaseUser.email ?? email,
          displayName: firebaseUser.displayName ?? null,
          role: 'user',
          onboardingComplete: false,
          createdAt: serverTimestamp(),
        }

        await setDoc(userRef, profile)
        this._setUserFromProfile(firebaseUser, profile)
      } catch (err) {
        console.error('Email login failed', err)
        this.error = err?.message || 'Email login failed'
      } finally {
        this.loading = false
      }
    },

    async registerWithEmail(email, password, fullName) {
      this.loading = true
      this.error = null
      try {
        const credential = await createUserWithEmailAndPassword(auth, email, password)
        const firebaseUser = credential.user

        if (fullName) {
          try {
            await updateProfile(firebaseUser, { displayName: fullName })
          } catch (err) {
            console.warn('Failed to update displayName for new user', err)
          }
        }

        const uid = firebaseUser.uid
        const userRef = doc(db, 'users', uid)
        const profile = {
          email: firebaseUser.email ?? email,
          displayName: firebaseUser.displayName ?? fullName ?? null,
          role: 'user',
          onboardingComplete: false,
          createdAt: serverTimestamp(),
        }

        await setDoc(userRef, profile)
        this._setUserFromProfile(firebaseUser, profile)
      } catch (err) {
        console.error('Email registration failed', err)
        this.error = err?.message || 'Registration failed'
      } finally {
        this.loading = false
      }
    },

    async logoutUser() {
      this.loading = true
      try {
        await signOut(auth)
        this.user = null
        this.role = null
        this.teamId = null
      } finally {
        this.loading = false
      }
    },

    async fetchUserProfile(uid) {
      if (!uid) return null

      const userRef = doc(db, 'users', uid)
      const snapshot = await getDoc(userRef)
      if (!snapshot.exists()) {
        return null
      }

      const data = snapshot.data()
      this.role = data.role ?? this.role
      this.teamId = data.teamId ?? this.teamId ?? null
      return data
    },

    init() {
      if (unsubscribeAuthListener) {
        return
      }

      unsubscribeAuthListener = onAuthStateChanged(auth, async (firebaseUser) => {
        if (!firebaseUser) {
          this.user = null
          this.role = null
          this.teamId = null
          return
        }

        // Restore profile on reload
        const profile = await this.fetchUserProfile(firebaseUser.uid)

        if (!profile) {
          // If Firestore doc does not exist (user signed in outside loginWithGoogle)
          const bootstrapProfile = {
            email: firebaseUser.email ?? null,
            displayName: firebaseUser.displayName ?? null,
            role: 'user',
            onboardingComplete: false,
            createdAt: serverTimestamp(),
          }
          const userRef = doc(db, 'users', firebaseUser.uid)
          await setDoc(userRef, bootstrapProfile)
          this._setUserFromProfile(firebaseUser, bootstrapProfile)
          return
        }

        this._setUserFromProfile(firebaseUser, profile)
      })
    },
  },
})

