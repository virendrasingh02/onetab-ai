import { describe, expect, it } from 'vitest';
import type { Message } from '@org/types';
import { buildRows } from './message-list.js';

const BASE = new Date(2026, 9, 5, 11, 30).getTime();

function message(id: string, offsetMs: number, extra: Partial<Message> = {}): Message {
  return {
    id,
    roomId: '!room:a',
    senderId: '@me:a',
    senderName: 'Me',
    kind: 'text',
    body: id,
    timestamp: BASE + offsetMs,
    reactions: [],
    isEdited: false,
    isRedacted: false,
    ...extra,
  } as Message;
}

const shape = (rows: ReturnType<typeof buildRows>) =>
  rows.map((row) =>
    row.kind === 'message'
      ? `${row.message.id}${row.grouped ? '+' : ''}`
      : row.kind === 'ephemeral'
        ? `[${row.id}]`
        : row.kind,
  );

describe('buildRows — ephemeral rows', () => {
  it('places a notice directly under its anchor and breaks grouping after it', () => {
    const rows = buildRows(
      [message('a', 0), message('b', 1_000), message('c', 2_000)],
      null,
      [{ id: 'n1', anchorId: 'b', timestamp: BASE + 1_000 }],
    );
    // `c` would group under `b` (same sender, seconds apart) but starts a
    // fresh run below the notice.
    expect(shape(rows)).toEqual(['separator', 'a', 'b+', '[n1]', 'c']);
  });

  it('anchors by transaction id once the server has acknowledged the send', () => {
    const rows = buildRows(
      [message('$real', 0, { transactionId: 'm.123' })],
      null,
      [{ id: 'n1', anchorId: 'm.123', timestamp: BASE }],
    );
    expect(shape(rows)).toEqual(['separator', '$real', '[n1]']);
  });

  it('falls back to time order when the anchor is not loaded', () => {
    const rows = buildRows(
      [message('a', 0), message('b', 5_000)],
      null,
      [
        { id: 'late', anchorId: 'missing', timestamp: BASE + 9_000 },
        { id: 'mid', timestamp: BASE + 2_000 },
      ],
    );
    expect(shape(rows)).toEqual(['separator', 'a', '[mid]', 'b', '[late]']);
  });

  it('is unchanged without ephemeral items', () => {
    const rows = buildRows([message('a', 0), message('b', 1_000)]);
    expect(shape(rows)).toEqual(['separator', 'a', 'b+']);
  });
});
