import { describe, expect, it, vi } from 'vitest';
import {
  addToDirectMap,
  directRoomTitle,
  openDirectRoom,
  toDirectRooms,
  type DirectClient,
  type DirectRoom,
} from './direct-rooms';
import type { MatrixEvent, SyncResponse } from './matrix';

const ME = '@me:example';

const state = (
  type: string,
  stateKey: string,
  content: Record<string, unknown>,
  sender = ME,
): MatrixEvent => ({
  event_id: `$${type}-${stateKey}`,
  type,
  state_key: stateKey,
  sender,
  origin_server_ts: 1,
  content,
});

const member = (userId: string, displayname: string, membership = 'join') =>
  state('m.room.member', userId, { membership, displayname }, userId);

const message = (id: string, ts: number, body: string): MatrixEvent => ({
  event_id: id,
  type: 'm.room.message',
  sender: '@ana:example',
  origin_server_ts: ts,
  content: { msgtype: 'm.text', body },
});

const sync: SyncResponse = {
  next_batch: 's1',
  account_data: {
    events: [
      {
        type: 'm.direct',
        content: {
          '@ana:example': ['!dm:example', '!group:example'],
          '@bo:example': ['!group:example'],
          '@me:example': ['!notes:example'],
          '@cy:example': ['!space:example'],
          bad: 'not-a-list',
        },
      },
    ],
  },
  rooms: {
    join: {
      '!dm:example': {
        timeline: { events: [message('$m1', 50, 'hey')] },
        state: { events: [member(ME, 'Me'), member('@ana:example', 'Ana')] },
        summary: {
          'm.heroes': ['@ana:example'],
          'm.joined_member_count': 2,
        },
        unread_notifications: { notification_count: 3, highlight_count: 1 },
      },
      '!group:example': {
        timeline: { events: [message('$m2', 80, 'standup?')] },
        state: {
          events: [
            state('m.room.encryption', '', { algorithm: 'm.megolm.v1' }),
            member('@ana:example', 'Ana'),
          ],
        },
        summary: {
          'm.heroes': ['@ana:example', '@bo:example'],
          'm.joined_member_count': 3,
        },
      },
      '!notes:example': {
        timeline: { events: [] },
        state: { events: [member(ME, 'Me')] },
        summary: { 'm.heroes': [], 'm.joined_member_count': 1 },
      },
      '!space:example': {
        state: { events: [state('m.room.create', '', { type: 'm.space' })] },
      },
      '!channel:example': {
        timeline: { events: [message('$m3', 99, 'general')] },
      },
    },
    invite: {
      '!invite:example': {
        invite_state: {
          events: [
            {
              ...state('m.room.member', ME, {
                membership: 'invite',
                is_direct: true,
              }),
              sender: '@dee:example',
              origin_server_ts: 10,
            },
            member('@dee:example', 'Dee'),
          ],
        },
      },
      '!chan-invite:example': {
        invite_state: {
          events: [state('m.room.member', ME, { membership: 'invite' })],
        },
      },
    },
  },
};

describe('toDirectRooms', () => {
  const rooms = toDirectRooms(sync, ME);
  const byId = (id: string) => rooms.find((r) => r.roomId === id);

  it('keeps only m.direct rooms and direct invites, invites first', () => {
    expect(rooms.map((r) => r.roomId)).toEqual([
      '!invite:example',
      '!group:example',
      '!dm:example',
      '!notes:example',
    ]);
  });

  it('classifies 1:1 and group DMs like the web', () => {
    expect(byId('!dm:example')).toMatchObject({
      kind: 'direct',
      peers: ['@ana:example'],
      unread: 3,
      highlight: 1,
      lastMessage: { body: 'hey', ts: 50 },
    });
    expect(byId('!group:example')).toMatchObject({
      kind: 'group',
      memberCount: 3,
      encrypted: true,
      peers: ['@ana:example', '@bo:example'],
    });
    expect(byId('!invite:example')).toMatchObject({
      membership: 'invite',
      inviter: '@dee:example',
      peers: ['@dee:example'],
    });
  });

  it('falls back to the m.direct key for a note-to-self room', () => {
    expect(byId('!notes:example')?.peers).toEqual([]);
  });
});

