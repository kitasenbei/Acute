import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Remembered media playback preferences (volume + mute), persisted. */
export const usePlayerStore = create(
  persist(
    (set) => ({
      volume: 1,
      muted: false,
      setVolume: (volume) => set({ volume }),
      setMuted: (muted) => set({ muted }),
    }),
    { name: 'app-player' },
  ),
)
