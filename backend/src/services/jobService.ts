import { randomUUID } from 'node:crypto'
import path from 'node:path'
import type { ConvertService } from './convertService.js'
import type { Entry } from '../types.js'

export interface Job {
  id: string
  kind: 'convert'
  label: string
  status: 'running' | 'done' | 'error'
  progress: number // 0..1
  createdAt: number
  result?: Entry
  error?: string
}

/**
 * In-memory registry of background jobs (currently media conversions). The
 * conversion runs detached; the frontend polls {@link list} for progress.
 */
export class JobService {
  private readonly jobs = new Map<string, Job>()

  constructor(private readonly converter: ConvertService) {}

  list(): Job[] {
    return [...this.jobs.values()].sort((a, b) => b.createdAt - a.createdAt)
  }

  startConvert(relPath: string, format: string): Job {
    const job: Job = {
      id: randomUUID(),
      kind: 'convert',
      label: `${path.basename(relPath)} → ${String(format).toUpperCase()}`,
      status: 'running',
      progress: 0,
      createdAt: Date.now(),
    }
    this.jobs.set(job.id, job)

    this.converter
      .convert(relPath, format, (p) => {
        job.progress = Math.min(0.99, p)
      })
      .then((entry) => {
        job.status = 'done'
        job.progress = 1
        job.result = entry
      })
      .catch((err: Error) => {
        job.status = 'error'
        job.error = err.message
      })

    return job
  }
}
