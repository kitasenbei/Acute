import { promises as fs } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { NotFoundError, ValidationError } from '../errors.js'
import { PathResolver } from '../fs/pathResolver.js'
import type { Entry } from '../types.js'

// Output formats we offer, mapped to sharp's format id.
const FORMATS: Record<string, keyof sharp.FormatEnum> = {
  png: 'png',
  jpg: 'jpeg',
  jpeg: 'jpeg',
  webp: 'webp',
  avif: 'avif',
  tiff: 'tiff',
  gif: 'gif',
}

const IMAGE_INPUT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'avif', 'tiff'])

export interface ImageServiceDeps {
  rootDir: string
}

/** Converts images between formats with sharp, writing a new file alongside. */
export class ImageService {
  private readonly resolver: PathResolver

  constructor({ rootDir }: ImageServiceDeps) {
    this.resolver = new PathResolver(rootDir)
  }

  async convert(relPath: string, format: string): Promise<Entry> {
    const fmt = FORMATS[String(format).toLowerCase()]
    if (!fmt) throw new ValidationError('Unsupported image format')

    const abs = this.resolver.toAbsolute(relPath)
    let stat
    try {
      stat = await fs.stat(abs)
    } catch {
      throw new NotFoundError(`Path not found: ${relPath}`)
    }
    if (stat.isDirectory()) throw new ValidationError('Not a file')
    if (!IMAGE_INPUT.has(path.extname(abs).slice(1).toLowerCase())) {
      throw new ValidationError('Not an image')
    }

    const outExt = fmt === 'jpeg' ? 'jpg' : fmt
    const base = path.basename(abs, path.extname(abs))
    const target = await this.uniquePath(path.dirname(abs), `${base}.${outExt}`)

    await sharp(abs, { failOn: 'none', animated: fmt === 'webp' || fmt === 'gif' })
      .toFormat(fmt)
      .toFile(target)

    const s = await fs.stat(target)
    return {
      name: path.basename(target),
      path: this.resolver.toRelative(target),
      type: 'file',
      size: s.size,
      modifiedAt: s.mtime.toISOString(),
    }
  }

  private async uniquePath(dir: string, name: string): Promise<string> {
    let candidate = name
    let i = 1
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await fs.access(path.join(dir, candidate))
      } catch {
        return path.join(dir, candidate)
      }
      const ext = path.extname(name)
      candidate = `${path.basename(name, ext)} (${i})${ext}`
      i++
    }
  }
}
