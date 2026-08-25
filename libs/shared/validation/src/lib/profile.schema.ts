import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  displayName: z.string().trim().max(48).nullable().optional(),
  bio: z.string().trim().max(280).nullable().optional(),
  timezone: z.string().min(1).max(64).optional(),
  avatarUrl: z.string().url('Enter a valid URL').nullable().optional(),
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
});

export const updateUserPreferencesSchema = z.object({
  chat: chatPreferencesSchema.partial().optional(),
  notifications: notificationDisplayPreferencesSchema.partial().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type UploadRequestInput = z.infer<typeof uploadRequestSchema>;
export type ChatPreferencesInput = z.infer<typeof chatPreferencesSchema>;
export type NotificationDisplayPreferencesInput = z.infer<
  typeof notificationDisplayPreferencesSchema
>;
export type UserPreferencesInput = z.infer<typeof userPreferencesSchema>;
export type UpdateUserPreferencesInput = z.infer<
  typeof updateUserPreferencesSchema
>;
