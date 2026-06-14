import { useEffect, useRef } from 'react'
import { api } from '../api.js'
import { useQueueStore } from '../stores/queueStore.js'
import { usePlayerStore } from '../stores/playerStore.js'

/**
 * The actual audio engine for the background play queue: a single hidden
 * <audio> element, mounted once at the app root, driven entirely by the queue
 * store. It has no UI — controls live in the sidebar's Now Playing card and the
 * playlist panel.
 */
export function QueuePlayer() {
  const audioRef = useRef(null)
  const queue = useQueueStore((s) => s.queue)
  const index = useQueueStore((s) => s.index)
  const isPlaying = useQueueStore((s) => s.isPlaying)
  const repeat = useQueueStore((s) => s.repeat)
  const next = useQueueStore((s) => s.next)
  const setPlaying = useQueueStore((s) => s.setPlaying)
  const volume = usePlayerStore((s) => s.volume)
  const muted = usePlayerStore((s) => s.muted)

  const current = index >= 0 && index < queue.length ? queue[index] : null
  const src = current ? api.contentUrl(current.path) : null

  // Mirror the shared volume/mute preferences.
  useEffect(() => {
    const a = audioRef.current
    if (a) {
      a.volume = volume
      a.muted = muted
    }
  }, [volume, muted, src])

  // Drive play/pause from the store (the element is headless).
  useEffect(() => {
    const a = audioRef.current
    if (!a || !src) return
    if (isPlaying) a.play().catch(() => {})
    else a.pause()
  }, [isPlaying, src])

  // "Repeat one" = loop the current track natively (so onEnded never fires).
  useEffect(() => {
    const a = audioRef.current
    if (a) a.loop = repeat === 'one'
  }, [repeat, src])

  if (!src) return null
  return (
    <audio
      ref={audioRef}
      src={src}
      autoPlay={isPlaying}
      onEnded={next}
      onPlay={() => setPlaying(true)}
      style={{ display: 'none' }}
    />
  )
}
