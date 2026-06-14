import { useEffect, useState } from 'react'

/**
 * OS file-type icons (Electron `app.getFileIcon`). Files are effectively per
 * *type*, so we cache them by extension — a 2,000-file folder makes ~a dozen IPC
 * calls, not 2,000. Folders are cached per *path*, because the OS/theme can give
 * special folders (Downloads, Pictures, Music…) their own icons; each distinct
 * folder is fetched once and then memoized across navigation. PNG data URL | null.
 */
const cache = new Map() // key -> dataUrl | null (resolved)
const pending = new Map() // key -> Promise<dataUrl|null> (in flight)

function keyFor(entry) {
  if (entry.type === 'dir') return `dir:${entry.path}`
  const dot = entry.name.lastIndexOf('.')
  const ext = dot > 0 ? entry.name.slice(dot + 1).toLowerCase() : ''
  return ext ? `ext:${ext}` : 'file'
}

export function useOsIcon(entry, enabled) {
  const key = keyFor(entry)
  const [url, setUrl] = useState(() => (enabled && cache.has(key) ? cache.get(key) : null))

  useEffect(() => {
    if (!enabled || !window.native?.fileIcon) return
    if (cache.has(key)) {
      setUrl(cache.get(key))
      return
    }
    let cancelled = false
    let p = pending.get(key)
    if (!p) {
      // First request for this type — fetch it once and memoize the result.
      p = window.native
        .fileIcon(entry.path)
        .then((u) => {
          cache.set(key, u ?? null)
          pending.delete(key)
          return u ?? null
        })
        .catch(() => {
          cache.set(key, null)
          pending.delete(key)
          return null
        })
      pending.set(key, p)
    }
    p.then((u) => {
      if (!cancelled) setUrl(u)
    })
    return () => {
      cancelled = true
    }
  }, [key, enabled, entry.path])

  return enabled ? url : null
}
