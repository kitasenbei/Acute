import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import {
  Box,
  Center,
  Flex,
  Group,
  Loader,
  ColorSwatch,
  SegmentedControl,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
  ActionIcon,
  UnstyledButton,
  FileButton,
  Menu,
  Popover,
  Chip,
} from '@mantine/core'
import {
  IconHome,
  IconArrowUp,
  IconArrowDown,
  IconArrowsSort,
  IconRefresh,
  IconFolderPlus,
  IconFilePlus,
  IconPlus,
  IconScissors,
  IconCopy,
  IconCopyPlus,
  IconClipboard,
  IconClipboardCopy,
  IconUpload,
  IconChevronRight,
  IconEye,
  IconEyeOff,
  IconExternalLink,
  IconFolderOpen,
  IconDownload,
  IconPencil,
  IconTrash,
  IconStar,
  IconStarFilled,
  IconFolder,
  IconSettings,
  IconTags,
  IconFile,
  IconPhoto,
  IconMusic,
  IconLayoutList,
  IconLayoutRows,
  IconLayoutGrid,
  IconFilter,
  IconX,
  IconPlaylist,
  IconPlaylistAdd,
  IconSearch,
} from '@tabler/icons-react'
import { api } from './api.js'
import { EXT, fileKind, extOf } from './fileTypes.js'
import { useSettingsStore } from './stores/settingsStore.js'
import { useViewStore } from './stores/viewStore.js'
import { usePreviewStore } from './stores/previewStore.js'
import { useContextMenuStore } from './stores/contextMenuStore.js'
import { useClipboardStore } from './stores/clipboardStore.js'
import { useJobsStore } from './stores/jobsStore.js'
import { useTagsStore, buildTagTree } from './stores/tagsStore.js'
import { VirtualEntries } from './components/VirtualEntries.jsx'
import { SidebarTagTree } from './components/SidebarTagTree.jsx'
import { NowPlaying } from './components/Playlist.jsx'
import { useQueueStore } from './stores/queueStore.js'
import { StatusBar } from './components/StatusBar.jsx'
import { EntryRow, EntryTile } from './components/EntryItems.jsx'
import { Breadcrumbs } from './components/Breadcrumbs.jsx'
import { SidebarItem, SidebarLabel } from './components/SidebarItem.jsx'
import {
  EMPTY_TAGS,
  SORTS,
  KIND_FILTERS,
  CONVERT_FORMATS,
  AUDIO_EXTRACT,
  PLACES,
  compareEntries,
} from './explorerConfig.js'

