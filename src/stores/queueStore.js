import { create } from 'zustand'

/**
 * Background play queue. Holds a list of songs ({ path, name }) and which one
 * is current; an always-mounted <QueuePlayer> reflects this into a hidden
 * <audio> element so playback survives navigation. Transient (not persisted):
 * the queue is a per-session thing and file paths could go stale.
 */
export const useQueueStore = create((set) => ({
  queue: [], // [{ path, name }]
  index: -1, // index of the current song, or -1 when empty
  isPlaying: false,
  isOpen: false, // playlist panel visibility
  repeat: 'off', // 'off' | 'all' (loop the queue) | 'one' (loop current song)

  // The two repeat modes are mutually exclusive; turning one on clears the other.
  toggleRepeatOne: () => set((s) => ({ repeat: s.repeat === 'one' ? 'off' : 'one' })),
  toggleRepeatAll: () => set((s) => ({ repeat: s.repeat === 'all' ? 'off' : 'all' })),

  // Append one or many songs. If nothing is playing yet, start at the first
  // newly-added track.
  enqueue: (songs) =>
    set((s) => {
      const additions = Array.isArray(songs) ? songs : [songs]
      if (additions.length === 0) return {}
      const queue = [...s.queue, ...additions]
      return s.index === -1 ? { queue, index: s.queue.length, isPlaying: true } : { queue }
    }),

  playAt: (i) => set((s) => (i >= 0 && i < s.queue.length ? { index: i, isPlaying: true } : {})),

  removeAt: (i) =>
    set((s) => {
      const queue = s.queue.filter((_, idx) => idx !== i)
      let { index, isPlaying } = s
      if (queue.length === 0) return { queue: [], index: -1, isPlaying: false }
      if (i < index) index -= 1
      else if (i === index && index >= queue.length) index = queue.length - 1
      return { queue, index, isPlaying }
    }),

  clear: () => set({ queue: [], index: -1, isPlaying: false }),

  // Advance; wrap to the start when repeating the whole queue, else stop at the
  // end. ('one' is handled by the audio element's loop, so it never calls this
  // on natural end — a manual Next still steps to the next track.)
  next: () =>
    set((s) => {
      if (s.index + 1 < s.queue.length) return { index: s.index + 1, isPlaying: true }
      if (s.repeat === 'all' && s.queue.length) return { index: 0, isPlaying: true }
      return { isPlaying: false }
    }),
  prev: () => set((s) => (s.index > 0 ? { index: s.index - 1, isPlaying: true } : {})),

  togglePlay: () => set((s) => (s.index === -1 ? {} : { isPlaying: !s.isPlaying })),
  setPlaying: (isPlaying) => set({ isPlaying }),

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),
}))
