// Source of truth: docs/04-erd.md. Column names are snake_case in the database (casing: 'snake_case').
import { sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgSequence,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

// ---------- Enums (ERD §2) ----------

export const userRole = pgEnum('user_role', ['customer', 'admin'])
export const orderStatus = pgEnum('order_status', [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
])
export const paymentMethod = pgEnum('payment_method', ['cod', 'online'])
export const paymentProvider = pgEnum('payment_provider', ['cod', 'mock', 'aba_payway', 'bakong'])
export const paymentStatus = pgEnum('payment_status', ['pending', 'success', 'failed', 'expired'])
export const cancelReason = pgEnum('cancel_reason', [
  'payment_timeout',
  'customer_cancelled',
  'admin_cancelled',
])

// Order number SKH-YYYYMMDD-NNNNNN: NNNNNN = nextval, never resets (ERD §4.2)
export const orderNumberSeq = pgSequence('order_number_seq', { startWith: 1, increment: 1 })

// ---------- Shared columns ----------

const id = () => uuid().primaryKey().defaultRandom()
const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow()
const updatedAt = () =>
  timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())

// ---------- Tables ----------

export const users = pgTable(
  'users',
  {
    id: id(),
    email: varchar({ length: 255 }).notNull().unique(),
    passwordHash: varchar({ length: 255 }).notNull(),
    fullName: varchar({ length: 120 }).notNull(),
    phone: varchar({ length: 30 }).notNull(),
    role: userRole().notNull().default('customer'),
    isActive: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check('users_email_lowercase', sql`${t.email} = lower(${t.email})`)],
)

export const addresses = pgTable(
  'addresses',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    recipientName: varchar({ length: 120 }).notNull(),
    phone: varchar({ length: 30 }).notNull(),
    street: varchar({ length: 255 }).notNull(),
    district: varchar({ length: 120 }).notNull(),
    province: varchar({ length: 120 }).notNull(),
    isDefault: boolean().notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('addresses_user_id_idx').on(t.userId),
    uniqueIndex('addresses_one_default_per_user')
      .on(t.userId)
      .where(sql`${t.isDefault}`),
  ],
)

export const categories = pgTable(
  'categories',
  {
    id: id(),
    parentId: uuid().references((): AnyPgColumn => categories.id, {
      onDelete: 'restrict',
    }),
    name: varchar({ length: 120 }).notNull(),
    slug: varchar({ length: 140 }).notNull().unique(),
    sortOrder: integer().notNull().default(0),
    isActive: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('categories_parent_id_idx').on(t.parentId),
    check('categories_not_own_parent', sql`${t.parentId} <> ${t.id}`),
  ],
)

export const products = pgTable(
  'products',
  {
    id: id(),
    categoryId: uuid()
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    name: varchar({ length: 200 }).notNull(),
    slug: varchar({ length: 220 }).notNull().unique(),
    sku: varchar({ length: 64 }).notNull().unique(),
    description: text().notNull().default(''),
    priceCents: integer().notNull(),
    stockQuantity: integer().notNull().default(0),
    isActive: boolean().notNull().default(true),
    avgRating: numeric({ precision: 3, scale: 2 }).notNull().default('0'),
    reviewCount: integer().notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('products_price_positive', sql`${t.priceCents} > 0`),
    check('products_stock_non_negative', sql`${t.stockQuantity} >= 0`),
    index('products_category_active_idx').on(t.categoryId, t.isActive),
    index('products_name_lower_idx').on(sql`lower(${t.name})`),
  ],
)

export const productImages = pgTable(
  'product_images',
  {
    id: id(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    url: varchar({ length: 500 }).notNull(),
    altText: varchar({ length: 255 }).notNull().default(''),
    sortOrder: integer().notNull().default(0),
    isPrimary: boolean().notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index('product_images_product_sort_idx').on(t.productId, t.sortOrder),
    uniqueIndex('product_images_one_primary_per_product')
      .on(t.productId)
      .where(sql`${t.isPrimary}`),
  ],
)

export const carts = pgTable('carts', {
  id: id(),
  userId: uuid()
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'restrict' }),
  updatedAt: updatedAt(),
})

export const cartItems = pgTable(
  'cart_items',
  {
    id: id(),
    cartId: uuid()
      .notNull()
      .references(() => carts.id, { onDelete: 'cascade' }),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    quantity: integer().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique('cart_items_cart_product_unique').on(t.cartId, t.productId),
    index('cart_items_product_id_idx').on(t.productId),
    check('cart_items_quantity_positive', sql`${t.quantity} > 0`),
  ],
)

