import { server } from '../../src/server.js'
import { AUTH_COOKIE } from '../../src/lib/auth-cookie.js'

type Options = {
  method?: string
  json?: unknown
  form?: FormData
  cookie?: string
  headers?: Record<string, string>
}

/** Sends a request through the real server (middleware, validation, error handler). */
export async function request(
  path: string,
  { method, json, form, cookie, headers = {} }: Options = {},
) {
  const hasBody = json !== undefined || form !== undefined
  const res = await server.request(path.startsWith('/uploads/') ? path : `/api${path}`, {
    method: method ?? (hasBody ? 'POST' : 'GET'),
    headers: {
      ...(json === undefined ? {} : { 'content-type': 'application/json' }),
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body: form ?? (json === undefined ? undefined : JSON.stringify(json)),
  })
  const text = await res.text()
  let body: any = null // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    // not JSON, e.g. an uploaded file; use `text`
  }
  return { res, status: res.status, body, text }
}

/** The `shopkh_auth=<token>` pair from a Set-Cookie header, ready to send back as a Cookie header. */
export function authCookieFrom(res: Response): string | undefined {
  const header = res.headers.getSetCookie().find((c) => c.startsWith(`${AUTH_COOKIE}=`))
  return header?.split(';')[0]
}
