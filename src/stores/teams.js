import { defineStore } from 'pinia'
import { db } from 'boot/firebase'
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'

const TEAMS_COLLECTION = 'teams'

function generateInviteCode() {
  const segment = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
  return `TEAM-${segment}`
}

export const useTeamsStore = defineStore('teams', {
  state: () => ({
    teams: [],
    loading: false,
  }),

  actions: {
    async fetchTeams() {
      this.loading = true
      try {
        const colRef = collection(db, TEAMS_COLLECTION)
        const snapshot = await getDocs(colRef)
        this.teams = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
      } catch (err) {
        console.error('Failed to fetch teams', err)
        throw err
      } finally {
        this.loading = false
      }
    },

    async createTeam(payload) {
      const { name, coachEmail, memberLimit } = payload || {}
      if (!name) {
        throw new Error('Team name is required')
      }

      this.loading = true
      try {
        const colRef = collection(db, TEAMS_COLLECTION)
        const docData = {
          name,
          coachEmail: coachEmail ?? null,
          memberLimit: typeof memberLimit === 'number' ? memberLimit : null,
          inviteCode: generateInviteCode(),
          createdAt: serverTimestamp(),
        }

        const docRef = await addDoc(colRef, docData)

        // Option 1: refetch all teams (keeps store in sync with server-side logic)
        // await this.fetchTeams()

        // Option 2: push optimistically to local state
        this.teams.push({
          id: docRef.id,
          ...docData,
        })

        return docRef.id
      } catch (err) {
        console.error('Failed to create team', err)
        throw err
      } finally {
        this.loading = false
      }
    },
  },
})

