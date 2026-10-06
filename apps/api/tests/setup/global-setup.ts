// Runs once in the main Vitest process: apply migrations to the test database (shopkh_test).
export default async function setup() {
  process.env.NODE_ENV = 'test'
  const { runMigrations } = await import('../../src/db/migrate.js')
  const { sql } = await import('../../src/db/client.js')
  try {
    await runMigrations()
  } finally {
    await sql.end()
  }
}
