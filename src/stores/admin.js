import { defineStore } from 'pinia'
import {
  fetchAllUsers,
  fetchAllTeams,
  fetchAdminStats,
  assignUserToTeam as assignUserToTeamApi,
  deleteUser as deleteUserApi,
  renameTeam as renameTeamApi,
  deleteTeam as deleteTeamApi,
} from '../services/adminService.js'

export const useAdminStore = defineStore('admin', {
  state: () => ({
    users: [],
    teams: [],
    loading: false,
    stats: { totalMembers: 0, newThisWeek: 0, checkinsToday: 0 },
  }),

  getters: {
    totalUsers: (state) => state.users.length,
    totalTeams: (state) => state.teams.length,
    orphanedUsers: (state) =>
      state.users.filter((u) => {
        const role = u.profile?.role ?? u.role ?? 'user'
        return !u.teamId && role !== 'admin' && role !== 'coach'
      }),
    systemCapacity: (state) =>
      state.teams.reduce((sum, team) => {
        const limit = Number(team.memberLimit)
        return sum + (Number.isFinite(limit) && limit > 0 ? limit : 0)
      }, 0),
  },

  actions: {
    async fetchAllData() {
      this.loading = true
      try {
        const [usersRes, teamsRes, statsRes] = await Promise.all([
          fetchAllUsers(),
          fetchAllTeams(),
          fetchAdminStats().catch(() => ({ totalMembers: 0, newThisWeek: 0, checkinsToday: 0 })),
        ])
        this.users = Array.isArray(usersRes) ? usersRes.map((u) => ({ id: u.id ?? u.userId, ...u })) : []
        this.teams = Array.isArray(teamsRes) ? teamsRes.map((t) => ({ id: t.id, ...t })) : []
        const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
        this.stats = {
          totalMembers: n(statsRes?.totalMembers),
          newThisWeek: n(statsRes?.newThisWeek),
          checkinsToday: n(statsRes?.checkinsToday),
        }
      } catch (err) {
        console.error('AdminStore: failed to fetch all data', err)
        throw err
      } finally {
        this.loading = false
      }
    },

    async assignUserToTeam(userId, teamId) {
      if (!userId) throw new Error('userId is required')
      await assignUserToTeamApi(userId, teamId ?? null)
      const user = this.users.find((u) => u.id === userId)
      if (user) user.teamId = teamId ?? null
    },

    async deleteUser(userId) {
      if (!userId) throw new Error('userId is required')
      await deleteUserApi(userId)
      this.users = this.users.filter((u) => u.id !== userId)
    },

    async renameTeam(teamId, newName) {
      if (!teamId) throw new Error('teamId is required')
      const name = (newName || '').trim()
      if (!name) throw new Error('Nieuwe teamnaam is leeg')
      await renameTeamApi(teamId, name)
      this.teams = this.teams.map((t) => (t.id === teamId ? { ...t, name } : t))
    },

    async deleteTeam(teamId) {
      if (!teamId) throw new Error('teamId is required')
      await deleteTeamApi(teamId)
      this.teams = this.teams.filter((t) => t.id !== teamId)
      this.users = this.users.map((u) => (u.teamId === teamId ? { ...u, teamId: null } : u))
    },
  },
})
