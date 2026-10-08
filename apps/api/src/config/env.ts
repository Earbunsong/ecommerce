import { existsSync } from 'node:fs'
import { z } from 'zod'

// Load apps/api/.env in development. In production the host provides real env vars.
if (existsSync('.env') && process.env.NODE_ENV !== 'production') {
  process.loadEnvFile('.env')
}

const bool = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true')

const cents = z.coerce.number().int().nonnegative()

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.url().optional(),
    TEST_DATABASE_URL: z.url().optional(),
    JWT_SECRET: z.string().min(1).default('dev-only-secret'),
    WEB_ORIGIN: z.url().default('http://localhost:5173'),
    COOKIE_DOMAIN: z.string().optional(),
    SHIPPING_FEE_CENTS: cents.default(150),
    FREE_SHIPPING_THRESHOLD_CENTS: cents.default(3000),
    ORDER_PAYMENT_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(15),
    ENABLE_MOCK_PAYMENTS: bool,
    STORAGE_DRIVER: z.enum(['local', 's3', 'cloudinary']).default('local'),
    // Local driver: folder for uploaded files, relative to apps/api; served at /uploads/*
    UPLOAD_DIR: z.string().min(1).default('uploads'),
    // true only behind a reverse proxy that sets X-Forwarded-For (used for rate limiting by IP)
    TRUST_PROXY: bool,
  })
  .transform((env) => ({
    ...env,
    // Tests always use the separate test database, never the development data.
    DATABASE_URL: env.NODE_ENV === 'test' ? env.TEST_DATABASE_URL : env.DATABASE_URL,
  }))
  .refine((env) => env.DATABASE_URL, {
    message: 'DATABASE_URL (or TEST_DATABASE_URL when NODE_ENV=test) is required',
  })
  .refine((env) => env.NODE_ENV !== 'production' || env.JWT_SECRET !== 'dev-only-secret', {
    message: 'JWT_SECRET must be set in production',
  })

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:', z.prettifyError(parsed.error))
  process.exit(1)
}

export const env = parsed.data as typeof parsed.data & { DATABASE_URL: string }
