import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TagsRepository } from '../src/repositories/tagsRepository.js'
import { TagService } from '../src/services/tagService.js'
import { NotFoundError, ValidationError } from '../src/errors.js'
import { makeTestStack, type TestStack } from './helpers.js'

describe('TagService (business tier)', () => {
  let stack: TestStack
  let service: TagService

  beforeEach(async () => {
    stack = await makeTestStack()
    service = new TagService({ repository: new TagsRepository(stack.db) })
  })

  afterEach(async () => {
    await stack.cleanup()
  })

  it('creates and lists tags', () => {
    const tag = service.createTag('Work', '#ff0000')
    expect(tag).toMatchObject({ name: 'Work', color: '#ff0000' })
    expect(service.listTags()).toHaveLength(1)
  })

  it('defaults the colour and validates a bad one', () => {
    expect(service.createTag('Plain').color).toMatch(/^#/)
    expect(() => service.createTag('Bad', 'red')).toThrow(ValidationError)
  })

  it('rejects an empty name and duplicates', () => {
    expect(() => service.createTag('  ')).toThrow(ValidationError)
    service.createTag('Unique')
    expect(() => service.createTag('Unique')).toThrow(ValidationError)
  })

  it('updates a tag', () => {
    const tag = service.createTag('Old', '#111111')
    const updated = service.updateTag(tag.id, { name: 'New', color: '#222222' })
    expect(updated).toMatchObject({ name: 'New', color: '#222222' })
  })

  it('throws NotFound updating a missing tag', () => {
    expect(() => service.updateTag('nope', { name: 'x' })).toThrow(NotFoundError)
  })

  it('assigns and lists assignments', () => {
    const tag = service.createTag('Photos')
    service.assign('Pictures/a.png', tag.id)
    service.assign('Pictures/b.png', tag.id)
    expect(service.listAssignments()).toHaveLength(2)
  })

  it('refuses to assign a non-existent tag', () => {
    expect(() => service.assign('x.txt', 'nope')).toThrow(NotFoundError)
  })

  it('unassigns', () => {
    const tag = service.createTag('Photos')
    service.assign('a.png', tag.id)
    service.unassign('a.png', tag.id)
    expect(service.listAssignments()).toHaveLength(0)
  })

  it('deleting a tag cascades its assignments', () => {
    const tag = service.createTag('Temp')
    service.assign('a.png', tag.id)
    service.deleteTag(tag.id)
    expect(service.listTags()).toHaveLength(0)
    expect(service.listAssignments()).toHaveLength(0)
  })

  describe('subtags', () => {
    it('creates a subtag that inherits the parent colour', () => {
      const parent = service.createTag('Project', '#1971c2')
      const child = service.createTag('Acute', undefined, parent.id)
      expect(child.parentId).toBe(parent.id)
      expect(child.color).toBe('#1971c2')
    })

    it('filtering a parent returns files tagged on any descendant', () => {
      const parent = service.createTag('Project')
      const child = service.createTag('Acute', undefined, parent.id)
      service.assign('a.txt', parent.id)
      service.assign('b.txt', child.id)
      expect(service.pathsForTag(parent.id).sort()).toEqual(['a.txt', 'b.txt'])
      expect(service.pathsForTag(child.id)).toEqual(['b.txt'])
    })

    it('rejects self-parenting and cycles', () => {
      const a = service.createTag('A')
      const b = service.createTag('B', undefined, a.id)
      expect(() => service.updateTag(a.id, { parentId: a.id })).toThrow(ValidationError)
      expect(() => service.updateTag(a.id, { parentId: b.id })).toThrow(ValidationError)
    })

    it('deleting a parent promotes children to top-level', () => {
      const parent = service.createTag('Group')
      const child = service.createTag('Child', undefined, parent.id)
      service.deleteTag(parent.id)
      const reloaded = service.listTags().find((t) => t.id === child.id)
      expect(reloaded?.parentId).toBeNull()
    })
  })
})
