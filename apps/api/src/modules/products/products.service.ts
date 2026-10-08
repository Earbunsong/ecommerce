import { randomUUID } from 'node:crypto'
import { db } from '../../db/client.js'
import { AppError, isUniqueViolation } from '../../lib/errors.js'
import { detectImageType, MAX_IMAGE_BYTES } from '../../lib/image-type.js'
import type { Page } from '../../lib/pagination.js'
import { slugify, uniqueSlug } from '../../lib/slug.js'
import { getStorage } from '../../lib/storage/storage.js'
import { categoriesRepository } from '../categories/categories.repository.js'
import { type ProductImage, productImagesRepository } from './product-images.repository.js'
import { type Product, productsRepository } from './products.repository.js'
import type {
  AdminProductListQuery,
  CreateProductInput,
  ProductListQuery,
  StockAdjustmentInput,
  UpdateImageInput,
  UpdateProductInput,
} from './products.schemas.js'

export type ProductCard = {
  id: string
  slug: string
  name: string
  priceCents: number
  stockQuantity: number
  inStock: boolean
  avgRating: number
  reviewCount: number
  category: { slug: string; name: string }
  image: { url: string; altText: string } | null
}

const toImage = ({ id, url, altText, sortOrder, isPrimary }: ProductImage) => ({
  id,
  url,
  altText,
  sortOrder,
  isPrimary,
})

function duplicateError(err: unknown): unknown {
  if (isUniqueViolation(err, 'products_slug_unique')) {
    return new AppError('ALREADY_EXISTS', 'A product with this slug already exists.')
  }
  if (isUniqueViolation(err, 'products_sku_unique')) {
    return new AppError('ALREADY_EXISTS', 'A product with this SKU already exists.')
  }
  return err
}

async function requireProduct(id: string): Promise<Product> {
  const product = await productsRepository.findById(id)
  if (!product) throw new AppError('NOT_FOUND', 'Product not found.')
  return product
}

/** New products and category changes must use an existing, active category (flowchart 7). */
async function assertActiveCategory(categoryId: string) {
  const category = await categoriesRepository.findById(categoryId)
  if (!category) throw new AppError('VALIDATION_ERROR', 'The category does not exist.')
  if (!category.isActive) throw new AppError('VALIDATION_ERROR', 'The category is not active.')
}

