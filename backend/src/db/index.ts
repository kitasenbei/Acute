import Database from 'better-sqlite3'

/**
 * Create and initialise a SQLite database connection.
 *
 * Used to persist the explorer's favourites (pinned folders).
 *
 * @param dbPath - Filesystem path, or ':memory:' for an ephemeral DB.
 */
export function createDb(dbPath = ':memory:'): Database.Database {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)
  return db
}

/** Apply the schema. Idempotent — safe to run on every startup. */
function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS favorites (
      path       TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL UNIQUE,
      color      TEXT NOT NULL,
      created_at TEXT NOT NULL,
      parent_id  TEXT REFERENCES tags(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS file_tags (
      path   TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      PRIMARY KEY (path, tag_id),
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_file_tags_path ON file_tags (path);
  `)

  // Backfill parent_id for databases created before subtags existed.
  const cols = db.prepare(`PRAGMA table_info(tags)`).all() as { name: string }[]
  if (!cols.some((c) => c.name === 'parent_id')) {
    db.exec(`ALTER TABLE tags ADD COLUMN parent_id TEXT REFERENCES tags(id) ON DELETE SET NULL`)
  }
}
