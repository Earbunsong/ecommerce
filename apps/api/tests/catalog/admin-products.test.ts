import { beforeEach, describe, expect, it } from 'vitest'
import { loginAs } from '../helpers/auth.js'
import { createAdmin, createCategory, createProduct, createUser } from '../helpers/factories.js'
import { request } from '../helpers/http.js'
import { runConcurrently } from '../helpers/concurrency.js'
import { resetDb } from '../setup/db.js'

let admin: string
let categoryId: string

beforeEach(async () => {
  await resetDb()
  admin = await loginAs((await createAdmin()).email)
  categoryId = (await createCategory()).id
})

const newProduct = () => ({ name: 'Angkor Tee', sku: 'TEE-001', categoryId, priceCents: 1200 })

describe('admin routes guard', () => {
  it('rejects guests and customers on every admin catalog route', async () => {
    const customer = await loginAs((await createUser()).email)
    const routes = [
      ['GET', '/admin/products'],
      ['POST', '/admin/products'],
      ['GET', '/admin/categories'],
      ['POST', '/admin/categories'],
    ] as const
    for (const [method, path] of routes) {
      expect((await request(path, { method })).status, `${method} ${path} guest`).toBe(401)
      expect(
        (await request(path, { method, cookie: customer })).status,
        `${method} ${path} customer`,
      ).toBe(403)
    }
  })
})

describe('POST /admin/products', () => {
  it('creates a product with a slug generated from the name', async () => {
    const { status, body } = await request('/admin/products', { json: newProduct(), cookie: admin })
    expect(status).toBe(201)
    expect(body.product).toMatchObject({ slug: 'angkor-tee', stockQuantity: 0, isActive: true })
  })

  it('adds a number to the generated slug when the name is already used', async () => {
    await request('/admin/products', { json: newProduct(), cookie: admin })
    const { body } = await request('/admin/products', {
      json: { ...newProduct(), sku: 'TEE-002' },
      cookie: admin,
    })
    expect(body.product.slug).toBe('angkor-tee-2')
  })

  it('rejects a duplicate SKU with ALREADY_EXISTS', async () => {
    await request('/admin/products', { json: newProduct(), cookie: admin })
    const { status, body } = await request('/admin/products', {
      json: { ...newProduct(), name: 'Other' },
      cookie: admin,
    })
    expect(status).toBe(409)
    expect(body.error).toMatchObject({
      code: 'ALREADY_EXISTS',
      message: expect.stringContaining('SKU'),
    })
  })

  it('rejects zero or fractional prices, negative stock, and an inactive category', async () => {
    const inactive = await createCategory({ isActive: false })
    for (const bad of [
      { priceCents: 0 },
      { priceCents: 12.5 },
      { stockQuantity: -1 },
      { categoryId: inactive.id },
    ]) {
      const { status } = await request('/admin/products', {
        json: { ...newProduct(), ...bad },
        cookie: admin,
      })
      expect(status, JSON.stringify(bad)).toBe(400)
    }
  })
})

describe('PATCH /admin/products/:id', () => {
  it('updates fields and can deactivate and reactivate a product', async () => {
    const product = await createProduct({ categoryId })
    const off = await request(`/admin/products/${product.id}`, {
      method: 'PATCH',
      json: { isActive: false, priceCents: 1500 },
      cookie: admin,
    })
    expect(off.body.product).toMatchObject({ isActive: false, priceCents: 1500 })

    const on = await request(`/admin/products/${product.id}`, {
      method: 'PATCH',
      json: { isActive: true },
      cookie: admin,
    })
    expect(on.body.product.isActive).toBe(true)
  })

  it('rejects stockQuantity: stock only changes through stock adjustments', async () => {
    const product = await createProduct({ categoryId, stockQuantity: 5 })
    const { status, body } = await request(`/admin/products/${product.id}`, {
      method: 'PATCH',
      json: { stockQuantity: 999 },
      cookie: admin,
    })
    expect(status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    const after = await request(`/admin/products/${product.id}`, { cookie: admin })
    expect(after.body.product.stockQuantity).toBe(5)
  })

  it('rejects an empty update', async () => {
    const product = await createProduct({ categoryId })
    const { status } = await request(`/admin/products/${product.id}`, {
      method: 'PATCH',
      json: {},
      cookie: admin,
    })
    expect(status).toBe(400)
  })

  it('returns 404 for an unknown product', async () => {
    const { status } = await request('/admin/products/00000000-0000-4000-8000-000000000000', {
      method: 'PATCH',
      json: { name: 'x' },
      cookie: admin,
    })
    expect(status).toBe(404)
  })
})

describe('GET /admin/products', () => {
  it('lists inactive products too, and filters by status and SKU search', async () => {
    await createProduct({ categoryId, name: 'Visible', sku: 'VIS-1' })
    await createProduct({ categoryId, name: 'Hidden', sku: 'HID-1', isActive: false })

    expect((await request('/admin/products', { cookie: admin })).body.total).toBe(2)
    const inactive = await request('/admin/products?isActive=false', { cookie: admin })
    expect(inactive.body.items.map((p: { name: string }) => p.name)).toEqual(['Hidden'])
    const bySku = await request('/admin/products?search=vis-', { cookie: admin })
    expect(bySku.body.items.map((p: { name: string }) => p.name)).toEqual(['Visible'])
  })
})

describe('POST /admin/products/:id/stock-adjustments', () => {
  const adjust = (id: string, delta: number, cookie = admin) =>
    request(`/admin/products/${id}/stock-adjustments`, { json: { delta, reason: 'test' }, cookie })

  it('adds and removes stock', async () => {
    const product = await createProduct({ categoryId, stockQuantity: 5 })
    expect((await adjust(product.id, 20)).body.product.stockQuantity).toBe(25)
    expect((await adjust(product.id, -25)).body.product.stockQuantity).toBe(0)
  })

  it('never lets stock go below zero', async () => {
    const product = await createProduct({ categoryId, stockQuantity: 3 })
    const { status, body } = await adjust(product.id, -4)
    expect(status).toBe(409)
    expect(body.error).toMatchObject({
      code: 'OUT_OF_STOCK',
      message: expect.stringContaining('3'),
    })
  })

  it('applies simultaneous adjustments atomically: never negative, nothing lost', async () => {
    const product = await createProduct({ categoryId, stockQuantity: 5 })
    // 10 admins remove 1 at the same moment: exactly 5 succeed
    const results = await runConcurrently(10, () => adjust(product.id, -1))
    const statuses = results.map((r) => (r.status === 'fulfilled' ? r.value.status : 0))
    expect(statuses.filter((s) => s === 200)).toHaveLength(5)
    expect(statuses.filter((s) => s === 409)).toHaveLength(5)

    const { body } = await request(`/admin/products/${product.id}`, { cookie: admin })
    expect(body.product.stockQuantity).toBe(0)
  })

  it('requires a reason and a non-zero change', async () => {
    const product = await createProduct({ categoryId })
    for (const bad of [{ delta: 0, reason: 'x' }, { delta: 1, reason: '' }, { delta: 1 }]) {
      const { status } = await request(`/admin/products/${product.id}/stock-adjustments`, {
        json: bad,
        cookie: admin,
      })
      expect(status, JSON.stringify(bad)).toBe(400)
    }
  })

  it('returns 404 for an unknown product', async () => {
    expect((await adjust('00000000-0000-4000-8000-000000000000', 1)).status).toBe(404)
  })
})
