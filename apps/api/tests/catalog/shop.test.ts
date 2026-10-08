import { beforeAll, describe, expect, it } from 'vitest'
import { db } from '../../src/db/client.js'
import { productImages } from '../../src/db/schema.js'
import { createCategory, createProduct } from '../helpers/factories.js'
import { request } from '../helpers/http.js'
import { resetDb } from '../setup/db.js'

// One catalog for the whole file (read-only tests):
//   Clothing (active)        -> T-shirts (active)
//   Hidden parent (inactive) -> Orphan child (active, but hidden through its parent)
//   Electronics (active)
//   Old stuff (inactive)
let ids: Record<string, string>

beforeAll(async () => {
  await resetDb()
  const clothing = await createCategory({ name: 'Clothing', slug: 'clothing', sortOrder: 1 })
  const tshirts = await createCategory({
    name: 'T-shirts',
    slug: 't-shirts',
    parentId: clothing.id,
  })
  const electronics = await createCategory({
    name: 'Electronics',
    slug: 'electronics',
    sortOrder: 2,
  })
  const hiddenParent = await createCategory({ name: 'Hidden', slug: 'hidden', isActive: false })
  const orphan = await createCategory({ name: 'Orphan', slug: 'orphan', parentId: hiddenParent.id })
  const old = await createCategory({ name: 'Old stuff', slug: 'old', isActive: false })

  const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000)
  const scarf = await createProduct({
    name: 'Krama Scarf',
    slug: 'krama-scarf',
    categoryId: clothing.id,
    priceCents: 600,
    createdAt: at(5),
  })
  const tee = await createProduct({
    name: 'Angkor Tee',
    slug: 'angkor-tee',
    categoryId: tshirts.id,
    priceCents: 1200,
    createdAt: at(4),
    avgRating: '4.50',
    reviewCount: 2,
  })
  const cheapTee = await createProduct({
    name: 'Basic Tee 50%',
    slug: 'basic-tee',
    categoryId: tshirts.id,
    priceCents: 400,
    stockQuantity: 0,
    createdAt: at(3),
  })
  const earbuds = await createProduct({
    name: 'Wireless Earbuds',
    slug: 'earbuds',
    categoryId: electronics.id,
    priceCents: 2900,
    createdAt: at(2),
    avgRating: '3.00',
    reviewCount: 1,
  })
  await createProduct({
    name: 'Inactive Tee',
    slug: 'inactive-tee',
    categoryId: tshirts.id,
    isActive: false,
  })
  await createProduct({ name: 'Orphan Item', slug: 'orphan-item', categoryId: orphan.id })
  await createProduct({ name: 'Old Item', slug: 'old-item', categoryId: old.id })

  await db.insert(productImages).values([
    { productId: tee.id, url: '/uploads/tee-2.png', sortOrder: 1, isPrimary: false },
    { productId: tee.id, url: '/uploads/tee-1.png', sortOrder: 0, isPrimary: true },
  ])

  ids = {
    clothing: clothing.id,
    scarf: scarf.id,
    tee: tee.id,
    cheapTee: cheapTee.id,
    earbuds: earbuds.id,
  }
})

const list = async (query = '') => (await request(`/products${query}`)).body
const names = (body: { items: { name: string }[] }) => body.items.map((p) => p.name)

describe('GET /categories', () => {
  it('returns the active tree, hiding inactive categories and children of inactive parents', async () => {
    const { status, body } = await request('/categories')
    expect(status).toBe(200)
    expect(body.items).toEqual([
      {
        id: ids.clothing,
        name: 'Clothing',
        slug: 'clothing',
        children: [expect.objectContaining({ slug: 't-shirts' })],
      },
      expect.objectContaining({ slug: 'electronics', children: [] }),
    ])
  })
})

