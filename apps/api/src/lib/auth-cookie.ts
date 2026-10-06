import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { CookieOptions } from 'hono/utils/cookie'
import { sign, verify } from 'hono/jwt'
import { env } from '../config/env.js'

// JWT in an httpOnly cookie, 7 days (NFR-02, architecture §4.9)
export const AUTH_COOKIE = 'shopkh_auth'
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60
const ALG = 'HS256'

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: true, // browsers also accept secure cookies on http://localhost
  sameSite: 'Lax',
  path: '/',
  ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
}

export async function setAuthCookie(c: Context, userId: string) {
  const now = Math.floor(Date.now() / 1000)
  const token = await sign(
    { sub: userId, iat: now, exp: now + MAX_AGE_SECONDS },
    env.JWT_SECRET,
    ALG,
  )
  setCookie(c, AUTH_COOKIE, token, { ...cookieOptions, maxAge: MAX_AGE_SECONDS })
}

export function clearAuthCookie(c: Context) {
  deleteCookie(c, AUTH_COOKIE, cookieOptions)
}

/** The user id from a valid, unexpired token, or null. */
export async function readAuthCookie(c: Context): Promise<string | null> {
  const token = getCookie(c, AUTH_COOKIE)
  if (!token) return null
  try {
    const payload = await verify(token, env.JWT_SECRET, ALG)
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null // bad signature, expired, or malformed
  }
}
