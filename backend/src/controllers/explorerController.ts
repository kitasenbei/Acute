import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { ValidationError } from '../errors.js'
import type { ExplorerService } from '../services/explorerService.js'
import type { ThumbnailService } from '../services/thumbnailService.js'
import type { StoryboardService } from '../services/storyboardService.js'

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>

const wrap =
  (fn: AsyncHandler): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next)
  }

/** Reads the root-relative path from a query string, defaulting to the root. */
function pathParam(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * Build a Content-Disposition that is safe for HTTP headers. The plain
 * `filename` must be ASCII (Node rejects other bytes), so non-ASCII names are
 * preserved via the RFC 5987 `filename*` form and stripped from the fallback.
 */
function contentDisposition(name: string): string {
  const asciiFallback = name.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_')
  return `inline; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

/**
 * Presentation tier for browsing. Maps HTTP to {@link ExplorerService} calls.
 */
export class ExplorerController {
  constructor(
    private readonly service: ExplorerService,
    private readonly thumbnails: ThumbnailService,
    private readonly storyboards: StoryboardService,
  ) {}

  list = wrap(async (req, res) => {
    res.json(await this.service.listDir(pathParam(req.query.path)))
  })

  thumbnail = wrap(async (req, res) => {
    const size = Number(req.query.w) || 256
    const file = await this.thumbnails.getThumbnail(pathParam(req.query.path), size)
    res.setHeader('Cache-Control', 'private, max-age=3600')
    res.type('image/webp').sendFile(file)
  })

  storyboard = wrap(async (req, res) => {
    const sb = await this.storyboards.getStoryboard(pathParam(req.query.path))
    res.setHeader('X-SB-Cols', String(sb.cols))
    res.setHeader('X-SB-Rows', String(sb.rows))
    res.setHeader('X-SB-Interval', String(sb.interval))
    res.setHeader('X-SB-Count', String(sb.count))
    res.setHeader('Cache-Control', 'private, max-age=3600')
    res.type('image/jpeg').sendFile(sb.file)
  })

  createFolder = wrap(async (req, res) => {
    const { path: parent, name } = req.body ?? {}
    res.status(201).json(await this.service.createFolder(pathParam(parent), name))
  })

  rename = wrap(async (req, res) => {
    res.json(await this.service.rename(pathParam(req.body?.path), req.body?.name))
  })

  remove = wrap(async (req, res) => {
    await this.service.remove(pathParam(req.query.path))
    res.status(204).end()
  })

  upload = wrap(async (req, res) => {
    if (!req.file) throw new ValidationError('No file uploaded (field name: "file")')
    const entry = await this.service.upload(
      pathParam(req.body?.path),
      req.file.originalname,
      req.file.buffer,
    )
    res.status(201).json(entry)
  })

  download = wrap(async (req, res) => {
    const file = await this.service.getFileContent(pathParam(req.query.path))
    res.setHeader('Content-Type', file.mimeType)
    res.setHeader('Content-Disposition', contentDisposition(file.name))
    res.send(file.content)
  })
}
