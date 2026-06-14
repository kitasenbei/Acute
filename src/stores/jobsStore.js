import { create } from 'zustand'
import { api } from '../api.js'

let timer = null

/**
 * Tracks background jobs (conversions) we've started, polling /jobs for their
 * progress while any are running. The status bar renders from here.
 */
export const useJobsStore = create((set, get) => ({
  jobs: [],

  add: (job) => set((s) => ({ jobs: [job, ...s.jobs.filter((j) => j.id !== job.id)] })),
  dismiss: (id) => set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) })),

  poll: async () => {
    try {
      const server = await api.jobs()
      const byId = new Map(server.map((j) => [j.id, j]))
      set((s) => ({ jobs: s.jobs.map((j) => byId.get(j.id) ?? j) }))
    } catch {
      // backend not reachable; try again next tick
    }
  },

  ensurePolling: () => {
    if (timer) return
    timer = setInterval(async () => {
      await get().poll()
      if (!get().jobs.some((j) => j.status === 'running')) {
        clearInterval(timer)
        timer = null
      }
    }, 600)
  },
}))
