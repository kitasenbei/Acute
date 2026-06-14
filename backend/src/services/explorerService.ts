import path from 'node:path'
import { NotFoundError, ValidationError } from '../errors.js'
import { PathResolver, assertValidName } from '../fs/pathResolver.js'
import { mimeFromName } from '../fs/mime.js'
import { scoreEntry } from './fuzzy.js'
import type { FileSystem } from '../fs/fileSystem.js'
import type { DirListing, Entry } from '../types.js'

export interface ExplorerDeps {
  fileSystem: FileSystem
  rootDir: string
}

// Directories the recursive search never descends into — heavy/generated trees
// that bury real results and slow the walk (dotfolders are skipped separately).
const SEARCH_SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  'target',
  'vendor',
  '__pycache__',
  '.git',
])

export interface FileContent {
  name: string
  mimeType: string
  content: Buffer
}

// A single indexed entry: enough to score (name + path-relative-to-root) and to
// stat lazily for the few that become results. No size/mtime stored.
interface IndexEntry {
  abs: string
  name: string
  isDir: boolean
  rel: string // path relative to the search root
}

/**
 * Business tier for filesystem browsing.
 *
 * Enforces confinement (via {@link PathResolver}) and the explorer's rules,
 * then delegates raw I/O to the {@link FileSystem} data tier. It speaks only
 * in root-relative paths so the presentation layer never sees absolute paths.
 */
export class ExplorerService {
  private readonly fs: FileSystem
  private readonly resolver: PathResolver

  // In-memory search index, keyed by the absolute search root. Each entry is the
  // cheap (name + isDir, no stat) shape collected by one walk; repeat searches
  // scan this in memory instead of touching the disk. Kept small (a few roots),
  // expired by TTL, and cleared whenever Acute mutates the filesystem.
  private readonly searchIndex = new Map<string, { entries: IndexEntry[]; builtAt: number }>()
  private static readonly INDEX_TTL = 30_000
  private static readonly INDEX_MAX_ROOTS = 6

  constructor({ fileSystem, rootDir }: ExplorerDeps) {
    this.fs = fileSystem
    this.resolver = new PathResolver(rootDir)
  }

  /** Drop cached search indexes — called after any filesystem mutation. */
  private invalidateSearchIndex(): void {
    this.searchIndex.clear()
  }

  /** Free/total bytes of the disk holding the browsing root. */
  diskUsage(): Promise<{ free: number; total: number }> {
    return this.fs.diskUsage(this.resolver.root)
  }

  async listDir(relPath = ''): Promise<DirListing> {
    const abs = this.resolver.toAbsolute(relPath)
    const stat = await this.statOrThrow(abs)
    if (!stat.isDirectory()) throw new ValidationError('Not a directory')

    const raw = await this.fs.list(abs)
    const entries: Entry[] = raw
      .map((e) => ({
        name: e.name,
        path: this.resolver.toRelative(e.abs),
        type: e.isDir ? ('dir' as const) : ('file' as const),
        size: e.size,
        modifiedAt: e.modifiedAt,
      }))
      .sort(byFolderThenName)

    return {
      path: this.resolver.toRelative(abs),
      parent: this.resolver.parentOf(this.resolver.toRelative(abs)),
      entries,
    }
  }

  /**
   * Recursively fuzzy-find entries under `relDir`, fff-style. The first search
   * under a root walks the tree once to build an in-memory index (cheap: no
   * per-entry stat); subsequent searches scan that index in memory — no disk —
   * until it expires or a mutation invalidates it. Matches are scored as
   * subsequences with boundary/consecutive bonuses and returned best-first;
   * `onMatch` streams the chosen results in rank order.
   */
  async search(
    relDir = '',
    query: string,
    onMatch?: (entry: Entry, score: number) => void,
    limit = 200,
  ): Promise<Entry[]> {
    if (!query.trim()) return []
    const rootAbs = this.resolver.toAbsolute(relDir)
    const stat = await this.statOrThrow(rootAbs)
    if (!stat.isDirectory()) throw new ValidationError('Not a directory')

    const entries = await this.getSearchIndex(rootAbs)
    return this.matchIndex(entries, query, onMatch, limit)
  }

  /** Reuse a fresh cached index for `rootAbs`, else build and cache one. */
  private async getSearchIndex(rootAbs: string): Promise<IndexEntry[]> {
    const cached = this.searchIndex.get(rootAbs)
    if (cached && Date.now() - cached.builtAt < ExplorerService.INDEX_TTL) return cached.entries

    const entries = await this.buildSearchIndex(rootAbs)
    this.searchIndex.set(rootAbs, { entries, builtAt: Date.now() })
    // Keep only the most-recent few roots.
    while (this.searchIndex.size > ExplorerService.INDEX_MAX_ROOTS) {
      const oldest = this.searchIndex.keys().next().value as string
      this.searchIndex.delete(oldest)
    }
    return entries
  }

