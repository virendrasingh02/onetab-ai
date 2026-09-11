import type { Message } from '@org/matrix-client';
import { describe, expect, it } from 'vitest';
import { deriveAttachmentBursts } from './derive-attachment-bursts.js';

let seq = 0;

function attachmentMessage(overrides: Partial<Message> = {}): Message {
  seq += 1;
  const name = overrides.attachment?.name ?? `file-${seq}.png`;
  return {
    id: `$${seq}`,
    roomId: '!room:hs',
    senderId: '@alice:hs',
    senderName: 'Alice',
    kind: 'image',
    body: name,
    timestamp: 1_000 + seq,
    attachment: { name, mimeType: 'image/png', url: `mxc://hs/${seq}` },
    reactions: [],
    isEdited: false,
    isRedacted: false,
    isEncrypted: false,
    ...overrides,
  };
}

function textMessage(overrides: Partial<Message> = {}): Message {
  seq += 1;
  return {
    id: `$${seq}`,
    roomId: '!room:hs',
    senderId: '@alice:hs',
    senderName: 'Alice',
    kind: 'text',
    body: 'hello',
    timestamp: 1_000 + seq,
    reactions: [],
    isEdited: false,
    isRedacted: false,
    isEncrypted: false,
    ...overrides,
  };
}

describe('deriveAttachmentBursts', () => {
  it('groups consecutive caption-less attachments from the same sender sent close together', () => {
    const files = [
      attachmentMessage({ timestamp: 1000 }),
      attachmentMessage({ timestamp: 1500 }),
      attachmentMessage({ timestamp: 2000 }),
    ];

    const { hidden, membersByHead } = deriveAttachmentBursts(files);

    expect(membersByHead.get(files[0].id)).toEqual(files);
    expect(hidden.has(files[0].id)).toBe(false);
    expect(hidden.has(files[1].id)).toBe(true);
    expect(hidden.has(files[2].id)).toBe(true);
  });

  it('leaves a single attachment alone', () => {
    const files = [attachmentMessage()];
    const { hidden, membersByHead } = deriveAttachmentBursts(files);

    expect(membersByHead.size).toBe(0);
    expect(hidden.size).toBe(0);
  });

  it('does not group attachments sent well apart in time', () => {
    const files = [
      attachmentMessage({ timestamp: 1000 }),
      attachmentMessage({ timestamp: 60_000 }),
    ];

    const { hidden, membersByHead } = deriveAttachmentBursts(files);

    expect(membersByHead.size).toBe(0);
    expect(hidden.size).toBe(0);
  });

  it('does not group attachments from different senders', () => {
    const files = [
      attachmentMessage({ timestamp: 1000, senderId: '@alice:hs' }),
      attachmentMessage({ timestamp: 1200, senderId: '@bob:hs' }),
    ];

    const { hidden, membersByHead } = deriveAttachmentBursts(files);

    expect(membersByHead.size).toBe(0);
    expect(hidden.size).toBe(0);
  });

  it('does not group a message carrying its own caption', () => {
    const files = [
      attachmentMessage({ timestamp: 1000 }),
      attachmentMessage({ timestamp: 1200, body: 'check this out' }),
    ];

    const { hidden, membersByHead } = deriveAttachmentBursts(files);

    expect(membersByHead.size).toBe(0);
    expect(hidden.size).toBe(0);
  });

  it('breaks the run at a plain text message and starts a new one after it', () => {
    const first = attachmentMessage({ timestamp: 1000 });
    const chat = textMessage({ timestamp: 1200 });
    const second = attachmentMessage({ timestamp: 1400 });
    const third = attachmentMessage({ timestamp: 1600 });

    const { hidden, membersByHead } = deriveAttachmentBursts([
      first,
      chat,
      second,
      third,
    ]);

    expect(membersByHead.size).toBe(1);
    expect(membersByHead.get(second.id)).toEqual([second, third]);
    expect(hidden.has(first.id)).toBe(false);
    expect(hidden.has(third.id)).toBe(true);
  });

  it('supports two separate bursts from the same sender with a long gap between them', () => {
    const burstA = [
      attachmentMessage({ timestamp: 1000 }),
      attachmentMessage({ timestamp: 1200 }),
    ];
    const burstB = [
      attachmentMessage({ timestamp: 120_000 }),
      attachmentMessage({ timestamp: 120_200 }),
    ];

    const { hidden, membersByHead } = deriveAttachmentBursts([
      ...burstA,
      ...burstB,
    ]);

    expect(membersByHead.get(burstA[0].id)).toEqual(burstA);
    expect(membersByHead.get(burstB[0].id)).toEqual(burstB);
    expect(hidden.has(burstA[1].id)).toBe(true);
    expect(hidden.has(burstB[1].id)).toBe(true);
  });
});
