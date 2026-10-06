// Test data builders. Each one inserts directly with Drizzle and returns the inserted row.
// Defaults produce valid rows; pass overrides to build the case under test.
import { db } from '../../src/db/client.js'
import { nextOrderNumber } from '../../src/db/order-number.js'
import {
  carts,
  categories,
  orderItems,
  orders,
  orderStatusHistory,
  products,
  users,
} from '../../src/db/schema.js'
import { hashPassword } from '../../src/lib/password.js'

export const TEST_PASSWORD = 'Password123!'

let counter = 0
const next = () => ++counter

// Hashing is slow on purpose (argon2), so hash the shared test password once.
let testPasswordHash: Promise<string> | undefined
const passwordHash = (password: string) =>
  password === TEST_PASSWORD
    ? (testPasswordHash ??= hashPassword(TEST_PASSWORD))
    : hashPassword(password)

type NewUser = Partial<typeof users.$inferInsert> & { password?: string }

/** Customer with a cart (every customer gets one at registration). */
export async function createUser(overrides: NewUser = {}) {
  const n = next()
  const { password = TEST_PASSWORD, ...values } = overrides
  const [user] = await db
    .insert(users)
    .values({
      email: `user${n}@test.local`,
      fullName: `Test User ${n}`,
      phone: '012000000',
      role: 'customer',
      ...values,
      passwordHash: await passwordHash(password),
    })
    .returning()
  if (user!.role === 'customer') await db.insert(carts).values({ userId: user!.id })
  return user!
}

export function createAdmin(overrides: NewUser = {}) {
  return createUser({ ...overrides, role: 'admin' })
}

export async function createCategory(overrides: Partial<typeof categories.$inferInsert> = {}) {
  const n = next()
  const [category] = await db
    .insert(categories)
    .values({ name: `Category ${n}`, slug: `category-${n}`, ...overrides })
    .returning()
  return category!
}

export async function createProduct(overrides: Partial<typeof products.$inferInsert> = {}) {
  const n = next()
  const categoryId = overrides.categoryId ?? (await createCategory()).id
  const [product] = await db
    .insert(products)
    .values({
      name: `Product ${n}`,
      slug: `product-${n}`,
      sku: `TEST-${n}`,
      priceCents: 1000,
      stockQuantity: 10,
      ...overrides,
      categoryId,
    })
    .returning()
  return product!
}

type Product = Awaited<ReturnType<typeof createProduct>>

type NewOrder = Partial<typeof orders.$inferInsert> & {
  items?: { product: Product; quantity: number }[]
}

/**
 * Order with consistent totals, snapshots, and a creation history row.
 * Online orders get `expires_at`; cancelled orders need a `cancelReason` override.
 * Does not touch stock: tests that care about stock set it on the product.
 */
export async function createOrder(overrides: NewOrder = {}) {
  const { items: givenItems, ...values } = overrides
  const userId = values.userId ?? (await createUser()).id
  const items = givenItems ?? [{ product: await createProduct(), quantity: 1 }]
  const paymentMethod = values.paymentMethod ?? 'cod'
  const subtotalCents = items.reduce((sum, i) => sum + i.product.priceCents * i.quantity, 0)
  const shippingFeeCents = values.shippingFeeCents ?? 150

  return db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        orderNumber: await nextOrderNumber(tx),
        paymentMethod,
        subtotalCents,
        shippingFeeCents,
        totalCents: subtotalCents + shippingFeeCents,
        shipRecipientName: 'Test Recipient',
        shipPhone: '012000000',
        shipStreet: 'Street 1',
        shipDistrict: 'Daun Penh',
        shipProvince: 'Phnom Penh',
        expiresAt: paymentMethod === 'online' ? new Date(Date.now() + 15 * 60_000) : null,
        ...values,
        userId,
      })
      .returning()

    await tx.insert(orderItems).values(
      items.map((i) => ({
        orderId: order!.id,
        productId: i.product.id,
        productName: i.product.name,
        unitPriceCents: i.product.priceCents,
        quantity: i.quantity,
        lineTotalCents: i.product.priceCents * i.quantity,
      })),
    )
    await tx
      .insert(orderStatusHistory)
      .values({ orderId: order!.id, fromStatus: null, toStatus: 'pending', changedBy: userId })

    return order!
  })
}
