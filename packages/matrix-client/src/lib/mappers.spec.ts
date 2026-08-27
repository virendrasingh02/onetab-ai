import type { MatrixClient as SdkClient, MatrixEvent } from 'matrix-js-sdk';
import type { Room as SdkRoom } from 'matrix-js-sdk';
import {
  resolveDirectMessageRoom,
  resolveGroupDirectMessageRoom,
  resolveMediaUrl,
  toMessage,
  toMessageKind,
  toPresence,
  toRoomKind,
} from './mappers.js';

/**
 * Minimal stand-ins for the SDK objects the mappers read.
 *
 * Building fakes by hand rather than mocking the module keeps these tests
 * honest about exactly which SDK methods the mappers depend on — if that set
 * grows, the fake has to grow with it.
 */
function fakeClient(overrides: Partial<SdkClient> = {}): SdkClient {
  return {
    getUserId: () => '@me:example.org',
    mxcUrlToHttp: (mxc: string) =>
      mxc.startsWith('mxc://')
        ? `https://media.example.org/${mxc.slice(6)}`
        : null,
    getAccountData: () => undefined,
    ...overrides,
  } as unknown as SdkClient;
}

interface FakeEventInput {
  id?: string;
  roomId?: string;
  sender?: string;
  type?: string;
  content: Record<string, unknown>;
  ts?: number;
  redacted?: boolean;
  decryptionFailure?: boolean;
  encrypted?: boolean;
  replacing?: boolean;
}

function fakeEvent(input: FakeEventInput): MatrixEvent {
  return {
    getId: () => input.id ?? '$evt1',
    getRoomId: () => input.roomId ?? '!room:example.org',
    getSender: () => input.sender ?? '@alice:example.org',
    getType: () => input.type ?? 'm.room.message',
    getContent: () => input.content,
    getTs: () => input.ts ?? 1_700_000_000_000,
    isRedacted: () => input.redacted ?? false,
    isDecryptionFailure: () => input.decryptionFailure ?? false,
    isEncrypted: () => input.encrypted ?? false,
    replacingEvent: () => (input.replacing ? {} : null),
    getRelation: () => null,
  } as unknown as MatrixEvent;
}

function fakeRoom(): SdkRoom {
  return {
    roomId: '!room:example.org',
    getMember: () => ({
      name: 'Alice',
      getMxcAvatarUrl: () => 'mxc://example.org/avatar',
    }),
    getUnfilteredTimelineSet: () => ({ relations: undefined }),
  } as unknown as SdkRoom;
}

describe('toMessageKind', () => {
  it('maps standard msgtypes', () => {
    expect(toMessageKind({ msgtype: 'm.text' })).toBe('text');
    expect(toMessageKind({ msgtype: 'm.image' })).toBe('image');
    expect(toMessageKind({ msgtype: 'm.file' })).toBe('file');
  });

  it('distinguishes a voice note from a plain audio file', () => {
    expect(toMessageKind({ msgtype: 'm.audio' })).toBe('audio');
    expect(
      toMessageKind({
        msgtype: 'm.audio',
        'org.matrix.msc3245.voice': {},
      }),
    ).toBe('voice');
  });

  it('falls back to unknown for unrecognised types', () => {
    expect(toMessageKind({ msgtype: 'm.something.new' })).toBe('unknown');
    expect(toMessageKind({})).toBe('unknown');
  });
});

describe('resolveMediaUrl', () => {
  it('resolves an mxc URI', () => {
    expect(resolveMediaUrl(fakeClient(), 'mxc://example.org/abc')).toBe(
      'https://media.example.org/example.org/abc',
    );
  });

  it('returns null rather than a broken URL', () => {
    expect(resolveMediaUrl(fakeClient(), undefined)).toBeNull();
    expect(resolveMediaUrl(fakeClient(), 'https://not-mxc')).toBeNull();
  });
});

