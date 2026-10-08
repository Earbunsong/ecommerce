import { z } from 'zod'

// List endpoints accept page (default 1) and pageSize (default 20, max 100) and return
// { items, page, pageSize, total } (architecture §6 conventions).
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type Pagination = z.infer<typeof paginationSchema>

export type Page<T> = { items: T[]; page: number; pageSize: number; total: number }

export const offsetOf = ({ page, pageSize }: Pagination) => (page - 1) * pageSize
