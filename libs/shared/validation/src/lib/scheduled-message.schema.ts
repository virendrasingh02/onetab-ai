import { z } from 'zod';

/** `POST .../scheduled-messages` — schedule a message for later delivery. */
export const createScheduledMessageSchema = z.object({
  conversationId: z.string().trim().min(1).max(300),
  channelName: z.string().trim().max(200).optional(),
  body: z.string().trim().min(1, 'Message is empty').max(20_000),
  /** Must be in the future — enforced in the service, where "now" is real. */
  scheduledFor: z.string().datetime(),
});

/** `PATCH .../scheduled-messages/:id` — reschedule and/or edit, while still pending. */
export const updateScheduledMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message is empty').max(20_000).optional(),
  scheduledFor: z.string().datetime().optional(),
});

export type CreateScheduledMessageInput = z.infer<
  typeof createScheduledMessageSchema
>;
export type UpdateScheduledMessageInput = z.infer<
  typeof updateScheduledMessageSchema
>;
