import { describe, expect, it } from 'vitest';
import { CONTENT_BLOCKED_MESSAGE } from '@org/types';
import { OneTabMatrixClient } from './matrix-client.js';

/** The check runs first, so these never need a started client. */
const client = OneTabMatrixClient.prototype;

describe('content filter backstop', () => {
  it('refuses to send blocked text', async () => {
    await expect(
      client.sendMessage.call({} as never, 'room', 'kill yourself'),
    ).rejects.toThrow(CONTENT_BLOCKED_MESSAGE);
  });

  it('refuses to edit a message into blocked text', async () => {
    await expect(
      client.editMessage.call({} as never, 'room', 'event', 'kill yourself'),
    ).rejects.toThrow(CONTENT_BLOCKED_MESSAGE);
  });

  it('lets ordinary text reach the client', async () => {
    await expect(
      client.sendMessage.call({} as never, 'room', 'ship it'),
    ).rejects.not.toThrow(CONTENT_BLOCKED_MESSAGE);
  });
});

describe('media guard', () => {
  const file = {} as File;
  const screen = (client as unknown as Record<string, unknown>)[
    'screenMedia'
  ] as (this: unknown, room: string, file: File) => Promise<void>;

  it('stops media the guard refuses', async () => {
    const self = {
      mediaGuard: async () => {
        throw new Error('refused');
      },
      isRoomEncrypted: async () => false,
    };
    await expect(screen.call(self, 'room', file)).rejects.toThrow('refused');
  });

  it('never sends encrypted-room media to the guard', async () => {
    let called = false;
    const self = {
      mediaGuard: async () => {
        called = true;
      },
      isRoomEncrypted: async () => true,
    };
    await screen.call(self, 'room', file);
    expect(called).toBe(false);
  });
});
