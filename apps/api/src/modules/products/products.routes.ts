import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { AppError } from '../../lib/errors.js'
import { MAX_IMAGE_BYTES } from '../../lib/image-type.js'
import { validate } from '../../lib/validate.js'
import { type AuthEnv, authMiddleware } from '../../middleware/auth.js'
import { requireAdmin } from '../../middleware/require-admin.js'
import {
  adminProductListQuerySchema,
  createProductSchema,
  idParamSchema,
  imageParamSchema,
  productListQuerySchema,
  slugParamSchema,
  stockAdjustmentSchema,
  updateImageSchema,
  updateProductSchema,
  uploadImageSchema,
} from './products.schemas.js'
import { productsService } from './products.service.js'

/** Public: /api/products */
export const productRoutes = new Hono()
  .get('/', validate('query', productListQuerySchema), async (c) =>
    c.json(await productsService.listForShop(c.req.valid('query'))),
  )
  .get('/:slug', validate('param', slugParamSchema), async (c) =>
    c.json({ product: await productsService.detailForShop(c.req.valid('param').slug) }),
  )

// Reject oversized uploads before reading them into memory (5 MB image + form overhead)
const uploadLimit = bodyLimit({
  maxSize: MAX_IMAGE_BYTES + 64 * 1024,
  onError: () => {
    throw new AppError('VALIDATION_ERROR', 'The image must be 5 MB or smaller.')
  },
})

/** Admin: /api/admin/products */
export const adminProductRoutes = new Hono<AuthEnv>()
  .use(authMiddleware, requireAdmin)
  .get('/', validate('query', adminProductListQuerySchema), async (c) =>
    c.json(await productsService.listForAdmin(c.req.valid('query'))),
  )
  .post('/', validate('json', createProductSchema), async (c) =>
    c.json({ product: await productsService.create(c.req.valid('json')) }, 201),
  )
  .get('/:id', validate('param', idParamSchema), async (c) =>
    c.json({ product: await productsService.getForAdmin(c.req.valid('param').id) }),
  )
  .patch(
    '/:id',
    validate('param', idParamSchema),
    validate('json', updateProductSchema),
    async (c) =>
      c.json({
        product: await productsService.update(c.req.valid('param').id, c.req.valid('json')),
      }),
  )
  .post(
    '/:id/stock-adjustments',
    validate('param', idParamSchema),
    validate('json', stockAdjustmentSchema),
    async (c) =>
      c.json({
        product: await productsService.adjustStock(
          c.req.valid('param').id,
          c.req.valid('json'),
          c.var.user.id,
        ),
      }),
  )
  .post(
    '/:id/images',
    uploadLimit,
    validate('param', idParamSchema),
    validate('form', uploadImageSchema),
    async (c) => {
      const { file, altText } = c.req.valid('form')
      const image = await productsService.uploadImage(c.req.valid('param').id, file, altText)
      return c.json({ image }, 201)
    },
  )
  .patch(
    '/:id/images/:imageId',
    validate('param', imageParamSchema),
    validate('json', updateImageSchema),
    async (c) => {
      const { id, imageId } = c.req.valid('param')
      return c.json({ image: await productsService.updateImage(id, imageId, c.req.valid('json')) })
    },
  )
  .delete('/:id/images/:imageId', validate('param', imageParamSchema), async (c) => {
    const { id, imageId } = c.req.valid('param')
    await productsService.deleteImage(id, imageId)
    return c.body(null, 204)
  })
