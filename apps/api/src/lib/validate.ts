import { zValidator } from '@hono/zod-validator'
import type { ValidationTargets } from 'hono'
import type { ZodType } from 'zod'
import { AppError } from './errors.js'

/**
 * Zod validation for a route. On failure it throws VALIDATION_ERROR, so every invalid
 * request gets the standard error shape with the list of issues in `details`.
 */
export function validate<T extends ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) {
  return zValidator(target, schema, (result) => {
    if (!result.success) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Some fields are invalid.',
        result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      )
    }
  })
}
