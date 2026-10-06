import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/client.js'
import { carts, users } from '../../src/db/schema.js'
import { resetRateLimits } from '../../src/middleware/rate-limit.js'
import { createUser } from '../helpers/factories.js'
import { authCookieFrom, request } from '../helpers/http.js'
import { resetDb } from '../setup/db.js'

beforeEach(async () => {
  await resetDb()
  resetRateLimits()
})

const valid = {
  fullName: 'Sok Dara',
  email: 'Dara@Example.com',
  phone: '+855 12 345 678',
  password: 'longenough',
}

describe('POST /auth/register', () => {
  it('creates a customer with a cart and logs them in immediately', async () => {
    const { res, status, body } = await request('/auth/register', { json: valid })

    expect(status).toBe(201)
    expect(body.user).toMatchObject({
      email: 'dara@example.com', // lowercased
      phone: '012345678', // normalized to the local form
      fullName: 'Sok Dara',
      role: 'customer',
    })

    // The cookie works right away: no second login needed
    const cookie = authCookieFrom(res)!
    expect(res.headers.get('set-cookie')).toMatch(/HttpOnly/i)
    expect(res.headers.get('set-cookie')).toMatch(/SameSite=Lax/i)
    const me = await request('/auth/me', { cookie })
    expect(me.body.user.id).toBe(body.user.id)

    const [cart] = await db.select().from(carts).where(eq(carts.userId, body.user.id))
    expect(cart).toBeDefined()

    const [row] = await db.select().from(users).where(eq(users.id, body.user.id))
    expect(row!.passwordHash).toMatch(/^\$argon2id\$/)
  })

  it('rejects an email that is already registered, in any letter case', async () => {
    await createUser({ email: 'dara@example.com' })

    const { status, body } = await request('/auth/register', {
      json: { ...valid, email: 'DARA@example.COM' },
    })
    expect(status).toBe(409)
    expect(body.error.code).toBe('EMAIL_TAKEN')
  })

  it('creates only one account when the same email registers twice at the same moment', async () => {
    const results = await Promise.all([
      request('/auth/register', { json: valid }),
      request('/auth/register', { json: valid }),
    ])
    expect(results.map((r) => r.status).sort()).toEqual([201, 409])
    expect(await db.$count(users)).toBe(1)
  })

  it('returns VALIDATION_ERROR with details for invalid fields', async () => {
    const { status, body } = await request('/auth/register', {
      json: { fullName: '', email: 'not-an-email', phone: '12345', password: 'short' },
    })
    expect(status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.details.map((d: { path: string }) => d.path).sort()).toEqual([
      'email',
      'fullName',
      'password',
      'phone',
    ])
  })

  it.each(['012345678', '0123456789', '+85512345678', '012-345-678', '097 123 4567'])(
    'accepts the Cambodian phone number %s',
    async (phone) => {
      const { status } = await request('/auth/register', {
        json: { ...valid, phone, email: `p${phone.replace(/\D/g, '')}@example.com` },
      })
      expect(status).toBe(201)
    },
  )

  it.each(['12345678', '0012345678', '+1 555 123 4567', '01234567890'])(
    'rejects the phone number %s',
    async (phone) => {
      const { status } = await request('/auth/register', { json: { ...valid, phone } })
      expect(status).toBe(400)
    },
  )

  it('returns VALIDATION_ERROR for a body that is not JSON', async () => {
    const { status, body } = await request('/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      json: undefined,
    })
    expect(status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})
