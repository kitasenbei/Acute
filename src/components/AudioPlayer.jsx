import './audio.css'
import { useEffect, useRef, useState } from 'react'
import { Box, Stack, Group, Text, Slider, ActionIcon } from '@mantine/core'
import {
  IconPlayerPlayFilled,
  IconPlayerPauseFilled,
  IconPlayerTrackPrevFilled,
  IconPlayerTrackNextFilled,
  IconVolume,
  IconVolumeOff,
  IconMusic,
} from '@tabler/icons-react'
import { formatTime } from '../util.js'
import { usePlayerStore } from '../stores/playerStore.js'

/** Track title that scrolls (jukebox-style) only when it overflows. */
function MarqueeTitle({ text }) {
  const wrapRef = useRef(null)
  const innerRef = useRef(null)
  const [shift, setShift] = useState(0)

  useEffect(() => {
    const measure = () => {
      const wrap = wrapRef.current
      const inner = innerRef.current
      if (!wrap || !inner) return
      const overflow = inner.scrollWidth - wrap.clientWidth
      setShift(overflow > 4 ? overflow : 0)
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [text])

  const scrolling = shift > 0
  return (
    <Box ref={wrapRef} style={{ width: '100%', overflow: 'hidden', textAlign: scrolling ? 'left' : 'center' }}>
      <Text
        ref={innerRef}
        fw={600}
        title={text}
        className={`audio-title-track${scrolling ? ' is-scrolling' : ''}`}
        style={{ '--marquee-shift': `-${shift}px`, '--marquee-duration': `${Math.max(4, (shift / 35) * 2)}s` }}
      >
        {text}
      </Text>
    </Box>
  )
}

/**
 * Custom audio player: a gradient "album" tile (with an animated equalizer
 * while playing), the track name, a seek bar, and the shared persisted volume.
 * Themed surfaces, so it looks right in both light and dark.
 */
export function AudioPlayer({ src, name, onPrev, onNext, hasPrev, hasNext }) {
  const audioRef = useRef(null)
  const autoplayRef = useRef(false)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const hasNav = hasPrev || hasNext
  const volume = usePlayerStore((s) => s.volume)
  const muted = usePlayerStore((s) => s.muted)
  const setVolume = usePlayerStore((s) => s.setVolume)
  const setMuted = usePlayerStore((s) => s.setMuted)

  useEffect(() => {
    setPlaying(false)
    setCurrent(0)
    setDuration(0)
  }, [src])

  useEffect(() => {
    const a = audioRef.current
    if (a) {
      a.volume = volume
      a.muted = muted
    }
  }, [volume, muted, src])

  const audio = () => audioRef.current
  const togglePlay = () => {
    const a = audio()
    if (!a) return
    if (a.paused) a.play()
    else a.pause()
  }
  const seek = (v) => {
    const a = audio()
    if (a) {
      a.currentTime = v
      setCurrent(v)
    }
  }
  const toggleMute = () => setMuted(!muted)
  const changeVolume = (v) => {
    setVolume(v)
    setMuted(v === 0)
  }
  const nudgeVolume = (e) => {
    const base = muted ? 0 : volume
    changeVolume(Math.min(1, Math.max(0, +(base + (e.deltaY < 0 ? 0.05 : -0.05)).toFixed(2))))
  }

  // Navigating tracks continues playback on the next one.
  const goPrev = () => {
    if (!hasPrev) return
    autoplayRef.current = true
    onPrev()
  }
  const goNext = () => {
    if (!hasNext) return
    autoplayRef.current = true
    onNext()
  }

  return (
    <Box style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Stack align="center" gap="lg" w={380} maw="100%">
        <Box className="audio-art">
          {playing ? (
            <Box className="audio-eq">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </Box>
          ) : (
            <IconMusic size={72} color="var(--mantine-color-dimmed)" />
          )}
        </Box>

        <MarqueeTitle text={name} />

        <Box w="100%">
          <Slider value={current} min={0} max={duration || 0} step={0.1} onChange={seek} size="sm" label={formatTime} />
          <Group justify="space-between" mt={4}>
            <Text size="xs" c="dimmed">{formatTime(current)}</Text>
            <Text size="xs" c="dimmed">{formatTime(duration)}</Text>
          </Group>
        </Box>

        <Group justify="center" gap="md">
          {hasNav && (
            <ActionIcon variant="subtle" color="gray" radius="xl" size={40} disabled={!hasPrev} onClick={goPrev}>
              <IconPlayerTrackPrevFilled size={18} />
            </ActionIcon>
          )}
          <ActionIcon variant="filled" radius="xl" size={56} onClick={togglePlay}>
            {playing ? <IconPlayerPauseFilled size={26} /> : <IconPlayerPlayFilled size={26} />}
          </ActionIcon>
          {hasNav && (
            <ActionIcon variant="subtle" color="gray" radius="xl" size={40} disabled={!hasNext} onClick={goNext}>
              <IconPlayerTrackNextFilled size={18} />
            </ActionIcon>
          )}
        </Group>

        <Group gap={6} wrap="nowrap" onWheel={nudgeVolume} style={{ paddingBlock: 8 }}>
          <ActionIcon variant="subtle" color="gray" onClick={toggleMute}>
            {muted || volume === 0 ? <IconVolumeOff size={18} /> : <IconVolume size={18} />}
          </ActionIcon>
          <Slider value={muted ? 0 : volume} min={0} max={1} step={0.05} onChange={changeVolume} size="md" thumbSize={14} w={130} label={null} />
        </Group>
      </Stack>

      <audio
        ref={audioRef}
        src={src}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration)
          if (autoplayRef.current) {
            autoplayRef.current = false
            e.currentTarget.play()
          }
        }}
        onEnded={() => (hasNext ? goNext() : setPlaying(false))}
      />
    </Box>
  )
}
