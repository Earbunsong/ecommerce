import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import api from './app.js'
import { env } from './config/env.js'
import { errorHandler, notFoundHandler } from './middleware/error-handler.js'

/**
 * The Node server: the API under /api and, for the local storage driver, uploaded files
 * under /uploads. With S3 or Cloudinary the files are served by that service instead.
 */
export const server = new Hono()
  .use(
    '/uploads/*',
    async (c, next) => {
      // Uploaded files are data, never pages: no MIME sniffing, no scripts
      c.header('X-Content-Type-Options', 'nosniff')
      c.header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'")
      await next()
    },
    serveStatic({
      root: env.UPLOAD_DIR,
      rewriteRequestPath: (p) => p.replace(/^\/uploads/, ''),
    }),
  )
  .route('/', api)

// A mounted app's notFound handler is not used by the outer app, so set both handlers here too:
// unknown URLs and missing upload files get the standard error shape.
server.notFound(notFoundHandler)
server.onError(errorHandler)
