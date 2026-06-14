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

  /**
   * Like `list`, but only returns name + isDir using readdir's dirent types —
   * no per-entry `stat`. Used by recursive search, which walks huge trees and
   * only needs size/mtime for the handful of matches (statted separately).
   */
  async listNames(absDir: string): Promise<{ name: string; abs: string; isDir: boolean }[]> {
    const dirents = await fs.readdir(absDir, { withFileTypes: true })
    return dirents.map((d) => ({ name: d.name, abs: path.join(absDir, d.name), isDir: d.isDirectory() }))
  }

  async mkdir(abs: string): Promise<void> {
    await fs.mkdir(abs)
  }

  async rename(from: string, to: string): Promise<void> {
    await fs.rename(from, to)
  }

  async cp(from: string, to: string): Promise<void> {
    await fs.cp(from, to, { recursive: true })
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

  async diskUsage(abs: string): Promise<{ free: number; total: number }> {
    const s = await fs.statfs(abs)
    return { free: s.bavail * s.bsize, total: s.blocks * s.bsize }
  }
}
