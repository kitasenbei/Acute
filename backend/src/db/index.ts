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
  `)
}
