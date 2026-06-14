import {
  IconFolderFilled,
  IconFileFilled,
  IconPhotoFilled,
  IconFileMusicFilled,
  IconFileText,
  IconFileZip,
  IconMovie,
  IconCode,
} from '@tabler/icons-react'
import { EXT } from '../fileTypes.js'

// Tabler has no filled PDF glyph, so compose one: a solid red document with a
// small white "PDF" wordmark. Matches the (size, color) API of Tabler icons so
// it slots into iconForEntry like any other.
export function PdfIcon({ size = 24, color = '#e03131' }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: size, height: size }}>
      <IconFileFilled size={size} color={color} />
      <span
        style={{
          position: 'absolute',
          bottom: size * 0.17,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: size * 0.24,
          fontWeight: 800,
          letterSpacing: size * 0.004,
          lineHeight: 1,
          color: '#fff',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        PDF
      </span>
    </span>
  )
}

// Solid glyph + a single tone per kind, rendered directly (no colored tile).
// Folders get a soft, intentionally theme-independent gold; file kinds borrow
// their hue from Mantine's palette so they track light/dark.
export function iconForEntry(entry) {
  if (entry.type === 'dir') return { Icon: IconFolderFilled, tone: '#e0aa3e' }
  const ext = entry.name.split('.').pop()?.toLowerCase() ?? ''
  const v = (c) => `var(--mantine-color-${c}-6)`
  if (EXT.image.includes(ext)) return { Icon: IconPhotoFilled, tone: v('grape') }
  if (EXT.pdf.includes(ext)) return { Icon: PdfIcon, tone: v('red') }
  if (EXT.audio.includes(ext)) return { Icon: IconFileMusicFilled, tone: v('teal') }
  if (EXT.video.includes(ext)) return { Icon: IconMovie, tone: v('indigo') }
  if (EXT.archive.includes(ext)) return { Icon: IconFileZip, tone: v('orange') }
  if (EXT.code.includes(ext)) return { Icon: IconCode, tone: v('blue') }
  if (EXT.text.includes(ext)) return { Icon: IconFileText, tone: v('gray') }
  return { Icon: IconFileFilled, tone: v('gray') }
}
