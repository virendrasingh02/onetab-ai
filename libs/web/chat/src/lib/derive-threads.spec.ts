import type { Message } from '@org/matrix-client';
import { describe, expect, it } from 'vitest';
import { deriveThreads, groupReplies } from './derive-threads.js';

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
});
