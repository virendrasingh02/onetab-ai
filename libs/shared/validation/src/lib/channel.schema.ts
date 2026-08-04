import { ChannelRole, ChannelVisibility } from '@org/types';
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
  visibility: z
    .enum([ChannelVisibility.PUBLIC, ChannelVisibility.PRIVATE])
    .default(ChannelVisibility.PUBLIC),
  /** Seed the channel with these workspace members on creation. */
  memberIds: z.array(z.string()).max(200).optional(),
});

export const updateChannelSchema = z.object({
  name: channelNameSchema.optional(),
  topic: z.string().trim().max(120).nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
});

export const changeVisibilitySchema = z.object({
  // Public -> private is allowed; private -> public is not, because members
  // who never had access would retroactively gain the channel's history.
  visibility: z.literal(ChannelVisibility.PRIVATE),
});

export const addChannelMembersSchema = z.object({
  userIds: z.array(z.string()).min(1, 'Select at least one person').max(200),
  role: z.enum([ChannelRole.ADMIN, ChannelRole.MEMBER]).default(ChannelRole.MEMBER),
});

export const channelPreferencesSchema = z.object({
  isFavorite: z.boolean().optional(),
  isMuted: z.boolean().optional(),
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
export type CreatePinInput = z.infer<typeof createPinSchema>;
