// Expected business failures (architecture §4.10). Services throw AppError with a code and
// no HTTP status; the error handler maps the code to a status with this one table.
export const errorStatus = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  ACCOUNT_DISABLED: 403,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  EMAIL_TAKEN: 409,
  ALREADY_EXISTS: 409,
  OUT_OF_STOCK: 409,
  CART_EMPTY: 409,
  INVALID_STATUS_TRANSITION: 409,
  ORDER_EXPIRED: 409,
  ALREADY_REVIEWED: 409,
  NOT_ELIGIBLE_TO_REVIEW: 403,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
} as const

export type ErrorCode = keyof typeof errorStatus

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

/** True if a database error was caused by the given unique constraint (Drizzle wraps it in `cause`). */
export function isUniqueViolation(err: unknown, constraint: string): boolean {
  const pgError = ((err as { cause?: unknown })?.cause ?? err) as {
    code?: string
    constraint_name?: string
  }
  return pgError?.code === '23505' && pgError.constraint_name === constraint
}
