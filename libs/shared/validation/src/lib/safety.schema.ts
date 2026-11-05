import { z } from 'zod';

export const CONTENT_REPORT_TARGETS = [
  'MESSAGE',
  'USER',
  'AI_OUTPUT',
  'AGENT',
  'FILE',
  'OTHER',
] as const;

export const CONTENT_REPORT_REASONS = [
  'SPAM',
  'HARASSMENT',
  'HATE',
  'SEXUAL',
  'VIOLENCE',
  'SELF_HARM',
  'ILLEGAL',
  'MISINFORMATION',
  'OTHER',
] as const;

export const CONTENT_REPORT_STATUSES = [
  'OPEN',
  'REVIEWING',
  'ACTIONED',
  'DISMISSED',
] as const;

export const createContentReportSchema = z.object({
  targetType: z.enum(CONTENT_REPORT_TARGETS),
  targetId: z.string().trim().min(1).max(255),
  /** Platform user id of the author, when the surface knows it. */
  targetUserId: z.string().trim().min(1).max(64).optional(),
  /** Matrix id of the author; chat surfaces know this one, not the platform id. */
  targetMatrixUserId: z.string().trim().min(1).max(255).optional(),
  workspaceId: z.string().trim().min(1).max(64).optional(),
  reason: z.enum(CONTENT_REPORT_REASONS),
  details: z.string().trim().max(2000).optional(),
  /** A copy of the reported text; the original may be edited or redacted. */
  excerpt: z.string().trim().max(4000).optional(),
});
export type CreateContentReportInput = z.infer<
  typeof createContentReportSchema
>;

export const resolveContentReportSchema = z.object({
  status: z.enum(CONTENT_REPORT_STATUSES),
  resolutionNote: z.string().trim().max(2000).optional(),
});
export type ResolveContentReportInput = z.infer<
  typeof resolveContentReportSchema
>;

/** One of the two ids is required; chat surfaces only know the Matrix one. */
export const blockUserSchema = z
  .object({
    userId: z.string().trim().min(1).max(64).optional(),
    matrixUserId: z.string().trim().min(1).max(255).optional(),
  })
  .refine((value) => Boolean(value.userId || value.matrixUserId), {
    message: 'A user is required.',
  });
export type BlockUserInput = z.infer<typeof blockUserSchema>;

export const ACCOUNT_DELETION_CONFIRMATION = 'DELETE';

export const deleteAccountSchema = z.object({
  /** Required when the account has a password. */
  password: z.string().max(200).optional(),
  /** Required when two-factor authentication is on. */
  twoFactorCode: z.string().trim().max(32).optional(),
  /** Typed by hand, so a stray tap cannot erase an account. */
  confirmation: z.literal(ACCOUNT_DELETION_CONFIRMATION),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
