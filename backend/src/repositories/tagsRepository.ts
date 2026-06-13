import type Database from 'better-sqlite3'
import type { Tag, TagAssignment } from '../types.js'

interface TagRow {
  id: string
  name: string
  color: string
  created_at: string
}

/** Data-access layer for tags and their assignments to paths. */
export class TagsRepository {
  constructor(private readonly db: Database.Database) {}

  private static toDomain(row: TagRow): Tag {
    return { id: row.id, name: row.name, color: row.color, createdAt: row.created_at }
  }

  findAll(): Tag[] {
    const rows = this.db
      .prepare(`SELECT * FROM tags ORDER BY name COLLATE NOCASE`)
      .all() as TagRow[]
    return rows.map(TagsRepository.toDomain)
  }

  findById(id: string): Tag | null {
    const row = this.db.prepare(`SELECT * FROM tags WHERE id = ?`).get(id) as TagRow | undefined
    return row ? TagsRepository.toDomain(row) : null
  }

  insert(tag: Tag): Tag {
    this.db
      .prepare(`INSERT INTO tags (id, name, color, created_at) VALUES (@id, @name, @color, @createdAt)`)
      .run(tag)
    return tag
  }

  update(id: string, name: string, color: string): void {
    this.db.prepare(`UPDATE tags SET name = ?, color = ? WHERE id = ?`).run(name, color, id)
  }

  delete(id: string): boolean {
    // file_tags rows cascade away via the foreign key.
    const info = this.db.prepare(`DELETE FROM tags WHERE id = ?`).run(id)
    return info.changes > 0
  }

  // --- assignments ---

  allAssignments(): TagAssignment[] {
    const rows = this.db.prepare(`SELECT path, tag_id AS tagId FROM file_tags`).all() as TagAssignment[]
    return rows
  }

  assign(path: string, tagId: string): void {
    this.db
      .prepare(`INSERT OR IGNORE INTO file_tags (path, tag_id) VALUES (?, ?)`)
      .run(path, tagId)
  }

  unassign(path: string, tagId: string): void {
    this.db.prepare(`DELETE FROM file_tags WHERE path = ? AND tag_id = ?`).run(path, tagId)
  }
}
