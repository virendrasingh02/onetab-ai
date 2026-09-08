import { WorkspaceRole } from '@org/types';
import { z } from 'zod';

/** `PUT .../anonymous/settings` — workspace admin only. */
export const updateChannelAnonymousSettingsSchema = z.object({
  isEnabled: z.boolean().optional(),
  allowedRoles: z
    .array(
      z.enum([
        WorkspaceRole.OWNER,
        WorkspaceRole.ADMIN,
        WorkspaceRole.MEMBER,
        WorkspaceRole.GUEST,
      ]),
    )
    .max(4)
    .optional(),
  allowReplies: z.boolean().optional(),
});

/** `POST .../anonymous/messages` — the anonymous post itself. */
export const postAnonymousMessageSchema = z.object({
  text: z.string().trim().min(1, 'Message is empty').max(4000),
  /** Present for a threaded anonymous reply. */
  threadRootId: z.string().max(200).optional(),
});

/** `POST .../anonymous/messages/:id/report` — any member. */
export const reportAnonymousMessageSchema = z.object({
  reason: z.string().trim().min(1, 'Say why').max(500),
});

/** `POST .../anonymous/messages/:id/remove` — moderator only. */
export const removeAnonymousMessageSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export type UpdateChannelAnonymousSettingsInput = z.infer<
  typeof updateChannelAnonymousSettingsSchema
>;
export type PostAnonymousMessageInput = z.infer<
  typeof postAnonymousMessageSchema
>;
export type ReportAnonymousMessageInput = z.infer<
  typeof reportAnonymousMessageSchema
>;
export type RemoveAnonymousMessageInput = z.infer<
  typeof removeAnonymousMessageSchema
>;
