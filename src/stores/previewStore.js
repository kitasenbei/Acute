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
  open: (entry) => set({ entry, isOpen: true }),
  close: () => set({ isOpen: false }),
  toggleDetails: () => set((s) => ({ showDetails: !s.showDetails })),
}))
