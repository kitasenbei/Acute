import express, { type Express } from 'express'
import cors from 'cors'
import swaggerUi from 'swagger-ui-express'
import type Database from 'better-sqlite3'
import { openapiSpec } from './openapi.js'
import os from 'node:os'
import path from 'node:path'
import { FileSystem } from './fs/fileSystem.js'
import { FavoritesRepository } from './repositories/favoritesRepository.js'
import { TagsRepository } from './repositories/tagsRepository.js'
import { ExplorerService } from './services/explorerService.js'
import { FavoritesService } from './services/favoritesService.js'
import { TagService } from './services/tagService.js'
import { ThumbnailService } from './services/thumbnailService.js'
import { ExplorerController } from './controllers/explorerController.js'
import { FavoritesController } from './controllers/favoritesController.js'
import { TagsController } from './controllers/tagsController.js'
import { createExplorerRouter, createFavoritesRouter, createTagsRouter } from './routes/index.js'
import { errorHandler } from './middleware/errorHandler.js'

export interface AppDeps {
  db: Database.Database
  rootDir: string
  /** Where generated thumbnails are cached. Defaults to a temp dir. */
  cacheDir?: string
}

/**
 * Compose the application from its three tiers.
 *
 * Dependencies (the SQLite db and the browsing root) are injected so tests can
 * supply an in-memory DB and a throwaway temp directory.
 */
export function createApp({ db, rootDir, cacheDir }: AppDeps): Express {
  const thumbDir = cacheDir ?? path.join(os.tmpdir(), 'file-explorer-thumbnails')
  // Data tier
  const fileSystem = new FileSystem()
  const favoritesRepo = new FavoritesRepository(db)
  const tagsRepo = new TagsRepository(db)
  // Business tier
  const explorerService = new ExplorerService({ fileSystem, rootDir })
  const favoritesService = new FavoritesService({ repository: favoritesRepo, fileSystem, rootDir })
  const tagService = new TagService({ repository: tagsRepo })
  const thumbnailService = new ThumbnailService({ rootDir, cacheDir: thumbDir })
  // Presentation tier
  const explorerController = new ExplorerController(explorerService, thumbnailService)
  const favoritesController = new FavoritesController(favoritesService)
  const tagsController = new TagsController(tagService)

  const app = express()
  app.use(cors({ exposedHeaders: ['Content-Disposition'] }))
  app.use(express.json())

  app.get('/health', (_req, res) => res.json({ status: 'ok' }))

  // API documentation: raw spec + interactive Swagger UI.
  app.get('/api/docs.json', (_req, res) => res.json(openapiSpec))
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec))

  app.use('/api/fs', createExplorerRouter(explorerController))
  app.use('/api/favorites', createFavoritesRouter(favoritesController))
  app.use('/api/tags', createTagsRouter(tagsController))

  app.use(errorHandler)
  return app
}
