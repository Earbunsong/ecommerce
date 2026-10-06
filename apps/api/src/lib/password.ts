import { hash, verify } from '@node-rs/argon2'

// argon2id with the library defaults (NFR-01). Never store or log the plain password.
export function hashPassword(password: string): Promise<string> {
  return hash(password)
}

export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password)
}
