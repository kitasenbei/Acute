import path from 'node:path'
import { ValidationError } from '../errors.js'

/**
 * Translates between root-relative paths (what the API speaks) and absolute
 * filesystem paths, while guaranteeing nothing escapes the configured root.
 *
 * This is the single chokepoint for path-traversal safety: every absolute
 * path handed to the filesystem layer passes through {@link toAbsolute}.
 */
export class PathResolver {
  readonly root: string

  constructor(rootDir: string) {
    this.root = path.resolve(rootDir)
  }

  /** Resolve a root-relative path to an absolute one, rejecting escapes. */
  toAbsolute(relPath = ''): string {
    const cleaned = relPath.replace(/^[/\\]+/, '')
    const abs = path.resolve(this.root, cleaned)
    if (abs !== this.root && !abs.startsWith(this.root + path.sep)) {
      throw new ValidationError('Path is outside the allowed root')
    }
    return abs
  }

  /** Express an absolute path relative to the root ('' === root). */
  toRelative(abs: string): string {
    const rel = path.relative(this.root, abs)
    return rel === '' ? '' : rel.split(path.sep).join('/')
  }

  /** The parent of a root-relative path, or null if it is the root. */
  parentOf(relPath: string): string | null {
    if (!relPath) return null
    const parent = path.dirname(relPath)
    return parent === '.' ? '' : parent.split(path.sep).join('/')
  }
}

/** Validate a single path segment (a file or folder name). */
export function assertValidName(name: string): string {
  const trimmed = (name ?? '').trim()
  if (!trimmed) throw new ValidationError('A name is required')
  if (trimmed === '.' || trimmed === '..' || /[/\\]/.test(trimmed)) {
    throw new ValidationError('Name must not contain path separators')
  }
  return trimmed
}
