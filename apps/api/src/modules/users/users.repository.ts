import { eq } from 'drizzle-orm'
import { type Db, db } from '../../db/client.js'
import { users } from '../../db/schema.js'

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export const usersRepository = {
  async findById(id: string, tx: Db = db): Promise<User | undefined> {
    const [user] = await tx.select().from(users).where(eq(users.id, id))
    return user
  },

  /** `email` must already be lowercase (stored lowercase, ERD §5). */
  async findByEmail(email: string, tx: Db = db): Promise<User | undefined> {
    const [user] = await tx.select().from(users).where(eq(users.email, email))
    return user
  },

  async create(values: NewUser, tx: Db = db): Promise<User> {
    const [user] = await tx.insert(users).values(values).returning()
    return user!
  },
}
