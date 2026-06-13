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
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [hovering, setHovering] = useState(false)

  // Reset transport state when the source changes.
  useEffect(() => {
    setPlaying(false)
    setCurrent(0)
    setDuration(0)
  }, [src])

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

  const toggleMute = () => {
    const v = video()
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
  }

  const changeVolume = (val) => {
    const v = video()
    if (!v) return
    v.volume = val
    v.muted = val === 0
    setVolume(val)
    setMuted(val === 0)
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
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
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
            <ActionIcon variant="transparent" style={iconStyle} onClick={toggleMute}>
              {muted || volume === 0 ? <IconVolumeOff size={18} /> : <IconVolume size={18} />}
            </ActionIcon>
            <Slider
              value={muted ? 0 : volume}
              min={0}
              max={1}
              step={0.05}
              onChange={changeVolume}
              size="xs"
              w={80}
              label={null}
            />
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
