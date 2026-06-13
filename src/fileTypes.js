// Extension groupings shared across the explorer and the preview modal.
export const EXT = {
  image: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'],
  pdf: ['pdf'],
  audio: ['mp3', 'wav', 'flac', 'ogg', 'm4a'],
  video: ['mp4', 'webm', 'mov', 'mkv', 'avi'],
  archive: ['zip', 'gz', 'tar', 'rar', '7z'],
  code: ['js', 'ts', 'jsx', 'tsx', 'json', 'html', 'css', 'py', 'sh', 'xml', 'yml', 'yaml'],
  text: ['txt', 'md', 'csv', 'log', 'ini', 'conf'],
}

export function extOf(name) {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

/** High-level category used to decide how to preview/open a file. */
export function fileKind(entry) {
  if (entry.type === 'dir') return 'dir'
  const e = extOf(entry.name)
  if (EXT.image.includes(e)) return 'image'
  if (EXT.video.includes(e)) return 'video'
  if (EXT.audio.includes(e)) return 'audio'
  if (EXT.pdf.includes(e)) return 'pdf'
  if (EXT.code.includes(e)) return 'code' // shown in the Monaco editor
  if (EXT.text.includes(e)) return 'text' // shown in the plain viewer
  return 'other'
}

/** Whether a file can be previewed in-app with web technologies. */
export function isPreviewable(entry) {
  const kind = fileKind(entry)
  return kind !== 'dir' && kind !== 'other'
}

// Map an extension to a Monaco language id for syntax highlighting.
const MONACO_LANG = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  json: 'json', html: 'html', css: 'css', scss: 'scss', less: 'less',
  py: 'python', sh: 'shell', bash: 'shell', xml: 'xml',
  yml: 'yaml', yaml: 'yaml', md: 'markdown',
}

export function monacoLanguage(name) {
  return MONACO_LANG[extOf(name)] ?? 'plaintext'
}

/** Human-readable description of an entry's type, e.g. "PNG image". */
export function kindLabel(entry) {
  if (entry.type === 'dir') return 'Folder'
  const e = extOf(entry.name)
  const labels = {
    image: 'Image',
    video: 'Video',
    audio: 'Audio',
    pdf: 'PDF document',
  }
  const base = labels[fileKind(entry)]
  if (base) return e ? `${base} (${e.toUpperCase()})` : base
  return e ? `${e.toUpperCase()} file` : 'File'
}
