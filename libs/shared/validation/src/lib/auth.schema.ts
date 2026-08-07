import { z } from 'zod';

/**
 * Password policy, enforced identically in the browser and the API.
 *
 * Length does more for entropy than character-class rules, so the floor is 10
 * with a light composition requirement rather than a long list of classes.
 */
export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128, 'Password must be at most 128 characters')
  .refine((value) => /[a-z]/.test(value), {
    message: 'Password must contain a lowercase letter',
  })
  .refine((value) => /[A-Z]/.test(value), {
    message: 'Password must contain an uppercase letter',
  })
  .refine((value) => /[0-9]/.test(value), {
    message: 'Password must contain a number',
  });

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .max(255)
  .email('Enter a valid email address')
  .toLowerCase();

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email or username is required')
    .max(255)
    .toLowerCase(),
  // Deliberately not `passwordSchema`: an existing password that predates a
  // policy change must still be able to sign in.
  password: z.string().min(1, 'Password is required'),
  // Plain boolean rather than `.default(false)`: a default makes the schema's
  // input and output types diverge, which React Hook Form's generics surface
  // as an unassignable `control`. The form supplies the initial value instead.
  rememberMe: z.boolean(),
});

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .max(80, 'Name must be at most 80 characters'),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, {
      message: 'You must accept the terms to continue',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
