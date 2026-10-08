import { existsSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { env } from '../../src/config/env.js'
import { loginAs } from '../helpers/auth.js'
import { createAdmin, createProduct } from '../helpers/factories.js'
import { request } from '../helpers/http.js'
import { imageForm, jpegFile, pngFile } from '../helpers/images.js'
import { resetDb } from '../setup/db.js'

let admin: string
let productId: string

beforeEach(async () => {
  await resetDb()
  admin = await loginAs((await createAdmin()).email)
  productId = (await createProduct()).id
})

const upload = (form: FormData, id = productId) =>
  request(`/admin/products/${id}/images`, { form, cookie: admin })
const images = async () =>
  (await request(`/admin/products/${productId}`, { cookie: admin })).body.product.images as {
    id: string
    url: string
    isPrimary: boolean
    sortOrder: number
  }[]
const fileOnDisk = (url: string) => path.join(env.UPLOAD_DIR, url.replace('/uploads/', ''))

describe('POST /admin/products/:id/images', () => {
  it('stores the image under a random name; the first image becomes primary', async () => {
    const first = await upload(imageForm(pngFile('my holiday.png'), 'Front view'))
    expect(first.status).toBe(201)
    expect(first.body.image).toMatchObject({ isPrimary: true, sortOrder: 0, altText: 'Front view' })
    expect(first.body.image.url).toMatch(/^\/uploads\/products\/[0-9a-f-]{36}\.png$/)
    expect(existsSync(fileOnDisk(first.body.image.url))).toBe(true)

    const second = await upload(imageForm(jpegFile()))
    expect(second.body.image).toMatchObject({ isPrimary: false, sortOrder: 1 })
    expect(second.body.image.url).toMatch(/\.jpg$/)
  })

  it('serves the uploaded file at its URL', async () => {
    const { body } = await upload(imageForm(pngFile()))
    const file = await request(body.image.url)
    expect(file.status).toBe(200)
    expect(file.res.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('rejects a file that is not really an image, whatever its name and type say', async () => {
    const fake = new File(['<script>alert(1)</script>'], 'evil.png', { type: 'image/png' })
    const { status, body } = await upload(imageForm(fake))
    expect(status).toBe(400)
    expect(body.error.message).toContain('JPEG, PNG, or WebP')
  })

  it('rejects SVG images (they can contain scripts)', async () => {
    const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'a.svg', {
      type: 'image/svg+xml',
    })
    expect((await upload(imageForm(svg))).status).toBe(400)
  })

  it('rejects files over 5 MB', async () => {
    const { status, body } = await upload(imageForm(pngFile('big.png', 5 * 1024 * 1024 + 1)))
    expect(status).toBe(400)
    expect(body.error.message).toContain('5 MB')
    expect(await images()).toHaveLength(0)
  })

  it('accepts a file of exactly 5 MB', async () => {
    expect((await upload(imageForm(pngFile('max.png', 5 * 1024 * 1024)))).status).toBe(201)
  })

  it('rejects a request without a file', async () => {
    expect((await upload(new FormData())).status).toBe(400)
  })

  it('makes only one image primary when two are uploaded at the same moment', async () => {
    await Promise.all([upload(imageForm(pngFile())), upload(imageForm(pngFile()))])
    const all = await images()
    expect(all).toHaveLength(2)
    expect(all.filter((i) => i.isPrimary)).toHaveLength(1)
  })
})

describe('PATCH and DELETE /admin/products/:id/images/:imageId', () => {
  it('sets a new primary image and clears the old one', async () => {
    await upload(imageForm(pngFile()))
    const second = (await upload(imageForm(pngFile()))).body.image

    const { status, body } = await request(`/admin/products/${productId}/images/${second.id}`, {
      method: 'PATCH',
      json: { isPrimary: true },
      cookie: admin,
    })
    expect(status).toBe(200)
    expect(body.image.isPrimary).toBe(true)
    expect((await images()).filter((i) => i.isPrimary).map((i) => i.id)).toEqual([second.id])
  })

  it('reorders images', async () => {
    const first = (await upload(imageForm(pngFile()))).body.image
    const second = (await upload(imageForm(pngFile()))).body.image
    await request(`/admin/products/${productId}/images/${first.id}`, {
      method: 'PATCH',
      json: { sortOrder: 5 },
      cookie: admin,
    })
    expect((await images()).map((i) => i.id)).toEqual([second.id, first.id])
  })

  it('deleting the primary image promotes the next one and removes the file', async () => {
    const first = (await upload(imageForm(pngFile()))).body.image
    const second = (await upload(imageForm(pngFile()))).body.image

    const { status } = await request(`/admin/products/${productId}/images/${first.id}`, {
      method: 'DELETE',
      cookie: admin,
    })
    expect(status).toBe(204)
    expect(await images()).toEqual([expect.objectContaining({ id: second.id, isPrimary: true })])
    expect(existsSync(fileOnDisk(first.url))).toBe(false)
  })

  it('returns 404 for an image of another product', async () => {
    const image = (await upload(imageForm(pngFile()))).body.image
    const other = await createProduct()
    const { status } = await request(`/admin/products/${other.id}/images/${image.id}`, {
      method: 'DELETE',
      cookie: admin,
    })
    expect(status).toBe(404)
  })
})
