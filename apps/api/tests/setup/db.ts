import { expect } from 'vitest'
import { db } from '../../src/db/client.js'
import { truncateAll } from '../../src/db/reset.js'

/** Empty every table. Call in `beforeAll` (or `beforeEach`) of each test file that uses the database. */
export function resetDb() {
  return truncateAll(db)
}

/** Expects the query to be rejected by PostgreSQL with the given constraint (CHECK, UNIQUE, or FK). */
export async function expectConstraintViolation(query: Promise<unknown>, constraint: string) {
  const error = await query.then(
    () => null,
    (err: unknown) => err,
  )
  expect(error, `expected constraint "${constraint}" to reject the query`).not.toBeNull()
  // Drizzle wraps the postgres.js error; the original is in `cause`
  const pgError = ((error as { cause?: unknown }).cause ?? error) as { constraint_name?: string }
  expect(pgError.constraint_name).toBe(constraint)
}
