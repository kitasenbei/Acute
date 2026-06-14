import path from 'node:path'
import { NotFoundError, ValidationError } from '../errors.js'
import { PathResolver, assertValidName } from '../fs/pathResolver.js'
import { mimeFromName } from '../fs/mime.js'
import type { FileSystem } from '../fs/fileSystem.js'
import type { DirListing, Entry } from '../types.js'

export interface ExplorerDeps {
  fileSystem: FileSystem
  rootDir: string
}

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
