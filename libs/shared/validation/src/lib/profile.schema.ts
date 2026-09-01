import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  displayName: z.string().trim().max(48).nullable().optional(),
  bio: z.string().trim().max(280).nullable().optional(),
  timezone: z.string().min(1).max(64).optional(),
  avatarUrl: z.string().nullable().optional(),
  coverUrl: z.string().nullable().optional(),
  title: z.string().trim().max(80).nullable().optional(),
  jobTitle: z.string().trim().max(80).nullable().optional(),
  location: z.string().trim().max(80).nullable().optional(),
  website: z.string().trim().max(255).nullable().optional(),
  github: z.string().trim().max(80).nullable().optional(),
  statusText: z.string().trim().max(100).nullable().optional(),
  statusEmoji: z.string().trim().max(32).nullable().optional(),
  statusExpiresAt: z.string().datetime().nullable().optional(),
});

export const updateStatusSchema = z.object({
  statusText: z.string().trim().max(100).nullable().optional(),
  statusEmoji: z.string().trim().max(32).nullable().optional(),
  statusExpiresAt: z.string().datetime().nullable().optional(),
  presence: z.enum(['ONLINE', 'AWAY', 'BUSY', 'OFFLINE']).optional(),
});

/** Upload constraints, enforced client-side and re-checked by the API. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const ALLOWED_UPLOAD_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/json',
] as const;

export const uploadRequestSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: z.enum(ALLOWED_UPLOAD_MIME_TYPES, {
    message: 'That file type is not supported',
  }),
  size: z
    .number()
    .int()
    .positive()
    .max(MAX_UPLOAD_BYTES, 'File must be 25 MB or smaller'),
  channelId: z.string().nullable().optional(),
});

export const chatPreferencesSchema = z.object({
  messageDensity: z.enum(['comfy', 'compact']).default('comfy'),
  openPosition: z.enum(['last-read', 'newest']).default('last-read'),
  readReceipts: z.boolean().default(true),
});

export const notificationDisplayPreferencesSchema = z.object({
  showContentPreview: z.boolean().default(true),
  showDuringCalls: z.boolean().default(true),
  flashTaskbar: z.boolean().default(true),
  dismissDuration: z
    .union([
      z.literal(3000),
      z.literal(5000),
      z.literal(10000),
      z.literal(15000),
      z.literal(30000),
      z.null(),
    ])
    .default(5000),
  position: z
    .enum(['bottom-right', 'top-right', 'bottom-left', 'top-left'])
    .default('bottom-right'),
  size: z.enum(['comfy', 'compact']).default('comfy'),
});

const hexColorRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const gradientStopSchema = z.object({
  color: z.string().regex(hexColorRegex, 'Invalid hex color'),
  position: z.number().min(0).max(100),
  opacity: z.number().min(0).max(1).optional(),
});

export const gradientConfigSchema = z.object({
  type: z.enum(['linear', 'radial']),
  angle: z.number().min(0).max(360).optional(),
  shape: z.enum(['circle', 'ellipse']).optional(),
  stops: z.array(gradientStopSchema).min(2),
});

export const themeColorsConfigSchema = z.object({
  primary: z.string().regex(hexColorRegex, 'Invalid hex color'),
  primaryForeground: z.string().regex(hexColorRegex).optional(),
  secondary: z.string().regex(hexColorRegex).optional(),
  secondaryForeground: z.string().regex(hexColorRegex).optional(),
  accent: z.string().regex(hexColorRegex).optional(),
  accentForeground: z.string().regex(hexColorRegex).optional(),
  background: z.string().regex(hexColorRegex).optional(),
  foreground: z.string().regex(hexColorRegex).optional(),
  card: z.string().regex(hexColorRegex).optional(),
  cardForeground: z.string().regex(hexColorRegex).optional(),
  muted: z.string().regex(hexColorRegex).optional(),
  mutedForeground: z.string().regex(hexColorRegex).optional(),
  border: z.string().regex(hexColorRegex).optional(),
  input: z.string().optional(),
  ring: z.string().regex(hexColorRegex).optional(),
  destructive: z.string().regex(hexColorRegex).optional(),
  destructiveForeground: z.string().regex(hexColorRegex).optional(),
  success: z.string().regex(hexColorRegex).optional(),
  successForeground: z.string().regex(hexColorRegex).optional(),
  warning: z.string().regex(hexColorRegex).optional(),
  warningForeground: z.string().regex(hexColorRegex).optional(),
  info: z.string().regex(hexColorRegex).optional(),
  infoForeground: z.string().regex(hexColorRegex).optional(),
  sidebar: z.string().regex(hexColorRegex).optional(),
  sidebarForeground: z.string().regex(hexColorRegex).optional(),
  sidebarBorder: z.string().regex(hexColorRegex).optional(),
});

export const themeGradientsConfigSchema = z.object({
  primary: z.union([gradientConfigSchema, z.string()]).optional(),
  secondary: z.union([gradientConfigSchema, z.string()]).optional(),
  accent: z.union([gradientConfigSchema, z.string()]).optional(),
  hero: z.union([gradientConfigSchema, z.string()]).optional(),
  sidebar: z.union([gradientConfigSchema, z.string()]).optional(),
  surface: z.union([gradientConfigSchema, z.string()]).optional(),
  button: z.union([gradientConfigSchema, z.string()]).optional(),
  background: z.union([gradientConfigSchema, z.string()]).optional(),
});

export const themeBackgroundsConfigSchema = z.object({
  pageType: z.enum(['flat', 'gradient', 'subtle-pattern']).default('flat'),
  sidebarType: z.enum(['flat', 'gradient']).default('flat'),
  headerType: z.enum(['flat', 'gradient', 'glass']).default('flat'),
  cardType: z.enum(['flat', 'gradient', 'glass']).default('flat'),
  glassBlur: z.number().min(0).max(40).optional(),
  surfaceOpacity: z.number().min(0).max(1).optional(),
});

export const themeTypographyConfigSchema = z.object({
  fontFamily: z.string(),
  monoFamily: z.string().optional(),
  baseFontSize: z.enum(['13px', '14px', '15px', '16px']).optional(),
  headingWeight: z.enum(['500', '600', '700', '800']).optional(),
  bodyWeight: z.enum(['400', '500']).optional(),
  lineHeight: z.enum(['1.4', '1.5', '1.6']).optional(),
});

export const themeShapeConfigSchema = z.object({
  radiusBase: z.enum(['0px', '4px', '6px', '8px', '10px', '12px', '16px', '9999px']),
  radiusButton: z.enum(['0px', '4px', '6px', '8px', '10px', '12px', '9999px']).optional(),
  radiusCard: z.enum(['0px', '6px', '8px', '10px', '12px', '16px', '20px']).optional(),
  radiusInput: z.enum(['0px', '4px', '6px', '8px', '10px', '12px']).optional(),
  radiusDialog: z.enum(['0px', '8px', '12px', '16px', '24px']).optional(),
});

export const themeShadowsConfigSchema = z.object({
  elevation: z.enum(['none', 'subtle', 'balanced', 'elevated', 'dramatic']),
  borderIntensity: z.enum(['subtle', 'medium', 'strong', 'none']),
});

export const themeConfigSchema = z.object({
  mode: z.enum(['light', 'dark', 'system']).default('light'),
  type: z.enum(['default', 'custom', 'preset']).default('default'),
  name: z.string().optional(),
  brandColor: z.string().regex(hexColorRegex, 'Invalid hex color').optional(),
  neutralColor: z.string().regex(hexColorRegex, 'Invalid hex color').optional(),
  presetId: z.string().optional(),
  colors: themeColorsConfigSchema.partial().optional(),
  gradients: themeGradientsConfigSchema.partial().optional(),
  backgrounds: themeBackgroundsConfigSchema.partial().optional(),
  typography: themeTypographyConfigSchema.partial().optional(),
  shape: themeShapeConfigSchema.partial().optional(),
  shadows: themeShadowsConfigSchema.partial().optional(),
});

export const userPreferencesSchema = z.object({
  chat: chatPreferencesSchema.default({
    messageDensity: 'comfy',
    openPosition: 'last-read',
    readReceipts: true,
  }),
  notifications: notificationDisplayPreferencesSchema.default({
    showContentPreview: true,
    showDuringCalls: true,
    flashTaskbar: true,
    dismissDuration: 5000,
    position: 'bottom-right',
    size: 'comfy',
  }),
  theme: themeConfigSchema.optional(),
});

export const updateUserPreferencesSchema = z.object({
  chat: chatPreferencesSchema.partial().optional(),
  notifications: notificationDisplayPreferencesSchema.partial().optional(),
  theme: themeConfigSchema.partial().optional(),
});

/**
 * The sidebar-customization blob the web client persists — section/item
 * visibility and order, per-workspace resource ordering, collapsed groups.
 *
 * Validated loosely: the shape is owned by the client's zustand store and
 * evolves with the UI, so this pins the known top-level keys, strips anything
 * else, and caps the serialized size rather than describing every nested
 * value.
 */
