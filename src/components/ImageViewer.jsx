import { useCallback, useEffect, useRef, useState } from 'react'
import { Group, ActionIcon, Text, Tooltip } from '@mantine/core'
import { IconPlus, IconMinus, IconZoomReset } from '@tabler/icons-react'

const MIN = 1
const MAX = 8
const STEP = 1.25

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/**
 * A zoom control button. We avoid Mantine's `disabled` prop (it paints a filled
 * background); instead an "off" button just dims and ignores clicks.
 */
function ZoomButton({ label, off, onClick, children }) {
  return (
    <Tooltip label={label} openDelay={400}>
      <ActionIcon
        variant="subtle"
        color="gray.3"
        radius="xl"
        onClick={off ? undefined : onClick}
        style={{ opacity: off ? 0.4 : 1, cursor: off ? 'default' : 'pointer' }}
      >
        {children}
      </ActionIcon>
    </Tooltip>
  )
}

/**
 * An image preview that zooms and pans. Wheel zooms toward the cursor, drag
 * pans while zoomed, double-click toggles, and a floating control bar (fades
 * in on hover, like the media players) offers +/−, a reset, and the level.
 */
export function ImageViewer({ src, alt }) {
  const stageRef = useRef(null)
  const [scale, setScale] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [hovering, setHovering] = useState(false)
  const drag = useRef(null)

  // Mirror the live transform in refs so wheel/zoom math reads fresh values
  // (rapid wheel events fire faster than React re-renders) and we can update
  // scale + pos together without nesting state updaters.
  const scaleRef = useRef(1)
  const posRef = useRef({ x: 0, y: 0 })
  const commit = useCallback((s, p) => {
    scaleRef.current = s
    posRef.current = p
    setScale(s)
    setPos(p)
  }, [])

  // Reset when the image changes.
  useEffect(() => {
    commit(1, { x: 0, y: 0 })
  }, [src, commit])

  const apply = useCallback(
    (nextScale, nextPos) => {
      const s = clamp(nextScale, MIN, MAX)
      commit(s, s === 1 ? { x: 0, y: 0 } : nextPos)
    },
    [commit],
  )

  // Zoom toward a point (cx, cy) given relative to the stage center.
  const zoomAt = useCallback(
    (factor, cx, cy) => {
      const prev = scaleRef.current
      const next = clamp(prev * factor, MIN, MAX)
      if (next === prev) return
      if (next === 1) {
        commit(1, { x: 0, y: 0 })
        return
      }
      const ratio = next / prev
      const p = posRef.current
      // Keep the cursor anchored over the same pixel as we scale.
      commit(next, { x: cx - ratio * (cx - p.x), y: cy - ratio * (cy - p.y) })
    },
    [commit],
  )

  const onWheel = useCallback(
    (e) => {
      e.preventDefault()
      const rect = stageRef.current?.getBoundingClientRect()
      if (!rect) return
      const cx = e.clientX - rect.left - rect.width / 2
      const cy = e.clientY - rect.top - rect.height / 2
      zoomAt(e.deltaY < 0 ? STEP : 1 / STEP, cx, cy)
    },
    [zoomAt],
  )

  // Wheel must be a non-passive native listener to allow preventDefault.
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onWheel])

  const onPointerDown = useCallback(
    (e) => {
      if (scale === 1) return
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      drag.current = { sx: e.clientX, sy: e.clientY, px: pos.x, py: pos.y }
    },
    [scale, pos],
  )

  const onPointerMove = useCallback(
    (e) => {
      if (!drag.current) return
      const d = drag.current
      const p = { x: d.px + (e.clientX - d.sx), y: d.py + (e.clientY - d.sy) }
      posRef.current = p
      setPos(p)
    },
    [],
  )

  const onPointerUp = useCallback((e) => {
    if (drag.current) e.currentTarget.releasePointerCapture?.(e.pointerId)
    drag.current = null
  }, [])

  const onDoubleClick = useCallback(
    (e) => {
      const rect = stageRef.current?.getBoundingClientRect()
      if (!rect) return
      const cx = e.clientX - rect.left - rect.width / 2
      const cy = e.clientY - rect.top - rect.height / 2
      if (scale > 1) apply(1, { x: 0, y: 0 })
      else zoomAt(2.5, cx, cy)
    },
    [scale, apply, zoomAt],
  )

  return (
    <div
      ref={stageRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{
        position: 'relative',
        width: '100%',
        height: '78vh',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
        cursor: scale === 1 ? 'default' : drag.current ? 'grabbing' : 'grab',
        userSelect: 'none',
      }}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
          transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
          transformOrigin: 'center center',
          transition: drag.current ? 'none' : 'transform 120ms ease-out',
          willChange: 'transform',
        }}
      />

      {/* Floating zoom controls — fade in on hover. */}
      <Group
        gap={4}
        wrap="nowrap"
        px={6}
        py={4}
        style={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(6px)',
          borderRadius: 999,
          opacity: hovering ? 1 : 0,
          transition: 'opacity 160ms ease',
          pointerEvents: hovering ? 'auto' : 'none',
        }}
      >
        <ZoomButton label="Zoom out" off={scale <= MIN} onClick={() => zoomAt(1 / STEP, 0, 0)}>
          <IconMinus size={18} />
        </ZoomButton>
        <Text
          size="xs"
          c="gray.3"
          ta="center"
          w={46}
          style={{ fontVariantNumeric: 'tabular-nums', userSelect: 'none' }}
        >
          {Math.round(scale * 100)}%
        </Text>
        <ZoomButton label="Zoom in" off={scale >= MAX} onClick={() => zoomAt(STEP, 0, 0)}>
          <IconPlus size={18} />
        </ZoomButton>
        <ZoomButton label="Reset" off={scale === 1} onClick={() => apply(1, { x: 0, y: 0 })}>
          <IconZoomReset size={18} />
        </ZoomButton>
      </Group>
    </div>
  )
}
