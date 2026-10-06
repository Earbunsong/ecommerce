import { afterAll } from 'vitest'
import { sql } from '../../src/db/client.js'

// Close the connection pool after each test file so the worker can exit.
afterAll(async () => {
  await sql.end({ timeout: 5 })
})