  /** One parallel, stat-free walk collecting every searchable entry under root. */
  private async buildSearchIndex(rootAbs: string): Promise<IndexEntry[]> {
    const prefix = rootAbs.endsWith(path.sep) ? rootAbs : rootAbs + path.sep
    const out: IndexEntry[] = []
    let queue: string[] = [rootAbs]
    let visited = 0
    const MAX_DIRS = 40000
    const MAX_ENTRIES = 200000
    const CONCURRENCY = 16 // directories read in parallel — overlaps I/O

    const processDir = async (dir: string): Promise<string[]> => {
      let listed
      try {
        listed = await this.fs.listNames(dir) // no per-entry stat — the win
      } catch {
        return [] // unreadable directory — skip it
      }
      const children: string[] = []
      for (const e of listed) {
        out.push({ abs: e.abs, name: e.name, isDir: e.isDir, rel: e.abs.startsWith(prefix) ? e.abs.slice(prefix.length) : e.name })
        // Index entries themselves, but don't descend into dotfolders or
        // heavy/generated dirs.
        if (e.isDir && !e.name.startsWith('.') && !SEARCH_SKIP_DIRS.has(e.name)) children.push(e.abs)
      }
      return children
    }

    while (queue.length && visited < MAX_DIRS && out.length < MAX_ENTRIES) {
      const batch = queue.splice(0, CONCURRENCY)
      visited += batch.length
      const nested = await Promise.all(batch.map(processDir))
      queue = queue.concat(...nested)
    }
    return out
  }

  /** Score the (in-memory) index, then stat only the top `limit` results. */
  private async matchIndex(
    entries: IndexEntry[],
    query: string,
    onMatch: ((entry: Entry, score: number) => void) | undefined,
    limit: number,
  ): Promise<Entry[]> {
    // Substring ("strong") matches win; scattered fuzzy ones are only the
    // fallback when nothing matched as a substring. Scoring is pure in-memory.
    const strong: { it: IndexEntry; score: number }[] = []
    const weak: { it: IndexEntry; score: number }[] = []
    for (const it of entries) {
      const m = scoreEntry(query, it.rel, it.name)
      if (m === null) continue
      ;(m.strong ? strong : weak).push({ it, score: m.score })
    }

    const chosen = (strong.length ? strong : weak)
      .sort((a, b) => b.score - a.score || byIndexFolderThenName(a.it, b.it))
      .slice(0, limit)

    // Stat only the handful of results (for size/mtime), streaming them in rank
    // order as we go.
    const results: Entry[] = []
    for (const c of chosen) {
      let st
      try {
        st = await this.fs.stat(c.it.abs)
      } catch {
        continue // vanished / broken symlink
      }
      const entry: Entry = {
        name: c.it.name,
        path: this.resolver.toRelative(c.it.abs),
        type: c.it.isDir ? 'dir' : 'file',
        size: c.it.isDir ? 0 : st.size,
        modifiedAt: st.mtime.toISOString(),
      }
      results.push(entry)
      onMatch?.(entry, c.score)
    }
    return results
  }

  async createFolder(relParent: string, name: string): Promise<Entry> {
    const folderName = assertValidName(name)
    const abs = this.resolver.toAbsolute(path.posix.join(relParent || '', folderName))
    if (await this.fs.exists(abs)) throw new ValidationError('An item with that name already exists')
    await this.fs.mkdir(abs)
    this.invalidateSearchIndex()
    return this.entryOf(abs)
  }

  async rename(relPath: string, newName: string): Promise<Entry> {
    const name = assertValidName(newName)
    const abs = this.resolver.toAbsolute(relPath)
    if (abs === this.resolver.root) throw new ValidationError('Cannot rename the root')
    await this.statOrThrow(abs)
    const target = path.join(path.dirname(abs), name)
    this.resolver.toAbsolute(this.resolver.toRelative(target)) // re-validate confinement
    if (await this.fs.exists(target)) throw new ValidationError('An item with that name already exists')
    await this.fs.rename(abs, target)
    this.invalidateSearchIndex()
    return this.entryOf(target)
  }

  async remove(relPath: string): Promise<void> {
    const abs = this.resolver.toAbsolute(relPath)
    if (abs === this.resolver.root) throw new ValidationError('Cannot delete the root')
    await this.statOrThrow(abs)
    await this.fs.remove(abs)
    this.invalidateSearchIndex()
  }

  async upload(relParent: string, originalName: string, content: Buffer): Promise<Entry> {
    const name = assertValidName(originalName)
    const abs = this.resolver.toAbsolute(path.posix.join(relParent || '', name))
    await this.fs.writeFile(abs, content)
    this.invalidateSearchIndex()
    return this.entryOf(abs)
  }

