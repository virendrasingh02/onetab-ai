import { describe, expect, it, vi } from 'vitest';
import {
  MatrixError,
  MatrixRestClient,
  mediaMessageContent,
  parseMxc,
  threadReplyContent,
  toTimeline,
  type MatrixEvent,
} from './matrix';

const session = {
  homeserverUrl: 'https://matrix.example/',
  matrixUserId: '@u1:example',
  accessToken: 'mx_token',
  deviceId: 'DEV1',
};

const msg = (
  id: string,
  ts: number,
  content: Record<string, unknown>,
  extra: Partial<MatrixEvent> = {},
): MatrixEvent => ({
  event_id: id,
  type: 'm.room.message',
  sender: '@ana:example',
  origin_server_ts: ts,
  content,
  ...extra,
});

describe('toTimeline', () => {
  it('orders oldest first and keeps text and media', () => {
    const items = toTimeline([
      msg('$2', 2, {
        msgtype: 'm.image',
        body: 'cat.png',
        url: 'mxc://example/abc',
        info: { mimetype: 'image/png', size: 10 },
      }),
      msg('$1', 1, { msgtype: 'm.text', body: 'hello' }),
    ]);
    expect(items.map((i) => i.id)).toEqual(['$1', '$2']);
    expect(items[1]).toMatchObject({
      kind: 'image',
      mxcUrl: 'mxc://example/abc',
      mimeType: 'image/png',
    });
  });

  it('applies the latest edit and hides the edit event itself', () => {
    const items = toTimeline([
      msg('$e2', 4, {
        body: '* v3',
        'm.new_content': { msgtype: 'm.text', body: 'v3' },
        'm.relates_to': { rel_type: 'm.replace', event_id: '$1' },
      }),
      msg('$e1', 3, {
        body: '* v2',
        'm.new_content': { msgtype: 'm.text', body: 'v2' },
        'm.relates_to': { rel_type: 'm.replace', event_id: '$1' },
      }),
      msg('$1', 1, { msgtype: 'm.text', body: 'v1' }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ body: 'v3', edited: true });
  });

  it('drops redactions and thread replies but flags the thread root', () => {
    const items = toTimeline([
      msg('$r', 3, {
        msgtype: 'm.text',
        body: 'reply',
        'm.relates_to': { rel_type: 'm.thread', event_id: '$1' },
      }),
      msg('$gone', 2, {}, { unsigned: { redacted_because: {} } }),
      msg('$1', 1, { msgtype: 'm.text', body: 'root' }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: '$1', isThreadRoot: true });
  });

  it('shows encrypted events as a placeholder', () => {
    const items = toTimeline([
      { ...msg('$x', 1, {}), type: 'm.room.encrypted' },
    ]);
    expect(items[0]?.kind).toBe('encrypted');
  });

  it('counts thread replies and returns a thread when asked', () => {
    const events = [
      msg('$1', 1, { msgtype: 'm.text', body: 'root' }),
      msg('$r1', 2, {
        msgtype: 'm.text',
        body: 'first',
        'm.relates_to': { rel_type: 'm.thread', event_id: '$1' },
      }),
      msg('$r2', 5, {
        msgtype: 'm.text',
        body: 'second',
        'm.relates_to': { rel_type: 'm.thread', event_id: '$1' },
      }),
      msg('$other', 3, { msgtype: 'm.text', body: 'not in thread' }),
    ];
    const main = toTimeline(events);
    expect(main.map((i) => i.id)).toEqual(['$1', '$other']);
    expect(main[0]).toMatchObject({ threadReplyCount: 2, threadLatestTs: 5 });

    const thread = toTimeline(events, { threadRootId: '$1' });
    expect(thread.map((i) => i.id)).toEqual(['$1', '$r1', '$r2']);
  });

  it('prefers the bundled thread summary when larger than what is loaded', () => {
    const items = toTimeline([
      msg(
        '$1',
        1,
        { msgtype: 'm.text', body: 'root' },
        {
          unsigned: {
            'm.relations': {
              'm.thread': { count: 7, latest_event: { origin_server_ts: 9 } },
            },
          },
        },
      ),
    ]);
    expect(items[0]).toMatchObject({
      isThreadRoot: true,
      threadReplyCount: 7,
      threadLatestTs: 9,
    });
  });

  it('aggregates reactions, marks mine and honours live redactions', () => {
    const reaction = (id: string, sender: string, key: string) => ({
      event_id: id,
      type: 'm.reaction',
      sender,
      origin_server_ts: 10,
      content: {
        'm.relates_to': { rel_type: 'm.annotation', event_id: '$1', key },
      },
    });
    const items = toTimeline(
      [
        msg('$1', 1, { msgtype: 'm.text', body: 'hi' }),
        reaction('$a', '@ana:example', '👍'),
        reaction('$b', '@u1:example', '👍'),
        reaction('$c', '@u1:example', '🎉'),
        {
          event_id: '$red',
          type: 'm.room.redaction',
          sender: '@u1:example',
          origin_server_ts: 11,
          content: { redacts: '$c' },
        },
      ],
      { userId: '@u1:example' },
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.reactions).toEqual([
      {
        key: '👍',
        count: 2,
        senders: ['@ana:example', '@u1:example'],
        mine: '$b',
      },
    ]);
  });

  it('drops a message removed by a pre-v11 redaction', () => {
    const items = toTimeline([
      msg('$1', 1, { msgtype: 'm.text', body: 'oops' }),
      {
        event_id: '$red',
        type: 'm.room.redaction',
        sender: '@ana:example',
        origin_server_ts: 2,
        content: {},
        redacts: '$1',
      },
    ]);
    expect(items).toHaveLength(0);
  });
});

describe('threadReplyContent', () => {
  it('relates to the root with a reply fallback to the latest event', () => {
    expect(
      threadReplyContent({ msgtype: 'm.text', body: 'yo' }, '$root', '$last'),
    ).toEqual({
      msgtype: 'm.text',
      body: 'yo',
      'm.relates_to': {
        rel_type: 'm.thread',
        event_id: '$root',
        is_falling_back: true,
        'm.in_reply_to': { event_id: '$last' },
      },
    });
  });
});

describe('MatrixRestClient', () => {
  it('sends with the bearer token and a transaction id', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ event_id: '$new' }), { status: 200 }),
      );
    const client = new MatrixRestClient(session, fetchImpl);

    const result = await client.sendText('!room:example', 'hi', 'txn1');

    expect(result.event_id).toBe('$new');
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(
      'https://matrix.example/_matrix/client/v3/rooms/!room%3Aexample/send/m.room.message/txn1',
    );
    expect(init.method).toBe('PUT');
    expect(init.headers.Authorization).toBe('Bearer mx_token');
    expect(JSON.parse(init.body)).toEqual({ msgtype: 'm.text', body: 'hi' });
  });

  it('surfaces Matrix error codes', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ errcode: 'M_UNKNOWN_TOKEN', error: 'bad' }),
          { status: 401 },
        ),
      );
    const client = new MatrixRestClient(session, fetchImpl);

    const error = await client
      .messages('!room:example')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MatrixError);
    expect((error as MatrixError).isUnknownToken).toBe(true);
  });

  it('reacts with an annotation and removes it by redaction', async () => {
    const fetchImpl = vi
      .fn()
      .mockImplementation(
        async () =>
          new Response(JSON.stringify({ event_id: '$x' }), { status: 200 }),
      );
    const client = new MatrixRestClient(session, fetchImpl);

    await client.react('!r:example', '$msg', '👍', 't1');
    await client.redact('!r:example', '$reaction', 't2');

    const [reactUrl, reactInit] = fetchImpl.mock.calls[0];
    expect(reactUrl).toBe(
      'https://matrix.example/_matrix/client/v3/rooms/!r%3Aexample/send/m.reaction/t1',
    );
    expect(JSON.parse(reactInit.body)).toEqual({
      'm.relates_to': {
        rel_type: 'm.annotation',
        event_id: '$msg',
        key: '👍',
      },
    });
    const [redactUrl, redactInit] = fetchImpl.mock.calls[1];
    expect(redactUrl).toBe(
      'https://matrix.example/_matrix/client/v3/rooms/!r%3Aexample/redact/%24reaction/t2',
    );
    expect(redactInit.method).toBe('PUT');
  });

  it('long-polls /sync with the filter, token and abort signal', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ next_batch: 's2' }), { status: 200 }),
      );
    const client = new MatrixRestClient(session, fetchImpl);
    const controller = new AbortController();

    const result = await client.sync({
      since: 's1',
      filter: { room: { rooms: ['!r:example'] } },
      timeoutMs: 30000,
      signal: controller.signal,
    });

    expect(result.next_batch).toBe('s2');
    const [url, init] = fetchImpl.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/_matrix/client/v3/sync');
    expect(parsed.searchParams.get('since')).toBe('s1');
    expect(parsed.searchParams.get('timeout')).toBe('30000');
    expect(JSON.parse(parsed.searchParams.get('filter') ?? '')).toEqual({
      room: { rooms: ['!r:example'] },
    });
    expect(init.signal).toBe(controller.signal);
  });

  it('reads thread relations and treats a missing m.direct as empty', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ chunk: [], next_batch: 'n1' }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ errcode: 'M_NOT_FOUND' }), {
          status: 404,
        }),
      );
    const client = new MatrixRestClient(session, fetchImpl);

    await client.threadReplies('!r:example', '$root');
    expect(fetchImpl.mock.calls[0][0]).toBe(
      'https://matrix.example/_matrix/client/v1/rooms/!r%3Aexample/relations/%24root/m.thread?dir=b&limit=50',
    );
    await expect(client.directMap()).resolves.toEqual({});
  });

  it('builds authenticated media URLs', () => {
    const client = new MatrixRestClient(session, vi.fn());
    expect(client.mediaUrl('mxc://example/abc')).toBe(
      'https://matrix.example/_matrix/client/v1/media/download/example/abc',
    );
    expect(client.mediaUrl('not-mxc')).toBeNull();
  });
});

describe('helpers', () => {
  it('parses mxc URIs', () => {
    expect(parseMxc('mxc://srv/id')).toEqual({ server: 'srv', mediaId: 'id' });
    expect(parseMxc('https://x')).toBeNull();
  });

  it('picks the msgtype from the mime type', () => {
    expect(
      mediaMessageContent({
        mxcUrl: 'mxc://s/i',
        filename: 'a.pdf',
        mimeType: 'application/pdf',
        size: 3,
      }),
    ).toMatchObject({ msgtype: 'm.file' });
    expect(
      mediaMessageContent({
        mxcUrl: 'mxc://s/i',
        filename: 'a.jpg',
        mimeType: 'image/jpeg',
        size: 3,
        width: 2,
        height: 1,
      }),
    ).toMatchObject({ msgtype: 'm.image', info: { w: 2, h: 1 } });
  });
});
