import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Global settings + the settings-modal UI state.
 *
 * `appearance` is the single source of truth for the theme; a small effect in
 * the app syncs it into Mantine's color scheme. Only `appearance` is persisted
 * (the modal's open state and active section are ephemeral).
 */
export const useSettingsStore = create(
  persist(
    (set) => ({
      // 'auto' follows the OS; 'light' / 'dark' force a scheme.
      appearance: 'auto',
      setAppearance: (appearance) => set({ appearance }),

      // Settings modal UI state
      isOpen: false,
      section: 'general',
      openSettings: (section = 'general') => set({ isOpen: true, section }),
      closeSettings: () => set({ isOpen: false }),
      setSection: (section) => set({ section }),
    }),
    {
      name: 'app-settings',
      partialize: (state) => ({ appearance: state.appearance }),
    },
  ),
)
