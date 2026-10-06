import { Hono } from 'hono'
import { logger } from 'hono/logger'

// Every middleware and route is chained so AppType keeps the full route types (architecture §5.1).
const app = new Hono()
  .basePath('/api')
  .use(logger())
  .get('/health', (c) => c.json({ status: 'ok' as const, time: new Date().toISOString() }))

export type AppType = typeof app
export default app
