import { testClient } from 'hono/testing'
import { describe, expect, it } from 'vitest'
import app from '../src/app.js'

describe('GET /api/health', () => {
  it('returns status ok', async () => {
    const res = await testClient(app).api.health.$get()

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(typeof body.time).toBe('string')
  })
})
