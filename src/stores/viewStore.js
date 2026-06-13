import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Available ways to render a directory's entries. */
export const VIEW_MODES = ['list', 'compact', 'grid']

/**
 * Explorer view preferences. Persisted so the chosen layout sticks across
 * sessions. Kept separate from the settings store since it's a per-explorer
 * concern, not a global app setting.
 */
export const useViewStore = create(
  persist(
    (set) => ({
      mode: 'list', // 'list' | 'compact' | 'grid'
      setMode: (mode) => set({ mode }),

      // Whether dot files (names starting with '.') are shown.
      showHidden: false,
      toggleHidden: () => set((s) => ({ showHidden: !s.showHidden })),
    }),
    { name: 'app-view' },
  ),
)
