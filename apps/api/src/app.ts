import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { env } from './config/env.js'
import { errorHandler, notFoundHandler } from './middleware/error-handler.js'
import { authRoutes } from './modules/auth/auth.routes.js'
import { adminCategoryRoutes, categoryRoutes } from './modules/categories/categories.routes.js'
import { adminProductRoutes, productRoutes } from './modules/products/products.routes.js'

const app = new Hono().basePath('/api')

app.use(secureHeaders())
if (env.NODE_ENV !== 'test') app.use(logger())
app.onError(errorHandler)
app.notFound(notFoundHandler)

// Every route is chained so AppType keeps the full route types for the RPC client (architecture §5.1).
const routes = app
  .get('/health', (c) => c.json({ status: 'ok' as const, time: new Date().toISOString() }))
  .route('/auth', authRoutes)
  .route('/categories', categoryRoutes)
  .route('/products', productRoutes)
  .route('/admin/categories', adminCategoryRoutes)
  .route('/admin/products', adminProductRoutes)

export type AppType = typeof routes
export default routes
