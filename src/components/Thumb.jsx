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
    const px = Math.min(512, Math.round(size * 2)) // a touch sharper than 1x
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
      <Center style={{ width: size, height: size, flexShrink: 0 }}>
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
