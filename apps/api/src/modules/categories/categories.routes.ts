import { Hono } from 'hono'
import { validate } from '../../lib/validate.js'
import { type AuthEnv, authMiddleware } from '../../middleware/auth.js'
import { requireAdmin } from '../../middleware/require-admin.js'
import { createCategorySchema, idParamSchema, updateCategorySchema } from './categories.schemas.js'
import { categoriesService } from './categories.service.js'

/** Public: GET /api/categories */
export const categoryRoutes = new Hono().get('/', async (c) =>
  c.json({ items: await categoriesService.activeTree() }),
)

/** Admin: /api/admin/categories */
export const adminCategoryRoutes = new Hono<AuthEnv>()
  .use(authMiddleware, requireAdmin)
  .get('/', async (c) => c.json({ items: await categoriesService.listAll() }))
  .post('/', validate('json', createCategorySchema), async (c) =>
    c.json({ category: await categoriesService.create(c.req.valid('json')) }, 201),
  )
  .patch(
    '/:id',
    validate('param', idParamSchema),
    validate('json', updateCategorySchema),
    async (c) =>
      c.json({
        category: await categoriesService.update(c.req.valid('param').id, c.req.valid('json')),
      }),
  )
