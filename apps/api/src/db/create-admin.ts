// Creates the first real admin in production (architecture §8):
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm --filter api db:create-admin
// Remove ADMIN_EMAIL and ADMIN_PASSWORD from the environment afterwards.
import { eq } from 'drizzle-orm'
import { hashPassword } from '../lib/password.js'
import { db, sql } from './client.js'
import { users } from './schema.js'

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD

  if (!email || !password) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required.')
  if (password.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters.')

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email))
  if (existing) throw new Error(`A user with email ${email} already exists.`)

  await db.insert(users).values({
    email,
    passwordHash: await hashPassword(password),
    fullName: 'Administrator',
    phone: '',
    role: 'admin',
  })
  console.log(`Admin ${email} created.`)
}

try {
  await main()
} catch (err) {
  console.error((err as Error).message)
  process.exitCode = 1
} finally {
  await sql.end()
}
