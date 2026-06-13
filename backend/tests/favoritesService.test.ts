import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FileSystem } from '../src/fs/fileSystem.js'
import { FavoritesRepository } from '../src/repositories/favoritesRepository.js'
import { FavoritesService } from '../src/services/favoritesService.js'
import { ValidationError } from '../src/errors.js'
import { makeTestStack, type TestStack } from './helpers.js'

describe('FavoritesService (business tier)', () => {
  let stack: TestStack
  let service: FavoritesService

  beforeEach(async () => {
    stack = await makeTestStack()
    service = new FavoritesService({
      repository: new FavoritesRepository(stack.db),
      fileSystem: new FileSystem(),
      rootDir: stack.rootDir,
    })
  })

  afterEach(async () => {
    await stack.cleanup()
  })

  it('pins a folder and lists it', async () => {
    const fav = await service.add('Docs')
    expect(fav).toMatchObject({ path: 'Docs', name: 'Docs' })
    expect(service.list()).toHaveLength(1)
  })

  it('refuses to pin a file', async () => {
    await expect(service.add('notes.txt')).rejects.toBeInstanceOf(ValidationError)
  })

  it('refuses to pin the root', async () => {
    await expect(service.add('')).rejects.toBeInstanceOf(ValidationError)
  })

  it('is idempotent — pinning twice keeps one entry', async () => {
    await service.add('Docs')
    await service.add('Docs')
    expect(service.list()).toHaveLength(1)
  })

  it('unpins a folder', async () => {
    await service.add('Docs')
    service.remove('Docs')
    expect(service.list()).toHaveLength(0)
  })
})
