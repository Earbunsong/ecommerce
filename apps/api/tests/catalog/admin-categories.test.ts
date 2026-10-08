import { beforeEach, describe, expect, it } from 'vitest'
import { loginAs } from '../helpers/auth.js'
import { createAdmin, createCategory } from '../helpers/factories.js'
import { request } from '../helpers/http.js'
import { resetDb } from '../setup/db.js'

let admin: string

beforeEach(async () => {
  await resetDb()
  admin = await loginAs((await createAdmin()).email)
})

const create = (json: object) => request('/admin/categories', { json, cookie: admin })
const update = (id: string, json: object) =>
  request(`/admin/categories/${id}`, { method: 'PATCH', json, cookie: admin })

describe('admin categories', () => {
  it('creates top-level and sub-categories with generated slugs', async () => {
    const parent = await create({ name: 'Home & Kitchen' })
    expect(parent.status).toBe(201)
    expect(parent.body.category.slug).toBe('home-kitchen')

    const child = await create({ name: 'Cookware', parentId: parent.body.category.id })
    expect(child.body.category.parentId).toBe(parent.body.category.id)
  })

  it('lists inactive categories too', async () => {
    await createCategory({ isActive: false })
    const { body } = await request('/admin/categories', { cookie: admin })
    expect(body.items).toHaveLength(1)
  })

  it('rejects a third level', async () => {
    const top = await createCategory()
    const sub = await createCategory({ parentId: top.id })
    const { status, body } = await create({ name: 'Too deep', parentId: sub.id })
    expect(status).toBe(400)
    expect(body.error.message).toContain('2 levels')
  })

  it('rejects a category as its own parent', async () => {
    const category = await createCategory()
    const { status, body } = await update(category.id, { parentId: category.id })
    expect(status).toBe(400)
    expect(body.error.message).toContain('own parent')
  })

  it('rejects making a category with children into a sub-category', async () => {
    const a = await createCategory()
    await createCategory({ parentId: a.id })
    const b = await createCategory()
    const { status } = await update(a.id, { parentId: b.id })
    expect(status).toBe(400)
  })

  it('can move a sub-category back to the top level and deactivate it', async () => {
    const top = await createCategory()
    const sub = await createCategory({ parentId: top.id })
    const { body } = await update(sub.id, { parentId: null, isActive: false })
    expect(body.category).toMatchObject({ parentId: null, isActive: false })
  })

  it('rejects a duplicate slug with ALREADY_EXISTS', async () => {
    await createCategory({ slug: 'shoes' })
    const { status, body } = await create({ name: 'Shoes 2', slug: 'shoes' })
    expect(status).toBe(409)
    expect(body.error.code).toBe('ALREADY_EXISTS')
  })
})