describe('toMessage', () => {
  const client = fakeClient();
  const room = fakeRoom();

  it('maps a text message to the domain model', () => {
    const message = toMessage(
      client,
      fakeEvent({ content: { msgtype: 'm.text', body: 'hello' } }),
      room,
    );

    expect(message).toMatchObject({
      id: '$evt1',
      roomId: '!room:example.org',
      senderId: '@alice:example.org',
      senderName: 'Alice',
      kind: 'text',
      body: 'hello',
      isEdited: false,
      isRedacted: false,
    });
  });

  it('keeps formatted bodies only for the custom HTML format', () => {
    const html = toMessage(
      client,
      fakeEvent({
        content: {
          msgtype: 'm.text',
          body: 'hi',
          format: 'org.matrix.custom.html',
          formatted_body: '<b>hi</b>',
        },
      }),
      room,
    );
    expect(html?.formattedBody).toBe('<b>hi</b>');

    const unknownFormat = toMessage(
      client,
      fakeEvent({
        content: {
          msgtype: 'm.text',
          body: 'hi',
          format: 'something/else',
          formatted_body: '<b>hi</b>',
        },
      }),
      room,
    );
    expect(unknownFormat?.formattedBody).toBeUndefined();
  });

  it('drops replacement events — the SDK folds them into the original', () => {
    const message = toMessage(
      client,
      fakeEvent({
        content: {
          msgtype: 'm.text',
          body: '* edited',
          'm.relates_to': { rel_type: 'm.replace', event_id: '$orig' },
        },
      }),
      room,
    );
    expect(message).toBeNull();
  });

  it('flags an edited message', () => {
    const message = toMessage(
      client,
      fakeEvent({ content: { msgtype: 'm.text', body: 'x' }, replacing: true }),
      room,
    );
    expect(message?.isEdited).toBe(true);
  });

  it('withholds content and surfaces an explanation when decryption fails', () => {
    const message = toMessage(
      client,
      fakeEvent({
        content: { msgtype: 'm.text', body: 'should not leak' },
        decryptionFailure: true,
        encrypted: true,
      }),
      room,
    );

    expect(message?.body).toBe('');
    expect(message?.attachment).toBeUndefined();
    expect(message?.decryptionError).toContain('could not be decrypted');
  });

  it('resolves an encrypted attachment from `file` rather than `url`', () => {
    const message = toMessage(
      client,
      fakeEvent({
        content: {
          msgtype: 'm.image',
          body: 'photo.png',
          file: { url: 'mxc://example.org/secret' },
          info: { mimetype: 'image/png', size: 1234, w: 800, h: 600 },
        },
      }),
      room,
    );

    expect(message?.attachment).toMatchObject({
      name: 'photo.png',
      mimeType: 'image/png',
      size: 1234,
      width: 800,
      height: 600,
    });
  });

  it('normalises an MSC1767 waveform into the 0..1 range', () => {
    const message = toMessage(
      client,
      fakeEvent({
        content: {
          msgtype: 'm.audio',
          body: 'voice.ogg',
          url: 'mxc://example.org/voice',
          'org.matrix.msc3245.voice': {},
          // 0, half and full scale, plus an out-of-spec overshoot.
          'org.matrix.msc1767.audio': { waveform: [0, 512, 1024, 2048] },
        },
      }),
      room,
    );

    expect(message?.kind).toBe('voice');
    expect(message?.attachment?.waveform).toEqual([0, 0.5, 1, 1]);
  });

  it('returns null when the event lacks the identifiers we require', () => {
    const orphan = {
      getId: () => undefined,
      getRoomId: () => '!r:example.org',
      getSender: () => '@a:example.org',
      getContent: () => ({}),
    } as unknown as MatrixEvent;

    expect(toMessage(client, orphan, room)).toBeNull();
  });

  it('maps custom AI agent structured events to domain model', () => {
    const agentEvent = fakeEvent({
      type: 'mie.ai.agent.v1',
      content: {
        agentId: 'agent-research',
        status: 'completed',
        agentName: 'Research Agent',
        summary: 'Synthesized findings from 12 sources',
        tools: [{ name: 'web_search', status: 'success', durationMs: 320 }],
        sources: [{ title: 'Doc A', url: 'https://docs.example.com' }],
      },
    });

    const msg = toMessage(client, agentEvent, room);
    expect(msg).not.toBeNull();
    expect(msg?.structuredEvent).toBeDefined();
    expect(msg?.structuredEvent?.type).toBe('mie.ai.agent');
    expect((msg?.structuredEvent as any).agentId).toBe('agent-research');
    expect((msg?.structuredEvent as any).status).toBe('completed');
  });

  it('maps embedded app response structured events to domain model', () => {
    const appEvent = fakeEvent({
      content: {
        msgtype: 'm.text',
        body: 'New GitHub PR created',
        mie_event: {
          type: 'mie.app.response',
          appId: 'github',
          appName: 'GitHub',
          title: '#123 Feature branch',
          fields: [{ label: 'Author', value: 'alice', inline: true }],
        },
      },
    });

    const msg = toMessage(client, appEvent, room);
    expect(msg).not.toBeNull();
    expect(msg?.structuredEvent).toBeDefined();
    expect(msg?.structuredEvent?.type).toBe('mie.app.response');
    expect((msg?.structuredEvent as any).appId).toBe('github');
  });
});

describe('toPresence', () => {
  it('maps known presence states', () => {
    expect(toPresence('@a:x', 'online').state).toBe('online');
    expect(toPresence('@a:x', 'unavailable').state).toBe('unavailable');
    expect(toPresence('@a:x', 'offline').state).toBe('offline');
  });

  it('defaults an unknown or missing state to offline', () => {
    expect(toPresence('@a:x', undefined).state).toBe('offline');
    expect(toPresence('@a:x', 'weird').state).toBe('offline');
  });
});

