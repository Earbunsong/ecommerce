// `pnpm db:seed`: resets the database and loads demo data. NEVER run in production:
// it deletes all data and creates accounts with known passwords (see seed-data.ts).
import { cp, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

if (process.env.NODE_ENV === 'production') {
  console.error('db:seed refuses to run when NODE_ENV=production. Use db:create-admin instead.')
  process.exit(1)
}

// Imported after the check so nothing connects to a production database.
const { db, sql } = await import('./client.js')
const { seedDatabase } = await import('./seed-core.js')

try {
  await seedDatabase(db)

  // Copy placeholder images to the local upload folder (served from /uploads in Phase 3)
  const from = fileURLToPath(new URL('../../seed-assets/products', import.meta.url))
  const to = fileURLToPath(new URL('../../uploads/seed', import.meta.url))
  await mkdir(to, { recursive: true })
  await cp(from, to, { recursive: true })

  console.log('Seed complete: 3 users, 5 categories, 30 products, 2 orders.')
} finally {
  await sql.end()
}
