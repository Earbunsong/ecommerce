import { db } from '../../db/client.js'
import { AppError, isUniqueViolation } from '../../lib/errors.js'
import { hashPassword, verifyPassword } from '../../lib/password.js'
import { cartRepository } from '../cart/cart.repository.js'
import { usersRepository } from '../users/users.repository.js'
import { type PublicUser, toPublicUser } from '../users/users.service.js'
import type { LoginInput, RegisterInput } from './auth.schemas.js'

// Verified against when the email is unknown, so a wrong email takes as long as a wrong
// password and response time does not reveal which emails have accounts.
let dummyHash: Promise<string> | undefined

export const authService = {
  /** Creates a customer and their empty cart in one transaction (flowchart 1). */
  async register(input: RegisterInput): Promise<PublicUser> {
    const passwordHash = await hashPassword(input.password)

    try {
      return await db.transaction(async (tx) => {
        if (await usersRepository.findByEmail(input.email, tx)) {
          throw new AppError('EMAIL_TAKEN', 'This email is already registered.')
        }
        const user = await usersRepository.create(
          {
            email: input.email,
            passwordHash,
            fullName: input.fullName,
            phone: input.phone,
            role: 'customer',
          },
          tx,
        )
        await cartRepository.createForUser(user.id, tx)
        return toPublicUser(user)
      })
    } catch (err) {
      // Two registrations with the same email at the same moment: the unique index decides
      if (isUniqueViolation(err, 'users_email_unique')) {
        throw new AppError('EMAIL_TAKEN', 'This email is already registered.')
      }
      throw err
    }
  },

  /**
   * Password first, then is_active (architecture §4.9): unknown email and wrong password give
   * the same INVALID_CREDENTIALS, and ACCOUNT_DISABLED is only revealed to the real owner.
   */
  async login(input: LoginInput): Promise<PublicUser> {
    const user = await usersRepository.findByEmail(input.email)
    const valid = user
      ? await verifyPassword(user.passwordHash, input.password)
      : await verifyPassword(await (dummyHash ??= hashPassword('timing-only')), input.password)

    if (!user || !valid) {
      throw new AppError('INVALID_CREDENTIALS', 'Email or password is incorrect.')
    }
    if (!user.isActive) {
      throw new AppError('ACCOUNT_DISABLED', 'This account is disabled. Please contact the shop.')
    }
    return toPublicUser(user)
  },
}
