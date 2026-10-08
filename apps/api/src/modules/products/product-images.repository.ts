import { and, asc, eq, max, ne } from 'drizzle-orm'
import { type Db, db } from '../../db/client.js'
import { productImages } from '../../db/schema.js'

export type ProductImage = typeof productImages.$inferSelect

export const productImagesRepository = {
  listByProduct(productId: string, tx: Db = db): Promise<ProductImage[]> {
    return tx
      .select()
      .from(productImages)
      .where(eq(productImages.productId, productId))
      .orderBy(asc(productImages.sortOrder), asc(productImages.createdAt))
  },

  async find(productId: string, imageId: string, tx: Db = db) {
    const [row] = await tx
      .select()
      .from(productImages)
      .where(and(eq(productImages.id, imageId), eq(productImages.productId, productId)))
    return row
  },

  /** -1 when the product has no images. */
  async maxSortOrder(productId: string, tx: Db): Promise<number> {
    const [row] = await tx
      .select({ value: max(productImages.sortOrder) })
      .from(productImages)
      .where(eq(productImages.productId, productId))
    return row?.value ?? -1
  },

  async create(values: typeof productImages.$inferInsert, tx: Db) {
    const [row] = await tx.insert(productImages).values(values).returning()
    return row!
  },

  async update(imageId: string, values: Partial<typeof productImages.$inferInsert>, tx: Db) {
    const [row] = await tx
      .update(productImages)
      .set(values)
      .where(eq(productImages.id, imageId))
      .returning()
    return row!
  },

  /** Step 1 of "set primary": clear the old one, so the partial unique index allows the new one. */
  clearPrimary(productId: string, tx: Db) {
    return tx
      .update(productImages)
      .set({ isPrimary: false })
      .where(and(eq(productImages.productId, productId), eq(productImages.isPrimary, true)))
  },

  delete(imageId: string, tx: Db) {
    return tx.delete(productImages).where(eq(productImages.id, imageId))
  },

  /** The image that takes over as primary: lowest sort order among the others. */
  async firstOther(productId: string, excludeImageId: string, tx: Db) {
    const [row] = await tx
      .select()
      .from(productImages)
      .where(and(eq(productImages.productId, productId), ne(productImages.id, excludeImageId)))
      .orderBy(asc(productImages.sortOrder), asc(productImages.createdAt))
      .limit(1)
    return row
  },
}
