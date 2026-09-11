import type { Message } from '@org/matrix-client';

/**
 * Consecutive attachment messages from the same sender inside this window are
 * treated as one multi-file upload rather than separate sends. Matrix has no
 * "one event, many files" message type, so attaching several files still
 * fires one `m.room.message` per file in a tight loop — this is what turns
 * that back into the single grouped send the user actually made.
 */
const BURST_WINDOW_MS = 10_000;

export interface AttachmentBursts {
  /** Non-head messages that belong to a burst — the timeline skips these rows. */
  hidden: Set<string>;
  /** Head message id → every message in its burst (including the head), oldest first. */
  membersByHead: Map<string, Message[]>;
}

/** A message that is nothing but an uncaptioned file — no user text was added. */
function isBareAttachment(message: Message): boolean {
  return (
    !!message.attachment &&
    !message.structuredEvent &&
    !message.isRedacted &&
    message.body === message.attachment.name
  );
}

/**
 * Groups consecutive same-sender, caption-less attachment messages sent
 * within {@link BURST_WINDOW_MS} of each other into bursts, so a bulk upload
 * renders as one grid instead of one bubble per file.
 *
 * Single attachments, and ones with their own caption, are left alone — this
 * only ever merges rows that would otherwise look like an accidental flood of
 * near-identical, header-less messages.
 */
export function deriveAttachmentBursts(messages: Message[]): AttachmentBursts {
  const hidden = new Set<string>();
  const membersByHead = new Map<string, Message[]>();

  let head: Message | null = null;
  let run: Message[] = [];

  const flush = () => {
    if (head && run.length > 1) {
      membersByHead.set(head.id, run);
      for (const message of run) {
        if (message.id !== head.id) hidden.add(message.id);
      }
    }
    head = null;
    run = [];
  };

  let previous: Message | undefined;
  for (const message of messages) {
    const eligible = isBareAttachment(message);
    const continuesRun =
      eligible &&
      !!previous &&
      run.length > 0 &&
      previous.senderId === message.senderId &&
      message.timestamp - previous.timestamp < BURST_WINDOW_MS;

    if (continuesRun) {
      run.push(message);
    } else {
      flush();
      if (eligible) {
        head = message;
        run = [message];
      }
    }
    previous = message;
  }
  flush();

  return { hidden, membersByHead };
}
