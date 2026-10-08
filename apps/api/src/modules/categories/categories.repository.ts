import { asc, count, eq } from 'drizzle-orm'
import { type Db, db } from '../../db/client.js'
import { categories } from '../../db/schema.js'

export type Category = typeof categories.$inferSelect

export const categoriesRepository = {
  /** All categories (incl. inactive), parents and children mixed, in display order. */
  listAll(tx: Db = db): Promise<Category[]> {
    return tx.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name))
  },

  async findById(id: string, tx: Db = db): Promise<Category | undefined> {
    const [row] = await tx.select().from(categories).where(eq(categories.id, id))
    return row
  },

  async findBySlug(slug: string, tx: Db = db): Promise<Category | undefined> {
    const [row] = await tx.select().from(categories).where(eq(categories.slug, slug))
    return row
  },

  async countChildren(id: string, tx: Db = db): Promise<number> {
    const [row] = await tx
      .select({ n: count() })
      .from(categories)
      .where(eq(categories.parentId, id))
    return row!.n
  },

  async create(values: typeof categories.$inferInsert, tx: Db = db): Promise<Category> {
    const [row] = await tx.insert(categories).values(values).returning()
    return row!
  },

  async update(
    id: string,
    values: Partial<typeof categories.$inferInsert>,
    tx: Db = db,
  ): Promise<Category | undefined> {
    const [row] = await tx.update(categories).set(values).where(eq(categories.id, id)).returning()
    return row
  },
}
