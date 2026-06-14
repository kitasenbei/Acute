import { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react'
import {
  Box,
  Center,
  Divider,
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
  IconDeviceDesktop,
  IconFiles,
  IconFile,
  IconPhoto,
  IconFileTypePdf,
  IconFileText,
  IconFileZip,
  IconMusic,
  IconMovie,
  IconCode,
  IconPlayerPlayFilled,
  IconLayoutList,
  IconLayoutRows,
  IconLayoutGrid,
} from '@tabler/icons-react'
import { api } from './api.js'
import { formatBytes, formatDate } from './util.js'
import { EXT, fileKind } from './fileTypes.js'
import { useSettingsStore } from './stores/settingsStore.js'
import { useViewStore } from './stores/viewStore.js'
import { usePreviewStore } from './stores/previewStore.js'
import { useContextMenuStore } from './stores/contextMenuStore.js'
import { useClipboardStore } from './stores/clipboardStore.js'
import { useTagsStore, buildTagTree } from './stores/tagsStore.js'
import { VirtualEntries } from './components/VirtualEntries.jsx'
import { TagChips } from './components/TagManagerModal.jsx'
import { SidebarTagTree } from './components/SidebarTagTree.jsx'

// Shared empty array keeps untagged rows' `tags` prop referentially stable.
const EMPTY_TAGS = []

const SORTS = [
  { value: 'name', label: 'Name' },
  { value: 'modified', label: 'Date modified' },
  { value: 'size', label: 'Size' },
]

// Formats offered in the right-click "Convert to" submenu, by file kind.
const CONVERT_FORMATS = {
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

// Sort entries with folders always first, then by the chosen field/direction.
function compareEntries(a, b, field, dir) {
  if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
  let r = 0
  if (field === 'modified') r = new Date(a.modifiedAt) - new Date(b.modifiedAt)
  else if (field === 'size') r = a.size - b.size
  if (r === 0) r = a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
  return dir === 'desc' ? -r : r
}

// Standard home subfolders a file explorer surfaces for quick access. Only the
// ones that actually exist under the root are shown.
const PLACES = [
  { name: 'Desktop', icon: IconDeviceDesktop },
  { name: 'Documents', icon: IconFiles },
  { name: 'Downloads', icon: IconDownload },
  { name: 'Pictures', icon: IconPhoto },
  { name: 'Music', icon: IconMusic },
  { name: 'Videos', icon: IconMovie },
]

function iconForEntry(entry) {
  if (entry.type === 'dir') return { Icon: IconFolder, color: 'yellow' }
  const ext = entry.name.split('.').pop()?.toLowerCase() ?? ''
  if (EXT.image.includes(ext)) return { Icon: IconPhoto, color: 'grape' }
  if (EXT.pdf.includes(ext)) return { Icon: IconFileTypePdf, color: 'red' }
  if (EXT.audio.includes(ext)) return { Icon: IconMusic, color: 'teal' }
  if (EXT.video.includes(ext)) return { Icon: IconMovie, color: 'indigo' }
  if (EXT.archive.includes(ext)) return { Icon: IconFileZip, color: 'orange' }
  if (EXT.code.includes(ext)) return { Icon: IconCode, color: 'blue' }
  if (EXT.text.includes(ext)) return { Icon: IconFileText, color: 'gray' }
  return { Icon: IconFile, color: 'gray' }
}

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
function Thumb({ entry, size, iconSize }) {
  const { Icon, color } = iconForEntry(entry)
  const [failed, setFailed] = useState(false)
  const kind = fileKind(entry)
  const hasThumb = kind === 'image' || kind === 'video'

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
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
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

  return (
    <ThemeIcon variant="light" color={color} size={size} radius="md">
      <Icon size={iconSize} />
    </ThemeIcon>
  )
}

function Breadcrumbs({ path, onNavigate }) {
  const segments = path ? path.split('/') : []
  return (
    <Group gap={4} wrap="nowrap" style={{ overflow: 'hidden' }}>
      <ActionIcon variant="subtle" color="gray" onClick={() => onNavigate('')}>
        <IconHome size={16} />
      </ActionIcon>
      {segments.map((seg, i) => {
        const target = segments.slice(0, i + 1).join('/')
        const last = i === segments.length - 1
        return (
          <Group gap={4} key={target} wrap="nowrap">
            <IconChevronRight size={14} color="var(--mantine-color-dimmed)" />
            <UnstyledButton onClick={() => !last && onNavigate(target)}>
              <Text size="sm" c={last ? undefined : 'dimmed'} fw={last ? 600 : 400} truncate>
                {seg}
              </Text>
            </UnstyledButton>
          </Group>
        )
      })}
    </Group>
  )
}

/** Inline name editor reused by every view mode. */
function NameField({ entry, onCommit, onCancel }) {
  return (
    <TextInput
      size="xs"
      defaultValue={entry.name}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      onClick={(e) => e.stopPropagation()}
      onBlur={(e) => onCommit(entry, e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit(entry, e.currentTarget.value)
        if (e.key === 'Escape') onCancel()
      }}
    />
  )
}

const EntryRow = memo(function EntryRow({ entry, editing, pinned, compact, zoom = 1, selected, tags, onOpen, onOpenFile, onStartEdit, onCommitEdit, onCancelEdit,
  onTogglePin, onContextMenu }) {
  const [hover, setHover] = useState(false)
  const isDir = entry.type === 'dir'
  const base = compact ? 24 : 32
  const thumbSize = Math.round(base * zoom)
  const thumbIcon = Math.round((compact ? 14 : 18) * zoom)

  return (
    <Flex
      data-path={entry.path}
      align="center"
      gap="sm"
      px="md"
      py={compact ? 3 : 7}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onDoubleClick={() => (isDir ? onOpen(entry) : onOpenFile(entry))}
      onContextMenu={(e) => onContextMenu(entry, e)}
      style={{
        borderRadius: 8,
        cursor: 'default',
        background: selected
          ? 'var(--mantine-primary-color-light)'
          : hover
            ? 'var(--mantine-color-default-hover)'
            : 'transparent',
      }}
    >
      <Thumb entry={entry} size={thumbSize} iconSize={thumbIcon} />

      <Box style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <NameField entry={entry} onCommit={onCommitEdit} onCancel={onCancelEdit} />
        ) : (
          <Text size="sm" truncate>
            {entry.name}
          </Text>
        )}
      </Box>

      <TagChips tags={tags} />

      <Text size="xs" c="dimmed" w={70} ta="right">
        {isDir ? '' : formatBytes(entry.size)}
      </Text>
      {!compact && (
        <Text size="xs" c="dimmed" w={100} ta="right" visibleFrom="sm">
          {formatDate(entry.modifiedAt)}
        </Text>
      )}

      {/* Actions mount only on hover — keeps non-hovered (and scrolling) rows light. */}
      <Group gap={2} w={118} justify="flex-end">
        {hover &&
          (isDir ? (
            <Tooltip label={pinned ? 'Unpin' : 'Pin'} openDelay={400}>
              <ActionIcon variant="subtle" color={pinned ? 'yellow' : 'gray'} onClick={() => onTogglePin(entry)}>
                {pinned ? <IconStarFilled size={15} /> : <IconStar size={15} />}
              </ActionIcon>
            </Tooltip>
          ) : (
            <Tooltip label="Open" openDelay={400}>
              <ActionIcon variant="subtle" color="gray" onClick={() => onOpenFile(entry)}>
                <IconEye size={16} />
              </ActionIcon>
            </Tooltip>
          ))}
        {hover && (
          <Tooltip label="Rename" openDelay={400}>
            <ActionIcon variant="subtle" color="gray" onClick={() => onStartEdit(entry.path)}>
              <IconPencil size={16} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
    </Flex>
  )
})

const EntryTile = memo(function EntryTile({ entry, editing, pinned, zoom = 1, selected, tags, onOpen, onOpenFile, onStartEdit, onCommitEdit, onCancelEdit,
  onTogglePin, onContextMenu }) {
  const [hover, setHover] = useState(false)
  const isDir = entry.type === 'dir'
  const thumbSize = Math.round(64 * zoom)

  return (
    <Flex
      data-path={entry.path}
      direction="column"
      align="center"
      gap={8}
      p="sm"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onDoubleClick={() => (isDir ? onOpen(entry) : onOpenFile(entry))}
      onContextMenu={(e) => onContextMenu(entry, e)}
      style={{
        position: 'relative',
        borderRadius: 10,
        cursor: 'default',
        background: selected
          ? 'var(--mantine-primary-color-light)'
          : hover
            ? 'var(--mantine-color-default-hover)'
            : 'transparent',
      }}
    >
      {hover && (
        <Group gap={2} style={{ position: 'absolute', top: 4, right: 4 }}>
          {isDir ? (
            <ActionIcon variant="subtle" color={pinned ? 'yellow' : 'gray'} size="sm" onClick={() => onTogglePin(entry)}>
              {pinned ? <IconStarFilled size={14} /> : <IconStar size={14} />}
            </ActionIcon>
          ) : (
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => onOpenFile(entry)}>
              <IconEye size={14} />
            </ActionIcon>
          )}
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => onStartEdit(entry.path)}>
            <IconPencil size={14} />
          </ActionIcon>
        </Group>
      )}

      <Thumb entry={entry} size={thumbSize} iconSize={Math.round(thumbSize / 2)} />

      <Box w="100%" style={{ textAlign: 'center' }}>
        {editing ? (
          <NameField entry={entry} onCommit={onCommitEdit} onCancel={onCancelEdit} />
        ) : (
          <Text size="xs" ta="center" lineClamp={2} title={entry.name}>
            {entry.name}
          </Text>
        )}
      </Box>
      {tags?.length > 0 && (
        <Group justify="center" style={{ maxWidth: '100%' }}>
          <TagChips tags={tags} max={2} />
        </Group>
      )}
    </Flex>
  )
})

