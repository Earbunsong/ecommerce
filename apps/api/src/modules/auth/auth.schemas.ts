import { z } from 'zod'

// Emails are compared and stored in lowercase (ERD §5)
const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.').max(255))

// Cambodian numbers: 0XX XXX XXX(X) or +855 XX XXX XXX(X). Spaces and dashes are removed and
// the number is stored in the local 0XX… form, so the same phone always looks the same.
const cambodianPhone = z
  .string()
  .transform((v) => v.replace(/[\s-]/g, '').replace(/^\+855/, '0'))
  .pipe(z.string().regex(/^0[1-9]\d{7,8}$/, 'Enter a Cambodian phone number, e.g. 012 345 678.'))

export const registerSchema = z.object({
  fullName: z.string().trim().min(1, 'Enter your name.').max(120),
  email,
  phone: cambodianPhone,
  password: z.string().min(8, 'Password must be at least 8 characters.').max(128),
})

export const loginSchema = z.object({
  email,
  // No length rule on login: just check the password
  password: z.string().min(1, 'Enter your password.').max(128),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
