import { useEffect, useRef, useState, useCallback } from 'react'
import { Box, Group, Slider, ActionIcon, Text } from '@mantine/core'
import {
  IconPlayerPlayFilled,
  IconPlayerPauseFilled,
  IconVolume,
  IconVolumeOff,
  IconMaximize,
  IconChevronUp,
} from '@tabler/icons-react'
import { formatTime } from '../util.js'
import { api } from '../api.js'
import { usePlayerStore } from '../stores/playerStore.js'
import { useSettingsStore } from '../stores/settingsStore.js'

/**
 * Custom video player: the video fills a black stage (small clips scale up,
 * aspect ratio preserved) and the native controls are replaced with a clean
 * control bar that fades in on hover / while paused.
 */
export function VideoPlayer({ src, path }) {
  const videoRef = useRef(null)
  const stageRef = useRef(null)
  const seekRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [hovering, setHovering] = useState(false)
  const [storyboard, setStoryboard] = useState(null)
  const [seekHover, setSeekHover] = useState(null) // { x, w, time } while hovering the bar
  // Volume/mute are remembered across videos and sessions.
  const volume = usePlayerStore((s) => s.volume)
  const muted = usePlayerStore((s) => s.muted)
  const setVolume = usePlayerStore((s) => s.setVolume)
  const setMuted = usePlayerStore((s) => s.setMuted)
  const autoplay = useSettingsStore((s) => s.autoplayVideo)

  // Reset transport state when the source changes.
  useEffect(() => {
    setPlaying(false)
    setCurrent(0)
    setDuration(0)
    setSeekHover(null)
  }, [src])

  // Fetch the hover-preview sprite sheet for this video (best-effort).
  useEffect(() => {
    if (!path) return
    let cancelled = false
    let objectUrl
    setStoryboard(null)
    api
      .storyboard(path)
      .then((sb) => {
        objectUrl = sb.url
        const img = new Image()
        img.onload = () => {
          if (cancelled) return URL.revokeObjectURL(sb.url)
          setStoryboard({ ...sb, tileW: img.naturalWidth / sb.cols, tileH: img.naturalHeight / sb.rows })
        }
        img.onerror = () => !cancelled && URL.revokeObjectURL(sb.url)
        img.src = sb.url
      })
      .catch(() => {})
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [path])

  // Apply the remembered volume/mute to the element.
  useEffect(() => {
    const v = videoRef.current
    if (v) {
      v.volume = volume
      v.muted = muted
    }
  }, [volume, muted, src])

  const video = () => videoRef.current

  const togglePlay = () => {
    const v = video()
    if (!v) return
    if (v.paused) v.play()
    else v.pause()
  }

  // --- Custom scrubber with "pull up for precise seeking" ------------------
  const scrubRef = useRef(null)

  const onScrubMove = useCallback((e) => {
    const s = scrubRef.current
    if (!s) return
    // Pulling the cursor up from the bar scales horizontal movement down.
    const distAbove = Math.max(0, s.rect.top - e.clientY)
    const precision = 1 + distAbove / 55
    const dx = e.clientX - s.lastX
    s.lastX = e.clientX
    s.time = Math.min(s.duration, Math.max(0, s.time + ((dx / s.rect.width) * s.duration) / precision))
    const v = videoRef.current
    if (v) v.currentTime = s.time
    setCurrent(s.time)
    setSeekHover({ x: (s.time / s.duration) * s.rect.width, w: s.rect.width, time: s.time, dragging: true, precise: distAbove > 30 })
  }, [])

  const onScrubEnd = useCallback(() => {
    scrubRef.current = null
    window.removeEventListener('pointermove', onScrubMove)
    window.removeEventListener('pointerup', onScrubEnd)
  }, [onScrubMove])

  const onScrubStart = useCallback(
    (e) => {
      if (e.button) return
      const rect = seekRef.current?.getBoundingClientRect()
      const dur = videoRef.current?.duration || 0
      if (!rect || !dur) return
      const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
      const t = ratio * dur
      scrubRef.current = { time: t, lastX: e.clientX, rect, duration: dur }
      if (videoRef.current) videoRef.current.currentTime = t
      setCurrent(t)
      setSeekHover({ x: ratio * rect.width, w: rect.width, time: t, dragging: true, precise: false })
      window.addEventListener('pointermove', onScrubMove)
      window.addEventListener('pointerup', onScrubEnd)
    },
    [onScrubMove, onScrubEnd],
  )

  const toggleMute = () => setMuted(!muted)

  const changeVolume = (val) => {
    setVolume(val)
    setMuted(val === 0)
  }

  const nudgeVolume = (e) => {
    const base = muted ? 0 : volume
    const next = Math.min(1, Math.max(0, +(base + (e.deltaY < 0 ? 0.05 : -0.05)).toFixed(2)))
    changeVolume(next)
  }

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else stageRef.current?.requestFullscreen?.()
  }

  const controlsVisible = hovering || !playing
  const iconStyle = { color: '#fff' }
  const pct = duration ? (current / duration) * 100 : 0
  // Filmstrip reel shown when the bar is pulled up for precise seeking.
  const FILMSTRIP_H = 76
  const STRIP_FRAMES = 14
  const showStrip = !!(seekHover?.dragging && seekHover.precise && storyboard)

  return (
    <Box
      ref={stageRef}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{
        position: 'relative',
        width: '100%',
        height: '74vh',
        background: '#000',
        overflow: 'hidden',
      }}
    >
      <video
        ref={videoRef}
        src={src}
        onClick={togglePlay}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration)
          if (autoplay) e.currentTarget.play().catch(() => {})
        }}
        onEnded={() => setPlaying(false)}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', cursor: 'pointer' }}
      />

      {/* Center play button while paused */}
      {!playing && (
        <ActionIcon
          variant="filled"
          color="dark"
          radius="xl"
          size={64}
          onClick={togglePlay}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            opacity: 0.85,
          }}
        >
          <IconPlayerPlayFilled size={30} />
        </ActionIcon>
      )}

      {/* Control bar */}
      <Box
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '6px 12px 10px',
          background: 'linear-gradient(transparent, rgba(0,0,0,0.65))',
          opacity: controlsVisible ? 1 : 0,
          transition: 'opacity 150ms ease',
          pointerEvents: controlsVisible ? 'auto' : 'none',
        }}
      >
        {/* Filmstrip reel (full width) while pulled up for precise seeking. */}
        {showStrip && (
          <Box style={{ display: 'flex', height: FILMSTRIP_H, marginLeft: -12, marginRight: -12, marginBottom: 10, overflow: 'hidden' }}>
            {Array.from({ length: STRIP_FRAMES }).map((_, i) => {
              const index = Math.round((i / (STRIP_FRAMES - 1)) * (storyboard.count - 1))
              const col = index % storyboard.cols
              const row = Math.floor(index / storyboard.cols)
              const bx = storyboard.cols > 1 ? (col / (storyboard.cols - 1)) * 100 : 0
              const by = storyboard.rows > 1 ? (row / (storyboard.rows - 1)) * 100 : 0
              return (
                <Box
                  key={i}
                  style={{
                    flex: 1,
                    height: '100%',
                    backgroundImage: `url(${storyboard.url})`,
                    backgroundSize: `${storyboard.cols * 100}% ${storyboard.rows * 100}%`,
                    backgroundPosition: `${bx}% ${by}%`,
                    borderRight: '1px solid rgba(0,0,0,0.35)',
                  }}
                />
              )
            })}
          </Box>
        )}
        <Box
          ref={seekRef}
          mb={6}
          onPointerDown={onScrubStart}
          onMouseMove={(e) => {
            if (scrubRef.current) return
            const rect = seekRef.current?.getBoundingClientRect()
            if (!rect || !duration) return
            const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
            setSeekHover({ x: ratio * rect.width, w: rect.width, time: ratio * duration, dragging: false, precise: false })
          }}
          onMouseLeave={() => !scrubRef.current && setSeekHover(null)}
          style={{ position: 'relative', height: 16, display: 'flex', alignItems: 'center', cursor: 'pointer', touchAction: 'none' }}
        >
          {seekHover && storyboard && (() => {
            const idx = Math.min(storyboard.count - 1, Math.max(0, Math.floor(seekHover.time / storyboard.interval)))
            const tx = (idx % storyboard.cols) * storyboard.tileW
            const ty = Math.floor(idx / storyboard.cols) * storyboard.tileH
            const left = Math.min(seekHover.w - storyboard.tileW / 2, Math.max(storyboard.tileW / 2, seekHover.x))
            return (
              <Box
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left,
                  transform: 'translateX(-50%)',
                  marginBottom: showStrip ? FILMSTRIP_H + 16 : 12,
                  pointerEvents: 'none',
                  zIndex: 5,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                {seekHover.dragging && (
                  <Group gap={2} mb={6} wrap="nowrap" style={{ whiteSpace: 'nowrap' }}>
                    <IconChevronUp size={14} color="#fff" />
                    <Text size="xs" fw={600} c="white" style={{ textShadow: '0 1px 2px #000' }}>
                      Pull up for precise seeking
                    </Text>
                  </Group>
                )}
                <Box
                  style={{
                    width: storyboard.tileW,
                    height: storyboard.tileH,
                    backgroundImage: `url(${storyboard.url})`,
                    backgroundPosition: `-${tx}px -${ty}px`,
                    backgroundSize: `${storyboard.cols * storyboard.tileW}px ${storyboard.rows * storyboard.tileH}px`,
                    borderRadius: 4,
                    border: '2px solid #fff',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.7)',
                  }}
                />
                <Text size="xs" c="white" fw={600} mt={8} px={8} py={2} style={{ background: 'rgba(0,0,0,0.75)', borderRadius: 10 }}>
                  {formatTime(seekHover.time)}
                </Text>
              </Box>
            )
          })()}
          {/* track + filled + thumb */}
          <Box style={{ position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.3)' }} />
          <Box style={{ position: 'absolute', left: 0, height: 4, borderRadius: 2, width: `${pct}%`, background: 'var(--mantine-primary-color-filled)' }} />
          <Box style={{ position: 'absolute', left: `${pct}%`, top: '50%', width: 12, height: 12, borderRadius: '50%', background: '#fff', transform: 'translate(-50%, -50%)', boxShadow: '0 0 0 1px rgba(0,0,0,0.35)' }} />
        </Box>
        <Group justify="space-between" gap="xs" wrap="nowrap">
          <Group gap={6} wrap="nowrap" style={{ flex: 1 }}>
            <ActionIcon variant="transparent" style={iconStyle} onClick={togglePlay}>
              {playing ? <IconPlayerPauseFilled size={18} /> : <IconPlayerPlayFilled size={18} />}
            </ActionIcon>
            {/* Mute + volume share one wheel-/click-friendly zone with padding. */}
            <Group gap={6} wrap="nowrap" onWheel={nudgeVolume} style={{ paddingBlock: 8 }}>
              <ActionIcon variant="transparent" style={iconStyle} onClick={toggleMute}>
                {muted || volume === 0 ? <IconVolumeOff size={18} /> : <IconVolume size={18} />}
              </ActionIcon>
              <Slider
                value={muted ? 0 : volume}
                min={0}
                max={1}
                step={0.05}
                onChange={changeVolume}
                size="md"
                thumbSize={14}
                w={90}
                label={null}
              />
            </Group>
            <Text size="xs" c="white" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatTime(current)} / {formatTime(duration)}
            </Text>
          </Group>
          <ActionIcon variant="transparent" style={iconStyle} onClick={toggleFullscreen}>
            <IconMaximize size={18} />
          </ActionIcon>
        </Group>
      </Box>
    </Box>
  )
}