describe('GET /products', () => {
  it('returns visible products in the pagination shape, newest first by default', async () => {
    const body = await list()
    expect(body).toMatchObject({ page: 1, pageSize: 20, total: 4 })
    expect(names(body)).toEqual(['Wireless Earbuds', 'Basic Tee 50%', 'Angkor Tee', 'Krama Scarf'])
  })

  it('hides inactive products and products whose category or parent category is inactive', async () => {
    const all = names(await list('?pageSize=100'))
    expect(all).not.toContain('Inactive Tee')
    expect(all).not.toContain('Old Item')
    expect(all).not.toContain('Orphan Item')
  })

  it('includes sub-category products when filtering by a parent category', async () => {
    expect(names(await list('?category=clothing')).sort()).toEqual([
      'Angkor Tee',
      'Basic Tee 50%',
      'Krama Scarf',
    ])
    expect(names(await list('?category=t-shirts')).sort()).toEqual(['Angkor Tee', 'Basic Tee 50%'])
  })

  it('returns an empty list for an unknown or hidden category', async () => {
    expect((await list('?category=nope')).total).toBe(0)
    expect((await list('?category=old')).total).toBe(0)
  })

  it('searches by name, case-insensitive, treating % as a normal character', async () => {
    expect(names(await list('?search=TEE'))).toHaveLength(2)
    expect(names(await list('?search=50%25'))).toEqual(['Basic Tee 50%'])
    expect(names(await list('?search=%25'))).toEqual(['Basic Tee 50%'])
  })

  it('filters by price range in cents, inclusive', async () => {
    expect(names(await list('?minPrice=600&maxPrice=1200')).sort()).toEqual([
      'Angkor Tee',
      'Krama Scarf',
    ])
  })

  it('sorts by price and by rating', async () => {
    expect(names(await list('?sort=price_asc'))).toEqual([
      'Basic Tee 50%',
      'Krama Scarf',
      'Angkor Tee',
      'Wireless Earbuds',
    ])
    expect(names(await list('?sort=price_desc'))[0]).toBe('Wireless Earbuds')
    expect(names(await list('?sort=rating')).slice(0, 2)).toEqual([
      'Angkor Tee',
      'Wireless Earbuds',
    ])
  })

  it('paginates', async () => {
    const page2 = await list('?sort=price_asc&page=2&pageSize=3')
    expect(page2).toMatchObject({ page: 2, pageSize: 3, total: 4 })
    expect(names(page2)).toEqual(['Wireless Earbuds'])
  })

  it('shows the primary image, stock availability, and rating as a number', async () => {
    const tee = (await list()).items.find((p: { slug: string }) => p.slug === 'angkor-tee')
    expect(tee).toMatchObject({
      image: { url: '/uploads/tee-1.png' },
      inStock: true,
      avgRating: 4.5,
    })
    const cheap = (await list()).items.find((p: { slug: string }) => p.slug === 'basic-tee')
    expect(cheap).toMatchObject({ inStock: false, image: null })
  })

  it('rejects invalid query values', async () => {
    for (const q of ['?pageSize=101', '?page=0', '?sort=random', '?minPrice=-1', '?minPrice=1.5']) {
      const { status, body } = await request(`/products${q}`)
      expect(status, q).toBe(400)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    }
  })
})

describe('GET /products/:slug', () => {
  it('returns the product with images in order and the category breadcrumb', async () => {
    const { status, body } = await request('/products/angkor-tee')
    expect(status).toBe(200)
    expect(body.product).toMatchObject({
      name: 'Angkor Tee',
      categories: [{ slug: 'clothing' }, { slug: 't-shirts' }],
    })
    expect(body.product.images.map((i: { url: string }) => i.url)).toEqual([
      '/uploads/tee-1.png',
      '/uploads/tee-2.png',
    ])
  })

  it('returns 404 for hidden products', async () => {
    for (const slug of ['inactive-tee', 'orphan-item', 'old-item', 'does-not-exist']) {
      const { status, body } = await request(`/products/${slug}`)
      expect(status, slug).toBe(404)
      expect(body.error.code).toBe('NOT_FOUND')
    }
  })
})
