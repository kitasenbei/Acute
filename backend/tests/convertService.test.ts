import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import sharp from 'sharp'
import { ConvertService } from '../src/services/convertService.js'
import { ValidationError } from '../src/errors.js'
import { makeTestStack, type TestStack } from './helpers.js'

describe('ConvertService', () => {
  let stack: TestStack
  let service: ConvertService

  beforeEach(async () => {
    stack = await makeTestStack()
    service = new ConvertService({ rootDir: stack.rootDir })
  })

  afterEach(async () => {
    await stack.cleanup()
  })

  it('converts an image (png -> jpg)', async () => {
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#123456' } }).png().toBuffer()
    await fs.writeFile(path.join(stack.rootDir, 'pic.png'), png)

    const entry = await service.convert('pic.png', 'jpg')
    expect(entry.name).toBe('pic.jpg')
    expect((await sharp(path.join(stack.rootDir, 'pic.jpg')).metadata()).format).toBe('jpeg')
  })

  it('converts a video (mp4 -> mkv) and reports progress', async () => {
    const src = path.join(stack.rootDir, 'clip.mp4')
    await new Promise<void>((resolve, reject) => {
      const ff = spawn('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'testsrc=d=1:s=32x32:r=10', src], { stdio: 'ignore' })
      ff.on('error', reject)
      ff.on('close', (c) => (c === 0 ? resolve() : reject(new Error('gen'))))
    })

    let lastProgress = 0
    const entry = await service.convert('clip.mp4', 'mkv', (p) => (lastProgress = p))
    expect(entry.name).toBe('clip.mkv')
    expect(lastProgress).toBeGreaterThan(0)
  }, 20000)

  it('rejects unsupported types', async () => {
    await fs.writeFile(path.join(stack.rootDir, 'x.txt'), 'hi')
    await expect(service.convert('x.txt', 'png')).rejects.toBeInstanceOf(ValidationError)
  })
})
