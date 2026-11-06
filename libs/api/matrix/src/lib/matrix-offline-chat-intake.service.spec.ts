import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MatrixOfflineChatIntakeService,
  hasLiveClient,
  isNotifiable,
  mentions,
  mutedRoomIds,
} from './matrix-offline-chat-intake.service.js';

const prisma = { user: { findMany: vi.fn() } };
const admin = { syncAs: vi.fn(), getRoomMembers: vi.fn() };
const events = { emit: vi.fn() };
const config = { get: vi.fn() };

function message(overrides: Record<string, unknown> = {}) {
  return {
    type: 'm.room.message',
    room_id: '!room:hs',
    event_id: '$e1',
    sender: '@alice:hs',
    origin_server_ts: Date.now(),
    content: { msgtype: 'm.text', body: 'hello' },
    ...overrides,
  };
}

function sync(batch: string, list: unknown[] = [], pushRules?: unknown) {
  return { nextBatch: batch, invitedRoomIds: [], events: list, pushRules };
}

describe('MatrixOfflineChatIntakeService', () => {
  let service: MatrixOfflineChatIntakeService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.user.findMany.mockResolvedValue([
      { id: 'me', matrixUserId: '@me:hs', presence: 'OFFLINE' },
    ]);
    admin.getRoomMembers.mockResolvedValue(['@me:hs', '@alice:hs']);
    service = new MatrixOfflineChatIntakeService(
      prisma as never,
      admin as never,
      events as never,
      config as never,
    );
  });

  it('only sets a cursor on the first sync, then reports new messages', async () => {
    admin.syncAs.mockResolvedValueOnce(sync('a', [message()]));
    await service.tick();
    expect(events.emit).not.toHaveBeenCalled();

    admin.syncAs.mockResolvedValueOnce(sync('b', [message()]));
    await service.tick();

    expect(admin.syncAs).toHaveBeenLastCalledWith('@me:hs', 'a', {
      person: true,
    });
    expect(events.emit).toHaveBeenCalledWith(
      'chat.message.missed',
      expect.objectContaining({
        recipientId: 'me',
        roomId: '!room:hs',
        eventId: '$e1',
        isEncrypted: false,
        isGroup: false,
      }),
    );
  });

  it('leaves a user with a live client to that client, but keeps up', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'me',
        matrixUserId: '@me:hs',
        presence: 'ONLINE',
        lastSeenAt: new Date(),
      },
    ]);
    admin.syncAs
      .mockResolvedValueOnce(sync('a'))
      .mockResolvedValueOnce(sync('b', [message()]));
    await service.tick();
    await service.tick();

    expect(events.emit).not.toHaveBeenCalled();
    expect(admin.syncAs).toHaveBeenCalledTimes(2);
  });

  it('skips the user’s own messages and muted rooms', async () => {
    const rules = { global: { override: [{ rule_id: '!muted:hs' }] } };
    admin.syncAs
      .mockResolvedValueOnce(sync('a', [], rules))
      .mockResolvedValueOnce(
        sync('b', [
          message({ sender: '@me:hs' }),
          message({ room_id: '!muted:hs' }),
        ]),
      );
    await service.tick();
    await service.tick();

    expect(events.emit).not.toHaveBeenCalled();
  });

  it('flags an encrypted event without reading it', async () => {
    admin.syncAs.mockResolvedValueOnce(sync('a')).mockResolvedValueOnce(
      sync('b', [
        message({ type: 'm.room.encrypted', content: { ciphertext: 'x' } }),
      ]),
    );
    await service.tick();
    await service.tick();

    expect(events.emit.mock.calls[0][1]).toMatchObject({ isEncrypted: true });
  });

  it('one user failing does not stop the next', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'a', matrixUserId: '@a:hs', presence: 'OFFLINE' },
      { id: 'b', matrixUserId: '@b:hs', presence: 'OFFLINE' },
    ]);
    admin.syncAs
      .mockRejectedValueOnce(new Error('nope'))
      .mockResolvedValueOnce(sync('x'));

    await expect(service.tick()).resolves.toBeUndefined();
    expect(admin.syncAs).toHaveBeenCalledTimes(2);
  });
});

describe('event helpers', () => {
  it('does not trust an "online" nobody has refreshed', () => {
    const now = Date.now();
    const seen = (ago: number) => new Date(now - ago);
    expect(
      hasLiveClient({ presence: 'ONLINE', lastSeenAt: seen(60_000) }, now),
    ).toBe(true);
    expect(
      hasLiveClient({ presence: 'ONLINE', lastSeenAt: seen(200_000) }, now),
    ).toBe(false);
    expect(hasLiveClient({ presence: 'ONLINE', lastSeenAt: null }, now)).toBe(
      false,
    );
    expect(
      hasLiveClient({ presence: 'OFFLINE', lastSeenAt: seen(1_000) }, now),
    ).toBe(false);
  });

  it('drops edits, redactions and system rows', () => {
    expect(isNotifiable(message() as never)).toBe(true);
    expect(
      isNotifiable(
        message({
          content: { body: 'x', 'm.relates_to': { rel_type: 'm.replace' } },
        }) as never,
      ),
    ).toBe(false);
    expect(
      isNotifiable(
        message({ unsigned: { redacted_because: {} } }) as never,
      ),
    ).toBe(false);
    expect(
      isNotifiable(
        message({
          content: { body: 'x', mie_event: { type: 'mie.system_event' } },
        }) as never,
      ),
    ).toBe(false);
  });

  it('reads mentions from m.mentions', () => {
    expect(mentions({ 'm.mentions': { user_ids: ['@me:hs'] } }, '@me:hs')).toBe(
      true,
    );
    expect(mentions({ 'm.mentions': { room: true } }, '@me:hs')).toBe(true);
    expect(mentions({}, '@me:hs')).toBe(false);
  });

  it('ignores disabled and built-in override rules', () => {
    expect([
      ...mutedRoomIds({
        global: {
          override: [
            { rule_id: '!a:hs' },
            { rule_id: '!b:hs', enabled: false },
            { rule_id: '.m.rule.master' },
          ],
        },
      }),
    ]).toEqual(['!a:hs']);
  });
});
