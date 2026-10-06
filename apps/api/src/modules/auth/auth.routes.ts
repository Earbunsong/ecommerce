import { Hono } from 'hono'
import { clearAuthCookie, setAuthCookie } from '../../lib/auth-cookie.js'
import { validate } from '../../lib/validate.js'
import { type AuthEnv, authMiddleware } from '../../middleware/auth.js'
import { authRateLimit } from '../../middleware/rate-limit.js'
import { loginSchema, registerSchema } from './auth.schemas.js'
import { authService } from './auth.service.js'

export const authRoutes = new Hono<AuthEnv>()
  // Registering logs the customer in immediately (flowchart 1)
  .post('/register', authRateLimit('register'), validate('json', registerSchema), async (c) => {
    const user = await authService.register(c.req.valid('json'))
    await setAuthCookie(c, user.id)
    return c.json({ user }, 201)
  })
  .post('/login', authRateLimit('login'), validate('json', loginSchema), async (c) => {
    const user = await authService.login(c.req.valid('json'))
    await setAuthCookie(c, user.id)
    return c.json({ user })
  })
  // The JWT stays valid until it expires, but the browser no longer sends it (architecture §4.9)
  .post('/logout', (c) => {
    clearAuthCookie(c)
    return c.body(null, 204)
  })
  .get('/me', authMiddleware, (c) => c.json({ user: c.var.user }))
