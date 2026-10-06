import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { count, eq } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'
import { db } from '../../src/db/client.js'
import { seedDatabase } from '../../src/db/seed-core.js'
import { orders, productImages, products, users } from '../../src/db/schema.js'
import { verifyPassword } from '../../src/lib/password.js'
import { resetDb } from '../setup/db.js'

describe('demo seed', () => {
  beforeAll(async () => {
    await resetDb()
    await seedDatabase(db)
  })

  it('creates 1 admin and 2 customers with the documented demo password', async () => {
    const rows = await db.select().from(users)
    expect(rows.filter((u) => u.role === 'admin')).toHaveLength(1)
    expect(rows.filter((u) => u.role === 'customer')).toHaveLength(2)

    const dara = rows.find((u) => u.email === 'dara@shopkh.test')!
    expect(await verifyPassword(dara.passwordHash, 'Customer123!')).toBe(true)
  })

  it('creates 30 products including inactive, out-of-stock, and low-stock cases', async () => {
    const rows = await db.select().from(products)
    expect(rows).toHaveLength(30)
    expect(rows.filter((p) => !p.isActive)).toHaveLength(1)
    expect(rows.filter((p) => p.stockQuantity === 0)).toHaveLength(1)
    expect(rows.filter((p) => p.stockQuantity > 0 && p.stockQuantity <= 5)).toHaveLength(2)
  })

  it('gives every product 1–3 images in order, exactly one of them primary', async () => {
    const images = await db.select().from(productImages)
    const byProduct = Map.groupBy(images, (img) => img.productId)

    expect(byProduct.size).toBe(30)
    for (const productImgs of byProduct.values()) {
      expect(productImgs.length).toBeGreaterThanOrEqual(1)
      expect(productImgs.length).toBeLessThanOrEqual(3)
      expect(productImgs.filter((img) => img.isPrimary)).toHaveLength(1)
      expect(productImgs.find((img) => img.isPrimary)!.sortOrder).toBe(0)
    }
    expect(images).toHaveLength(60) // (i % 3) + 1 over 30 products
  })

  it('creates a delivered order and a cancelled paid order that needs a refund', async () => {
    const [delivered] = await db
      .select({ n: count() })
      .from(orders)
      .where(eq(orders.status, 'delivered'))
    expect(delivered!.n).toBe(1)

    const [cancelled] = await db.select().from(orders).where(eq(orders.status, 'cancelled'))
    expect(cancelled!.needsRefund).toBe(true)
    expect(cancelled!.cancelReason).toBe('customer_cancelled')
  })

  it('can run twice (it resets the database first)', async () => {
    await seedDatabase(db)
    const [row] = await db.select({ n: count() }).from(users)
    expect(row!.n).toBe(3)
  })
})

describe('db:seed script', () => {
  it('refuses to run when NODE_ENV=production', () => {
    const apiDir = fileURLToPath(new URL('../..', import.meta.url))
    const result = spawnSync('pnpm', ['exec', 'tsx', 'src/db/seed.ts'], {
      cwd: apiDir,
      env: { ...process.env, NODE_ENV: 'production' },
      encoding: 'utf8',
      shell: process.platform === 'win32',
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('refuses to run when NODE_ENV=production')
  })
})
