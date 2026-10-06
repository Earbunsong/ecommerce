import { Hono } from 'hono'
import { beforeEach, describe, expect, it } from 'vitest'
import { type AuthEnv, authMiddleware } from '../../src/middleware/auth.js'
import { errorHandler } from '../../src/middleware/error-handler.js'
import { resetRateLimits } from '../../src/middleware/rate-limit.js'
import { requireAdmin } from '../../src/middleware/require-admin.js'
import { loginAs } from '../helpers/auth.js'
import { createAdmin, createUser, TEST_PASSWORD } from '../helpers/factories.js'
import { request } from '../helpers/http.js'
import { resetDb } from '../setup/db.js'

beforeEach(async () => {
  await resetDb()
  resetRateLimits()
})

describe('requireAdmin', () => {
  // No admin routes exist yet (Phase 3+), so test the guard on a small app of its own
  const adminApp = new Hono<AuthEnv>()
    .use(authMiddleware, requireAdmin)
    .get('/admin-only', (c) => c.json({ ok: true }))
  adminApp.onError(errorHandler)

  const get = (cookie?: string) =>
    adminApp.request('/admin-only', { headers: cookie ? { cookie } : {} })

  it('lets an admin through', async () => {
    const admin = await createAdmin()
    expect((await get(await loginAs(admin.email))).status).toBe(200)
  })

  it('rejects a customer with FORBIDDEN', async () => {
    const customer = await createUser()
    const res = await get(await loginAs(customer.email))
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('FORBIDDEN')
  })

  it('rejects a guest with UNAUTHENTICATED', async () => {
    expect((await get()).status).toBe(401)
  })
})

describe('rate limiting', () => {
  it('allows 10 login attempts per IP, then returns 429 RATE_LIMITED', async () => {
    await createUser({ email: 'dara@example.com' })
    const attempt = () =>
      request('/auth/login', { json: { email: 'dara@example.com', password: 'wrong-password' } })

    for (let i = 0; i < 10; i++) expect((await attempt()).status).toBe(401)

    const blocked = await attempt()
    expect(blocked.status).toBe(429)
    expect(blocked.body.error.code).toBe('RATE_LIMITED')
    expect(Number(blocked.res.headers.get('retry-after'))).toBeGreaterThan(0)

    // Even the correct password is blocked until the window ends
    const correct = await request('/auth/login', {
      json: { email: 'dara@example.com', password: TEST_PASSWORD },
    })
    expect(correct.status).toBe(429)
  })

  it('counts login and register separately', async () => {
    for (let i = 0; i < 10; i++) {
      await request('/auth/login', { json: { email: 'x@example.com', password: 'x' } })
    }
    const register = await request('/auth/register', {
      json: { fullName: 'A', email: 'a@example.com', phone: '012345678', password: 'longenough' },
    })
    expect(register.status).toBe(201)
  })
})
