import { create } from 'zustand'

/**
 * Ephemeral state for the file preview modal. Not persisted — opening a file
 * is a transient action, not a saved preference.
 *
 * `showDetails` toggles the side information panel; it persists across files
 * within a session so the panel stays open as you browse.
 */
export const usePreviewStore = create((set) => ({
  entry: null,
  isOpen: false,
  showDetails: false,
  // Sibling files of the same kind, enabling prev/next navigation.
  playlist: [],
  index: 0,
  open: (entry, playlist = []) =>
    set({
      entry,
      isOpen: true,
      playlist,
      index: Math.max(0, playlist.findIndex((p) => p.path === entry.path)),
    }),
  close: () => set({ isOpen: false }),
  toggleDetails: () => set((s) => ({ showDetails: !s.showDetails })),
  next: () =>
    set((s) => (s.index < s.playlist.length - 1 ? { index: s.index + 1, entry: s.playlist[s.index + 1] } : {})),
  prev: () =>
    set((s) => (s.index > 0 ? { index: s.index - 1, entry: s.playlist[s.index - 1] } : {})),
}))
