import type Database from 'better-sqlite3'
import type { Favorite } from '../types.js'

interface FavoriteRow {
  path: string
  name: string
  created_at: string
}

/** Data-access layer for pinned folders, persisted in SQLite. */
export class FavoritesRepository {
  constructor(private readonly db: Database.Database) {}

  private static toDomain(row: FavoriteRow): Favorite {
    return { path: row.path, name: row.name, createdAt: row.created_at }
  }

  findAll(): Favorite[] {
    const rows = this.db
      .prepare(`SELECT * FROM favorites ORDER BY name COLLATE NOCASE`)
      .all() as FavoriteRow[]
    return rows.map(FavoritesRepository.toDomain)
  }

  add(favorite: Favorite): void {
    this.db
      .prepare(
        `INSERT INTO favorites (path, name, created_at)
         VALUES (@path, @name, @createdAt)
         ON CONFLICT(path) DO UPDATE SET name = excluded.name`,
      )
      .run(favorite)
  }

  remove(favPath: string): boolean {
    const info = this.db.prepare(`DELETE FROM favorites WHERE path = ?`).run(favPath)
    return info.changes > 0
  }
}
