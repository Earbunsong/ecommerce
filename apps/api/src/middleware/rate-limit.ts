import { getConnInfo } from '@hono/node-server/conninfo'
import type { Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import { env } from '../config/env.js'
import { AppError } from '../lib/errors.js'

// Fixed-window counter per IP, kept in memory. This only works with ONE API instance;
// with several instances, store the counters in PostgreSQL or Redis (architecture §7).
const windows = new Map<string, { count: number; resetAt: number }>()

function clientIp(c: Context): string {
  if (env.TRUST_PROXY) {
    const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    if (forwarded) return forwarded
  }
  try {
    return getConnInfo(c).remote.address ?? 'unknown'
  } catch {
    return 'unknown' // e.g. app.request() in tests has no socket
  }
}

export function rateLimit(options: { name: string; max: number; windowMs: number }) {
  return createMiddleware(async (c, next) => {
    const key = `${options.name}:${clientIp(c)}`
    const now = Date.now()
    if (windows.size > 10_000) {
      for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k)
    }
    let entry = windows.get(key)
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + options.windowMs }
      windows.set(key, entry)
    }
    entry.count++

    if (entry.count > options.max) {
      c.header('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)))
      throw new AppError('RATE_LIMITED', 'Too many attempts. Please try again later.')
    }
    await next()
  })
}

/** 10 attempts per 15 minutes per IP, separate counters for login and register. */
export const authRateLimit = (name: 'login' | 'register') =>
  rateLimit({ name, max: 10, windowMs: 15 * 60_000 })

/** Tests only: start every test with empty counters. */
export function resetRateLimits() {
  windows.clear()
}