export const sidebarPreferencesSchema = z
  .object({
    items: z.record(z.string(), z.unknown()).optional(),
    sections: z.record(z.string(), z.unknown()).optional(),
    channelOrders: z.record(z.string(), z.array(z.string())).optional(),
    resourceOrders: z
      .record(z.string(), z.record(z.string(), z.array(z.string())))
      .optional(),
    collapsedGroups: z.record(z.string(), z.boolean()).optional(),
    sidebarCollapsed: z.boolean().optional(),
    activityIndicators: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((value) => JSON.stringify(value).length <= 64_000, {
    message: 'Sidebar preferences payload is too large.',
  });

/**
 * The appearance blob the web client persists — interface mode, density,
 * accent, corner radius, and the full custom-theme config (or null when the
 * user has reverted to the platform default).
 *
 * Every field is optional so the client can PUT a partial update; the server
 * merges it over the stored row. `customTheme` reuses `themeConfigSchema`.
 */
export const themeSettingSchema = z
  .object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
    density: z.enum(['compact', 'default', 'comfortable']).optional(),
    accent: z
      .enum([
        'mint',
        'violet',
        'blue',
        'green',
        'amber',
        'pink',
        'cyan',
        'orange',
        'indigo',
        'teal',
        'rose',
      ])
      .optional(),
    radius: z.enum(['xs', 'sm', 'md', 'lg', 'xl']).optional(),
    customTheme: themeConfigSchema.nullable().optional(),
  })
  .refine((value) => JSON.stringify(value).length <= 32_000, {
    message: 'Theme settings payload is too large.',
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type SidebarPreferencesInput = z.infer<typeof sidebarPreferencesSchema>;
export type ThemeSettingInput = z.infer<typeof themeSettingSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type UploadRequestInput = z.infer<typeof uploadRequestSchema>;
export type ChatPreferencesInput = z.infer<typeof chatPreferencesSchema>;
export type NotificationDisplayPreferencesInput = z.infer<
  typeof notificationDisplayPreferencesSchema
>;
export type ThemeConfigInput = z.infer<typeof themeConfigSchema>;
export type UserPreferencesInput = z.infer<typeof userPreferencesSchema>;
export type UpdateUserPreferencesInput = z.infer<
  typeof updateUserPreferencesSchema
>;
