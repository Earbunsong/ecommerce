import { AppError } from '../../lib/errors.js'
import { type User, usersRepository } from './users.repository.js'

/** The only user shape that leaves the API. Built from an allow-list, so password_hash can never leak. */
export type PublicUser = Pick<User, 'id' | 'email' | 'fullName' | 'phone' | 'role' | 'createdAt'>

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role,
    createdAt: user.createdAt,
  }
}

export const usersService = {
  /**
   * Loads the user behind an auth token on every request (architecture §4.9), so a
   * deactivated account or a changed role takes effect immediately, not when the token expires.
   */
  async getActiveUser(id: string): Promise<PublicUser> {
    const user = await usersRepository.findById(id)
    if (!user) throw new AppError('UNAUTHENTICATED', 'Please log in.')
    if (!user.isActive) {
      throw new AppError('ACCOUNT_DISABLED', 'This account is disabled. Please contact the shop.')
    }
    return toPublicUser(user)
  },
}
