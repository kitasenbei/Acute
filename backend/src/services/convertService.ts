import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { NotFoundError, ValidationError } from '../errors.js'
import { PathResolver } from '../fs/pathResolver.js'
import type { Entry } from '../types.js'

// Image output formats (sharp), mapped to sharp's format id.
const IMAGE_OUT: Record<string, keyof sharp.FormatEnum> = {
  png: 'png',
  jpg: 'jpeg',
  jpeg: 'jpeg',
  webp: 'webp',
  avif: 'avif',
  tiff: 'tiff',
  gif: 'gif',
}
const IMAGE_IN = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'avif', 'tiff'])

// Video output containers (ffmpeg picks sensible default codecs per container).
const VIDEO_OUT = new Set(['mp4', 'webm', 'mkv', 'mov'])
const VIDEO_IN = new Set(['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v'])

export interface ConvertServiceDeps {
  rootDir: string
}

/** Converts media between formats: images via sharp, videos via ffmpeg. */
export class ConvertService {
  private readonly resolver: PathResolver

  constructor({ rootDir }: ConvertServiceDeps) {
    this.resolver = new PathResolver(rootDir)
  }

  async convert(relPath: string, format: string): Promise<Entry> {
    const abs = this.resolver.toAbsolute(relPath)
    let stat
    try {
      stat = await fs.stat(abs)
    } catch {
      throw new NotFoundError(`Path not found: ${relPath}`)
    }
    if (stat.isDirectory()) throw new ValidationError('Not a file')

    const srcExt = path.extname(abs).slice(1).toLowerCase()
    const fmt = String(format).toLowerCase()

    if (IMAGE_IN.has(srcExt)) {
      const sharpFmt = IMAGE_OUT[fmt]
      if (!sharpFmt) throw new ValidationError('Unsupported image format')
      const target = await this.uniquePath(abs, fmt === 'jpeg' ? 'jpg' : fmt)
      await sharp(abs, { failOn: 'none', animated: sharpFmt === 'webp' || sharpFmt === 'gif' })
        .toFormat(sharpFmt)
        .toFile(target)
      return this.entryOf(target)
    }

    if (VIDEO_IN.has(srcExt)) {
      if (!VIDEO_OUT.has(fmt)) throw new ValidationError('Unsupported video format')
      const target = await this.uniquePath(abs, fmt)
      await this.ffmpeg(abs, target)
      return this.entryOf(target)
    }

    throw new ValidationError('Cannot convert this file type')
  }

  private ffmpeg(src: string, target: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ff = spawn('ffmpeg', ['-y', '-i', src, target], { stdio: ['ignore', 'ignore', 'ignore'] })
      ff.on('error', () => reject(new NotFoundError('ffmpeg unavailable')))
      ff.on('close', (code) =>
        code === 0 ? resolve() : reject(new ValidationError('Conversion failed')),
      )
    })
  }

  private async entryOf(target: string): Promise<Entry> {
    const s = await fs.stat(target)
    return {
      name: path.basename(target),
      path: this.resolver.toRelative(target),
      type: 'file',
      size: s.size,
      modifiedAt: s.mtime.toISOString(),
    }
  }

  /** A non-colliding target path: same dir as `srcAbs`, same base, new `ext`. */
  private async uniquePath(srcAbs: string, ext: string): Promise<string> {
    const dir = path.dirname(srcAbs)
    const base = path.basename(srcAbs, path.extname(srcAbs))
    let candidate = `${base}.${ext}`
    let i = 1
    while (await this.exists(path.join(dir, candidate))) {
      candidate = `${base} (${i}).${ext}`
      i++
    }
    return path.join(dir, candidate)
  }

  private async exists(p: string): Promise<boolean> {
    try {
      await fs.access(p)
      return true
    } catch {
      return false
    }
  }
}
