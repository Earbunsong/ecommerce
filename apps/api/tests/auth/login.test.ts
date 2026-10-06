import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/client.js'
import { users } from '../../src/db/schema.js'
import { resetRateLimits } from '../../src/middleware/rate-limit.js'
import { createUser, TEST_PASSWORD } from '../helpers/factories.js'
import { authCookieFrom, request } from '../helpers/http.js'
import { resetDb } from '../setup/db.js'

beforeEach(async () => {
  await resetDb()
  resetRateLimits()
})

describe('POST /auth/login', () => {
  it('logs in with the correct password, ignoring email letter case', async () => {
    const user = await createUser({ email: 'dara@example.com' })
    const { res, status, body } = await request('/auth/login', {
      json: { email: 'Dara@Example.com', password: TEST_PASSWORD },
    })
    expect(status).toBe(200)
    expect(body.user.id).toBe(user.id)
    expect(authCookieFrom(res)).toBeDefined()
  })

  it('gives the same INVALID_CREDENTIALS for a wrong password and an unknown email', async () => {
    await createUser({ email: 'dara@example.com' })

    const wrongPassword = await request('/auth/login', {
      json: { email: 'dara@example.com', password: 'wrong-password' },
    })
    const unknownEmail = await request('/auth/login', {
      json: { email: 'nobody@example.com', password: 'wrong-password' },
    })

    for (const r of [wrongPassword, unknownEmail]) {
      expect(r.status).toBe(401)
      expect(r.body.error.code).toBe('INVALID_CREDENTIALS')
      expect(authCookieFrom(r.res)).toBeUndefined()
    }
    expect(wrongPassword.body).toEqual(unknownEmail.body)
  })

  it('reveals ACCOUNT_DISABLED only to someone with the correct password', async () => {
    await createUser({ email: 'off@example.com', isActive: false })

    const wrong = await request('/auth/login', {
      json: { email: 'off@example.com', password: 'wrong-password' },
    })
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS')

    const right = await request('/auth/login', {
      json: { email: 'off@example.com', password: TEST_PASSWORD },
    })
    expect(right.status).toBe(403)
    expect(right.body.error.code).toBe('ACCOUNT_DISABLED')
    expect(authCookieFrom(right.res)).toBeUndefined()
  })

  it('logout clears the cookie', async () => {
    const { res, status } = await request('/auth/logout', { method: 'POST' })
    expect(status).toBe(204)
    expect(res.headers.get('set-cookie')).toMatch(/shopkh_auth=;.*Max-Age=0/i)
  })
})

describe('GET /auth/me', () => {
  it('requires a cookie', async () => {
    const { status, body } = await request('/auth/me')
    expect(status).toBe(401)
    expect(body.error.code).toBe('UNAUTHENTICATED')
  })

  it('rejects a forged token', async () => {
    const { status } = await request('/auth/me', { cookie: 'shopkh_auth=not.a.jwt' })
    expect(status).toBe(401)
  })

  it('rejects a user who was deactivated after logging in, on the very next request', async () => {
    const user = await createUser()
    const login = await request('/auth/login', {
      json: { email: user.email, password: TEST_PASSWORD },
    })
    const cookie = authCookieFrom(login.res)!
    expect((await request('/auth/me', { cookie })).status).toBe(200)

    await db.update(users).set({ isActive: false }).where(eq(users.id, user.id))

    const { status, body } = await request('/auth/me', { cookie })
    expect(status).toBe(403)
    expect(body.error.code).toBe('ACCOUNT_DISABLED')
  })

  it('reads the role from the database, not from the token', async () => {
    const user = await createUser()
    const login = await request('/auth/login', {
      json: { email: user.email, password: TEST_PASSWORD },
    })
    await db.update(users).set({ role: 'admin' }).where(eq(users.id, user.id))

    const { body } = await request('/auth/me', { cookie: authCookieFrom(login.res)! })
    expect(body.user.role).toBe('admin')
  })
})
