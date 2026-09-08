import { ChannelMode, ChannelRole, ChannelVisibility } from '@org/types';
import { z } from 'zod';

export const channelNameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, 'Channel name must be at least 2 characters')
  .max(48, 'Channel name must be at most 48 characters')
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Use lowercase letters, numbers and single hyphens',
  );

export const createChannelSchema = z.object({
  name: channelNameSchema,
  topic: z.string().trim().max(120).optional().or(z.literal('')),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  // Required rather than `.default()`: a Zod default makes the schema's input
  // and output types diverge, which React Hook Form surfaces as an
  // unassignable `control`. Forms supply the value via `defaultValues`.
  visibility: z.enum([ChannelVisibility.PUBLIC, ChannelVisibility.PRIVATE]),
  /** Seed the channel with these workspace members on creation. */
  memberIds: z.array(z.string()).max(200).optional(),
});

export const updateChannelSchema = z.object({
  name: channelNameSchema.optional(),
  topic: z.string().trim().max(120).nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
  /** Announcement / broadcast mode and its granular toggles (brief §3). */
  mode: z.enum([ChannelMode.STANDARD, ChannelMode.ANNOUNCEMENT]).optional(),
  allowReactions: z.boolean().optional(),
  allowReplies: z.boolean().optional(),
  allowFileUploads: z.boolean().optional(),
  /** Extra user ids allowed to post while in announcement mode. */
  announcementPosterIds: z.array(z.string()).max(200).optional(),
});

export const changeVisibilitySchema = z.object({
  // Public -> private is allowed; private -> public is not, because members
  // who never had access would retroactively gain the channel's history.
  visibility: z.literal(ChannelVisibility.PRIVATE),
});

export const addChannelMembersSchema = z.object({
  userIds: z.array(z.string()).min(1, 'Select at least one person').max(200),
  role: z.enum([ChannelRole.ADMIN, ChannelRole.MEMBER]),
});

export const channelPreferencesSchema = z.object({
  isFavorite: z.boolean().optional(),
  isMuted: z.boolean().optional(),
});

/**
 * Body for `POST channels/:id/join`. Omit `durationHours` (or send null) for a
 * normal permanent join; a positive number joins temporarily for that window
 * (brief §8). The service clamps it to [1h, 90d].
 */
export const joinChannelSchema = z.object({
  durationHours: z.number().int().positive().max(24 * 90).nullable().optional(),
});

/** Body for `POST channels/:id/membership/extend`. */
export const extendMembershipSchema = z.object({
  durationHours: z.number().int().positive().max(24 * 90),
});

export const createPinSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(160),
  url: z.string().url('Enter a valid URL').optional().or(z.literal('')),
  note: z.string().trim().max(500).optional().or(z.literal('')),
});

export type CreateChannelInput = z.infer<typeof createChannelSchema>;
export type UpdateChannelInput = z.infer<typeof updateChannelSchema>;
export type AddChannelMembersInput = z.infer<typeof addChannelMembersSchema>;
export type ChannelPreferencesInput = z.infer<typeof channelPreferencesSchema>;
export type JoinChannelInput = z.infer<typeof joinChannelSchema>;
export type ExtendMembershipInput = z.infer<typeof extendMembershipSchema>;
export type CreatePinInput = z.infer<typeof createPinSchema>;
