import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FileSystem } from '../src/fs/fileSystem.js'
import { ExplorerService } from '../src/services/explorerService.js'
import { NotFoundError, ValidationError } from '../src/errors.js'
import { makeTestStack, type TestStack } from './helpers.js'

describe('ExplorerService (business tier)', () => {
  let stack: TestStack
  let service: ExplorerService

  beforeEach(async () => {
    stack = await makeTestStack()
    service = new ExplorerService({ fileSystem: new FileSystem(), rootDir: stack.rootDir })
  })

  afterEach(async () => {
    await stack.cleanup()
  })

  it('lists the root with folders before files', async () => {
    const listing = await service.listDir('')
    expect(listing.path).toBe('')
    expect(listing.parent).toBeNull()
    expect(listing.entries.map((e) => e.name)).toEqual(['Docs', 'notes.txt'])
    expect(listing.entries[0].type).toBe('dir')
  })

  it('navigates into a subdirectory and reports its parent', async () => {
    const listing = await service.listDir('Docs')
    expect(listing.parent).toBe('')
    expect(listing.entries.map((e) => e.name)).toEqual(['readme.md'])
  })

  it('blocks path traversal outside the root', async () => {
    await expect(service.listDir('../..')).rejects.toBeInstanceOf(ValidationError)
  })

  it('throws NotFound for a missing path', async () => {
    await expect(service.listDir('nope')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('creates a folder', async () => {
    const entry = await service.createFolder('', 'Newdir')
    expect(entry.type).toBe('dir')
    const listing = await service.listDir('')
    expect(listing.entries.some((e) => e.name === 'Newdir')).toBe(true)
  })

  it('rejects folder names with separators', async () => {
    await expect(service.createFolder('', 'a/b')).rejects.toBeInstanceOf(ValidationError)
  })

  it('renames a file', async () => {
    const entry = await service.rename('notes.txt', 'renamed.txt')
    expect(entry.name).toBe('renamed.txt')
    const listing = await service.listDir('')
    expect(listing.entries.some((e) => e.name === 'renamed.txt')).toBe(true)
    expect(listing.entries.some((e) => e.name === 'notes.txt')).toBe(false)
  })

  it('refuses to rename or delete the root', async () => {
    await expect(service.rename('', 'x')).rejects.toBeInstanceOf(ValidationError)
    await expect(service.remove('')).rejects.toBeInstanceOf(ValidationError)
  })

  it('deletes a folder recursively', async () => {
    await service.remove('Docs')
    const listing = await service.listDir('')
    expect(listing.entries.some((e) => e.name === 'Docs')).toBe(false)
  })

  it('uploads a file and reads its content back', async () => {
    await service.upload('', 'data.bin', Buffer.from('payload'))
    const file = await service.getFileContent('data.bin')
    expect(file.content.toString()).toBe('payload')
  })

  it('downloads existing file content with a MIME type', async () => {
    const file = await service.getFileContent('Docs/readme.md')
    expect(file.name).toBe('readme.md')
    expect(file.mimeType).toBe('text/markdown')
    expect(file.content.toString()).toBe('# title')
  })
})