  async createFile(relParent: string, name: string): Promise<Entry> {
    const fileName = assertValidName(name)
    const abs = this.resolver.toAbsolute(path.posix.join(relParent || '', fileName))
    if (await this.fs.exists(abs)) throw new ValidationError('An item with that name already exists')
    await this.fs.writeFile(abs, Buffer.alloc(0))
    this.invalidateSearchIndex()
    return this.entryOf(abs)
  }

  async duplicate(relPath: string): Promise<Entry> {
    const abs = this.resolver.toAbsolute(relPath)
    if (abs === this.resolver.root) throw new ValidationError('Cannot duplicate the root')
    await this.statOrThrow(abs)
    const ext = path.extname(abs)
    const base = path.basename(abs, ext)
    const target = await this.uniquePath(path.dirname(abs), `${base} copy${ext}`)
    await this.fs.cp(abs, target)
    this.invalidateSearchIndex()
    return this.entryOf(target)
  }

  copy(relPaths: string[], relDestDir: string): Promise<Entry[]> {
    return this.transfer(relPaths, relDestDir, 'copy')
  }

  move(relPaths: string[], relDestDir: string): Promise<Entry[]> {
    return this.transfer(relPaths, relDestDir, 'move')
  }

  private async transfer(relPaths: string[], relDestDir: string, mode: 'copy' | 'move'): Promise<Entry[]> {
    const destDir = this.resolver.toAbsolute(relDestDir)
    const destStat = await this.fs.stat(destDir).catch(() => null)
    if (!destStat?.isDirectory()) throw new ValidationError('Destination is not a folder')

    const results: Entry[] = []
    for (const rel of relPaths) {
      const src = this.resolver.toAbsolute(rel)
      if (src === this.resolver.root) throw new ValidationError('Cannot move the root')
      await this.statOrThrow(src)
      if (destDir === src || destDir.startsWith(src + path.sep)) {
        throw new ValidationError('Cannot move a folder into itself')
      }
      // Moving into its own directory is a no-op.
      if (mode === 'move' && path.dirname(src) === destDir) {
        results.push(await this.entryOf(src))
        continue
      }
      const target = await this.uniquePath(destDir, path.basename(src))
      if (mode === 'copy') {
        await this.fs.cp(src, target)
      } else {
        try {
          await this.fs.rename(src, target)
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code === 'EXDEV') {
            await this.fs.cp(src, target)
            await this.fs.remove(src)
          } else throw err
        }
      }
      results.push(await this.entryOf(target))
    }
    this.invalidateSearchIndex()
    return results
  }

  /** A non-colliding absolute path in `dir` for `name`, appending " (n)" if taken. */
  private async uniquePath(dir: string, name: string): Promise<string> {
    let candidate = name
    let i = 1
    while (await this.fs.exists(path.join(dir, candidate))) {
      const ext = path.extname(name)
      candidate = `${path.basename(name, ext)} (${i})${ext}`
      i++
    }
    return path.join(dir, candidate)
  }

  /** Build entries for a set of root-relative paths, skipping any that are
   * missing. Used by views that span directories (e.g. tag filters). */
  async entriesForPaths(relPaths: string[]): Promise<Entry[]> {
    const entries = await Promise.all(
      relPaths.map(async (rel) => {
        try {
          return await this.entryOf(this.resolver.toAbsolute(rel))
        } catch {
          return null
        }
      }),
    )
    return entries.filter((e): e is Entry => e !== null).sort(byFolderThenName)
  }

  async getFileContent(relPath: string): Promise<FileContent> {
    const abs = this.resolver.toAbsolute(relPath)
    const stat = await this.statOrThrow(abs)
    if (stat.isDirectory()) throw new ValidationError('Cannot download a directory')
    return {
      name: path.basename(abs),
      mimeType: mimeFromName(abs),
      content: await this.fs.readFile(abs),
    }
  }

  /** Resolve a file's absolute path + metadata (for range-enabled streaming). */
  async fileInfo(relPath: string): Promise<{ abs: string; name: string; mimeType: string }> {
    const abs = this.resolver.toAbsolute(relPath)
    const stat = await this.statOrThrow(abs)
    if (stat.isDirectory()) throw new ValidationError('Cannot download a directory')
    return { abs, name: path.basename(abs), mimeType: mimeFromName(abs) }
  }

  private async statOrThrow(abs: string) {
    try {
      return await this.fs.stat(abs)
    } catch {
      throw new NotFoundError(`Path not found: ${this.resolver.toRelative(abs)}`)
    }
  }

  private async entryOf(abs: string): Promise<Entry> {
    const stat = await this.fs.stat(abs)
    return {
      name: path.basename(abs),
      path: this.resolver.toRelative(abs),
      type: stat.isDirectory() ? 'dir' : 'file',
      size: stat.isDirectory() ? 0 : stat.size,
      modifiedAt: stat.mtime.toISOString(),
    }
  }
}

function byFolderThenName(a: Entry, b: Entry): number {
  if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
}

function byIndexFolderThenName(a: IndexEntry, b: IndexEntry): number {
  if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
}
