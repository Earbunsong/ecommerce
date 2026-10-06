import { hashPassword } from '../lib/password.js'
import type { Db } from './client.js'
import { nextOrderNumber } from './order-number.js'
import { truncateAll } from './reset.js'
import {
  addresses,
  carts,
  categories,
  orderItems,
  orders,
  orderStatusHistory,
  payments,
  productImages,
  products,
  users,
} from './schema.js'
import { demoUsers, seedCategories, seedImages, seedProducts } from './seed-data.js'

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

/** Resets the database and inserts the demo data. Development and tests only. */
export async function seedDatabase(db: Db) {
  await truncateAll(db)

  await db.transaction(async (tx) => {
    // ---------- Users, carts, addresses ----------
    const [admin] = await tx
      .insert(users)
      .values({
        email: demoUsers.admin.email,
        passwordHash: await hashPassword(demoUsers.admin.password),
        fullName: demoUsers.admin.fullName,
        phone: demoUsers.admin.phone,
        role: 'admin',
      })
      .returning()

    const customers = await tx
      .insert(users)
      .values(
        await Promise.all(
          demoUsers.customers.map(async (c) => ({
            email: c.email,
            passwordHash: await hashPassword(c.password),
            fullName: c.fullName,
            phone: c.phone,
          })),
        ),
      )
      .returning()

    // Every customer gets a cart at registration; admins have none (ERD §3)
    await tx.insert(carts).values(customers.map((c) => ({ userId: c.id })))

    const [daraAddress, sopheaAddress] = await tx
      .insert(addresses)
      .values([
        {
          userId: customers[0]!.id,
          recipientName: customers[0]!.fullName,
          phone: customers[0]!.phone,
          street: 'No. 12, Street 271',
          district: 'Toul Kork',
          province: 'Phnom Penh',
          isDefault: true,
        },
        {
          userId: customers[1]!.id,
          recipientName: customers[1]!.fullName,
          phone: customers[1]!.phone,
          street: 'No. 5, Pub Street',
          district: 'Svay Dangkum',
          province: 'Siem Reap',
          isDefault: true,
        },
      ])
      .returning()

    // ---------- Categories (parents first) ----------
    const categoryIds = new Map<string, string>()
    for (const c of seedCategories) {
      const [row] = await tx
        .insert(categories)
        .values({
          name: c.name,
          slug: c.slug,
          sortOrder: c.sortOrder,
          isActive: c.isActive ?? true,
          parentId: c.parent ? categoryIds.get(c.parent) : null,
        })
        .returning({ id: categories.id })
      categoryIds.set(c.slug, row!.id)
    }

    // ---------- Products and images (1–3 each, the first one primary) ----------
    const productRows = await tx
      .insert(products)
      .values(
        seedProducts.map((p, i) => ({
          categoryId: categoryIds.get(p.category)!,
          name: p.name,
          slug: p.slug,
          sku: `SKH-${String(i + 1).padStart(4, '0')}`,
          description: `${p.name}. Demo product for ShopKH.`,
          priceCents: p.priceCents,
          stockQuantity: p.stock,
          isActive: p.isActive ?? true,
        })),
      )
      .returning()

    await tx.insert(productImages).values(
      seedProducts.flatMap((p, index) =>
        seedImages(p, index).map((image, i) => ({
          productId: productRows.find((row) => row.slug === p.slug)!.id,
          url: `/uploads/seed/${image.file}`,
          altText: `${p.name} – ${image.view}`,
          sortOrder: i,
          isPrimary: i === 0,
        })),
      ),
    )

    const product = (slug: string) => productRows.find((p) => p.slug === slug)!

    // ---------- Order 1: delivered COD order (so a review can be written) ----------
    const deliveredAt = new Date(Date.now() - 2 * DAY)
    const placedAt = new Date(deliveredAt.getTime() - 3 * DAY)
    const items1 = [
      { p: product('angkor-graphic-tee'), qty: 2 },
      { p: product('kampot-pepper-jar'), qty: 1 },
    ]
    const subtotal1 = items1.reduce((sum, i) => sum + i.p.priceCents * i.qty, 0)
    const shipping1 = 150

    const [order1] = await tx
      .insert(orders)
      .values({
        orderNumber: await nextOrderNumber(tx, placedAt),
        userId: customers[0]!.id,
        status: 'delivered',
        paymentMethod: 'cod',
        subtotalCents: subtotal1,
        shippingFeeCents: shipping1,
        totalCents: subtotal1 + shipping1,
        shipRecipientName: daraAddress!.recipientName,
        shipPhone: daraAddress!.phone,
        shipStreet: daraAddress!.street,
        shipDistrict: daraAddress!.district,
        shipProvince: daraAddress!.province,
        createdAt: placedAt,
      })
      .returning()

    await tx.insert(orderItems).values(
      items1.map((i) => ({
        orderId: order1!.id,
        productId: i.p.id,
        productName: i.p.name,
        unitPriceCents: i.p.priceCents,
        quantity: i.qty,
        lineTotalCents: i.p.priceCents * i.qty,
      })),
    )

    await tx.insert(payments).values({
      orderId: order1!.id,
      provider: 'cod',
      amountCents: order1!.totalCents,
      status: 'success',
      paidAt: deliveredAt,
      createdAt: placedAt,
    })

    const steps = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'] as const
    await tx.insert(orderStatusHistory).values(
      steps.map((to, i) => ({
        orderId: order1!.id,
        fromStatus: i === 0 ? null : steps[i - 1]!,
        toStatus: to,
        changedBy: i === 0 ? customers[0]!.id : admin!.id,
        createdAt: new Date(placedAt.getTime() + i * 18 * 60 * MINUTE),
      })),
    )

    // ---------- Order 2: paid online order, then cancelled -> needs manual refund ----------
    const placedAt2 = new Date(Date.now() - DAY)
    const items2 = [{ p: product('wireless-earbuds'), qty: 1 }]
    const subtotal2 = items2.reduce((sum, i) => sum + i.p.priceCents * i.qty, 0)
    const shipping2 = 150

    const [order2] = await tx
      .insert(orders)
      .values({
        orderNumber: await nextOrderNumber(tx, placedAt2),
        userId: customers[1]!.id,
        status: 'cancelled',
        paymentMethod: 'online',
        subtotalCents: subtotal2,
        shippingFeeCents: shipping2,
        totalCents: subtotal2 + shipping2,
        shipRecipientName: sopheaAddress!.recipientName,
        shipPhone: sopheaAddress!.phone,
        shipStreet: sopheaAddress!.street,
        shipDistrict: sopheaAddress!.district,
        shipProvince: sopheaAddress!.province,
        cancelReason: 'customer_cancelled',
        needsRefund: true,
        expiresAt: new Date(placedAt2.getTime() + 15 * MINUTE),
        createdAt: placedAt2,
      })
      .returning()

    await tx.insert(orderItems).values(
      items2.map((i) => ({
        orderId: order2!.id,
        productId: i.p.id,
        productName: i.p.name,
        unitPriceCents: i.p.priceCents,
        quantity: i.qty,
        lineTotalCents: i.p.priceCents * i.qty,
      })),
    )

    await tx.insert(payments).values({
      orderId: order2!.id,
      provider: 'mock',
      providerTxnId: 'mock_seed_0001',
      amountCents: order2!.totalCents,
      status: 'success',
      paidAt: new Date(placedAt2.getTime() + 3 * MINUTE),
      createdAt: placedAt2,
    })

    await tx.insert(orderStatusHistory).values([
      {
        orderId: order2!.id,
        fromStatus: null,
        toStatus: 'pending',
        changedBy: customers[1]!.id,
        createdAt: placedAt2,
      },
      // Payment callback: changed by the system (null)
      {
        orderId: order2!.id,
        fromStatus: 'pending',
        toStatus: 'confirmed',
        changedBy: null,
        createdAt: new Date(placedAt2.getTime() + 3 * MINUTE),
      },
      {
        orderId: order2!.id,
        fromStatus: 'confirmed',
        toStatus: 'cancelled',
        changedBy: customers[1]!.id,
        createdAt: new Date(placedAt2.getTime() + 60 * MINUTE),
      },
    ])
  })
}
