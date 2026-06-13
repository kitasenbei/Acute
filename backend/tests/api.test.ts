import { promises as fs } from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import sharp from 'sharp'
import { createApp } from '../src/app.js'
import { makeTestStack, type TestStack } from './helpers.js'
import type { Express } from 'express'

describe('Explorer API (presentation tier, end-to-end through all tiers)', () => {
  let stack: TestStack
  let app: Express

  beforeEach(async () => {
    stack = await makeTestStack()
    app = createApp({ db: stack.db, rootDir: stack.rootDir })
  })

  afterEach(async () => {
    await stack.cleanup()
  })

  it('GET /health reports ok', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })

  it('lists the root directory', async () => {
    const res = await request(app).get('/api/fs')
    expect(res.status).toBe(200)
    expect(res.body.entries.map((e: { name: string }) => e.name)).toEqual(['Docs', 'notes.txt'])
  })

  it('full lifecycle: create folder → upload → download → rename → delete', async () => {
    const folder = await request(app).post('/api/fs/folder').send({ path: '', name: 'Work' })
    expect(folder.status).toBe(201)

    const upload = await request(app)
      .post('/api/fs/upload')
      .field('path', 'Work')
      .attach('file', Buffer.from('contents'), 'doc.txt')
    expect(upload.status).toBe(201)
    expect(upload.body.path).toBe('Work/doc.txt')

    const download = await request(app).get('/api/fs/content').query({ path: 'Work/doc.txt' })
    expect(download.status).toBe(200)
    expect(download.text).toBe('contents')

    const rename = await request(app)
      .patch('/api/fs/rename')
      .send({ path: 'Work/doc.txt', name: 'final.txt' })
    expect(rename.status).toBe(200)
    expect(rename.body.name).toBe('final.txt')

    const del = await request(app).delete('/api/fs').query({ path: 'Work' })
    expect(del.status).toBe(204)

    const after = await request(app).get('/api/fs').query({ path: 'Work' })
    expect(after.status).toBe(404)
  })

  it('serves a file with a non-ASCII name without crashing', async () => {
    const name = 'café ☕.txt'
    await fs.writeFile(path.join(stack.rootDir, name), 'x')

    const res = await request(app).get('/api/fs/content').query({ path: name })
    expect(res.status).toBe(200)
    expect(res.headers['content-disposition']).toContain("filename*=UTF-8''")
  })

  it('generates a WebP thumbnail for an image', async () => {
    const png = await sharp({
      create: { width: 400, height: 300, channels: 3, background: { r: 10, g: 120, b: 200 } },
    })
      .png()
      .toBuffer()
    await fs.writeFile(path.join(stack.rootDir, 'pic.png'), png)

    const res = await request(app).get('/api/fs/thumbnail').query({ path: 'pic.png', w: 128 })
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('image/webp')
    expect(res.body.length).toBeGreaterThan(0)
  })

  it('returns 400 when thumbnailing an unsupported type', async () => {
    const res = await request(app).get('/api/fs/thumbnail').query({ path: 'notes.txt' })
    expect(res.status).toBe(400)
  })

  it('rejects traversal with 400', async () => {
    const res = await request(app).get('/api/fs').query({ path: '../../etc' })
    expect(res.status).toBe(400)
  })

  it('pins and lists favorites', async () => {
    const add = await request(app).post('/api/favorites').send({ path: 'Docs' })
    expect(add.status).toBe(201)

    const list = await request(app).get('/api/favorites')
    expect(list.body).toHaveLength(1)
    expect(list.body[0].name).toBe('Docs')

    const del = await request(app).delete('/api/favorites').query({ path: 'Docs' })
    expect(del.status).toBe(204)
    expect((await request(app).get('/api/favorites')).body).toHaveLength(0)
  })

  it('lists files carrying a tag', async () => {
    const tag = (await request(app).post('/api/tags').send({ name: 'Keep' })).body
    await request(app).post('/api/tags/assignments').send({ path: 'notes.txt', tagId: tag.id })
    await request(app).post('/api/tags/assignments').send({ path: 'Docs', tagId: tag.id })

    const res = await request(app).get(`/api/tags/${tag.id}/files`)
    expect(res.status).toBe(200)
    expect(res.body.tag.name).toBe('Keep')
    expect(res.body.entries.map((e: { name: string }) => e.name).sort()).toEqual(['Docs', 'notes.txt'])
  })

  it('serves the OpenAPI spec and Swagger UI', async () => {
    const spec = await request(app).get('/api/docs.json')
    expect(spec.status).toBe(200)
    expect(spec.body.openapi).toBe('3.0.3')
    expect(spec.body.paths['/api/fs']).toBeDefined()

    const ui = await request(app).get('/api/docs/')
    expect(ui.status).toBe(200)
    expect(ui.text).toContain('swagger-ui')
  })
})
