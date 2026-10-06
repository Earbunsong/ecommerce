import app from '../../src/app.js'
import { AUTH_COOKIE } from '../../src/lib/auth-cookie.js'

type Options = {
  method?: string
  json?: unknown
  cookie?: string
  headers?: Record<string, string>
}

/** Sends a request through the real Hono app (middleware, validation, error handler). */
export async function request(path: string, { method, json, cookie, headers = {} }: Options = {}) {
  const res = await app.request(`/api${path}`, {
    method: method ?? (json === undefined ? 'GET' : 'POST'),
    headers: {
      ...(json === undefined ? {} : { 'content-type': 'application/json' }),
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body: json === undefined ? undefined : JSON.stringify(json),
  })
  const text = await res.text()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = text ? JSON.parse(text) : null
  return { res, status: res.status, body, text }
}

/** The `shopkh_auth=<token>` pair from a Set-Cookie header, ready to send back as a Cookie header. */
export function authCookieFrom(res: Response): string | undefined {
  const header = res.headers.getSetCookie().find((c) => c.startsWith(`${AUTH_COOKIE}=`))
  return header?.split(';')[0]
}