// --- resolveDirectMessageRoom (audit B4) ----------------------------------

interface FakeDmRoomInput {
  roomId: string;
  /** Defaults to 'join'. */
  myMembership?: string;
  /** Presence of an `m.room.name` state event marks this a channel/group. */
  name?: string;
  members?: Array<{ userId: string; membership?: string }>;
  /** Defaults to the count of joined `members`, or 2. */
  joinedCount?: number;
}

function fakeDmRoom(input: FakeDmRoomInput): SdkRoom {
  const joined = (input.members ?? []).filter(
    (member) => (member.membership ?? 'join') === 'join',
  );
  return {
    roomId: input.roomId,
    getMyMembership: () => input.myMembership ?? 'join',
    getJoinedMemberCount: () => input.joinedCount ?? joined.length ?? 2,
    currentState: {
      getStateEvents: (type: string) =>
        type === 'm.room.name' && input.name
          ? ({ getContent: () => ({ name: input.name }) } as unknown)
          : null,
    },
    getMembers: () =>
      (input.members ?? []).map((member) => ({
        userId: member.userId,
        membership: member.membership ?? 'join',
      })),
  } as unknown as SdkRoom;
}

function fakeKindClient(direct: Record<string, string[]>): SdkClient {
  return {
    getAccountData: (type: string) =>
      type === 'm.direct' ? { getContent: () => direct } : undefined,
  } as unknown as SdkClient;
}

function fakeDmClient(input: {
  direct?: Record<string, string[]>;
  rooms?: SdkRoom[];
  myUserId?: string;
}): SdkClient {
  const rooms = input.rooms ?? [];
  return {
    getUserId: () => input.myUserId ?? '@me:example.org',
    getAccountData: (type: string) =>
      type === 'm.direct'
        ? { getContent: () => input.direct ?? {} }
        : undefined,
    getRoom: (id: string) => rooms.find((room) => room.roomId === id) ?? null,
    getRooms: () => rooms,
  } as unknown as SdkClient;
}

describe('resolveDirectMessageRoom', () => {
  const peer = '@alice:example.org';
  const me = '@me:example.org';

  it('returns the room recorded in m.direct for the peer', () => {
    const client = fakeDmClient({
      direct: { [peer]: ['!dm:example.org'] },
      rooms: [fakeDmRoom({ roomId: '!dm:example.org' })],
    });
    expect(resolveDirectMessageRoom(client, peer)).toBe('!dm:example.org');
  });

  it('returns a recorded room whose invite is still pending, so no duplicate is created', () => {
    const client = fakeDmClient({
      direct: { [peer]: ['!dm:example.org'] },
      rooms: [fakeDmRoom({ roomId: '!dm:example.org', myMembership: 'invite' })],
    });
    expect(resolveDirectMessageRoom(client, peer)).toBe('!dm:example.org');
  });

  it('skips a recorded room the caller has left', () => {
    const client = fakeDmClient({
      direct: { [peer]: ['!old:example.org'] },
      rooms: [fakeDmRoom({ roomId: '!old:example.org', myMembership: 'leave' })],
    });
    expect(resolveDirectMessageRoom(client, peer)).toBeNull();
  });

  it('finds an untagged, nameless two-person room with the peer', () => {
    const client = fakeDmClient({
      rooms: [
        fakeDmRoom({
          roomId: '!legacy:example.org',
          members: [{ userId: me }, { userId: peer }],
        }),
      ],
    });
    expect(resolveDirectMessageRoom(client, peer)).toBe('!legacy:example.org');
  });

  it('never matches a two-person channel — a named room (audit B4)', () => {
    const client = fakeDmClient({
      rooms: [
        fakeDmRoom({
          roomId: '!private-channel:example.org',
          name: 'secret-project',
          members: [{ userId: me }, { userId: peer }],
        }),
      ],
    });
    expect(resolveDirectMessageRoom(client, peer)).toBeNull();
  });

  it('never matches a room already tagged as another user’s DM', () => {
    const client = fakeDmClient({
      direct: { '@bob:example.org': ['!bobs-dm:example.org'] },
      rooms: [
        fakeDmRoom({
          roomId: '!bobs-dm:example.org',
          members: [{ userId: me }, { userId: peer }],
        }),
      ],
    });
    expect(resolveDirectMessageRoom(client, peer)).toBeNull();
  });

  it('does not match a room with a third participant', () => {
    const client = fakeDmClient({
      rooms: [
        fakeDmRoom({
          roomId: '!trio:example.org',
          members: [
            { userId: me },
            { userId: peer },
            { userId: '@carol:example.org' },
          ],
        }),
      ],
    });
    expect(resolveDirectMessageRoom(client, peer)).toBeNull();
  });

  it('counts a still-pending invite toward the two parties', () => {
    const client = fakeDmClient({
      rooms: [
        fakeDmRoom({
          roomId: '!pending:example.org',
          members: [
            { userId: me, membership: 'join' },
            { userId: peer, membership: 'invite' },
          ],
        }),
      ],
    });
    expect(resolveDirectMessageRoom(client, peer)).toBe('!pending:example.org');
  });

  it('returns null when nothing matches', () => {
    expect(resolveDirectMessageRoom(fakeDmClient({ rooms: [] }), peer)).toBeNull();
  });
});

