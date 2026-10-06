import type { Context, ErrorHandler, NotFoundHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { AppError, type ErrorCode, errorStatus } from '../lib/errors.js'

function errorResponse(c: Context, code: ErrorCode, message: string, details?: unknown) {
  return c.json(
    { error: { code, message, ...(details === undefined ? {} : { details }) } },
    errorStatus[code] as ContentfulStatusCode,
  )
}

// Every error leaves the API in the same shape: { error: { code, message, details? } } (§4.10)
export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    return errorResponse(c, err.code, err.message, err.details)
  }

  // Thrown by Hono itself, e.g. a request body that is not valid JSON
  if (err instanceof HTTPException && err.status === 400) {
    return errorResponse(c, 'VALIDATION_ERROR', 'The request body is not valid.')
  }

  // Unexpected: log the details, return nothing internal to the client
  console.error(err)
  return errorResponse(c, 'INTERNAL_ERROR', 'Something went wrong. Please try again.')
}

export const notFoundHandler: NotFoundHandler = (c) =>
  errorResponse(c, 'NOT_FOUND', 'The requested resource does not exist.')
