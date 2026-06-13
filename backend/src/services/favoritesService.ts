import path from 'node:path'
import { ValidationError } from '../errors.js'
import { PathResolver } from '../fs/pathResolver.js'
import type { FileSystem } from '../fs/fileSystem.js'
import type { FavoritesRepository } from '../repositories/favoritesRepository.js'
import type { Favorite } from '../types.js'

export interface FavoritesDeps {
  repository: FavoritesRepository
  fileSystem: FileSystem
  rootDir: string
}

/** Business tier for pinned folders shown in the sidebar. */
export class FavoritesService {
  private readonly repository: FavoritesRepository
  private readonly fs: FileSystem
  private readonly resolver: PathResolver

  constructor({ repository, fileSystem, rootDir }: FavoritesDeps) {
    this.repository = repository
    this.fs = fileSystem
    this.resolver = new PathResolver(rootDir)
  }

  list(): Favorite[] {
    return this.repository.findAll()
  }

  async add(relPath: string): Promise<Favorite> {
    if (!relPath) throw new ValidationError('Cannot pin the root')
    const abs = this.resolver.toAbsolute(relPath)
    const stat = await this.fs.stat(abs).catch(() => null)
    if (!stat?.isDirectory()) throw new ValidationError('Only folders can be pinned')

    const favorite: Favorite = {
      path: this.resolver.toRelative(abs),
      name: path.basename(abs),
      createdAt: new Date().toISOString(),
    }
    this.repository.add(favorite)
    return favorite
  }

  remove(relPath: string): void {
    this.repository.remove(relPath)
  }
}
