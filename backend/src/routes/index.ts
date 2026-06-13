import { Router } from 'express'
import multer from 'multer'
import type { ExplorerController } from '../controllers/explorerController.js'
import type { FavoritesController } from '../controllers/favoritesController.js'

const upload = multer({ storage: multer.memoryStorage() })

export function createExplorerRouter(controller: ExplorerController): Router {
  const router = Router()
  router.get('/', controller.list)
  router.get('/thumbnail', controller.thumbnail)
  router.post('/folder', controller.createFolder)
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
