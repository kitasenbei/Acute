import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { ValidationError } from '../errors.js'
import type { ExplorerService } from '../services/explorerService.js'

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
 * Presentation tier for browsing. Maps HTTP to {@link ExplorerService} calls.
 */
export class ExplorerController {
  constructor(private readonly service: ExplorerService) {}

  list = wrap(async (req, res) => {
    res.json(await this.service.listDir(pathParam(req.query.path)))
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
    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`)
    res.send(file.content)
  })
}
