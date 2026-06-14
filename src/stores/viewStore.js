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

      // Transient listing filter (not persisted): a free-text name/extension
      // query plus a set of selected file kinds. Empty = show everything.
      filterText: '',
      filterKinds: [],
      setFilterText: (filterText) => set({ filterText }),
      toggleFilterKind: (kind) =>
        set((s) => ({
          filterKinds: s.filterKinds.includes(kind)
            ? s.filterKinds.filter((k) => k !== kind)
            : [...s.filterKinds, kind],
        })),
      clearFilter: () => set({ filterText: '', filterKinds: [] }),

      // Thumbnail/icon zoom factor (Ctrl+wheel). Clamped to a sane range.
      zoom: 1,
      zoomBy: (delta) =>
        set((s) => ({ zoom: Math.min(2, Math.max(0.6, +(s.zoom + delta).toFixed(2))) })),

      // Sorting: field + direction. Picking the active field flips direction.
      sortBy: 'name', // 'name' | 'modified' | 'size'
      sortDir: 'asc', // 'asc' | 'desc'
      setSort: (field) =>
        set((s) =>
          s.sortBy === field
            ? { sortDir: s.sortDir === 'asc' ? 'desc' : 'asc' }
            : { sortBy: field, sortDir: field === 'name' ? 'asc' : 'desc' },
        ),
    }),
    {
      name: 'app-view',
      // Persist only durable preferences — the filter is per-session.
      partialize: (s) => ({
        mode: s.mode,
        showHidden: s.showHidden,
        zoom: s.zoom,
        sortBy: s.sortBy,
        sortDir: s.sortDir,
      }),
    },
  ),
)
