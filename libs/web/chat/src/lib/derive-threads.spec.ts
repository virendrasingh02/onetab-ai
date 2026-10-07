import type { Message } from '@org/matrix-client';
import { describe, expect, it } from 'vitest';
import { deriveThreads, groupReplies, threadReplyCount } from './derive-threads.js';

function message(overrides: Partial<Message>): Message {
  return {
    id: '$root' as any,
    roomId: '!room:example.org' as any,
    senderId: '@alice:example.org' as any,
    senderName: 'Alice',
    kind: 'text',
    body: 'hello',
    timestamp: 1_700_000_000_000,
    reactions: [],
    isEdited: false,
    isRedacted: false,
    isEncrypted: false,
    ...overrides,
  };
}

describe('groupReplies', () => {
  it('leaves deleted replies out of the thread and its count', () => {
    const replies = groupReplies([
      message({ id: '$root' as any }),
      message({ id: '$r1' as any, threadRootId: '$root' as any }),
      message({
        id: '$r2' as any,
        threadRootId: '$root' as any,
        isRedacted: true,
        body: '',
      }),
    ]);

    expect(replies.get('$root')?.map((reply) => reply.id)).toEqual(['$r1']);
  });

  it('drops a thread whose replies were all deleted', () => {
    const timeline = [
      message({ id: '$root' as any }),
      message({
        id: '$r1' as any,
        threadRootId: '$root' as any,
        isRedacted: true,
        body: '',
      }),
    ];

    expect(groupReplies(timeline).has('$root')).toBe(false);
    expect(deriveThreads(timeline, [])).toEqual([]);
  });

  it('orders replies by time when older history lands after live replies', () => {
    const replies = groupReplies([
      message({ id: '$root' as any }),
      // Arrived live this session…
      message({ id: '$new' as any, threadRootId: '$root' as any, timestamp: 300 }),
      // …then the thread's earlier replies were loaded and merged in after it.
      message({ id: '$old1' as any, threadRootId: '$root' as any, timestamp: 100 }),
      message({ id: '$old2' as any, threadRootId: '$root' as any, timestamp: 200 }),
    ]);

    expect(replies.get('$root')?.map((reply) => reply.id)).toEqual(['$old1', '$old2', '$new']);
  });
});

describe('threadReplyCount', () => {
  const summary = (replyCount: number, hasOlderReplies: boolean) => ({
    rootId: '$root' as any,
    roomId: '!room:example.org' as any,
    replyCount,
    hasOlderReplies,
    participantIds: [],
    hasUnread: false,
  });

  it("uses the server's count while only the newest replies are loaded", () => {
    expect(threadReplyCount(30, summary(87, true))).toBe(87);
  });

  it('counts loaded replies once the whole thread is in', () => {
    // The server still counts a deleted reply; the loaded list does not.
    expect(threadReplyCount(4, summary(5, false))).toBe(4);
  });

  it('falls back to loaded replies without a summary', () => {
    expect(threadReplyCount(3)).toBe(3);
  });

  it('never shows fewer than are on screen', () => {
    expect(threadReplyCount(6, summary(5, true))).toBe(6);
  });

  it('feeds the channel thread list', () => {
    const timeline = [
      message({ id: '$root' as any }),
      message({ id: '$r1' as any, threadRootId: '$root' as any }),
    ];
    const [thread] = deriveThreads(timeline, [], {
      summaries: new Map([['$root', summary(42, true)]]),
    });
    expect(thread.replyCount).toBe(42);
  });
});
