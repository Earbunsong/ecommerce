import { and, asc, count, desc, eq, gte, ilike, isNull, lte, or, type SQL, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { type Db, db } from '../../db/client.js'
import { categories, productImages, products } from '../../db/schema.js'
import { offsetOf, type Pagination } from '../../lib/pagination.js'
import type { productSort } from './products.schemas.js'

export type Product = typeof products.$inferSelect

const parentCategory = alias(categories, 'parent_category')

/**
 * Shop visibility (ERD §4.1, business rule 13): the product, its category, and (for a
 * sub-category) the parent category must all be active.
 */
const isVisible = and(
  eq(products.isActive, true),
  eq(categories.isActive, true),
  or(isNull(categories.parentId), eq(parentCategory.isActive, true)),
)

/** Escape LIKE wildcards so a search for "50%" means the text "50%". */
const containsText = (text: string) => `%${text.replace(/[\\%_]/g, (m) => `\\${m}`)}%`

const orderBy: Record<(typeof productSort)[number], SQL[]> = {
  newest: [desc(products.createdAt), desc(products.id)],
  price_asc: [asc(products.priceCents), asc(products.id)],
  price_desc: [desc(products.priceCents), asc(products.id)],
  rating: [desc(products.avgRating), desc(products.reviewCount), asc(products.id)],
}

const listColumns = {
  id: products.id,
  slug: products.slug,
  name: products.name,
  priceCents: products.priceCents,
  stockQuantity: products.stockQuantity,
  avgRating: products.avgRating,
  reviewCount: products.reviewCount,
  categorySlug: categories.slug,
  categoryName: categories.name,
  imageUrl: productImages.url,
  imageAlt: productImages.altText,
}

export type ShopFilter = {
  search?: string
  categoryId?: string // includes sub-categories of this category
  minPrice?: number
  maxPrice?: number
  sort: (typeof productSort)[number]
}

export const productsRepository = {
  async listVisible(filter: ShopFilter, page: Pagination, tx: Db = db) {
    const where = and(
      isVisible,
      filter.search ? ilike(products.name, containsText(filter.search)) : undefined,
      filter.categoryId
        ? or(eq(categories.id, filter.categoryId), eq(categories.parentId, filter.categoryId))
        : undefined,
      filter.minPrice !== undefined ? gte(products.priceCents, filter.minPrice) : undefined,
      filter.maxPrice !== undefined ? lte(products.priceCents, filter.maxPrice) : undefined,
    )

    const [rows, [total]] = await Promise.all([
      tx
        .select(listColumns)
        .from(products)
        .innerJoin(categories, eq(products.categoryId, categories.id))
        .leftJoin(parentCategory, eq(categories.parentId, parentCategory.id))
        .leftJoin(
          productImages,
          and(eq(productImages.productId, products.id), eq(productImages.isPrimary, true)),
        )
        .where(where)
        .orderBy(...orderBy[filter.sort])
        .limit(page.pageSize)
        .offset(offsetOf(page)),
      tx
        .select({ n: count() })
        .from(products)
        .innerJoin(categories, eq(products.categoryId, categories.id))
        .leftJoin(parentCategory, eq(categories.parentId, parentCategory.id))
        .where(where),
    ])
    return { rows, total: total!.n }
  },

  async findVisibleBySlug(slug: string, tx: Db = db) {
    const [row] = await tx
      .select({ product: products, category: categories, parent: parentCategory })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(parentCategory, eq(categories.parentId, parentCategory.id))
      .where(and(isVisible, eq(products.slug, slug)))
    return row
  },

  /** Admin: every product, incl. inactive ones and those in inactive categories. */
  async listAll(
    filter: { search?: string; categoryId?: string; isActive?: boolean },
    page: Pagination,
    tx: Db = db,
  ) {
    const where = and(
      filter.search
        ? or(
            ilike(products.name, containsText(filter.search)),
            ilike(products.sku, containsText(filter.search)),
          )
        : undefined,
      filter.categoryId ? eq(products.categoryId, filter.categoryId) : undefined,
      filter.isActive !== undefined ? eq(products.isActive, filter.isActive) : undefined,
    )
    const [rows, [total]] = await Promise.all([
      tx
        .select({ product: products, categoryName: categories.name, imageUrl: productImages.url })
        .from(products)
        .innerJoin(categories, eq(products.categoryId, categories.id))
        .leftJoin(
          productImages,
          and(eq(productImages.productId, products.id), eq(productImages.isPrimary, true)),
        )
        .where(where)
        .orderBy(desc(products.createdAt), asc(products.id))
        .limit(page.pageSize)
        .offset(offsetOf(page)),
      tx.select({ n: count() }).from(products).where(where),
    ])
    return { rows, total: total!.n }
  },

  async findById(id: string, tx: Db = db): Promise<Product | undefined> {
    const [row] = await tx.select().from(products).where(eq(products.id, id))
    return row
  },

  async slugExists(slug: string, tx: Db = db): Promise<boolean> {
    const [row] = await tx.select({ id: products.id }).from(products).where(eq(products.slug, slug))
    return !!row
  },

  /** SELECT ... FOR UPDATE: serializes image changes of one product (one primary image). */
  async lockById(id: string, tx: Db): Promise<boolean> {
    const [row] = await tx
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, id))
      .for('update')
    return !!row
  },

  async create(values: typeof products.$inferInsert, tx: Db = db): Promise<Product> {
    const [row] = await tx.insert(products).values(values).returning()
    return row!
  },

  async update(id: string, values: Partial<typeof products.$inferInsert>, tx: Db = db) {
    const [row] = await tx.update(products).set(values).where(eq(products.id, id)).returning()
    return row
  },

  /**
   * One atomic statement: check and change together, so stock can never go below zero and
   * never overwrites a checkout that reserved stock a moment earlier (architecture §6).
   * Returns undefined when the product does not exist or the result would be negative.
   */
  async adjustStock(id: string, delta: number, tx: Db = db) {
    const [row] = await tx
      .update(products)
      .set({ stockQuantity: sql`${products.stockQuantity} + ${delta}` })
      .where(and(eq(products.id, id), gte(sql`${products.stockQuantity} + ${delta}`, 0)))
      .returning({ id: products.id, stockQuantity: products.stockQuantity })
    return row
  },
}
