import { sql } from 'drizzle-orm'
import type { Db } from './client.js'

const tables = [
  'order_status_history',
  'payments',
  'order_items',
  'orders',
  'reviews',
  'cart_items',
  'carts',
  'product_images',
  'products',
  'categories',
  'addresses',
  'users',
]

/** Empties every table and restarts the order number sequence. Development and tests only. */
export async function truncateAll(db: Db) {
  await db.execute(sql.raw(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`))
  await db.execute(sql`ALTER SEQUENCE order_number_seq RESTART WITH 1`)
}
