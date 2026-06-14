import { create } from 'zustand'

/** Cut/Copy clipboard for file operations. `mode` is 'copy' | 'cut'. */
export const useClipboardStore = create((set) => ({
  items: [], // root-relative paths
  mode: null,
  setClipboard: (items, mode) => set({ items, mode }),
  clear: () => set({ items: [], mode: null }),
}))
