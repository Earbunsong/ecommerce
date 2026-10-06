import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '../config/env.js'
import * as schema from './schema.js'

export const sql = postgres(env.DATABASE_URL, {
  max: env.NODE_ENV === 'test' ? 10 : 20,
  onnotice: () => {},
})

export const db = drizzle(sql, { schema, casing: 'snake_case' })

/** The db client or a transaction handle. Repositories accept `tx: Db = db` (architecture §3.1). */
export type Db = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]
