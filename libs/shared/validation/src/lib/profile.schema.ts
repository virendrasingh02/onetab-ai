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

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type UploadRequestInput = z.infer<typeof uploadRequestSchema>;
