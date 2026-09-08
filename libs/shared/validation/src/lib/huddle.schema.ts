import { z } from 'zod';

/**
 * `POST /workspaces/:id/huddles` — start (or join the existing) huddle in a
 * conversation. Provide `channelId` for a channel huddle, or `matrixRoomId`
 * directly for a DM / group-DM huddle.
 */
export const startHuddleSchema = z
  .object({
    channelId: z.string().max(64).optional(),
    matrixRoomId: z.string().max(200).optional(),
  })
  .refine((v) => !!v.channelId || !!v.matrixRoomId, {
    message: 'A channelId or matrixRoomId is required.',
  });

export type StartHuddleInput = z.infer<typeof startHuddleSchema>;