export const productsService = {
  // ---------- Shop ----------

  async listForShop(query: ProductListQuery): Promise<Page<ProductCard>> {
    const { page, pageSize, category, ...filter } = query
    let categoryId: string | undefined
    if (category) {
      const found = await categoriesRepository.findBySlug(category)
      // Unknown category: an empty list, not an error (e.g. an old bookmarked link)
      if (!found) return { items: [], page, pageSize, total: 0 }
      categoryId = found.id
    }

    const { rows, total } = await productsRepository.listVisible(
      { ...filter, categoryId },
      { page, pageSize },
    )
    return {
      items: rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        priceCents: r.priceCents,
        stockQuantity: r.stockQuantity,
        inStock: r.stockQuantity > 0,
        avgRating: Number(r.avgRating),
        reviewCount: r.reviewCount,
        category: { slug: r.categorySlug, name: r.categoryName },
        image: r.imageUrl ? { url: r.imageUrl, altText: r.imageAlt ?? '' } : null,
      })),
      page,
      pageSize,
      total,
    }
  },

  async detailForShop(slug: string) {
    const row = await productsRepository.findVisibleBySlug(slug)
    if (!row) throw new AppError('NOT_FOUND', 'Product not found.')
    const { product, category, parent } = row
    const images = await productImagesRepository.listByProduct(product.id)
    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      priceCents: product.priceCents,
      stockQuantity: product.stockQuantity,
      inStock: product.stockQuantity > 0,
      avgRating: Number(product.avgRating),
      reviewCount: product.reviewCount,
      // Breadcrumb: parent category first, if any
      categories: [parent, category]
        .filter((c) => c !== null)
        .map((c) => ({ slug: c.slug, name: c.name })),
      images: images.map(toImage),
    }
  },

  // ---------- Admin: products ----------

  async listForAdmin(query: AdminProductListQuery) {
    const { page, pageSize, ...filter } = query
    const { rows, total } = await productsRepository.listAll(filter, { page, pageSize })
    return {
      items: rows.map((r) => ({
        ...r.product,
        avgRating: Number(r.product.avgRating),
        categoryName: r.categoryName,
        imageUrl: r.imageUrl,
      })),
      page,
      pageSize,
      total,
    }
  },

  async getForAdmin(id: string) {
    const product = await requireProduct(id)
    const images = await productImagesRepository.listByProduct(id)
    return { ...product, avgRating: Number(product.avgRating), images: images.map(toImage) }
  },

  async create(input: CreateProductInput) {
    await assertActiveCategory(input.categoryId)
    const slug =
      input.slug ?? (await uniqueSlug(slugify(input.name), productsRepository.slugExists))
    try {
      return await productsRepository.create({ ...input, slug })
    } catch (err) {
      throw duplicateError(err)
    }
  },

  async update(id: string, input: UpdateProductInput) {
    const product = await requireProduct(id)
    if (input.categoryId && input.categoryId !== product.categoryId) {
      await assertActiveCategory(input.categoryId)
    }
    try {
      return (await productsRepository.update(id, input))!
    } catch (err) {
      throw duplicateError(err)
    }
  },

  /** Restock (+) or write off (-). The reason is logged, not stored (architecture §6). */
  async adjustStock(id: string, input: StockAdjustmentInput, adminId: string) {
    const result = await productsRepository.adjustStock(id, input.delta)
    if (!result) {
      const product = await requireProduct(id) // NOT_FOUND if it does not exist
      throw new AppError(
        'OUT_OF_STOCK',
        `Stock cannot go below zero (current stock: ${product.stockQuantity}).`,
      )
    }
    console.info(
      JSON.stringify({
        event: 'stock_adjustment',
        productId: id,
        delta: input.delta,
        reason: input.reason,
        newStock: result.stockQuantity,
        adminId,
        at: new Date().toISOString(),
      }),
    )
    return result
  },

  // ---------- Admin: images ----------

  /**
   * Checks the real file type and size, stores the file, then records it. The first image of a
   * product becomes primary. The product row is locked so two uploads at the same moment cannot
   * both become primary.
   */
  async uploadImage(productId: string, file: File, altText: string | undefined) {
    await requireProduct(productId)
    if (file.size > MAX_IMAGE_BYTES) {
      throw new AppError('VALIDATION_ERROR', 'The image must be 5 MB or smaller.')
    }
    const bytes = new Uint8Array(await file.arrayBuffer())
    const imageType = detectImageType(bytes)
    if (!imageType) {
      throw new AppError('VALIDATION_ERROR', 'Only JPEG, PNG, or WebP images are allowed.')
    }

    // Random file name: never use the uploaded name (architecture §7)
    const storage = getStorage()
    const url = await storage.save(
      `products/${randomUUID()}.${imageType.ext}`,
      bytes,
      imageType.type,
    )
    try {
      return await db.transaction(async (tx) => {
        if (!(await productsRepository.lockById(productId, tx))) {
          throw new AppError('NOT_FOUND', 'Product not found.')
        }
        const last = await productImagesRepository.maxSortOrder(productId, tx)
        const image = await productImagesRepository.create(
          { productId, url, altText: altText ?? '', sortOrder: last + 1, isPrimary: last === -1 },
          tx,
        )
        return toImage(image)
      })
    } catch (err) {
      await storage.delete(url) // don't leave an orphan file behind
      throw err
    }
  },

  /** Change sort order or alt text, or make this image primary (old primary cleared first). */
  async updateImage(productId: string, imageId: string, input: UpdateImageInput) {
    return db.transaction(async (tx) => {
      if (!(await productsRepository.lockById(productId, tx))) {
        throw new AppError('NOT_FOUND', 'Product not found.')
      }
      const image = await productImagesRepository.find(productId, imageId, tx)
      if (!image) throw new AppError('NOT_FOUND', 'Image not found.')

      if (input.isPrimary && !image.isPrimary) {
        await productImagesRepository.clearPrimary(productId, tx)
      }
      const { isPrimary, ...rest } = input
      return toImage(
        await productImagesRepository.update(
          imageId,
          { ...rest, ...(isPrimary ? { isPrimary } : {}) },
          tx,
        ),
      )
    })
  },

  /** Deleting the primary image promotes the next one by sort order. */
  async deleteImage(productId: string, imageId: string) {
    const image = await db.transaction(async (tx) => {
      if (!(await productsRepository.lockById(productId, tx))) {
        throw new AppError('NOT_FOUND', 'Product not found.')
      }
      const image = await productImagesRepository.find(productId, imageId, tx)
      if (!image) throw new AppError('NOT_FOUND', 'Image not found.')

      await productImagesRepository.delete(imageId, tx)
      if (image.isPrimary) {
        const next = await productImagesRepository.firstOther(productId, imageId, tx)
        if (next) await productImagesRepository.update(next.id, { isPrimary: true }, tx)
      }
      return image
    })
    // After COMMIT: if deleting the file fails, the database is still correct
    await getStorage()
      .delete(image.url)
      .catch((err) => console.error('Could not delete image file', image.url, err))
  },
}
