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

  constructor({ fileSystem, rootDir }: ExplorerDeps) {
    this.fs = fileSystem
    this.resolver = new PathResolver(rootDir)
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
   * Recursively fuzzy-find entries under `relDir`, fff-style: every entry's path
   * (relative to the search root) is scored against the query as a subsequence
   * with boundary/consecutive bonuses, and results are returned best-first.
   *
   * The walk is breadth-first and bounded (directory-visit cap + candidate cap)
   * so a huge tree can't hang; `limit` caps the returned top matches.
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

    const prefix = rootAbs.endsWith(path.sep) ? rootAbs : rootAbs + path.sep
    // Substring ("strong") matches are kept separate from scattered fuzzy ones;
    // we only fall back to fuzzy when nothing matched as a substring. Strong
    // matches are emitted to `onMatch` as the walk finds them (live streaming).
    const strong: { entry: Entry; score: number }[] = []
    const weak: { entry: Entry; score: number }[] = []
    const queue: string[] = [rootAbs]
    let visited = 0
    const MAX_DIRS = 20000
    const MAX_CANDIDATES = 5000

    while (queue.length && visited < MAX_DIRS && strong.length < limit && weak.length < MAX_CANDIDATES) {
      const dir = queue.shift() as string
      visited++
      let raw
      try {
        raw = await this.fs.list(dir)
      } catch {
        continue // unreadable directory — skip it
      }
      for (const e of raw) {
        const relToRoot = e.abs.startsWith(prefix) ? e.abs.slice(prefix.length) : e.name
        const m = scoreEntry(query, relToRoot, e.name)
        if (m !== null) {
          const entry: Entry = {
            name: e.name,
            path: this.resolver.toRelative(e.abs),
            type: e.isDir ? ('dir' as const) : ('file' as const),
            size: e.size,
            modifiedAt: e.modifiedAt,
          }
          if (m.strong) {
            strong.push({ entry, score: m.score })
            onMatch?.(entry, m.score) // stream substring hits as they're found
          } else {
            weak.push({ entry, score: m.score })
          }
        }
        // Don't recurse into dotfolders or heavy/generated dirs — they bury
        // results and slow the walk.
        if (e.isDir && !e.name.startsWith('.') && !SEARCH_SKIP_DIRS.has(e.name)) queue.push(e.abs)
      }
    }

    const chosen = strong.length ? strong : weak
    chosen.sort((a, b) => b.score - a.score || byFolderThenName(a.entry, b.entry))
    const result = chosen.slice(0, limit)
    // No substring hits → emit the fuzzy fallback now that the walk is done.
    if (onMatch && !strong.length) for (const s of result) onMatch(s.entry, s.score)
    return result.map((s) => s.entry)
  }

  async createFolder(relParent: string, name: string): Promise<Entry> {
    const folderName = assertValidName(name)
    const abs = this.resolver.toAbsolute(path.posix.join(relParent || '', folderName))
    if (await this.fs.exists(abs)) throw new ValidationError('An item with that name already exists')
    await this.fs.mkdir(abs)
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
    return this.entryOf(target)
  }

  async remove(relPath: string): Promise<void> {
    const abs = this.resolver.toAbsolute(relPath)
    if (abs === this.resolver.root) throw new ValidationError('Cannot delete the root')
    await this.statOrThrow(abs)
    await this.fs.remove(abs)
  }

  async upload(relParent: string, originalName: string, content: Buffer): Promise<Entry> {
    const name = assertValidName(originalName)
    const abs = this.resolver.toAbsolute(path.posix.join(relParent || '', name))
    await this.fs.writeFile(abs, content)
    return this.entryOf(abs)
  }

  async createFile(relParent: string, name: string): Promise<Entry> {
    const fileName = assertValidName(name)
    const abs = this.resolver.toAbsolute(path.posix.join(relParent || '', fileName))
    if (await this.fs.exists(abs)) throw new ValidationError('An item with that name already exists')
    await this.fs.writeFile(abs, Buffer.alloc(0))
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