export const orders = pgTable(
  'orders',
  {
    id: id(),
    orderNumber: varchar({ length: 32 }).notNull().unique(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    status: orderStatus().notNull().default('pending'),
    paymentMethod: paymentMethod().notNull(),
    subtotalCents: integer().notNull(),
    shippingFeeCents: integer().notNull(),
    totalCents: integer().notNull(),
    shipRecipientName: varchar({ length: 120 }).notNull(),
    shipPhone: varchar({ length: 30 }).notNull(),
    shipStreet: varchar({ length: 255 }).notNull(),
    shipDistrict: varchar({ length: 120 }).notNull(),
    shipProvince: varchar({ length: 120 }).notNull(),
    note: text(),
    cancelReason: cancelReason(),
    needsRefund: boolean().notNull().default(false),
    refundHandledAt: timestamp({ withTimezone: true }),
    refundHandledBy: uuid().references(() => users.id, { onDelete: 'restrict' }),
    expiresAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('orders_subtotal_non_negative', sql`${t.subtotalCents} >= 0`),
    check('orders_shipping_non_negative', sql`${t.shippingFeeCents} >= 0`),
    check(
      'orders_total_matches',
      sql`${t.totalCents} = ${t.subtotalCents} + ${t.shippingFeeCents}`,
    ),
    check(
      'orders_online_has_expiry',
      sql`(${t.paymentMethod} = 'online') = (${t.expiresAt} IS NOT NULL)`,
    ),
    check(
      'orders_cancel_reason_iff_cancelled',
      sql`(${t.status} = 'cancelled') = (${t.cancelReason} IS NOT NULL)`,
    ),
    check(
      'orders_refund_not_both',
      sql`NOT (${t.needsRefund} AND ${t.refundHandledAt} IS NOT NULL)`,
    ),
    index('orders_user_created_idx').on(t.userId, t.createdAt.desc()),
    index('orders_status_created_idx').on(t.status, t.createdAt.desc()),
    index('orders_created_idx').on(t.createdAt),
    index('orders_pending_online_expires_idx')
      .on(t.expiresAt)
      .where(sql`${t.status} = 'pending' AND ${t.paymentMethod} = 'online'`),
    index('orders_needs_refund_idx')
      .on(t.createdAt)
      .where(sql`${t.needsRefund}`),
  ],
)

export const orderItems = pgTable(
  'order_items',
  {
    id: id(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: 'restrict' }),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    productName: varchar({ length: 200 }).notNull(),
    unitPriceCents: integer().notNull(),
    quantity: integer().notNull(),
    lineTotalCents: integer().notNull(),
  },
  (t) => [
    check('order_items_unit_price_positive', sql`${t.unitPriceCents} > 0`),
    check('order_items_quantity_positive', sql`${t.quantity} > 0`),
    check(
      'order_items_line_total_matches',
      sql`${t.lineTotalCents} = ${t.unitPriceCents} * ${t.quantity}`,
    ),
    index('order_items_order_id_idx').on(t.orderId),
    index('order_items_product_id_idx').on(t.productId),
  ],
)

export const payments = pgTable(
  'payments',
  {
    id: id(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: 'restrict' }),
    provider: paymentProvider().notNull(),
    providerTxnId: varchar({ length: 128 }).unique(),
    amountCents: integer().notNull(),
    currency: varchar({ length: 3 }).notNull().default('USD'),
    status: paymentStatus().notNull().default('pending'),
    paymentUrl: text(),
    qrString: text(),
    failureReason: varchar({ length: 255 }),
    rawResponse: jsonb().notNull().default({}),
    paidAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('payments_amount_positive', sql`${t.amountCents} > 0`),
    check('payments_currency_usd', sql`${t.currency} = 'USD'`),
    index('payments_order_id_idx').on(t.orderId),
    uniqueIndex('payments_one_success_per_order')
      .on(t.orderId)
      .where(sql`${t.status} = 'success'`),
    uniqueIndex('payments_one_pending_per_order')
      .on(t.orderId)
      .where(sql`${t.status} = 'pending'`),
    index('payments_pending_created_idx')
      .on(t.createdAt)
      .where(sql`${t.status} = 'pending'`),
  ],
)

export const reviews = pgTable(
  'reviews',
  {
    id: id(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    rating: smallint().notNull(),
    comment: text().notNull().default(''),
    createdAt: createdAt(),
  },
  (t) => [
    unique('reviews_product_user_unique').on(t.productId, t.userId),
    check('reviews_rating_range', sql`${t.rating} BETWEEN 1 AND 5`),
    index('reviews_product_created_idx').on(t.productId, t.createdAt.desc()),
  ],
)

export const orderStatusHistory = pgTable(
  'order_status_history',
  {
    id: id(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: 'restrict' }),
    fromStatus: orderStatus(),
    toStatus: orderStatus().notNull(),
    changedBy: uuid().references(() => users.id, { onDelete: 'restrict' }),
    note: varchar({ length: 255 }),
    createdAt: createdAt(),
  },
  (t) => [index('order_status_history_order_created_idx').on(t.orderId, t.createdAt)],
)
