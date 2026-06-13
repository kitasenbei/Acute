import { create } from 'zustand'

/**
 * A single shared context menu. The opener supplies the cursor position and a
 * list of items, so the menu component stays generic — callers decide which
 * actions apply (a file vs. a folder, etc.).
 *
 * An item is `{ label, icon?, color?, onClick }` or `{ divider: true }`.
 */
export const useContextMenuStore = create((set) => ({
  opened: false,
  x: 0,
  y: 0,
  items: [],
  open: (x, y, items) => set({ opened: true, x, y, items }),
  close: () => set({ opened: false }),
}))