describe('toRoomKind', () => {
  it('classifies a two-person room in m.direct as a direct message', () => {
    const room = fakeDmRoom({ roomId: '!dm:x', joinedCount: 2 });
    const client = fakeKindClient({ '@a:x': ['!dm:x'] });
    expect(toRoomKind(room, client)).toBe('direct');
  });

  it('classifies a room in m.direct with three or more people as a group DM', () => {
    const room = fakeDmRoom({ roomId: '!grp:x', joinedCount: 4 });
    const client = fakeKindClient({ '@a:x': ['!grp:x'], '@b:x': ['!grp:x'] });
    expect(toRoomKind(room, client)).toBe('group');
  });

  it('classifies a larger room not in m.direct as a channel', () => {
    const room = fakeDmRoom({ roomId: '!chan:x', joinedCount: 12 });
    expect(toRoomKind(room, fakeKindClient({}))).toBe('channel');
  });
});

describe('resolveGroupDirectMessageRoom', () => {
  const me = '@me:example.org';
  const alice = '@alice:example.org';
  const bob = '@bob:example.org';
  const carol = '@carol:example.org';

  it('returns a tagged room whose other participants are exactly the wanted set', () => {
    const client = fakeDmClient({
      direct: { [alice]: ['!grp:x'], [bob]: ['!grp:x'] },
      rooms: [
        fakeDmRoom({
          roomId: '!grp:x',
          members: [{ userId: me }, { userId: alice }, { userId: bob }],
        }),
      ],
    });
    expect(resolveGroupDirectMessageRoom(client, [alice, bob])).toBe('!grp:x');
  });

  it('does not reuse a room that is missing one of the wanted people', () => {
    const client = fakeDmClient({
      direct: { [alice]: ['!grp:x'], [bob]: ['!grp:x'] },
      rooms: [
        fakeDmRoom({
          roomId: '!grp:x',
          members: [{ userId: me }, { userId: alice }, { userId: bob }],
        }),
      ],
    });
    expect(resolveGroupDirectMessageRoom(client, [alice, bob, carol])).toBeNull();
  });

  it('does not reuse a room that has an extra person', () => {
    const client = fakeDmClient({
      direct: { [alice]: ['!grp:x'], [bob]: ['!grp:x'], [carol]: ['!grp:x'] },
      rooms: [
        fakeDmRoom({
          roomId: '!grp:x',
          members: [
            { userId: me },
            { userId: alice },
            { userId: bob },
            { userId: carol },
          ],
        }),
      ],
    });
    expect(resolveGroupDirectMessageRoom(client, [alice, bob])).toBeNull();
  });

  it('never infers a group DM from an untagged room by default', () => {
    const client = fakeDmClient({
      rooms: [
        fakeDmRoom({
          roomId: '!untagged:x',
          members: [{ userId: me }, { userId: alice }, { userId: bob }],
        }),
      ],
    });
    expect(resolveGroupDirectMessageRoom(client, [alice, bob])).toBeNull();
  });

  it('reuses an untagged room these exact people share when includeChannels is set', () => {
    const client = fakeDmClient({
      rooms: [
        fakeDmRoom({
          roomId: '!shared-channel:x',
          name: 'squad',
          members: [{ userId: me }, { userId: alice }, { userId: bob }],
        }),
      ],
    });
    expect(
      resolveGroupDirectMessageRoom(client, [alice, bob], {
        includeChannels: true,
      }),
    ).toBe('!shared-channel:x');
  });

  it('does not reuse a channel whose membership is a superset of the picked people', () => {
    const client = fakeDmClient({
      rooms: [
        fakeDmRoom({
          roomId: '!general:x',
          name: 'general',
          members: [
            { userId: me },
            { userId: alice },
            { userId: bob },
            { userId: carol },
          ],
        }),
      ],
    });
    expect(
      resolveGroupDirectMessageRoom(client, [alice, bob], {
        includeChannels: true,
      }),
    ).toBeNull();
  });

  it('returns null for fewer than two peers', () => {
    expect(resolveGroupDirectMessageRoom(fakeDmClient({}), [alice])).toBeNull();
  });
});
