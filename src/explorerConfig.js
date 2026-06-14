import {
  IconPhoto,
  IconMovie,
  IconMusic,
  IconFileTypePdf,
  IconCode,
  IconFileText,
  IconFile,
  IconDeviceDesktop,
  IconFiles,
  IconDownload,
} from '@tabler/icons-react'

// Shared empty array keeps untagged rows' `tags` prop referentially stable.
export const EMPTY_TAGS = []

export const SORTS = [
  { value: 'name', label: 'Name' },
  { value: 'modified', label: 'Date modified' },
  { value: 'size', label: 'Size' },
]

// Quick file-kind toggles for the header filter, in display order.
export const KIND_FILTERS = [
  { value: 'image', label: 'Images', Icon: IconPhoto },
  { value: 'video', label: 'Videos', Icon: IconMovie },
  { value: 'audio', label: 'Audio', Icon: IconMusic },
  { value: 'pdf', label: 'PDFs', Icon: IconFileTypePdf },
  { value: 'code', label: 'Code', Icon: IconCode },
  { value: 'text', label: 'Text', Icon: IconFileText },
  { value: 'other', label: 'Other', Icon: IconFile },
]

// Formats offered in the right-click "Convert to" submenu, by file kind.
export const CONVERT_FORMATS = {
  image: [
    { fmt: 'png', label: 'PNG' },
    { fmt: 'jpg', label: 'JPG' },
    { fmt: 'webp', label: 'WebP' },
    { fmt: 'avif', label: 'AVIF' },
  ],
  video: [
    { fmt: 'mp4', label: 'MP4' },
    { fmt: 'webm', label: 'WebM' },
    { fmt: 'mkv', label: 'MKV' },
    { fmt: 'mov', label: 'MOV' },
  ],
}

// Audio formats a video's soundtrack can be extracted to.
export const AUDIO_EXTRACT = [
  { fmt: 'mp3', label: 'MP3' },
  { fmt: 'm4a', label: 'M4A' },
  { fmt: 'wav', label: 'WAV' },
  { fmt: 'flac', label: 'FLAC' },
]

// Standard home subfolders a file explorer surfaces for quick access. Only the
// ones that actually exist under the root are shown.
export const PLACES = [
  { name: 'Desktop', icon: IconDeviceDesktop },
  { name: 'Documents', icon: IconFiles },
  { name: 'Downloads', icon: IconDownload },
  { name: 'Pictures', icon: IconPhoto },
  { name: 'Music', icon: IconMusic },
  { name: 'Videos', icon: IconMovie },
]

// Sort entries with folders always first, then by the chosen field/direction.
export function compareEntries(a, b, field, dir) {
  if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
  let r = 0
  if (field === 'modified') r = new Date(a.modifiedAt) - new Date(b.modifiedAt)
  else if (field === 'size') r = a.size - b.size
  if (r === 0) r = a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
  return dir === 'desc' ? -r : r
}
