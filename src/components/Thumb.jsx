import { useState } from 'react'
import { Box, Center } from '@mantine/core'
import { IconPlayerPlayFilled } from '@tabler/icons-react'
import { api } from '../api.js'
import { fileKind } from '../fileTypes.js'
import { useSettingsStore } from '../stores/settingsStore.js'
import { iconForEntry } from './fileIcons.jsx'
import { useOsIcon } from './osIcons.js'

const thumbBox = (size) => ({
  width: size,
  height: size,
  borderRadius: 8,
  overflow: 'hidden',
  flexShrink: 0,
  background: 'var(--mantine-color-default-hover)',
  position: 'relative',
  // Smoothly grow/shrink on zoom (size only changes on zoom, never on scroll).
  transition: 'width 160ms ease, height 160ms ease',
})

/** A square preview: a real thumbnail for image/video files, otherwise the
 * type icon. Falls back to the icon if the media fails to load. */
export function Thumb({ entry, size }) {
  const { Icon, tone } = iconForEntry(entry)
  const [failed, setFailed] = useState(false)
  const kind = fileKind(entry)
  const hasThumb = kind === 'image' || kind === 'video'
  const thumbnailFit = useSettingsStore((s) => s.thumbnailFit)
  const iconSource = useSettingsStore((s) => s.iconSource)
  const osIcon = useOsIcon(entry, iconSource === 'os')

  // Backend serves a small cached WebP, so the renderer only decodes a tiny
  // image — no full-resolution decode, no <video> elements in the listing.
  if (!failed && hasThumb) {
    // Request one of a few fixed sizes (not size*2) so zooming reuses the same
    // URL — and the browser cache — until it crosses a bucket, instead of
    // refetching a new resolution on every zoom step.
    const want = size * 2
    const px = want <= 128 ? 128 : want <= 256 ? 256 : 512
    return (
      <Box style={thumbBox(size)}>
        <img
          src={api.thumbnailUrl(entry.path, px)}
          alt={entry.name}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: kind === 'image' ? thumbnailFit : 'cover',
            display: 'block',
          }}
        />
        {kind === 'video' && (
          <IconPlayerPlayFilled
            size={size >= 40 ? 18 : 10}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: '#fff',
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))',
            }}
          />
        )}
      </Box>
    )
  }

  // "System" icon theme: show the OS file-type icon once it's loaded, otherwise
  // fall back to our glyph (also the fallback in a plain browser / on failure).
  if (iconSource === 'os' && osIcon) {
    const g = Math.round(size * 0.86)
    return (
      <Center style={{ width: size, height: size, flexShrink: 0, transition: 'width 160ms ease, height 160ms ease' }}>
        <img src={osIcon} alt="" width={g} height={g} draggable={false} style={{ objectFit: 'contain' }} />
      </Center>
    )
  }

  return (
    <Center style={{ width: size, height: size, flexShrink: 0 }}>
      <Icon size={Math.round(size * 0.68)} color={tone} />
    </Center>
  )
}
