import { createMiddleware } from 'hono/factory'
import { readAuthCookie } from '../lib/auth-cookie.js'
import { AppError } from '../lib/errors.js'
import { type PublicUser, usersService } from '../modules/users/users.service.js'

export type AuthEnv = { Variables: { user: PublicUser } }

/**
 * Requires a valid auth cookie. Loads the user from the database on every request and rejects
 * inactive users, so `c.var.user` always reflects the database, not the token (architecture §4.9).
 */
export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const userId = await readAuthCookie(c)
  if (!userId) throw new AppError('UNAUTHENTICATED', 'Please log in.')

  c.set('user', await usersService.getActiveUser(userId))
  await next()
})
