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

  it('fuzzy-searches recursively (smart-case, subsequence)', async () => {
    // "rdme" is a subsequence of "readme.md", found in a nested folder.
    expect((await service.search('', 'rdme')).map((e) => e.path)).toContain('Docs/readme.md')
    // Smart-case: an uppercase query is case-sensitive and won't match lowercase.
    expect(await service.search('', 'README')).toEqual([])
  })

  it('searches within a subdirectory and returns an empty list for no match', async () => {
    expect(await service.search('Docs', 'notes')).toEqual([])
    expect(await service.search('', '')).toEqual([])
  })

  it('ranks an exact filename match above a fuzzy one', async () => {
    await service.createFile('', 'report.txt')
    await service.createFolder('', 'Reports')
    await service.createFile('Reports', 'q1.txt')
    const results = await service.search('', 'report')
    expect(results[0].name).toBe('report.txt') // exact filename wins
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

  it('creates an empty file', async () => {
    const entry = await service.createFile('', 'new.txt')
    expect(entry).toMatchObject({ name: 'new.txt', type: 'file', size: 0 })
  })

  it('duplicates a file with a "copy" suffix', async () => {
    const dup = await service.duplicate('notes.txt')
    expect(dup.name).toBe('notes copy.txt')
    expect((await service.getFileContent('notes copy.txt')).content.toString()).toBe('hello')
  })

  it('copies files into a folder (collision-safe)', async () => {
    await service.copy(['notes.txt'], 'Docs')
    await service.copy(['notes.txt'], 'Docs') // again -> deduped name
    const names = (await service.listDir('Docs')).entries.map((e) => e.name)
    expect(names).toContain('notes.txt')
    expect(names).toContain('notes (1).txt')
  })

  it('moves files into a folder and removes the source', async () => {
    await service.move(['notes.txt'], 'Docs')
    expect((await service.listDir('')).entries.some((e) => e.name === 'notes.txt')).toBe(false)
    expect((await service.listDir('Docs')).entries.some((e) => e.name === 'notes.txt')).toBe(true)
  })

  it('refuses to move a folder into itself', async () => {
    await expect(service.move(['Docs'], 'Docs')).rejects.toBeInstanceOf(ValidationError)
  })
})
