import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import sharp from 'sharp'
import { NotFoundError, ValidationError } from '../errors.js'
import { PathResolver } from '../fs/pathResolver.js'

const IMAGE = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'avif', 'tiff'])
const VIDEO = new Set(['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v'])

export interface ThumbnailDeps {
  rootDir: string
  cacheDir: string
}

/**
 * Generates small, cached thumbnails so the renderer never has to decode
 * full-resolution media. Runs in the backend process (off the renderer's main
 * thread): sharp downscales images; an ffmpeg poster frame covers videos.
 *
 * Thumbnails are cached on disk keyed by absolute path + mtime + size, so a
 * file only gets processed once (until it changes).
 */
export class ThumbnailService {
  private readonly resolver: PathResolver
  private readonly cacheDir: string

  constructor({ rootDir, cacheDir }: ThumbnailDeps) {
    this.resolver = new PathResolver(rootDir)
    this.cacheDir = cacheDir
  }

  /** Returns the absolute path of a cached WebP thumbnail, generating if needed. */
  async getThumbnail(relPath: string, size = 256): Promise<string> {
    const abs = this.resolver.toAbsolute(relPath)

    let stat
    try {
      stat = await fs.stat(abs)
    } catch {
      throw new NotFoundError(`Path not found: ${relPath}`)
    }
    if (stat.isDirectory()) throw new ValidationError('Cannot thumbnail a directory')

    const ext = path.extname(abs).slice(1).toLowerCase()
    const kind = IMAGE.has(ext) ? 'image' : VIDEO.has(ext) ? 'video' : null
    if (!kind) throw new ValidationError('Unsupported type for thumbnail')

    const w = Math.min(512, Math.max(32, Math.round(size) || 256))
    const key = crypto.createHash('sha1').update(`${abs}:${stat.mtimeMs}:${w}`).digest('hex')
    const cachePath = path.join(this.cacheDir, `${key}.webp`)
    if (await this.exists(cachePath)) return cachePath

    const input = kind === 'image' ? abs : await this.extractVideoFrame(abs)
    await fs.mkdir(this.cacheDir, { recursive: true })
    await sharp(input, { failOn: 'none', animated: false })
      .resize(w, w, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 70 })
      .toFile(cachePath)
    return cachePath
  }

  private async exists(p: string): Promise<boolean> {
    try {
      await fs.access(p)
      return true
    } catch {
      return false
    }
  }

  /** Grab a single frame (~1s in) from a video as a JPEG buffer via ffmpeg. */
  private extractVideoFrame(abs: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const args = ['-ss', '1', '-i', abs, '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'mjpeg', 'pipe:1']
      const ff = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'ignore'] })
      const chunks: Buffer[] = []
      ff.stdout.on('data', (c: Buffer) => chunks.push(c))
      ff.on('error', () => reject(new NotFoundError('ffmpeg unavailable')))
      ff.on('close', (code) => {
        const buf = Buffer.concat(chunks)
        if (code === 0 && buf.length > 0) resolve(buf)
        else reject(new NotFoundError('Could not extract video frame'))
      })
    })
  }
}
