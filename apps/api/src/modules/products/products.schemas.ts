import { z } from 'zod'
import { paginationSchema } from '../../lib/pagination.js'
import { slugSchemaPattern } from '../../lib/slug.js'

// Money is integer cents everywhere (business rule 1), including the price filters.
const cents = z.coerce.number().int().min(0)

export const productSort = ['newest', 'price_asc', 'price_desc', 'rating'] as const

export const productListQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  category: z.string().max(140).optional(), // category slug; a parent includes its sub-categories
  minPrice: cents.optional(),
  maxPrice: cents.optional(),
  sort: z.enum(productSort).default('newest'),
})

export const adminProductListQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(), // name or SKU
  categoryId: z.uuid().optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
})

export const slugParamSchema = z.object({ slug: z.string().max(220) })
export const idParamSchema = z.object({ id: z.uuid() })
export const imageParamSchema = z.object({ id: z.uuid(), imageId: z.uuid() })

const productFields = {
  name: z.string().trim().min(1).max(200),
  slug: z.string().regex(slugSchemaPattern, 'Use lowercase letters, numbers, and dashes.').max(220),
  sku: z.string().trim().min(1).max(64),
  categoryId: z.uuid(),
  description: z.string().max(10_000),
  priceCents: z.number().int().positive('Price must be greater than 0.'),
  isActive: z.boolean(),
}

export const createProductSchema = z.object({
  ...productFields,
  slug: productFields.slug.optional(), // generated from the name when missing
  description: productFields.description.default(''),
  isActive: productFields.isActive.default(true),
  stockQuantity: z.number().int().min(0).default(0), // initial stock; later changes use stock adjustments
})

const atLeastOneField = (v: object) => Object.keys(v).length > 0

// Stock is not editable here: only through stock adjustments (architecture §6). Strict, so
// sending stockQuantity gives a clear error instead of being silently ignored.
export const updateProductSchema = z
  .strictObject(productFields)
  .partial()
  .refine(atLeastOneField, 'Send at least one field to change.')

export const stockAdjustmentSchema = z.object({
  delta: z
    .number()
    .int()
    .refine((d) => d !== 0, 'Change must not be 0.')
    .refine((d) => Math.abs(d) <= 100_000, 'Change is too large.'),
  reason: z.string().trim().min(1, 'Give a reason, e.g. "restock" or "damaged".').max(255),
})

export const uploadImageSchema = z.object({
  file: z.instanceof(File, { message: 'Attach an image file in the "file" field.' }),
  altText: z.string().trim().max(255).optional(),
})

export const updateImageSchema = z
  .strictObject({
    sortOrder: z.number().int().min(0).max(1000),
    altText: z.string().trim().max(255),
    isPrimary: z.literal(true), // the only allowed change: make this one primary
  })
  .partial()
  .refine(atLeastOneField, 'Send at least one field to change.')

export type ProductListQuery = z.infer<typeof productListQuerySchema>
export type AdminProductListQuery = z.infer<typeof adminProductListQuerySchema>
export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>
export type UpdateImageInput = z.infer<typeof updateImageSchema>
