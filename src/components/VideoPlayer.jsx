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
import { usePlayerStore } from '../stores/playerStore.js'
import { useSettingsStore } from '../stores/settingsStore.js'

/**
 * Custom video player: the video fills a black stage (small clips scale up,
 * aspect ratio preserved) and the native controls are replaced with a clean
 * control bar that fades in on hover / while paused.
 */
export function VideoPlayer({ src }) {
  const videoRef = useRef(null)
  const stageRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [hovering, setHovering] = useState(false)
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
  }, [src])

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
        <Slider
          value={current}
          max={duration || 0}
          min={0}
          step={0.1}
          onChange={seek}
          size="sm"
          label={formatTime}
          styles={{ track: { cursor: 'pointer' }, thumb: { transition: 'none' } }}
          mb={6}
        />
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
