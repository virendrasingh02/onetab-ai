import type { Message } from '@org/matrix-client';

/**
 * Consecutive attachment messages from the same sender inside this window are
 * treated as one multi-file upload rather than separate sends. Only used for
 * files sent before uploads were tagged with a batch id (`Message.batchId`) —
 * tagged files are grouped by that id alone.
 */
const BURST_WINDOW_MS = 10_000;

export interface AttachmentBursts {
  /** Non-head messages that belong to a burst — the timeline skips these rows. */
  hidden: Set<string>;
  /** Head message id → every message in its burst (including the head), oldest first. */
  membersByHead: Map<string, Message[]>;
}

/**
 * A message that is nothing but an uncaptioned file — no user text was added.
 * The mapper blanks a media event's `body` when it is only the filename, so an
 * empty body (or one equal to the filename, from older mappings) means bare.
 */
function isBareAttachment(message: Message): boolean {
  return (
    !!message.attachment &&
    !message.structuredEvent &&
    !message.forwarded &&
    !message.replyToId &&
    !message.isRedacted &&
    (message.body === '' || message.body === message.attachment.name)
  );
}

/**
 * Groups a bulk upload's files into one burst, so it renders as one message
 * with a grid instead of one bubble per file.
 *
 * - Files tagged with the same `batchId` (sent together via `sendFiles`) are
 *   always one burst, even if someone else's message landed between them.
 * - Untagged legacy files fall back to a heuristic: consecutive same-sender,
 *   caption-less attachments sent within {@link BURST_WINDOW_MS}.
 *
 * Single attachments, and ones with their own caption, are left alone.
 */
export function deriveAttachmentBursts(messages: Message[]): AttachmentBursts {
  const hidden = new Set<string>();
  const membersByHead = new Map<string, Message[]>();

  const addBurst = (run: Message[]) => {
    if (run.length < 2) return;
    membersByHead.set(run[0].id, run);
    for (const message of run.slice(1)) hidden.add(message.id);
  };

  // Tagged uploads: group by batch id, keyed by sender so an id can never
  // pull in someone else's file.
  const batches = new Map<string, Message[]>();
  for (const message of messages) {
    if (!message.batchId || !message.attachment || message.isRedacted) continue;
    const key = `${message.senderId}\u0000${message.batchId}`;
    const run = batches.get(key);
    if (run) run.push(message);
    else batches.set(key, [message]);
  }
  for (const run of batches.values()) addBurst(run);

  // Legacy, untagged uploads.
  let run: Message[] = [];
  let previous: Message | undefined;
  for (const message of messages) {
    const eligible = !message.batchId && isBareAttachment(message);
    const continuesRun =
      eligible &&
      !!previous &&
      run.length > 0 &&
      previous.senderId === message.senderId &&
      message.timestamp - previous.timestamp < BURST_WINDOW_MS;

    if (continuesRun) {
      run.push(message);
    } else {
      addBurst(run);
      run = eligible ? [message] : [];
    }
    previous = message;
  }
  addBurst(run);

  return { hidden, membersByHead };
}
