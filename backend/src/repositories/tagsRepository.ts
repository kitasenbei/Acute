import type Database from 'better-sqlite3'
import type { Tag, TagAssignment } from '../types.js'

interface TagRow {
  id: string
  name: string
  color: string
  created_at: string
  parent_id: string | null
}

/** Data-access layer for tags and their assignments to paths. */
export class TagsRepository {
  constructor(private readonly db: Database.Database) {}

  private static toDomain(row: TagRow): Tag {
    return {
      id: row.id,
      name: row.name,
      color: row.color,
      parentId: row.parent_id ?? null,
      createdAt: row.created_at,
    }
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
      .prepare(
        `INSERT INTO tags (id, name, color, created_at, parent_id)
         VALUES (@id, @name, @color, @createdAt, @parentId)`,
      )
      .run(tag)
    return tag
  }

  update(id: string, name: string, color: string, parentId: string | null): void {
    this.db
      .prepare(`UPDATE tags SET name = ?, color = ?, parent_id = ? WHERE id = ?`)
      .run(name, color, parentId, id)
  }

  /** All ids in a tag's subtree, including the tag itself. */
  descendantIds(id: string): string[] {
    const rows = this.db
      .prepare(
        `WITH RECURSIVE sub(id) AS (
           SELECT id FROM tags WHERE id = ?
           UNION
           SELECT t.id FROM tags t JOIN sub ON t.parent_id = sub.id
         )
         SELECT id FROM sub`,
      )
      .all(id) as { id: string }[]
    return rows.map((r) => r.id)
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

  /** Paths assigned to a tag OR any of its descendants. */
  pathsForTag(tagId: string): string[] {
    const rows = this.db
      .prepare(
        `WITH RECURSIVE sub(id) AS (
           SELECT id FROM tags WHERE id = ?
           UNION
           SELECT t.id FROM tags t JOIN sub ON t.parent_id = sub.id
         )
         SELECT DISTINCT path FROM file_tags WHERE tag_id IN (SELECT id FROM sub)`,
      )
      .all(tagId) as { path: string }[]
    return rows.map((r) => r.path)
  }
}