export default function App() {
  const [path, setPath] = useState('')
  const [listing, setListing] = useState(null)
  const [favorites, setFavorites] = useState([])
  const [places, setPlaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingPath, setEditingPath] = useState(null)
  const [creating, setCreating] = useState(null) // 'folder' | 'file' | null
  const [dragOver, setDragOver] = useState(false)
  const [activeTagId, setActiveTagId] = useState(null)
  const [usage, setUsage] = useState(null)
  const [selected, setSelected] = useState(() => new Set())
  const [marquee, setMarquee] = useState(null) // viewport rect while drag-selecting
  const [search, setSearch] = useState('') // recursive search query (empty = off)
  const [searchResults, setSearchResults] = useState(null) // null until first result set
  const dragRef = useRef(null)
  const resetRef = useRef(null)
  const contentRef = useRef(null)
  const scrollRef = useRef(null)
  const jobStatusRef = useRef({})
  const anchorRef = useRef(null) // last clicked path, for shift-range selection
  const entriesRef = useRef([]) // current visible entries, for index-based selection
  const dragItemsRef = useRef([]) // paths being drag-moved
  const [dropTarget, setDropTarget] = useState(null) // folder path under the drag
  const openSettings = useSettingsStore((s) => s.openSettings)
  const mode = useViewStore((s) => s.mode)
  const setMode = useViewStore((s) => s.setMode)
  const showHidden = useViewStore((s) => s.showHidden)
  const toggleHidden = useViewStore((s) => s.toggleHidden)
  const sortBy = useViewStore((s) => s.sortBy)
  const sortDir = useViewStore((s) => s.sortDir)
  const setSort = useViewStore((s) => s.setSort)
  const zoom = useViewStore((s) => s.zoom)
  const zoomBy = useViewStore((s) => s.zoomBy)
  const filterText = useViewStore((s) => s.filterText)
  const filterKinds = useViewStore((s) => s.filterKinds)
  const setFilterText = useViewStore((s) => s.setFilterText)
  const toggleFilterKind = useViewStore((s) => s.toggleFilterKind)
  const clearFilter = useViewStore((s) => s.clearFilter)
  const openPreview = usePreviewStore((s) => s.open)
  const openContextMenu = useContextMenuStore((s) => s.open)
  const clipItems = useClipboardStore((s) => s.items)
  const clipMode = useClipboardStore((s) => s.mode)
  const setClipboard = useClipboardStore((s) => s.setClipboard)
  const clearClipboard = useClipboardStore((s) => s.clear)
  const jobs = useJobsStore((s) => s.jobs)
  const addJob = useJobsStore((s) => s.add)
  const dismissJob = useJobsStore((s) => s.dismiss)
  const ensureJobPolling = useJobsStore((s) => s.ensurePolling)
  const startConvert = useCallback(
    (path, fmt) => {
      api
        .convert(path, fmt)
        .then((job) => {
          addJob(job)
          ensureJobPolling()
        })
        .catch((e) => setError(e.message))
    },
    [addJob, ensureJobPolling],
  )
  const tags = useTagsStore((s) => s.tags)
  const assignments = useTagsStore((s) => s.assignments)
  const loadTags = useTagsStore((s) => s.loadAll)
  const toggleTag = useTagsStore((s) => s.toggleAssign)
  const openTagManager = useTagsStore((s) => s.openManager)
  const enqueue = useQueueStore((s) => s.enqueue)
  const toggleQueueOpen = useQueueStore((s) => s.toggleOpen)
  const queueLen = useQueueStore((s) => s.queue.length)

  const load = useCallback(async (p, { silent } = {}) => {
    if (!silent) setLoading(true)
    try {
      setListing(await api.list(p))
      setPath(p)
      setActiveTagId(null) // navigating a directory clears any tag filter
      setSelected(new Set())
      clearFilter() // a filter is per-folder; reset it on navigation
      setSearch('') // and a recursive search is per-folder too
      setSearchResults(null)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [clearFilter])

  // Show every file/folder carrying a tag, across directories.
  const loadTag = useCallback(async (tagId, { silent } = {}) => {
    if (!silent) setLoading(true)
    try {
      const { entries } = await api.tags.files(tagId)
      setListing({ path: '', parent: null, entries })
      setActiveTagId(tagId)
      setSelected(new Set())
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadFavorites = useCallback(async () => {
    try {
      setFavorites(await api.favorites.list())
    } catch {
      // non-fatal
    }
  }, [])

  // Derive which standard folders exist by inspecting the root once.
  const loadPlaces = useCallback(async () => {
    try {
      const root = await api.list('')
      const dirs = new Set(root.entries.filter((e) => e.type === 'dir').map((e) => e.name))
      setPlaces(PLACES.filter((p) => dirs.has(p.name)))
    } catch {
      // non-fatal
    }
  }, [])

  const loadUsage = useCallback(async () => {
    try {
      setUsage(await api.usage())
    } catch {
      // non-fatal
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        await api.waitUntilReady()
      } catch (e) {
        setError(e.message)
      }
      await Promise.all([load(''), loadFavorites(), loadPlaces(), loadTags(), loadUsage()])
    })()
  }, [load, loadFavorites, loadPlaces, loadTags, loadUsage])

  // When a background job finishes, refresh the view (the new file appears) and
  // auto-dismiss it from the status bar shortly after.
  useEffect(() => {
    for (const j of jobs) {
      const prev = jobStatusRef.current[j.id]
      if (prev === 'running' && j.status !== 'running') {
        if (j.status === 'done') {
          if (activeTagId) loadTag(activeTagId, { silent: true })
          else load(path, { silent: true })
          loadUsage()
        }
        const id = j.id
        setTimeout(() => dismissJob(id), 4000)
      }
      jobStatusRef.current[j.id] = j.status
    }
  }, [jobs, load, loadTag, path, activeTagId, dismissJob, loadUsage])

  // Ctrl+wheel zooms thumbnails. A native non-passive listener is required so we
  // can preventDefault and stop Chromium's built-in page zoom.
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const onWheel = (e) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      zoomBy(e.deltaY < 0 ? 0.1 : -0.1)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomBy])

  // Ctrl/⌘+A selects every entry, Escape clears the selection. Skipped while a
  // text field is focused so it doesn't hijack normal editing shortcuts.
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setSelected(new Set(entriesRef.current.map((x) => x.path)))
      } else if (e.key === 'Escape') {
        setSelected(new Set())
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Recursive search: debounce the query, then fetch matches under the current
  // directory. An empty query turns search off (falls back to the listing).
  useEffect(() => {
    const q = search.trim()
    if (!q) {
      setSearchResults(null)
      return
    }
    let cancelled = false
    const id = setTimeout(async () => {
      try {
        const { entries } = await api.search(path, q)
        if (!cancelled) setSearchResults(entries)
      } catch (e) {
        if (!cancelled) {
          setError(e.message)
          setSearchResults([])
        }
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [search, path])

  const searching = search.trim().length > 0
  const entries = useMemo(() => {
    const source = searching ? (searchResults ?? []) : (listing?.entries ?? [])
    let filtered = source.filter((e) => showHidden || !e.name.startsWith('.'))
    // Kind chips narrow files only; folders stay visible so you can navigate.
    if (filterKinds.length) {
      filtered = filtered.filter((e) => e.type === 'dir' || filterKinds.includes(fileKind(e)))
    }
    // Free-text query: comma-separated tokens; a leading dot matches by extension.
    const tokens = filterText.toLowerCase().split(',').map((t) => t.trim()).filter(Boolean)
    if (tokens.length) {
      filtered = filtered.filter((e) => {
        const name = e.name.toLowerCase()
        const ext = extOf(e.name)
        return tokens.some((t) => (t.startsWith('.') ? ext === t.slice(1) : name.includes(t) || ext === t))
      })
    }
    // Search results arrive ranked by relevance — keep that order; only the
    // normal listing is re-sorted by the chosen field.
    return searching ? filtered : [...filtered].sort((a, b) => compareEntries(a, b, sortBy, sortDir))
  }, [listing, searching, searchResults, showHidden, sortBy, sortDir, filterKinds, filterText])
  entriesRef.current = entries
  // Which file kinds actually appear in this folder — so the filter only
  // offers chips that would do something.
  const kindsPresent = useMemo(() => {
    const set = new Set()
    for (const e of listing?.entries ?? []) if (e.type !== 'dir') set.add(fileKind(e))
    return set
  }, [listing])
  const filterActive = filterKinds.length > 0 || filterText.trim().length > 0
  const favSet = useMemo(() => new Set(favorites.map((f) => f.path)), [favorites])
  const activeTag = activeTagId ? tags.find((t) => t.id === activeTagId) : null

  const summary = useMemo(() => {
    let selectedSize = 0
    for (const e of entries) if (selected.has(e.path) && e.type === 'file') selectedSize += e.size
    return { items: entries.length, selectedCount: selected.size, selectedSize }
  }, [entries, selected])
  const tagTree = useMemo(() => buildTagTree(tags), [tags])

  // Stable path -> Tag[] map so memoized rows only re-render when tags change.
  const tagsByPath = useMemo(() => {
    const byId = new Map(tags.map((t) => [t.id, t]))
    const map = new Map()
    for (const [p, ids] of Object.entries(assignments)) {
      const list = ids.map((id) => byId.get(id)).filter(Boolean)
      if (list.length) map.set(p, list)
    }
    return map
  }, [tags, assignments])

  const run = useCallback(
    async (fn) => {
      try {
        await fn()
        await (activeTagId ? loadTag(activeTagId, { silent: true }) : load(path, { silent: true }))
      } catch (e) {
        setError(e.message)
      }
    },
    [load, loadTag, path, activeTagId],
  )

  // Keep the tag view fresh when assignments change (e.g. untagging from here).
  useEffect(() => {
    if (activeTagId) loadTag(activeTagId, { silent: true })
  }, [assignments, activeTagId, loadTag])

  const uploadAll = useCallback(
    (fileList) =>
      run(async () => {
        await Promise.all(Array.from(fileList || []).map((f) => api.upload(path, f)))
        resetRef.current?.()
      }),
    [run, path],
  )

  const commitRename = useCallback(
    (entry, value) => {
      setEditingPath(null)
      const name = value.trim()
      if (!name || name === entry.name) return
      run(() => api.rename(entry.path, name))
    },
    [run],
  )

  const commitCreate = useCallback(
    (value) => {
      const type = creating
      setCreating(null)
      const name = value.trim()
      if (!name) return
      run(() => (type === 'file' ? api.createFile(path, name) : api.createFolder(path, name)))
    },
    [run, path, creating],
  )

  // Paste the clipboard into a destination directory (move on cut, copy on copy).
  const paste = useCallback(
    (destDir) =>
      run(async () => {
        if (!clipItems.length) return
        if (clipMode === 'cut') {
          await api.move(clipItems, destDir)
          clearClipboard()
        } else {
          await api.copy(clipItems, destDir)
        }
      }),
    [run, clipItems, clipMode, clearClipboard],
  )

  const togglePin = useCallback(
    (entry) =>
      run(async () => {
        if (favSet.has(entry.path)) await api.favorites.remove(entry.path)
        else await api.favorites.add(entry.path)
        await loadFavorites()
      }),
    [run, favSet, loadFavorites],
  )

  const unpin = useCallback(
    (favPath) =>
      run(async () => {
        await api.favorites.remove(favPath)
        await loadFavorites()
      }),
    [run, loadFavorites],
  )

  // Copy file path(s) to the clipboard — the absolute on-disk path under
  // Electron, falling back to the root-relative path in a plain browser.
  const copyPath = useCallback(async (paths) => {
    let text = paths.join('\n')
    if (window.native?.resolvePath) {
      const abs = await Promise.all(paths.map((p) => window.native.resolvePath(p)))
      const resolved = abs.filter(Boolean)
      if (resolved.length) text = resolved.join('\n')
    }
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      setError('Could not copy to clipboard')
    }
  }, [])

  // Build the right-click action list for an entry. Acts on the whole selection
  // when right-clicking a selected item (and more than one is selected).
  const buildMenuItems = useCallback((entry) => {
    const isDir = entry.type === 'dir'
    const targets = selected.has(entry.path) && selected.size > 1 ? [...selected] : [entry.path]
    const many = targets.length > 1
    const items = []

    if (!many) {
      items.push(
        isDir
          ? { label: 'Open', icon: IconFolderOpen, onClick: () => load(entry.path) }
          : { label: 'Open', icon: IconEye, onClick: () => openPreview(entry) },
      )
      if (window.native) {
        items.push({ label: 'Open with default app', icon: IconExternalLink, onClick: () => window.native.openPath(entry.path) })
        items.push({ label: 'Reveal in file manager', icon: IconFolderOpen, onClick: () => window.native.showInFolder(entry.path) })
      }
      // In a tag view the entries span folders, so offer a jump to the file's
      // actual location (navigating clears the tag filter).
      if (activeTagId) {
        const parentDir = entry.path.includes('/') ? entry.path.slice(0, entry.path.lastIndexOf('/')) : ''
        items.push({ label: 'Go to location', icon: IconFolder, onClick: () => load(parentDir) })
      }
      items.push({ divider: true })
    }

    // Background play queue (audio targets only).
    const audioTargets = targets.filter((p) => EXT.audio.includes(p.split('.').pop()?.toLowerCase() ?? ''))
    if (audioTargets.length) {
      const songs = audioTargets.map((p) => ({ path: p, name: p.split('/').pop() }))
      items.push({
        label: audioTargets.length > 1 ? `Add ${audioTargets.length} to queue` : 'Add to queue',
        icon: IconPlaylistAdd,
        onClick: () => enqueue(songs),
      })
      items.push({ divider: true })
    }

    // Clipboard ops (work on the whole target set).
    items.push({ label: many ? `Cut ${targets.length} items` : 'Cut', icon: IconScissors, onClick: () => setClipboard(targets, 'cut') })
    items.push({ label: many ? `Copy ${targets.length} items` : 'Copy', icon: IconCopy, onClick: () => setClipboard(targets, 'copy') })
    if (isDir && clipItems.length) {
      items.push({ label: `Paste (${clipItems.length})`, icon: IconClipboard, onClick: () => paste(entry.path) })
    }
    if (!many) items.push({ label: 'Duplicate', icon: IconCopyPlus, onClick: () => run(() => api.duplicate(entry.path)) })
    items.push({ label: many ? 'Copy paths' : 'Copy path', icon: IconClipboardCopy, onClick: () => copyPath(targets) })

    items.push({ divider: true })

    if (!many) {
      if (isDir) {
        const pinned = favSet.has(entry.path)
        items.push({ label: pinned ? 'Unpin' : 'Pin', icon: pinned ? IconStarFilled : IconStar, onClick: () => togglePin(entry) })
      } else {
        items.push({ label: 'Download', icon: IconDownload, onClick: () => api.download(entry).catch((err) => setError(err.message)) })
      }
      items.push({ label: 'Rename', icon: IconPencil, onClick: () => setEditingPath(entry.path) })

      // Convert image/video to another format (writes a new file alongside).
      const convertFmts = CONVERT_FORMATS[fileKind(entry)]
      if (convertFmts) {
        const cur = entry.name.split('.').pop()?.toLowerCase()
        const submenu = convertFmts
          .filter(({ fmt }) => !(fmt === cur || (fmt === 'jpg' && cur === 'jpeg')))
          .map(({ fmt, label }) => ({
            label,
            icon: IconPhoto,
            onClick: () => startConvert(entry.path, fmt),
          }))
        if (submenu.length) {
          items.push({ divider: true })
          items.push({ label: 'Convert to', icon: IconPhoto, submenu })
        }
      }

      // Pull a video's soundtrack out into a standalone audio file.
      if (fileKind(entry) === 'video') {
        const audioSub = AUDIO_EXTRACT.map(({ fmt, label }) => ({
          label,
          icon: IconMusic,
          onClick: () => startConvert(entry.path, fmt),
        }))
        items.push({ label: 'Extract audio', icon: IconMusic, submenu: audioSub })
      }

      // Narrow the current listing to entries sharing this file's extension.
      if (!isDir) {
        const ext = extOf(entry.name)
        if (ext) {
          items.push({ divider: true })
          items.push({
            label: `Filter by .${ext} files`,
            icon: IconFilter,
            onClick: () => setFilterText(`.${ext}`),
          })
        }
      }

      // Tags: toggle each tag for this entry, plus a shortcut to the manager.
      items.push({ divider: true })
      const assigned = new Set(assignments[entry.path] || [])
      for (const tag of tags) {
        items.push({ label: tagTree.pathName(tag), dot: tag.color, checked: assigned.has(tag.id), onClick: () => toggleTag(entry.path, tag.id) })
      }
      items.push({ label: 'Manage tags…', icon: IconTags, onClick: openTagManager })
    }

    items.push({ divider: true })
    items.push({
      label: many ? `Delete ${targets.length} items` : 'Delete',
      icon: IconTrash,
      color: 'red',
      onClick: () => run(async () => { for (const p of targets) await api.remove(p) }),
    })
    return items
  }, [load, openPreview, favSet, togglePin, run, tags, assignments, toggleTag, openTagManager, tagTree, selected, clipItems, setClipboard, paste, startConvert, enqueue, copyPath, activeTagId, setFilterText])

  // Stable handler references so memoized rows don't re-render while scrolling.
  const handleOpen = useCallback((e) => load(e.path), [load])
  const handleOpenFile = useCallback(
    (e) => {
      // Pass siblings of the same kind so the preview can offer prev/next.
      const playlist = entries.filter((x) => fileKind(x) === fileKind(e))
      openPreview(e, playlist)
    },
    [openPreview, entries],
  )
  const handleCancelEdit = useCallback(() => setEditingPath(null), [])
  const handleContextMenu = useCallback(
    (e, ev) => {
      ev.preventDefault()
      openContextMenu(ev.clientX, ev.clientY, buildMenuItems(e))
    },
    [openContextMenu, buildMenuItems],
  )

  // --- Rubber-band (marquee) selection -------------------------------------
  // Because the list is virtualized, only the visible page is in the DOM. So we
  // hit-test the mounted rows each frame, but *persist* hits for rows that were
  // inside the box when they scrolled out — and auto-scroll while the cursor is
  // near an edge so a drag can sweep beyond the viewport.
  const applyMarquee = useCallback(() => {
    const d = dragRef.current
    const el = scrollRef.current
    if (!d || !el) return
    const box = el.getBoundingClientRect()
    const scrollTop = el.scrollTop

    // The selection box is anchored in *content* coordinates (drag-start point +
    // scroll), so auto-scrolling reveals more of the same box instead of moving
    // it — dragging back up correctly shrinks the box rather than dropping rows.
    const curX = d.curX - box.left
    const curY = d.curY - box.top + scrollTop
    const left = Math.min(d.anchorX, curX)
    const right = Math.max(d.anchorX, curX)
    const top = Math.min(d.anchorY, curY)
    const bottom = Math.max(d.anchorY, curY)

    for (const node of el.querySelectorAll('[data-path]')) {
      const r = node.getBoundingClientRect()
      const nx = r.left - box.left
      const ny = r.top - box.top + scrollTop
      const inside = nx < right && nx + r.width > left && ny < bottom && ny + r.height > top
      // Mounted rows are re-evaluated every frame (so deselect works); rows that
      // scroll out keep whatever membership they had (persisted in `hits`).
      if (inside) d.hits.add(node.dataset.path)
      else d.hits.delete(node.dataset.path)
    }
    setSelected(new Set([...d.base, ...d.hits]))

    // Draw the overlay in viewport coords, clamped to the visible area.
    const vTop = Math.max(top - scrollTop + box.top, box.top)
    const vBottom = Math.min(bottom - scrollTop + box.top, box.bottom)
    setMarquee({ left: left + box.left, top: vTop, width: right - left, height: Math.max(0, vBottom - vTop) })
  }, [])

  const onSelectMove = useCallback(
    (e) => {
      const d = dragRef.current
      if (!d) return
      // Pressing an already-selected item is a potential drag-move, not a
      // marquee — don't recompute (which would collapse the selection to it).
      if (d.selectedAtDown) return
      if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 5) return
      d.moved = true
      d.curX = e.clientX
      d.curY = e.clientY

      // Auto-scroll velocity from proximity to the viewport's top/bottom edge.
      const box = scrollRef.current?.getBoundingClientRect()
      const ZONE = 48
      let v = 0
      if (box) {
        if (e.clientY < box.top + ZONE) v = -Math.ceil((box.top + ZONE - e.clientY) / 4)
        else if (e.clientY > box.bottom - ZONE) v = Math.ceil((e.clientY - (box.bottom - ZONE)) / 4)
      }
      d.vel = Math.max(-28, Math.min(28, v))
      applyMarquee()
    },
    [applyMarquee],
  )

  const onSelectUp = useCallback(() => {
    const d = dragRef.current
    window.removeEventListener('mousemove', onSelectMove)
    window.removeEventListener('mouseup', onSelectUp)
    if (d?.raf) cancelAnimationFrame(d.raf)
    setMarquee(null)
    if (d && !d.moved) {
      if (d.downPath && d.shift && anchorRef.current) {
        // Shift-click: select the whole range from the anchor — works across the
        // virtualized list since it indexes the entries array, not the DOM.
        const list = entriesRef.current
        const a = list.findIndex((e) => e.path === anchorRef.current)
        const b = list.findIndex((e) => e.path === d.downPath)
        if (a >= 0 && b >= 0) {
          const [lo, hi] = a < b ? [a, b] : [b, a]
          setSelected((prev) => {
            const n = new Set(d.additive ? prev : [])
            for (let i = lo; i <= hi; i++) n.add(list[i].path)
            return n
          })
        }
      } else if (d.downPath) {
        // Plain click: select the item (toggle with ctrl/meta) and set the anchor.
        anchorRef.current = d.downPath
        setSelected((prev) => {
          if (!d.additive) return new Set([d.downPath])
          const n = new Set(prev)
          n.has(d.downPath) ? n.delete(d.downPath) : n.add(d.downPath)
          return n
        })
      } else if (!d.additive) {
        setSelected(new Set())
        anchorRef.current = null
      }
    }
    dragRef.current = null
  }, [onSelectMove])

  const onSelectDown = useCallback(
    (e) => {
      if (e.button !== 0) return
      // Ignore clicks on the native scrollbar gutter — otherwise dragging the
      // scrollbar starts a marquee and wipes the current selection.
      const el = e.currentTarget
      if (e.clientX >= el.getBoundingClientRect().left + el.clientWidth) return
      if (e.clientY >= el.getBoundingClientRect().top + el.clientHeight) return
      if (e.target.closest('button, input, a, [role="slider"], [contenteditable="true"]')) return
      const additive = e.ctrlKey || e.metaKey
      const box = el.getBoundingClientRect()
      const d = {
        startX: e.clientX,
        startY: e.clientY,
        curX: e.clientX,
        curY: e.clientY,
        anchorX: e.clientX - box.left, // drag origin in content coordinates
        anchorY: e.clientY - box.top + el.scrollTop,
        downPath: e.target.closest('[data-path]')?.dataset.path ?? null,
        selectedAtDown: false, // set below once downPath is known
        additive,
        shift: e.shiftKey,
        base: additive ? new Set(selected) : new Set(),
        hits: new Set(), // rows that were inside the box, even after scrolling out
        moved: false,
        vel: 0,
        raf: 0,
      }
      d.selectedAtDown = !!(d.downPath && selected.has(d.downPath))
      // Continuous loop so the list keeps auto-scrolling (and selecting newly
      // revealed rows) even when the cursor is held still at an edge.
      const tick = () => {
        if (!dragRef.current) return
        if (dragRef.current.vel && scrollRef.current) {
          scrollRef.current.scrollTop += dragRef.current.vel
          applyMarquee()
        }
        dragRef.current.raf = requestAnimationFrame(tick)
      }
      dragRef.current = d
      d.raf = requestAnimationFrame(tick)
      window.addEventListener('mousemove', onSelectMove)
      window.addEventListener('mouseup', onSelectUp)
    },
    [selected, onSelectMove, onSelectUp, applyMarquee],
  )

  // --- Drag entries to move them into a folder ------------------------------
  // Starting a native drag also tears down any marquee the mousedown began, so
  // its listeners/rAF don't dangle (drag suppresses mousemove/mouseup).
  const handleDragStart = useCallback(
    (entry, e) => {
      const d = dragRef.current
      if (d?.raf) cancelAnimationFrame(d.raf)
      window.removeEventListener('mousemove', onSelectMove)
      window.removeEventListener('mouseup', onSelectUp)
      dragRef.current = null
      setMarquee(null)

      // Drag the whole selection if the grabbed item is part of it, else just it.
      let paths
      if (selected.has(entry.path) && selected.size > 0) {
        paths = [...selected]
      } else {
        paths = [entry.path]
        setSelected(new Set([entry.path]))
      }
      dragItemsRef.current = paths
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', paths.join('\n'))
    },
    [selected, onSelectMove, onSelectUp],
  )

  // Move the dragged items into `destDir`, skipping no-ops (an item dropped on
  // itself or into the folder it already lives in).
  const moveInto = useCallback(
    (destDir) => {
      const items = dragItemsRef.current
      dragItemsRef.current = []
      setDropTarget(null)
      const targets = items.filter((p) => {
        if (p === destDir) return false
        const parent = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : ''
        return parent !== destDir
      })
      if (!targets.length) return
      run(async () => {
        await api.move(targets, destDir)
        setSelected(new Set())
      })
    },
    [run],
  )

  // Props shared by every view mode (key is passed explicitly at the call site).
  const entryProps = (entry) => ({
    entry,
    editing: editingPath === entry.path,
    pinned: favSet.has(entry.path),
    selected: selected.has(entry.path),
    zoom,
    tags: tagsByPath.get(entry.path) ?? EMPTY_TAGS,
    onOpen: handleOpen,
    onOpenFile: handleOpenFile,
    onStartEdit: setEditingPath,
    onCommitEdit: commitRename,
    onCancelEdit: handleCancelEdit,
    onTogglePin: togglePin,
    onContextMenu: handleContextMenu,
    onDragStart: handleDragStart,
    onDropInto: moveInto,
    onDropOver: setDropTarget,
    dropActive: dropTarget === entry.path,
  })

  // Renders one entry for the virtualizer, picking row vs. tile by view mode.
  const renderEntry = (entry) =>
    mode === 'grid' ? (
      <EntryTile key={entry.path} {...entryProps(entry)} />
    ) : (
      <EntryRow key={entry.path} compact={mode === 'compact'} {...entryProps(entry)} />
    )

  const createInput = (
    <TextInput
      size="xs"
      placeholder={creating === 'file' ? 'File name' : 'Folder name'}
      autoFocus
      style={{ width: '100%' }}
      onBlur={(e) => commitCreate(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commitCreate(e.currentTarget.value)
        if (e.key === 'Escape') setCreating(null)
      }}
    />
  )

  const emptyState = (
    <Center h={220}>
      <Group gap={8} c="dimmed">
        <IconUpload size={18} />
        <Text size="sm">Empty — drop files here or use upload</Text>
      </Group>
    </Center>
  )

  return (
    <Flex h="100vh">
      {/* Sidebar */}
      <Flex direction="column" w={210} p={8}
        style={{ borderRight: '1px solid var(--mantine-color-default-border)', flexShrink: 0 }}>
        <Box style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <SidebarLabel first>Places</SidebarLabel>
          <SidebarItem icon={IconHome} label="Home" active={path === ''} onClick={() => load('')} dropPath="" onDropInto={moveInto} />
          {places.map((p) => (
            <SidebarItem
              key={p.name}
              icon={p.icon}
              label={p.name}
              active={path === p.name}
              onClick={() => load(p.name)}
              dropPath={p.name}
              onDropInto={moveInto}
            />
          ))}
          {favorites.length > 0 && <SidebarLabel>Favorites</SidebarLabel>}
          {favorites.map((fav) => (
            <SidebarItem
              key={fav.path}
              icon={IconFolder}
              label={fav.name}
              active={path === fav.path}
              onClick={() => load(fav.path)}
              onUnpin={() => unpin(fav.path)}
              dropPath={fav.path}
              onDropInto={moveInto}
            />
          ))}
          {tags.length > 0 && <SidebarLabel>Tags</SidebarLabel>}
          <SidebarTagTree tags={tags} activeTagId={activeTagId} onSelect={loadTag} />
        </Box>
        <NowPlaying />
        <SidebarItem
          icon={IconPlaylist}
          label={queueLen ? `Playlist (${queueLen})` : 'Playlist'}
          onClick={toggleQueueOpen}
        />
        <SidebarItem icon={IconTags} label="Tags" onClick={() => openTagManager()} />
        <SidebarItem icon={IconSettings} label="Settings" onClick={() => openSettings()} />
      </Flex>

      {/* Main */}
      <Flex
        ref={contentRef}
        direction="column"
        style={{ flex: 1, minWidth: 0, outline: dragOver ? '2px dashed var(--mantine-color-blue-5)' : 'none', outlineOffset: -8 }}
        onDragOver={(e) => { e.preventDefault(); if (e.dataTransfer.types.includes('Files')) setDragOver(true) }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false) }}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!activeTagId && e.dataTransfer.files.length) uploadAll(e.dataTransfer.files) }}
      >
        <Flex align="center" justify="space-between" gap="sm" px="md" h={52}
          style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
          <Group gap={4} wrap="nowrap" style={{ minWidth: 0 }}>
            <Tooltip label="Up" openDelay={400}>
              <ActionIcon variant="subtle" color="gray" disabled={!path || !!activeTagId}
                onClick={() => listing?.parent != null && load(listing.parent)}>
                <IconArrowUp size={18} />
              </ActionIcon>
            </Tooltip>
            {activeTagId ? (
              <Group gap={6} wrap="nowrap">
                <ActionIcon variant="subtle" color="gray" onClick={() => load('')}>
                  <IconHome size={16} />
                </ActionIcon>
                <IconChevronRight size={14} color="var(--mantine-color-dimmed)" />
                {activeTag && <ColorSwatch color={activeTag.color} size={12} />}
                <Text size="sm" fw={600} truncate>
                  {activeTag?.name ?? 'Tag'}
                </Text>
              </Group>
            ) : (
              <Breadcrumbs path={path} onNavigate={load} />
            )}
          </Group>
          <Group gap={8} wrap="nowrap">
            <TextInput
              size="xs"
              w={180}
              placeholder={activeTagId ? 'Search (open a folder)' : 'Search this folder'}
              disabled={!!activeTagId}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              leftSection={searching && searchResults === null ? <Loader size={13} /> : <IconSearch size={14} />}
              rightSection={
                search ? (
                  <ActionIcon variant="subtle" color="gray" size="xs" onClick={() => setSearch('')}>
                    <IconX size={13} />
                  </ActionIcon>
                ) : null
              }
            />
            <Menu shadow="md" width={190} position="bottom-end">
              <Menu.Target>
                <Tooltip label="Sort" openDelay={400}>
                  <ActionIcon variant="subtle" color="gray">
                    <IconArrowsSort size={18} />
                  </ActionIcon>
                </Tooltip>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Sort by</Menu.Label>
                {SORTS.map((s) => (
                  <Menu.Item
                    key={s.value}
                    onClick={() => setSort(s.value)}
                    rightSection={
                      sortBy === s.value ? (
                        sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />
                      ) : null
                    }
                  >
                    {s.label}
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
            <Popover width={260} position="bottom-end" shadow="md" trapFocus>
              <Popover.Target>
                <Tooltip label="Filter" openDelay={400}>
                  <ActionIcon variant={filterActive ? 'light' : 'subtle'} color={filterActive ? 'blue' : 'gray'}>
                    <IconFilter size={18} />
                  </ActionIcon>
                </Tooltip>
              </Popover.Target>
              <Popover.Dropdown p="sm">
                <Group justify="space-between" mb={8}>
                  <Text size="xs" fw={600} c="dimmed">Filter</Text>
                  {filterActive && (
                    <UnstyledButton onClick={clearFilter}>
                      <Group gap={2}>
                        <IconX size={12} color="var(--mantine-color-dimmed)" />
                        <Text size="xs" c="dimmed">Clear</Text>
                      </Group>
                    </UnstyledButton>
                  )}
                </Group>
                <TextInput
                  size="xs"
                  placeholder="Name or extension (comma-separated)"
                  value={filterText}
                  onChange={(e) => setFilterText(e.currentTarget.value)}
                  leftSection={<IconFilter size={13} />}
                  rightSection={
                    filterText ? (
                      <ActionIcon variant="subtle" color="gray" size="xs" onClick={() => setFilterText('')}>
                        <IconX size={13} />
                      </ActionIcon>
                    ) : null
                  }
                  mb="sm"
                />
                <Chip.Group multiple value={filterKinds} onChange={() => {}}>
                  <Group gap={6}>
                    {KIND_FILTERS.filter((k) => kindsPresent.has(k.value)).map(({ value, label, Icon }) => (
                      <Chip
                        key={value}
                        size="xs"
                        checked={filterKinds.includes(value)}
                        onChange={() => toggleFilterKind(value)}
                        icon={<Icon size={12} />}
                      >
                        {label}
                      </Chip>
                    ))}
                  </Group>
                </Chip.Group>
                {kindsPresent.size === 0 && (
                  <Text size="xs" c="dimmed">No files to filter here.</Text>
                )}
              </Popover.Dropdown>
            </Popover>
            <SegmentedControl
              size="xs"
              value={mode}
              onChange={setMode}
              data={[
                {
                  value: 'list',
                  label: (
                    <Tooltip label="List" openDelay={400}>
                      <Center><IconLayoutList size={15} /></Center>
                    </Tooltip>
                  ),
                },
                {
                  value: 'compact',
                  label: (
                    <Tooltip label="Compact" openDelay={400}>
                      <Center><IconLayoutRows size={15} /></Center>
                    </Tooltip>
                  ),
                },
                {
                  value: 'grid',
                  label: (
                    <Tooltip label="Grid" openDelay={400}>
                      <Center><IconLayoutGrid size={15} /></Center>
                    </Tooltip>
                  ),
                },
              ]}
            />
            <Tooltip label={showHidden ? 'Hide dot files' : 'Show dot files'} openDelay={400}>
              <ActionIcon
                variant={showHidden ? 'light' : 'subtle'}
                color="gray"
                onClick={toggleHidden}
              >
                {showHidden ? <IconEye size={18} /> : <IconEyeOff size={18} />}
              </ActionIcon>
            </Tooltip>
            <Menu shadow="md" width={190} position="bottom-end">
              <Menu.Target>
                <Tooltip label="New / Paste" openDelay={400}>
                  <ActionIcon variant="subtle" color="gray" disabled={!!activeTagId}>
                    <IconPlus size={18} />
                  </ActionIcon>
                </Tooltip>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<IconFolderPlus size={16} />} onClick={() => setCreating('folder')}>
                  New folder
                </Menu.Item>
                <Menu.Item leftSection={<IconFilePlus size={16} />} onClick={() => setCreating('file')}>
                  New file
                </Menu.Item>
                {clipItems.length > 0 && (
                  <Menu.Item leftSection={<IconClipboard size={16} />} onClick={() => paste(path)}>
                    Paste ({clipItems.length})
                  </Menu.Item>
                )}
              </Menu.Dropdown>
            </Menu>
            <Tooltip label="Refresh" openDelay={400}>
              <ActionIcon variant="subtle" color="gray"
                onClick={() => (activeTagId ? loadTag(activeTagId, { silent: true }) : load(path, { silent: true }))}>
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            <FileButton resetRef={resetRef} onChange={uploadAll} multiple disabled={!!activeTagId}>
              {(props) => (
                <Tooltip label="Upload" openDelay={400}>
                  <ActionIcon {...props} variant="light" disabled={!!activeTagId}>
                    <IconUpload size={18} />
                  </ActionIcon>
                </Tooltip>
              )}
            </FileButton>
          </Group>
        </Flex>

        {error && (
          <Text size="xs" c="red" px="md" py={6} onClick={() => setError(null)} style={{ cursor: 'pointer' }}>
            {error}
          </Text>
        )}

        {/* New-folder input as a bar above the list, so the scroll viewport
            holds only the virtualized items (keeps windowing offsets simple). */}
        {creating && (
          <Flex align="center" gap="sm" px="md" py={7}
            style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
            <ThemeIcon variant="light" color={creating === 'file' ? 'gray' : 'yellow'} size={32} radius="md">
              {creating === 'file' ? <IconFile size={18} /> : <IconFolder size={18} />}
            </ThemeIcon>
            {createInput}
          </Flex>
        )}

        {/* 30px side gutters: empty space that belongs to the scroll viewport,
            so users have room to start a marquee drag without grabbing a row. */}
        <Box ref={scrollRef} onMouseDown={onSelectDown}
          style={{ flex: 1, minHeight: 0, overflowY: 'auto', userSelect: 'none', paddingInline: 30 }}>
          {loading || (searching && searchResults === null) ? (
            <Center h={240}><Loader size="sm" /></Center>
          ) : entries.length === 0 ? (
            searching ? (
              <Center h={220}>
                <Text size="sm" c="dimmed">No matches for “{search.trim()}”</Text>
              </Center>
            ) : (
              !creating && emptyState
            )
          ) : (
            <VirtualEntries
              key={searching ? `search:${search.trim()}` : activeTagId ? `tag:${activeTagId}` : `dir:${path}`}
              entries={entries}
              mode={mode}
              zoom={zoom}
              scrollRef={scrollRef}
              renderEntry={renderEntry}
              tagsByPath={tagsByPath}
            />
          )}
        </Box>

        <StatusBar summary={summary} usage={usage} />
      </Flex>

      {marquee && (
        <Box
          style={{
            position: 'fixed',
            left: marquee.left,
            top: marquee.top,
            width: marquee.width,
            height: marquee.height,
            background: 'var(--mantine-primary-color-light)',
            border: '1px solid var(--mantine-primary-color-filled)',
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        />
      )}
    </Flex>
  )
}
