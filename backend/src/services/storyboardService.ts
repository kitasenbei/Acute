import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { NotFoundError, ValidationError } from '../errors.js'
import { PathResolver } from '../fs/pathResolver.js'

const VIDEO = new Set(['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v'])
const COLS = 10
const TILE_W = 160
const MAX_TILES = 100

export interface StoryboardDeps {
  rootDir: string
  cacheDir: string
}

export interface Storyboard {
  file: string
  cols: number
  rows: number
  interval: number // seconds between frames
  count: number
}

/**
 * YouTube-style hover previews: extracts evenly-spaced frames from a video and
 * tiles them into a single cached sprite sheet (via ffmpeg). The renderer shifts
 * a CSS background-position to show the frame under the cursor — no per-hover
 * requests. Cached on disk keyed by absPath + mtime + tile count.
 */
export class StoryboardService {
  private readonly resolver: PathResolver
  private readonly cacheDir: string

  constructor({ rootDir, cacheDir }: StoryboardDeps) {
    this.resolver = new PathResolver(rootDir)
    this.cacheDir = cacheDir
  }

  async getStoryboard(relPath: string): Promise<Storyboard> {
    const abs = this.resolver.toAbsolute(relPath)
    let stat
    try {
      stat = await fs.stat(abs)
    } catch {
      throw new NotFoundError(`Path not found: ${relPath}`)
    }
    if (stat.isDirectory()) throw new ValidationError('Not a file')
    if (!VIDEO.has(path.extname(abs).slice(1).toLowerCase())) {
      throw new ValidationError('Not a video')
    }

    const duration = await this.probeDuration(abs)
    if (!Number.isFinite(duration) || duration <= 0) throw new ValidationError('Unknown duration')

    const count = Math.min(MAX_TILES, Math.max(1, Math.floor(duration)))
    const interval = duration / count
    const rows = Math.ceil(count / COLS)

    const key = crypto.createHash('sha1').update(`${abs}:${stat.mtimeMs}:sb:${count}`).digest('hex')
    const file = path.join(this.cacheDir, `${key}.jpg`)
    const meta: Storyboard = { file, cols: COLS, rows, interval, count }

    if (!(await this.exists(file))) {
      await fs.mkdir(this.cacheDir, { recursive: true })
      await this.render(abs, interval, rows, file)
    }
    return meta
  }

  private async exists(p: string): Promise<boolean> {
    try {
      await fs.access(p)
      return true
    } catch {
      return false
    }
  }

  private probeDuration(abs: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const ff = spawn(
        'ffprobe',
        ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', abs],
        { stdio: ['ignore', 'pipe', 'ignore'] },
      )
      let out = ''
      ff.stdout.on('data', (d: Buffer) => (out += d))
      ff.on('error', () => reject(new NotFoundError('ffprobe unavailable')))
      ff.on('close', (code) =>
        code === 0 ? resolve(parseFloat(out.trim())) : reject(new NotFoundError('ffprobe failed')),
      )
    })
  }

  private render(abs: string, interval: number, rows: number, out: string): Promise<void> {
    const vf = `fps=${(1 / interval).toFixed(6)},scale=${TILE_W}:-1,tile=${COLS}x${rows}`
    return new Promise((resolve, reject) => {
      const ff = spawn('ffmpeg', ['-y', '-i', abs, '-frames:v', '1', '-vf', vf, '-q:v', '5', out], {
        stdio: ['ignore', 'ignore', 'ignore'],
      })
      ff.on('error', () => reject(new NotFoundError('ffmpeg unavailable')))
      ff.on('close', (code) =>
        code === 0 ? resolve() : reject(new NotFoundError('ffmpeg failed')),
      )
    })
  }
}
