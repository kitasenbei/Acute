import { Router } from 'express'
import multer from 'multer'
import type { ExplorerController } from '../controllers/explorerController.js'
import type { FavoritesController } from '../controllers/favoritesController.js'
import type { TagsController } from '../controllers/tagsController.js'

const upload = multer({ storage: multer.memoryStorage() })

export function createExplorerRouter(controller: ExplorerController): Router {
  const router = Router()
  router.get('/', controller.list)
  router.get('/search', controller.search)
  router.get('/usage', controller.usage)
  router.get('/thumbnail', controller.thumbnail)
  router.get('/storyboard', controller.storyboard)
  router.post('/folder', controller.createFolder)
  router.post('/file', controller.createFile)
  router.post('/duplicate', controller.duplicate)
  router.post('/copy', controller.copy)
  router.post('/move', controller.move)
  router.post('/convert', controller.convert)
  router.get('/jobs', controller.jobsList)
  router.post('/upload', upload.single('file'), controller.upload)
  router.get('/content', controller.download)
  router.patch('/rename', controller.rename)
  router.delete('/', controller.remove)
  return router
}

export function createFavoritesRouter(controller: FavoritesController): Router {
  const router = Router()
  router.get('/', controller.list)
  router.post('/', controller.add)
  router.delete('/', controller.remove)
  return router
}

export function createTagsRouter(controller: TagsController): Router {
  const router = Router()
  // Literal /assignments routes must come before the /:id params.
  router.get('/assignments', controller.listAssignments)
  router.post('/assignments', controller.assign)
  router.delete('/assignments', controller.unassign)
  router.get('/', controller.list)
  router.post('/', controller.create)
  router.get('/:id/files', controller.files)
  router.patch('/:id', controller.update)
  router.delete('/:id', controller.remove)
  return router
}