describe('directRoomTitle', () => {
  const base: DirectRoom = {
    roomId: '!r',
    kind: 'group',
    membership: 'join',
    name: null,
    peers: ['@a:x', '@b:x', '@c:x', '@d:x'],
    names: { '@a:x': 'Ana', '@b:x': 'Bo', '@c:x': 'Cy' },
    avatars: {},
    memberCount: 6,
    encrypted: false,
    lastActivity: 0,
    unread: 0,
    highlight: 0,
  };

  it('names by members, the room name, or the caller', () => {
    expect(directRoomTitle(base)).toBe('Ana, Bo, Cy and 2 others');
    expect(directRoomTitle({ ...base, name: 'Launch' })).toBe('Launch');
    expect(directRoomTitle({ ...base, peers: [], memberCount: 1 })).toBe(
      'Notes to self',
    );
    expect(
      directRoomTitle({ ...base, peers: ['@zed:x'], memberCount: 2 }),
    ).toBe('zed');
  });
});

describe('addToDirectMap', () => {
  it('appends, prefers, and reports no-ops', () => {
    expect(addToDirectMap({ '@a': ['!1'] }, ['@a'], '!2')).toEqual({
      '@a': ['!1', '!2'],
    });
    expect(
      addToDirectMap({ '@a': ['!1', '!2'] }, ['@a'], '!2', { preferred: true }),
    ).toEqual({ '@a': ['!2', '!1'] });
    expect(addToDirectMap({ '@a': ['!1'] }, ['@a'], '!1')).toBeNull();
  });
});

function fakeClient(
  map: Record<string, string[]> = {},
  members: Record<string, string[]> = {},
) {
  const client = {
    userId: ME,
    directMap: vi.fn(async () => map),
    setDirectMap: vi.fn(async () => ({})),
    createRoom: vi.fn(async () => ({ room_id: '!new:example' })),
    memberIds: vi.fn(async (roomId: string) => members[roomId] ?? []),
  };
  return client as typeof client & DirectClient;
}

describe('openDirectRoom', () => {
  const known = toDirectRooms(sync, ME);

  it('reuses the existing 1:1 room from m.direct', async () => {
    const client = fakeClient({ '@ana:example': ['!gone', '!dm:example'] });
    await expect(
      openDirectRoom(client, ['@ana:example', ME], known),
    ).resolves.toBe('!dm:example');
    expect(client.createRoom).not.toHaveBeenCalled();
  });

  it('creates and records a new 1:1 first in the list', async () => {
    const client = fakeClient({ '@zed:example': ['!old'] });
    await expect(openDirectRoom(client, ['@zed:example'], known)).resolves.toBe(
      '!new:example',
    );
    expect(client.createRoom).toHaveBeenCalledWith({
      invite: ['@zed:example'],
      isDirect: true,
    });
    expect(client.setDirectMap).toHaveBeenCalledWith({
      '@zed:example': ['!new:example', '!old'],
    });
  });

  it('opens a note-to-self room with no invite', async () => {
    const client = fakeClient();
    await openDirectRoom(client, [ME], []);
    expect(client.createRoom).toHaveBeenCalledWith({
      invite: [],
      isDirect: true,
    });
    expect(client.setDirectMap).toHaveBeenCalledWith({
      [ME]: ['!new:example'],
    });
  });

  it('reuses a group DM with exactly the same people', async () => {
    const client = fakeClient(
      {},
      { '!group:example': [ME, '@ana:example', '@bo:example'] },
    );
    await expect(
      openDirectRoom(client, ['@bo:example', '@ana:example'], known),
    ).resolves.toBe('!group:example');
    expect(client.createRoom).not.toHaveBeenCalled();
  });

  it('creates a named group DM tagged under every participant', async () => {
    const client = fakeClient(
      {},
      { '!group:example': [ME, '@ana:example', '@bo:example'] },
    );
    await openDirectRoom(
      client,
      ['@ana:example', '@cy:example'],
      known,
      ' Launch ',
    );
    expect(client.createRoom).toHaveBeenCalledWith({
      name: 'Launch',
      invite: ['@ana:example', '@cy:example'],
      isDirect: true,
    });
    expect(client.setDirectMap).toHaveBeenCalledWith({
      '@ana:example': ['!new:example'],
      '@cy:example': ['!new:example'],
    });
  });
});
