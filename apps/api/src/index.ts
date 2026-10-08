import { serve } from '@hono/node-server'
import { env } from './config/env.js'
import { server } from './server.js'

serve({ fetch: server.fetch, port: env.PORT }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`)
})
