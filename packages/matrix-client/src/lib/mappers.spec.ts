import type { MatrixClient as SdkClient, MatrixEvent } from 'matrix-js-sdk';
import type { Room as SdkRoom } from 'matrix-js-sdk';
import {
  resolveMediaUrl,
  toMessage,
  toMessageKind,
  toPresence,
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
