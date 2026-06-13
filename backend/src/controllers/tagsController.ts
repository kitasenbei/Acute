import type { Request, Response, NextFunction, RequestHandler } from 'express'
import type { TagService } from '../services/tagService.js'

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>

const wrap =
  (fn: AsyncHandler): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next)
  }

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/** Presentation tier for tags and tag assignments. */
export class TagsController {
  constructor(private readonly service: TagService) {}

  list = wrap(async (_req, res) => {
    res.json(this.service.listTags())
  })

  create = wrap(async (req, res) => {
    res.status(201).json(this.service.createTag(req.body?.name, req.body?.color))
  })

  update = wrap(async (req, res) => {
    res.json(this.service.updateTag(req.params.id, { name: req.body?.name, color: req.body?.color }))
  })

  remove = wrap(async (req, res) => {
    this.service.deleteTag(req.params.id)
    res.status(204).end()
  })

  listAssignments = wrap(async (_req, res) => {
    res.json(this.service.listAssignments())
  })

  assign = wrap(async (req, res) => {
    this.service.assign(str(req.body?.path), str(req.body?.tagId))
    res.status(201).end()
  })

  unassign = wrap(async (req, res) => {
    this.service.unassign(str(req.query.path), str(req.query.tagId))
    res.status(204).end()
  })
}
