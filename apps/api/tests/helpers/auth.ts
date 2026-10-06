import { resetRateLimits } from '../../src/middleware/rate-limit.js'
import { TEST_PASSWORD } from './factories.js'
import { authCookieFrom, request } from './http.js'

/**
 * Logs in through POST /api/auth/login and returns the auth cookie to send with later requests:
 *   const cookie = await loginAs(user.email)
 *   await request('/auth/me', { cookie })
 */
export async function loginAs(email: string, password = TEST_PASSWORD): Promise<string> {
  // Tests log in many times from the same "IP"; the rate limiter is tested on its own
  resetRateLimits()
  const { res, status, body } = await request('/auth/login', { json: { email, password } })
  const cookie = authCookieFrom(res)
  if (status !== 200 || !cookie) {
    throw new Error(`loginAs(${email}) failed: ${status} ${JSON.stringify(body)}`)
  }
  return cookie
}
