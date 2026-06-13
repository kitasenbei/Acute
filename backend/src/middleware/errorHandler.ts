import type { ErrorRequestHandler } from 'express'
import { AppError } from '../errors.js'

/** Convert thrown errors into JSON responses. Must be registered last. */
// Express identifies error handlers by arity — all four params must stay.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const statusCode = err instanceof AppError ? err.statusCode : 500
  const name = err instanceof Error ? err.name : 'Error'
  const message =
    statusCode === 500 ? 'Internal server error' : (err as Error).message

  if (statusCode === 500) console.error(err)

  res.status(statusCode).json({ error: { name, message } })
}
