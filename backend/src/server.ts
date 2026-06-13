import { promises as fs } from 'node:fs'
import { config } from './config.js'
import { createDb } from './db/index.js'
import { createApp } from './app.js'

async function main(): Promise<void> {
  await fs.mkdir(config.dataDir, { recursive: true })

  const db = createDb(config.dbPath)
  const app = createApp({ db, rootDir: config.rootDir, cacheDir: config.thumbDir })

  app.listen(config.port, () => {
    console.log(`File explorer backend listening on http://localhost:${config.port}`)
    console.log(`Browsing root: ${config.rootDir}`)
  })
}

main().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
