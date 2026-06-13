import type { Request, Response, NextFunction, RequestHandler } from 'express'
import type { FavoritesService } from '../services/favoritesService.js'

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>

const wrap =
  (fn: AsyncHandler): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next)
  }

/** Presentation tier for pinned folders. */
export class FavoritesController {
  constructor(private readonly service: FavoritesService) {}

  list = wrap(async (_req, res) => {
    res.json(this.service.list())
  })

  add = wrap(async (req, res) => {
    const path = typeof req.body?.path === 'string' ? req.body.path : ''
    res.status(201).json(await this.service.add(path))
  })

  remove = wrap(async (req, res) => {
    const path = typeof req.query.path === 'string' ? req.query.path : ''
    this.service.remove(path)
    res.status(204).end()
  })
}
