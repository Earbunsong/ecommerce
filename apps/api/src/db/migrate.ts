import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { db, sql } from './client.js'

export const migrationsFolder = fileURLToPath(new URL('./migrations', import.meta.url))

export async function runMigrations() {
  await migrate(db, { migrationsFolder })
}

// Run directly: `pnpm db:migrate`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await runMigrations()
    console.log('Migrations applied.')
  } finally {
    await sql.end()
  }
}
