import { createMiddleware } from 'hono/factory'
import { AppError } from '../lib/errors.js'
import type { AuthEnv } from './auth.js'

/** Use after authMiddleware on every admin route. */
export const requireAdmin = createMiddleware<AuthEnv>(async (c, next) => {
  if (c.var.user.role !== 'admin') {
    throw new AppError('FORBIDDEN', 'Admin access required.')
  }
  await next()
})
