import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = process.env.DATA_DIR ?? path.join(__dirname, '..', 'data')

export interface Config {
  port: number
  /** The directory the explorer is confined to. Browsing cannot escape it. */
  rootDir: string
  dataDir: string
  dbPath: string
}

export const config: Config = {
  port: Number(process.env.PORT ?? 3001),
  rootDir: process.env.ROOT_DIR ?? os.homedir(),
  dataDir,
  dbPath: process.env.DB_PATH ?? path.join(dataDir, 'app.db'),
}
