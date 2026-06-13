import { randomUUID } from 'node:crypto'
import { NotFoundError, ValidationError } from '../errors.js'
import type { TagsRepository } from '../repositories/tagsRepository.js'
import type { Tag, TagAssignment } from '../types.js'

const DEFAULT_COLOR = '#868e96'
const HEX = /^#[0-9a-fA-F]{6}$/

export interface TagServiceDeps {
  repository: TagsRepository
}

/** Business tier for tags: definitions plus their assignment to paths. */
export class TagService {
  private readonly repository: TagsRepository

  constructor({ repository }: TagServiceDeps) {
    this.repository = repository
  }

  listTags(): Tag[] {
    return this.repository.findAll()
  }

  createTag(name: string, color?: string): Tag {
    const tag: Tag = {
      id: randomUUID(),
      name: this.cleanName(name),
      color: this.cleanColor(color),
      createdAt: new Date().toISOString(),
    }
    try {
      return this.repository.insert(tag)
    } catch (err) {
      throw this.asConflict(err)
    }
  }

  updateTag(id: string, changes: { name?: string; color?: string }): Tag {
    const existing = this.repository.findById(id)
    if (!existing) throw new NotFoundError(`Tag ${id} not found`)

    const name = changes.name !== undefined ? this.cleanName(changes.name) : existing.name
    const color = changes.color !== undefined ? this.cleanColor(changes.color) : existing.color
    try {
      this.repository.update(id, name, color)
    } catch (err) {
      throw this.asConflict(err)
    }
    return { ...existing, name, color }
  }

  deleteTag(id: string): void {
    this.repository.delete(id)
  }

  listAssignments(): TagAssignment[] {
    return this.repository.allAssignments()
  }

  assign(path: string, tagId: string): void {
    if (!path) throw new ValidationError('A path is required')
    if (!this.repository.findById(tagId)) throw new NotFoundError(`Tag ${tagId} not found`)
    this.repository.assign(path, tagId)
  }

  unassign(path: string, tagId: string): void {
    this.repository.unassign(path, tagId)
  }

  private cleanName(name: string): string {
    const trimmed = (name ?? '').trim()
    if (!trimmed) throw new ValidationError('A tag name is required')
    if (trimmed.length > 40) throw new ValidationError('Tag name is too long')
    return trimmed
  }

  private cleanColor(color?: string): string {
    if (color === undefined) return DEFAULT_COLOR
    if (!HEX.test(color)) throw new ValidationError('Color must be a #rrggbb hex value')
    return color.toLowerCase()
  }

  private asConflict(err: unknown): Error {
    const code = (err as { code?: string })?.code
    if (code === 'SQLITE_CONSTRAINT_UNIQUE' || code === 'SQLITE_CONSTRAINT') {
      return new ValidationError('A tag with that name already exists')
    }
    return err as Error
  }
}
