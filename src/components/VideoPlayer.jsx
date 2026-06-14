import { useEffect, useRef, useState } from 'react'
import { Box, Group, Slider, ActionIcon, Text } from '@mantine/core'
import {
  IconPlayerPlayFilled,
  IconPlayerPauseFilled,
  IconVolume,
  IconVolumeOff,
  IconMaximize,
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

  const seek = (val) => {
    const v = video()
    if (v) {
      v.currentTime = val
      setCurrent(val)
    }
  }

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
        <Box
          ref={seekRef}
          mb={6}
          style={{ position: 'relative' }}
          onMouseMove={(e) => {
            const rect = seekRef.current?.getBoundingClientRect()
            if (!rect || !duration) return
            const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
            setSeekHover({ x: ratio * rect.width, w: rect.width, time: ratio * duration })
          }}
          onMouseLeave={() => setSeekHover(null)}
        >
          {seekHover && storyboard && (() => {
            const idx = Math.min(storyboard.count - 1, Math.max(0, Math.floor(seekHover.time / storyboard.interval)))
            const tx = (idx % storyboard.cols) * storyboard.tileW
            const ty = Math.floor(idx / storyboard.cols) * storyboard.tileH
            const left = Math.min(seekHover.w - storyboard.tileW / 2, Math.max(storyboard.tileW / 2, seekHover.x))
            return (
              <Box style={{ position: 'absolute', bottom: '100%', left, transform: 'translateX(-50%)', marginBottom: 10, pointerEvents: 'none', zIndex: 5 }}>
                <Box
                  style={{
                    width: storyboard.tileW,
                    height: storyboard.tileH,
                    backgroundImage: `url(${storyboard.url})`,
                    backgroundPosition: `-${tx}px -${ty}px`,
                    backgroundSize: `${storyboard.cols * storyboard.tileW}px ${storyboard.rows * storyboard.tileH}px`,
                    borderRadius: 4,
                    border: '1px solid rgba(255,255,255,0.3)',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.6)',
                  }}
                />
                <Text ta="center" size="xs" c="white" mt={2} style={{ textShadow: '0 1px 2px #000' }}>
                  {formatTime(seekHover.time)}
                </Text>
              </Box>
            )
          })()}
          <Slider
            value={current}
            max={duration || 0}
            min={0}
            step={0.1}
            onChange={seek}
            size="sm"
            label={formatTime}
            styles={{ track: { cursor: 'pointer' }, thumb: { transition: 'none' } }}
          />
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