function SidebarItem({ icon: Icon, dot, label, active, onClick, onUnpin }) {
  const [hover, setHover] = useState(false)
  return (
    <Flex
      align="center"
      gap="xs"
      px="sm"
      py={6}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        borderRadius: 8,
        cursor: 'pointer',
        background: active || hover ? 'var(--mantine-color-default-hover)' : 'transparent',
      }}
    >
      {dot ? (
        <ColorSwatch color={dot} size={11} style={{ marginLeft: 3, marginRight: 3 }} />
      ) : (
        <Icon size={17} color="var(--mantine-color-dimmed)" />
      )}
      <Text size="sm" truncate style={{ flex: 1 }}>
        {label}
      </Text>
      {onUnpin && hover && (
        <ActionIcon variant="subtle" color="gray" size="sm" onClick={(e) => { e.stopPropagation(); onUnpin() }}>
          <IconStarFilled size={13} />
        </ActionIcon>
      )}
    </Flex>
  )
}

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
  const [selected, setSelected] = useState(() => new Set())
  const [marquee, setMarquee] = useState(null) // viewport rect while drag-selecting
  const dragRef = useRef(null)
  const resetRef = useRef(null)
  const contentRef = useRef(null)
  const scrollRef = useRef(null)
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
  const openPreview = usePreviewStore((s) => s.open)
  const openContextMenu = useContextMenuStore((s) => s.open)
  const clipItems = useClipboardStore((s) => s.items)
  const clipMode = useClipboardStore((s) => s.mode)
  const setClipboard = useClipboardStore((s) => s.setClipboard)
  const clearClipboard = useClipboardStore((s) => s.clear)
  const tags = useTagsStore((s) => s.tags)
  const assignments = useTagsStore((s) => s.assignments)
  const loadTags = useTagsStore((s) => s.loadAll)
  const toggleTag = useTagsStore((s) => s.toggleAssign)
  const openTagManager = useTagsStore((s) => s.openManager)

  const load = useCallback(async (p, { silent } = {}) => {
    if (!silent) setLoading(true)
    try {
      setListing(await api.list(p))
      setPath(p)
      setActiveTagId(null) // navigating a directory clears any tag filter
      setSelected(new Set())
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

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

  useEffect(() => {
    ;(async () => {
      try {
        await api.waitUntilReady()
      } catch (e) {
        setError(e.message)
      }
      await Promise.all([load(''), loadFavorites(), loadPlaces(), loadTags()])
    })()
  }, [load, loadFavorites, loadPlaces, loadTags])

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

  const entries = useMemo(() => {
    const filtered = (listing?.entries ?? []).filter((e) => showHidden || !e.name.startsWith('.'))
    return [...filtered].sort((a, b) => compareEntries(a, b, sortBy, sortDir))
  }, [listing, showHidden, sortBy, sortDir])
  const favSet = useMemo(() => new Set(favorites.map((f) => f.path)), [favorites])
  const activeTag = activeTagId ? tags.find((t) => t.id === activeTagId) : null
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
      items.push({ divider: true })
    }

    // Clipboard ops (work on the whole target set).
    items.push({ label: many ? `Cut ${targets.length} items` : 'Cut', icon: IconScissors, onClick: () => setClipboard(targets, 'cut') })
    items.push({ label: many ? `Copy ${targets.length} items` : 'Copy', icon: IconCopy, onClick: () => setClipboard(targets, 'copy') })
    if (isDir && clipItems.length) {
      items.push({ label: `Paste (${clipItems.length})`, icon: IconClipboard, onClick: () => paste(entry.path) })
    }
    if (!many) items.push({ label: 'Duplicate', icon: IconCopyPlus, onClick: () => run(() => api.duplicate(entry.path)) })

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
            onClick: () => run(() => api.convert(entry.path, fmt)),
          }))
        if (submenu.length) {
          items.push({ divider: true })
          items.push({ label: 'Convert to', icon: IconPhoto, submenu })
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
  }, [load, openPreview, favSet, togglePin, run, tags, assignments, toggleTag, openTagManager, tagTree, selected, clipItems, setClipboard, paste])

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
  const onSelectMove = useCallback((e) => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (!d.moved && Math.hypot(dx, dy) < 5) return
    d.moved = true

    const left = Math.min(e.clientX, d.startX)
    const top = Math.min(e.clientY, d.startY)
    const width = Math.abs(dx)
    const height = Math.abs(dy)
    setMarquee({ left, top, width, height })

    // Select entries whose rendered rect intersects the marquee.
    const next = new Set(d.base)
    const nodes = scrollRef.current?.querySelectorAll('[data-path]') ?? []
    for (const node of nodes) {
      const r = node.getBoundingClientRect()
      if (r.left < left + width && r.right > left && r.top < top + height && r.bottom > top) {
        next.add(node.dataset.path)
      }
    }
    setSelected(next)
  }, [])

  const onSelectUp = useCallback(() => {
    const d = dragRef.current
    window.removeEventListener('mousemove', onSelectMove)
    window.removeEventListener('mouseup', onSelectUp)
    setMarquee(null)
    if (d && !d.moved) {
      // A plain click: select the clicked item, toggle with ctrl/meta, or clear.
      if (d.downPath) {
        setSelected((prev) => {
          if (!d.additive) return new Set([d.downPath])
          const n = new Set(prev)
          n.has(d.downPath) ? n.delete(d.downPath) : n.add(d.downPath)
          return n
        })
      } else if (!d.additive) {
        setSelected(new Set())
      }
    }
    dragRef.current = null
  }, [onSelectMove])

  const onSelectDown = useCallback(
    (e) => {
      if (e.button !== 0) return
      if (e.target.closest('button, input, a, [role="slider"], [contenteditable="true"]')) return
      const additive = e.ctrlKey || e.metaKey
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        downPath: e.target.closest('[data-path]')?.dataset.path ?? null,
        additive,
        base: additive ? new Set(selected) : new Set(),
        moved: false,
      }
      window.addEventListener('mousemove', onSelectMove)
      window.addEventListener('mouseup', onSelectUp)
    },
    [selected, onSelectMove, onSelectUp],
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
          <SidebarItem icon={IconHome} label="Home" active={path === ''} onClick={() => load('')} />
          {places.map((p) => (
            <SidebarItem
              key={p.name}
              icon={p.icon}
              label={p.name}
              active={path === p.name}
              onClick={() => load(p.name)}
            />
          ))}
          {favorites.length > 0 && <Divider my={6} />}
          {favorites.map((fav) => (
            <SidebarItem
              key={fav.path}
              icon={IconFolder}
              label={fav.name}
              active={path === fav.path}
              onClick={() => load(fav.path)}
              onUnpin={() => unpin(fav.path)}
            />
          ))}
          {tags.length > 0 && <Divider my={6} />}
          <SidebarTagTree tags={tags} activeTagId={activeTagId} onSelect={loadTag} />
        </Box>
        <SidebarItem icon={IconTags} label="Tags" onClick={() => openTagManager()} />
        <SidebarItem icon={IconSettings} label="Settings" onClick={() => openSettings()} />
      </Flex>

      {/* Main */}
      <Flex
        ref={contentRef}
        direction="column"
        style={{ flex: 1, minWidth: 0, outline: dragOver ? '2px dashed var(--mantine-color-blue-5)' : 'none', outlineOffset: -8 }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false) }}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!activeTagId) uploadAll(e.dataTransfer.files) }}
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

        <Box ref={scrollRef} onMouseDown={onSelectDown}
          style={{ flex: 1, minHeight: 0, overflowY: 'auto', userSelect: 'none' }}>
          {loading ? (
            <Center h={240}><Loader size="sm" /></Center>
          ) : entries.length === 0 ? (
            !creating && emptyState
          ) : (
            <VirtualEntries
              entries={entries}
              mode={mode}
              zoom={zoom}
              scrollRef={scrollRef}
              renderEntry={renderEntry}
            />
          )}
        </Box>
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
