import { z } from 'zod'
import { slugSchemaPattern } from '../../lib/slug.js'

const slug = z
  .string()
  .regex(slugSchemaPattern, 'Use lowercase letters, numbers, and dashes.')
  .max(140)

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: slug.optional(), // generated from the name when missing
  parentId: z.uuid().nullable().default(null),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
  isActive: z.boolean().default(true),
})

export const updateCategorySchema = z
  .strictObject({
    name: z.string().trim().min(1).max(120),
    slug,
    parentId: z.uuid().nullable(),
    sortOrder: z.number().int().min(0).max(10_000),
    isActive: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Send at least one field to change.')

export const idParamSchema = z.object({ id: z.uuid() })

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
