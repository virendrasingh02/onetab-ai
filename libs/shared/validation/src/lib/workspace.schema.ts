import { WorkspaceRole } from '@org/types';
import { z } from 'zod';
import { iconPatchShape } from './icon.schema.js';

/** Slugs appear in URLs (/w/:slug) and must not collide with app routes. */
const RESERVED_SLUGS = new Set([
  'api',
  'admin',
  'app',
  'auth',
  'login',
  'logout',
  'register',
  'settings',
  'new',
  'invite',
  'help',
  'support',
  'static',
  'assets',
  'www',
]);

export const workspaceSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Slug must be at least 3 characters')
  .max(40, 'Slug must be at most 40 characters')
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Use lowercase letters, numbers and single hyphens',
  )
  .refine((value) => !RESERVED_SLUGS.has(value), {
    message: 'That slug is reserved',
  });

export const workspaceNameSchema = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(60, 'Name must be at most 60 characters');

/**
 * Workspace logo constraints, shared so the browser can reject a bad file
 * before spending an upload on it and the API can reject the same file again.
 *
 * SVG is deliberately absent: the logo is served inline, and an SVG is a
 * script-bearing document on the API's own origin.
 */
export const WORKSPACE_LOGO_MAX_BYTES = 2 * 1024 * 1024;

export const WORKSPACE_LOGO_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const;

export type WorkspaceLogoMimeType = (typeof WORKSPACE_LOGO_MIME_TYPES)[number];

/** `null` when the file is acceptable, otherwise the message to show. */
export function workspaceLogoError(file: {
  type: string;
  size: number;
}): string | null {
  if (
    !(WORKSPACE_LOGO_MIME_TYPES as readonly string[]).includes(file.type)
  ) {
    return 'Upload a PNG, JPEG, WebP or GIF image.';
  }
  if (file.size > WORKSPACE_LOGO_MAX_BYTES) {
    return `Logos must be ${WORKSPACE_LOGO_MAX_BYTES / (1024 * 1024)} MB or smaller.`;
  }
  if (file.size === 0) {
    return 'That file is empty.';
  }
  return null;
}

export const createWorkspaceSchema = z.object({
  name: workspaceNameSchema,
  slug: workspaceSlugSchema,
  description: z.string().trim().max(280).optional().or(z.literal('')),
  // The wizard picks an icon before the workspace exists, so it rides along
  // with creation rather than costing a second request.
  ...iconPatchShape,
});

export const updateWorkspaceSchema = z.object({
  name: workspaceNameSchema.optional(),
  description: z.string().trim().max(280).nullable().optional(),
  avatarUrl: z.string().url('Enter a valid URL').nullable().optional(),
  ...iconPatchShape,
});

export const workspaceRoleSchema = z.enum([
  WorkspaceRole.OWNER,
  WorkspaceRole.ADMIN,
  WorkspaceRole.MEMBER,
  WorkspaceRole.GUEST,
]);

export const updateMemberRoleSchema = z.object({
  role: workspaceRoleSchema.refine((role) => role !== WorkspaceRole.OWNER, {
    // Ownership moves through an explicit transfer, not a role edit.
    message: 'Use "Transfer ownership" to assign the OWNER role',
  }),
});

export const inviteMembersSchema = z.object({
  emails: z
    .array(z.string().trim().toLowerCase().email('Enter valid email addresses'))
    .min(1, 'Add at least one email address')
    .max(50, 'Invite at most 50 people at a time')
    .refine((list) => new Set(list).size === list.length, {
      message: 'Remove duplicate email addresses',
    }),
  // See channel.schema.ts — no `.default()`, so input and output types match.
  role: workspaceRoleSchema,
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(1, 'Invitation token is required'),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type InviteMembersInput = z.infer<typeof inviteMembersSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
