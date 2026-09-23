import { z } from 'zod';

/** How far ahead a message reminder may be set. */
export const MESSAGE_REMINDER_MAX_AHEAD_DAYS = 365;

/**
 * A workspace-relative app path (`c/general?msg=$id`) — never a URL with a
 * scheme or a protocol-relative `//host`, so a reminder can't point outside.
 */
const workspacePath = z
  .string()
  .trim()
  .min(1)
  .max(1000)
  .refine(
    (path) => !/^[a-z][a-z0-9+.-]*:/i.test(path) && !path.startsWith('//'),
    'The link must be a path inside this workspace.',
  );

export const createMessageReminderSchema = z.object({
  roomId: z.string().min(1).max(255),
  eventId: z.string().min(1).max(255),
  remindAt: z.string().datetime(),
  deepLink: workspacePath,
  snippet: z.string().max(280).default(''),
});

export type CreateMessageReminderInput = z.infer<typeof createMessageReminderSchema>;
