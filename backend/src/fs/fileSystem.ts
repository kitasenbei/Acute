import { promises as fs, type Stats } from 'node:fs'
import path from 'node:path'

export interface RawEntry {
  name: string
  abs: string
  isDir: boolean
  size: number
  modifiedAt: string
}

/**
 * Data-access layer for the real filesystem.
 *
 * A thin async wrapper over node:fs that operates purely on absolute paths.
 * It enforces no policy — confinement and validation live in the tiers above.
 */
export class FileSystem {
  async list(absDir: string): Promise<RawEntry[]> {
    const dirents = await fs.readdir(absDir, { withFileTypes: true })
    const entries = await Promise.all(
      dirents.map(async (d) => {
        const abs = path.join(absDir, d.name)
        let stat: Stats
        try {
          stat = await fs.stat(abs)
        } catch {
          return null // broken symlink or vanished entry — skip it
        }
        return {
          name: d.name,
          abs,
          isDir: stat.isDirectory(),
          size: stat.isDirectory() ? 0 : stat.size,
          modifiedAt: stat.mtime.toISOString(),
        }
      }),
    )
    return entries.filter((e): e is RawEntry => e !== null)
  }

  stat(abs: string): Promise<Stats> {
    return fs.stat(abs)
  }

  async mkdir(abs: string): Promise<void> {
    await fs.mkdir(abs)
  }

  async rename(from: string, to: string): Promise<void> {
    await fs.rename(from, to)
  }

  async remove(abs: string): Promise<void> {
    await fs.rm(abs, { recursive: true, force: true })
  }

  readFile(abs: string): Promise<Buffer> {
    return fs.readFile(abs)
  }

  async writeFile(abs: string, data: Buffer): Promise<void> {
    await fs.writeFile(abs, data)
  }

  async exists(abs: string): Promise<boolean> {
    try {
      await fs.access(abs)
      return true
    } catch {
      return false
    }
  }
}
