import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type Database from 'better-sqlite3'
import { createDb } from '../src/db/index.js'

export interface TestStack {
  db: Database.Database
  rootDir: string
  cleanup(): Promise<void>
}

/**
 * Build an isolated stack: an in-memory SQLite DB plus a throwaway temp
 * directory that serves as the browsing root, pre-seeded with a small tree.
 */
export async function makeTestStack(): Promise<TestStack> {
  const db = createDb(':memory:')
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'explorer-test-'))

  // Seed: /notes.txt, /Docs/, /Docs/readme.md
  await fs.writeFile(path.join(rootDir, 'notes.txt'), 'hello')
  await fs.mkdir(path.join(rootDir, 'Docs'))
  await fs.writeFile(path.join(rootDir, 'Docs', 'readme.md'), '# title')

  return {
    db,
    rootDir,
    async cleanup() {
      db.close()
      await fs.rm(rootDir, { recursive: true, force: true })
    },
  }
}
