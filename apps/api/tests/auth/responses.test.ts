import { beforeEach, describe, expect, it } from 'vitest'
import { resetRateLimits } from '../../src/middleware/rate-limit.js'
import { createAdmin, createUser, TEST_PASSWORD } from '../helpers/factories.js'
import { authCookieFrom, request } from '../helpers/http.js'
import { resetDb } from '../setup/db.js'

beforeEach(async () => {
  await resetDb()
  resetRateLimits()
})

describe('API responses', () => {
  it('never contain the password hash', async () => {
    await createUser({ email: 'dara@example.com' })
    await createAdmin({ email: 'admin@example.com' })

    const register = await request('/auth/register', {
      json: {
        fullName: 'New',
        email: 'new@example.com',
        phone: '012345678',
        password: 'longenough',
      },
    })
    const login = await request('/auth/login', {
      json: { email: 'dara@example.com', password: TEST_PASSWORD },
    })
    const adminLogin = await request('/auth/login', {
      json: { email: 'admin@example.com', password: TEST_PASSWORD },
    })
    const me = await request('/auth/me', { cookie: authCookieFrom(login.res)! })
    const failed = await request('/auth/login', {
      json: { email: 'dara@example.com', password: 'wrong-password' },
    })

    for (const r of [register, login, adminLogin, me, failed]) {
      expect(r.text).not.toMatch(/password_?hash/i)
      expect(r.text).not.toContain('$argon2')
    }
  })

  it('use the standard error shape for unknown routes', async () => {
    const { status, body } = await request('/does-not-exist')
    expect(status).toBe(404)
    expect(body).toEqual({
      error: { code: 'NOT_FOUND', message: expect.any(String) },
    })
  })

  it('include secure headers', async () => {
    const { res } = await request('/health')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN')
  })
})
