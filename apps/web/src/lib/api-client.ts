import { hc } from 'hono/client'
// Types only: no backend code is bundled into the web app (architecture §5.1).
import type { AppType } from 'api/src/app'

// Same-origin base URL: requests stay on the web origin, and Vite proxies /api to the API in development.
export const api = hc<AppType>(window.location.origin, { init: { credentials: 'include' } }).api
