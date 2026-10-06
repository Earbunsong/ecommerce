import { sql } from 'drizzle-orm'
import type { Db } from './client.js'

/**
 * SKH-YYYYMMDD-NNNNNN: date in Asia/Phnom_Penh, NNNNNN from order_number_seq (ERD §4.2).
 * Call inside the checkout transaction. The sequence never returns the same number twice.
 */
export async function nextOrderNumber(tx: Db, at: Date = new Date()): Promise<string> {
  const rows = await tx.execute<{ order_number: string }>(sql`
    SELECT 'SKH-' || to_char(${at.toISOString()}::timestamptz AT TIME ZONE 'Asia/Phnom_Penh', 'YYYYMMDD')
        || '-' || lpad(nextval('order_number_seq')::text, 6, '0') AS order_number
  `)
  return rows[0]!.order_number
}
