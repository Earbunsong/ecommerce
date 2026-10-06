// The database is the last line of defense (ERD §5): even if service code has a bug,
// these rows must be rejected by PostgreSQL itself.
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/client.js'
import { nextOrderNumber } from '../../src/db/order-number.js'
import {
  addresses,
  orderItems,
  orders,
  payments,
  productImages,
  products,
  users,
} from '../../src/db/schema.js'
import { createOrder, createProduct, createUser } from '../helpers/factories.js'
import { expectConstraintViolation, resetDb } from '../setup/db.js'

beforeEach(resetDb)

const shipping = {
  shipRecipientName: 'A',
  shipPhone: '012000000',
  shipStreet: 'S',
  shipDistrict: 'D',
  shipProvince: 'P',
}

describe('database constraints', () => {
  it('accepts a valid order built by the factory', async () => {
    const order = await createOrder({ paymentMethod: 'online' })
    expect(order.orderNumber).toMatch(/^SKH-\d{8}-\d{6}$/)
    expect(order.totalCents).toBe(order.subtotalCents + order.shippingFeeCents)
  })

  it('rejects negative stock', async () => {
    const product = await createProduct({ stockQuantity: 1 })
    await expectConstraintViolation(
      db.update(products).set({ stockQuantity: -1 }).where(eq(products.id, product.id)),
      'products_stock_non_negative',
    )
  })

  it('rejects an order item whose line total does not match price x quantity', async () => {
    const order = await createOrder()
    const product = await createProduct({ priceCents: 500 })
    await expectConstraintViolation(
      db.insert(orderItems).values({
        orderId: order.id,
        productId: product.id,
        productName: product.name,
        unitPriceCents: 500,
        quantity: 2,
        lineTotalCents: 999,
      }),
      'order_items_line_total_matches',
    )
  })

  it('rejects an order whose total is not subtotal + shipping', async () => {
    const user = await createUser()
    await expectConstraintViolation(
      db.insert(orders).values({
        orderNumber: await nextOrderNumber(db),
        userId: user.id,
        paymentMethod: 'cod',
        subtotalCents: 1000,
        shippingFeeCents: 150,
        totalCents: 1000,
        ...shipping,
      }),
      'orders_total_matches',
    )
  })

  it('rejects a second default address for the same user', async () => {
    const user = await createUser()
    const address = {
      userId: user.id,
      recipientName: 'A',
      phone: '012',
      street: 'S',
      district: 'D',
      province: 'P',
    }
    await db.insert(addresses).values({ ...address, isDefault: true })
    await db.insert(addresses).values({ ...address, isDefault: false }) // non-default is fine
    await expectConstraintViolation(
      db.insert(addresses).values({ ...address, isDefault: true }),
      'addresses_one_default_per_user',
    )
  })

  it('rejects a second primary image for the same product', async () => {
    const product = await createProduct()
    await db.insert(productImages).values({ productId: product.id, url: '/a.jpg', isPrimary: true })
    await db
      .insert(productImages)
      .values({ productId: product.id, url: '/b.jpg', isPrimary: false })
    await expectConstraintViolation(
      db.insert(productImages).values({ productId: product.id, url: '/c.jpg', isPrimary: true }),
      'product_images_one_primary_per_product',
    )
  })

  it('rejects a second pending payment for the same order', async () => {
    const order = await createOrder({ paymentMethod: 'online' })
    const payment = { orderId: order.id, provider: 'mock' as const, amountCents: order.totalCents }
    await db.insert(payments).values({ ...payment, providerTxnId: 'txn-1', status: 'pending' })
    await expectConstraintViolation(
      db.insert(payments).values({ ...payment, providerTxnId: 'txn-2', status: 'pending' }),
      'payments_one_pending_per_order',
    )
  })

  it('rejects a second successful payment for the same order', async () => {
    const order = await createOrder({ paymentMethod: 'online' })
    const payment = { orderId: order.id, provider: 'mock' as const, amountCents: order.totalCents }
    await db.insert(payments).values({ ...payment, providerTxnId: 'txn-1', status: 'success' })
    await db.insert(payments).values({ ...payment, providerTxnId: 'txn-2', status: 'failed' }) // fine
    await expectConstraintViolation(
      db.insert(payments).values({ ...payment, providerTxnId: 'txn-3', status: 'success' }),
      'payments_one_success_per_order',
    )
  })

  it('rejects a cancelled order without a cancel reason', async () => {
    const order = await createOrder()
    await expectConstraintViolation(
      db.update(orders).set({ status: 'cancelled' }).where(eq(orders.id, order.id)),
      'orders_cancel_reason_iff_cancelled',
    )
  })

  it('rejects an online order without expires_at', async () => {
    const user = await createUser()
    await expectConstraintViolation(
      db.insert(orders).values({
        orderNumber: await nextOrderNumber(db),
        userId: user.id,
        paymentMethod: 'online',
        subtotalCents: 1000,
        shippingFeeCents: 150,
        totalCents: 1150,
        expiresAt: null,
        ...shipping,
      }),
      'orders_online_has_expiry',
    )
  })

  it('rejects an email that is not stored in lowercase', async () => {
    await expectConstraintViolation(
      db
        .insert(users)
        .values({ email: 'Alice@Test.local', passwordHash: 'x', fullName: 'A', phone: '0' }),
      'users_email_lowercase',
    )
  })
})
