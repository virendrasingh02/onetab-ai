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
  password: z.string().min(1, 'Password is required'),
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

export const desktopAuthorizeSchema = z.object({
  state: z.string().min(8, 'State must be at least 8 characters').max(256),
  codeChallenge: z.string().min(32, 'Code challenge must be at least 32 characters').max(128),
});

export const desktopExchangeSchema = z.object({
  code: z.string().min(16, 'Authorization code is required').max(128),
  codeVerifier: z.string().min(32, 'Code verifier must be at least 32 characters').max(128),
  state: z.string().min(8, 'State is required').max(256),
});

/* --- mobile device authorization schemas --------------------------------- */

export const createDeviceAuthSchema = z.object({
  clientName: z.string().max(100).optional(),
  platform: z.string().max(50).optional(),
  os: z.string().max(50).optional(),
  browser: z.string().max(50).optional(),
});

export const deviceInfoQuerySchema = z.object({
  requestId: z.string().min(8).max(128).optional(),
  code: z.string().min(4).max(32).optional(),
}).refine((data) => Boolean(data.requestId || data.code), {
  message: 'Either requestId or code is required',
});

export const approveDeviceAuthSchema = z.object({
  requestId: z.string().min(8).max(128).optional(),
  code: z.string().min(4).max(32).optional(),
}).refine((data) => Boolean(data.requestId || data.code), {
  message: 'Either requestId or code is required',
});

export const rejectDeviceAuthSchema = z.object({
  requestId: z.string().min(8).max(128).optional(),
  code: z.string().min(4).max(32).optional(),
}).refine((data) => Boolean(data.requestId || data.code), {
  message: 'Either requestId or code is required',
});

export const exchangeDeviceAuthSchema = z.object({
  requestId: z.string().min(8).max(128),
  secretToken: z.string().min(16).max(128),
});

export const pollDeviceAuthSchema = z.object({
  requestId: z.string().min(8).max(128),
  secretToken: z.string().min(16).max(128),
});

/**
 * Optional refresh token in a request body.
 *
 * The browser normally refreshes through the httpOnly `onetab_rt` cookie, but a
 * browser holds only one such cookie — so a *background* account in a
 * multi-account session presents its refresh token here instead. Absent means
 * "use the cookie", which is the single-account path.
 */
export const refreshSchema = z
  .object({
    refreshToken: z.string().min(16).max(512).optional(),
  })
  // A request with no body at all (the single-account path) parses to `{}`.
  .default({});

/** Logout accepts the same optional body: present revokes one background account. */
export const logoutSchema = refreshSchema;

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type DesktopAuthorizeInput = z.infer<typeof desktopAuthorizeSchema>;
export type DesktopExchangeInput = z.infer<typeof desktopExchangeSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;

export type CreateDeviceAuthInput = z.infer<typeof createDeviceAuthSchema>;
export type DeviceInfoQueryInput = z.infer<typeof deviceInfoQuerySchema>;
export type ApproveDeviceAuthInput = z.infer<typeof approveDeviceAuthSchema>;
export type RejectDeviceAuthInput = z.infer<typeof rejectDeviceAuthSchema>;
export type ExchangeDeviceAuthInput = z.infer<typeof exchangeDeviceAuthSchema>;
export type PollDeviceAuthInput = z.infer<typeof pollDeviceAuthSchema>;

export interface DeviceAuthInfoResponse {
  requestId: string;
  userCode: string;
  deviceInfo: {
    clientName: string;
    platform: string;
    os: string;
    browser: string;
    ip?: string;
    location?: string;
  };
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'consumed';
  expiresAt: string;
}

export interface CreateDeviceAuthResponse {
  requestId: string;
  userCode: string;
  secretToken: string;
  verificationUrl: string;
  deepLinkUrl: string;
  expiresAt: string;
  expiresInSeconds: number;
}
