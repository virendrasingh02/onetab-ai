/**
 * A small Matrix client-server REST client for chat on mobile.
 *
 * The web app runs the full matrix-js-sdk with the Rust crypto WASM build,
 * which does not run on Hermes. Channel rooms are plain (unencrypted) rooms
 * unless the deployment turned on encryption for private channels, so the
 * handful of endpoints chat needs — sync, read a page, send, react, redact,
 * thread relations, upload, join, members, `m.direct` — are enough. The
 * session itself comes from the API's existing `POST /matrix/session`, exactly
 * as the browser gets it.
 *
 * Platform-free (fetch is injected) so it is unit tested in Node.
 */

export interface MatrixSession {
  homeserverUrl: string;
  matrixUserId: string;
  accessToken: string;
  deviceId: string;
}

export interface MatrixEvent {
  event_id: string;
  type: string;
  sender: string;
  origin_server_ts: number;
  content: Record<string, unknown>;
  state_key?: string;
  /** Top-level target of an `m.room.redaction` before room v11. */
  redacts?: string;
  unsigned?: {
    redacted_because?: unknown;
    transaction_id?: string;
    /** Server-side bundled aggregations (the `m.thread` summary). */
    'm.relations'?: Record<string, unknown>;
  };
}

export type TimelineKind =
  'text' | 'image' | 'file' | 'video' | 'audio' | 'notice' | 'encrypted';

/** One emoji pill under a message. */
export interface Reaction {
  key: string;
  count: number;
  senders: string[];
  /** The caller's own reaction event, so tapping again can redact it. */
  mine?: string;
}

export interface TimelineItem {
  id: string;
  sender: string;
  ts: number;
  kind: TimelineKind;
  body: string;
  /** `mxc://` URI for media messages. */
  mxcUrl?: string;
  mimeType?: string;
  size?: number;
  edited?: boolean;
  isThreadRoot?: boolean;
  /** Replies in this message's thread (bundled count or seen locally). */
  threadReplyCount?: number;
  threadLatestTs?: number;
  reactions?: Reaction[];
  replyToId?: string;
}

export interface MemberProfile {
  displayName: string;
  avatarMxc: string | null;
}

/** The sync response fields this client reads. */
export interface SyncStateEvents {
  events?: MatrixEvent[];
}

export interface JoinedRoomSync {
  timeline?: {
    events?: MatrixEvent[];
    limited?: boolean;
    prev_batch?: string;
  };
  state?: SyncStateEvents;
  summary?: {
    'm.heroes'?: string[];
    'm.joined_member_count'?: number;
    'm.invited_member_count'?: number;
  };
  unread_notifications?: {
    notification_count?: number;
    highlight_count?: number;
  };
}

export interface InvitedRoomSync {
  invite_state?: SyncStateEvents;
}

export interface SyncResponse {
  next_batch: string;
  rooms?: {
    join?: Record<string, JoinedRoomSync>;
    invite?: Record<string, InvitedRoomSync>;
    leave?: Record<string, unknown>;
  };
  account_data?: { events?: Array<{ type: string; content: unknown }> };
}

export class MatrixError extends Error {
  constructor(
    readonly status: number,
    readonly errcode: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = 'MatrixError';
  }

  /** The access token was revoked or the device deleted — mint a new session. */
  get isUnknownToken(): boolean {
    return (
      this.errcode === 'M_UNKNOWN_TOKEN' || this.errcode === 'M_MISSING_TOKEN'
    );
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const room = (roomId: string) =>
  `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}`;

export class MatrixRestClient {
  private readonly base: string;

  constructor(
    private readonly session: MatrixSession,
    private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init),
  ) {
    this.base = session.homeserverUrl.replace(/\/+$/, '');
  }

  get userId(): string {
    return this.session.matrixUserId;
  }

  get authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.session.accessToken}` };
  }

  private async call<T>(
    method: string,
    path: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    const response = await this.fetchImpl(`${this.base}${path}`, {
      method,
      signal,
      headers: {
        ...this.authHeaders,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    const json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    if (!response.ok) {
      throw new MatrixError(
        response.status,
        typeof json['errcode'] === 'string' ? json['errcode'] : undefined,
        typeof json['error'] === 'string'
          ? json['error']
          : `Matrix request failed (${response.status})`,
      );
    }
    return json as T;
  }

  /**
   * `GET /sync`. With `timeoutMs` the homeserver holds the request open until
   * something happens, which is what replaces polling.
   */
  sync(options: {
    since?: string;
    filter?: Record<string, unknown>;
    timeoutMs?: number;
    signal?: AbortSignal;
  }) {
    const params = new URLSearchParams({
      timeout: String(options.timeoutMs ?? 0),
    });
    if (options.since) params.set('since', options.since);
    if (options.filter) params.set('filter', JSON.stringify(options.filter));
    return this.call<SyncResponse>(
      'GET',
      `/_matrix/client/v3/sync?${params.toString()}`,
      undefined,
      options.signal,
    );
  }

  /** One page of the room timeline, newest first (`dir=b`). */
  messages(roomId: string, from?: string, limit = 40) {
    const params = new URLSearchParams({ dir: 'b', limit: String(limit) });
    if (from) params.set('from', from);
    return this.call<{ chunk: MatrixEvent[]; end?: string }>(
      'GET',
      `${room(roomId)}/messages?${params.toString()}`,
    );
  }

  /** One event by id (a thread root). */
  event(roomId: string, eventId: string) {
    return this.call<MatrixEvent>(
      'GET',
      `${room(roomId)}/event/${encodeURIComponent(eventId)}`,
    );
  }

  /** A page of replies in a thread, newest first. */
  threadReplies(roomId: string, rootId: string, from?: string, limit = 50) {
    const params = new URLSearchParams({ dir: 'b', limit: String(limit) });
    if (from) params.set('from', from);
    return this.call<{ chunk: MatrixEvent[]; next_batch?: string }>(
      'GET',
      `/_matrix/client/v1/rooms/${encodeURIComponent(roomId)}/relations/${encodeURIComponent(rootId)}/m.thread?${params.toString()}`,
    );
  }

  join(roomId: string) {
    return this.call<{ room_id: string }>(
      'POST',
      `/_matrix/client/v3/join/${encodeURIComponent(roomId)}`,
      {},
    );
  }

  async joinedMembers(roomId: string): Promise<Record<string, MemberProfile>> {
    const result = await this.call<{
      joined: Record<
        string,
        { display_name?: string | null; avatar_url?: string | null }
      >;
    }>('GET', `${room(roomId)}/joined_members`);
    const members: Record<string, MemberProfile> = {};
    for (const [id, profile] of Object.entries(result.joined ?? {})) {
      members[id] = {
        displayName: profile.display_name || localpartOf(id),
        avatarMxc: profile.avatar_url ?? null,
      };
    }
    return members;
  }

  /** Joined and invited member ids — used to match an existing group DM. */
  async memberIds(roomId: string): Promise<string[]> {
    const result = await this.call<{ chunk?: MatrixEvent[] }>(
      'GET',
      `${room(roomId)}/members?not_membership=leave`,
    );
    return (result.chunk ?? [])
      .filter((e) => OPEN_MEMBERSHIPS.has(String(e.content['membership'])))
      .map((e) => e.state_key ?? '')
      .filter(Boolean);
  }

  sendEvent(
    roomId: string,
    type: string,
    content: Record<string, unknown>,
    txnId: string,
  ) {
    return this.call<{ event_id: string }>(
      'PUT',
      `${room(roomId)}/send/${encodeURIComponent(type)}/${encodeURIComponent(txnId)}`,
      content,
    );
  }

  send(roomId: string, content: Record<string, unknown>, txnId: string) {
    return this.sendEvent(roomId, 'm.room.message', content, txnId);
  }

  sendText(roomId: string, body: string, txnId: string) {
    return this.send(roomId, { msgtype: 'm.text', body }, txnId);
  }

  /** An `m.annotation` reaction — the same event the web reaction bar sends. */
  react(roomId: string, eventId: string, key: string, txnId: string) {
    return this.sendEvent(
      roomId,
      'm.reaction',
      { 'm.relates_to': { rel_type: 'm.annotation', event_id: eventId, key } },
      txnId,
    );
  }

  /** Redacts an event; removing a reaction is redacting the reaction event. */
  redact(roomId: string, eventId: string, txnId: string) {
    return this.call<{ event_id: string }>(
      'PUT',
      `${room(roomId)}/redact/${encodeURIComponent(eventId)}/${encodeURIComponent(txnId)}`,
      {},
    );
  }

  /** Moves the read marker so the web sidebar's unread dot clears too. */
  markRead(roomId: string, eventId: string) {
    return this.call<Record<string, never>>(
      'POST',
      `${room(roomId)}/read_markers`,
      { 'm.fully_read': eventId, 'm.read': eventId },
    );
  }

  /**
   * A private room for a DM or group DM. Unencrypted: this client cannot
   * encrypt, and the web follows the same rule ("only encrypt what this
   * session can send into").
   */
  createRoom(input: { name?: string; invite: string[]; isDirect: boolean }) {
    return this.call<{ room_id: string }>(
      'POST',
      '/_matrix/client/v3/createRoom',
      {
        preset: 'private_chat',
        visibility: 'private',
        is_direct: input.isDirect,
        invite: input.invite,
        ...(input.name ? { name: input.name } : {}),
      },
    );
  }

  /** The `m.direct` map (Matrix user id → DM room ids); `{}` when unset. */
  async directMap(): Promise<Record<string, string[]>> {
    try {
      const map = await this.call<unknown>(
        'GET',
        `/_matrix/client/v3/user/${encodeURIComponent(this.userId)}/account_data/m.direct`,
      );
      return normalizeDirectMap(map);
    } catch (error) {
      if (error instanceof MatrixError && error.status === 404) return {};
      throw error;
    }
  }

  setDirectMap(map: Record<string, string[]>) {
    return this.call<Record<string, never>>(
      'PUT',
      `/_matrix/client/v3/user/${encodeURIComponent(this.userId)}/account_data/m.direct`,
      map,
    );
  }

  uploadUrl(filename: string): string {
    return `${this.base}/_matrix/media/v3/upload?filename=${encodeURIComponent(filename)}`;
  }

  /** Authenticated media (MSC3916): needs the bearer header to load. */
  mediaUrl(
    mxc: string | null | undefined,
    thumbnail?: { width: number; height: number },
  ): string | null {
    const parsed = parseMxc(mxc);
    if (!parsed) return null;
    const { server, mediaId } = parsed;
    if (thumbnail) {
      return `${this.base}/_matrix/client/v1/media/thumbnail/${server}/${mediaId}?width=${thumbnail.width}&height=${thumbnail.height}&method=scale`;
    }
    return `${this.base}/_matrix/client/v1/media/download/${server}/${mediaId}`;
  }
}

/** Memberships that make a room the caller's to open: joined or invited. */
export const OPEN_MEMBERSHIPS = new Set(['join', 'invite']);

export function parseMxc(
  mxc: string | null | undefined,
): { server: string; mediaId: string } | null {
  const match = /^mxc:\/\/([^/]+)\/([^/?#]+)$/.exec(mxc ?? '');
  if (!match?.[1] || !match[2]) return null;
  return { server: match[1], mediaId: match[2] };
}

export function localpartOf(userId: string): string {
  const match = /^@([^:]+)/.exec(userId);
  return match?.[1] ?? userId;
}

/** Keeps only well-formed `userId → roomId[]` entries of `m.direct`. */
export function normalizeDirectMap(raw: unknown): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  if (!raw || typeof raw !== 'object') return map;
  for (const [userId, ids] of Object.entries(raw)) {
    if (!Array.isArray(ids)) continue;
    const roomIds = ids.filter((id): id is string => typeof id === 'string');
    if (roomIds.length) map[userId] = roomIds;
  }
  return map;
}

interface Relation {
  rel_type?: string;
  event_id?: string;
  key?: string;
}

export function relationOf(event: MatrixEvent): Relation | undefined {
  const rel = event.content['m.relates_to'];
  return rel && typeof rel === 'object' ? (rel as Relation) : undefined;
}

/** The event a redaction removes, in either room-version shape. */
export function redactedIdOf(event: MatrixEvent): string | undefined {
  if (event.type !== 'm.room.redaction') return undefined;
  const fromContent = event.content['redacts'];
  return typeof fromContent === 'string' ? fromContent : event.redacts;
}

function bundledThread(
  event: MatrixEvent,
): { count: number; latestTs?: number } | undefined {
  const thread = event.unsigned?.['m.relations']?.['m.thread'];
  if (!thread || typeof thread !== 'object') return undefined;
  const { count, latest_event } = thread as {
    count?: unknown;
    latest_event?: { origin_server_ts?: unknown };
  };
  return {
    count: typeof count === 'number' ? count : 0,
    latestTs:
      typeof latest_event?.origin_server_ts === 'number'
        ? latest_event.origin_server_ts
        : undefined,
  };
}

function kindOf(msgtype: unknown): TimelineKind {
  switch (msgtype) {
    case 'm.image':
      return 'image';
    case 'm.file':
      return 'file';
    case 'm.video':
      return 'video';
    case 'm.audio':
      return 'audio';
    case 'm.notice':
      return 'notice';
    default:
      return 'text';
  }
}

/**
 * Turns timeline events (a `/messages` page, sync batches, thread relations —
 * any order, duplicates allowed) into chat rows, oldest first.
 *
 * Mirrors what the web timeline shows: redactions vanish (both the
 * `redacted_because` shape and a live `m.room.redaction`), edits replace the
 * original's text, reactions aggregate into pills, encrypted events render as
 * a placeholder rather than disappearing, and thread replies stay in their
 * thread: the main timeline flags the root with a reply count, and passing
 * `threadRootId` returns that thread instead (root first, then replies).
 */
export function toTimeline(
  events: MatrixEvent[],
  options: { threadRootId?: string; userId?: string } = {},
): TimelineItem[] {
  const { threadRootId, userId } = options;
  const unique = new Map<string, MatrixEvent>();
  for (const event of events) {
    if (!unique.has(event.event_id)) unique.set(event.event_id, event);
  }
  // Newest first, so the first edit seen for a message is the latest one.
  const ordered = [...unique.values()].sort(
    (a, b) => b.origin_server_ts - a.origin_server_ts,
  );

  const redacted = new Set<string>();
  for (const event of ordered) {
    if (event.unsigned?.redacted_because) redacted.add(event.event_id);
    const target = redactedIdOf(event);
    if (target) redacted.add(target);
  }

  const edits = new Map<string, Record<string, unknown>>();
  const threads = new Map<string, { count: number; latestTs: number }>();
  const reactions = new Map<string, Map<string, Reaction>>();

  for (const event of ordered) {
    if (redacted.has(event.event_id)) continue;
    const rel = relationOf(event);
    if (!rel?.event_id) continue;
    if (rel.rel_type === 'm.replace') {
      const replacement = event.content['m.new_content'];
      if (
        replacement &&
        typeof replacement === 'object' &&
        !edits.has(rel.event_id)
      ) {
        edits.set(rel.event_id, replacement as Record<string, unknown>);
      }
    } else if (rel.rel_type === 'm.thread') {
      const thread = threads.get(rel.event_id) ?? { count: 0, latestTs: 0 };
      thread.count += 1;
      thread.latestTs = Math.max(thread.latestTs, event.origin_server_ts);
      threads.set(rel.event_id, thread);
    } else if (
      rel.rel_type === 'm.annotation' &&
      event.type === 'm.reaction' &&
      typeof rel.key === 'string'
    ) {
      const byKey = reactions.get(rel.event_id) ?? new Map<string, Reaction>();
      const pill = byKey.get(rel.key) ?? {
        key: rel.key,
        count: 0,
        senders: [],
      };
      // One reaction per person per key, as the homeserver enforces.
      if (!pill.senders.includes(event.sender)) {
        pill.senders.push(event.sender);
        pill.count += 1;
        if (userId && event.sender === userId) pill.mine = event.event_id;
      }
      byKey.set(rel.key, pill);
      reactions.set(rel.event_id, byKey);
    }
  }

  const items: TimelineItem[] = [];
  for (const event of ordered) {
    if (redacted.has(event.event_id)) continue;
    const rel = relationOf(event);
    if (rel?.rel_type === 'm.replace') continue;
    const inThread = rel?.rel_type === 'm.thread' ? rel.event_id : undefined;
    if (threadRootId) {
      if (event.event_id !== threadRootId && inThread !== threadRootId)
        continue;
    } else if (inThread) {
      continue;
    }

    const extras: Partial<TimelineItem> = {};
    const relData = event.content['m.relates_to'] as Record<string, unknown> | undefined;
    const inReplyTo = (relData?.['m.in_reply_to'] as Record<string, unknown> | undefined)?.['event_id'];
    if (typeof inReplyTo === 'string') {
      extras.replyToId = inReplyTo;
    }
    const pills = reactions.get(event.event_id);
    if (pills) extras.reactions = [...pills.values()];
    const bundled = bundledThread(event);
    const local = threads.get(event.event_id);
    const replyCount = Math.max(bundled?.count ?? 0, local?.count ?? 0);
    if (replyCount > 0) {
      extras.isThreadRoot = true;
      extras.threadReplyCount = replyCount;
      const latestTs = Math.max(bundled?.latestTs ?? 0, local?.latestTs ?? 0);
      if (latestTs) extras.threadLatestTs = latestTs;
    }

    const base = {
      id: event.event_id,
      sender: event.sender,
      ts: event.origin_server_ts,
    };

    if (event.type === 'm.room.encrypted') {
      items.push({
        ...base,
        ...extras,
        kind: 'encrypted',
        body: 'Encrypted message — open on web or desktop to read it.',
      });
      continue;
    }
    if (event.type !== 'm.room.message') continue;

    const edit = edits.get(event.event_id);
    const content = edit ?? event.content;
    const body = typeof content['body'] === 'string' ? content['body'] : '';
    if (!body && !content['url']) continue;

    const info = (content['info'] ?? event.content['info']) as
      { mimetype?: string; size?: number } | undefined;
    const url = content['url'] ?? event.content['url'];

    items.push({
      ...base,
      kind: kindOf(content['msgtype'] ?? event.content['msgtype']),
      body,
      mxcUrl: typeof url === 'string' ? url : undefined,
      mimeType: info?.mimetype,
      size: info?.size,
      edited: Boolean(edit),
      ...extras,
    });
  }

  return items.sort((a, b) => a.ts - b.ts);
}

/**
 * Content for a reply in a thread. `m.in_reply_to` with `is_falling_back`
 * keeps the reply readable in clients that do not render threads.
 */
export function threadReplyContent(
  content: Record<string, unknown>,
  rootId: string,
  latestEventId: string,
): Record<string, unknown> {
  return {
    ...content,
    'm.relates_to': {
      rel_type: 'm.thread',
      event_id: rootId,
      is_falling_back: true,
      'm.in_reply_to': { event_id: latestEventId },
    },
  };
}

/** Content for a direct quoted reply in a conversation. */
export function replyContent(
  content: Record<string, unknown>,
  replyToEventId: string,
): Record<string, unknown> {
  return {
    ...content,
    'm.relates_to': {
      'm.in_reply_to': { event_id: replyToEventId },
    },
  };
}

/** Content for a media message after the bytes are on the media repo. */
export function mediaMessageContent(input: {
  mxcUrl: string;
  filename: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
}): Record<string, unknown> {
  const msgtype = input.mimeType.startsWith('image/')
    ? 'm.image'
    : input.mimeType.startsWith('video/')
      ? 'm.video'
      : input.mimeType.startsWith('audio/')
        ? 'm.audio'
        : 'm.file';
  return {
    msgtype,
    body: input.filename,
    url: input.mxcUrl,
    info: {
      mimetype: input.mimeType,
      size: input.size,
      ...(input.width && input.height
        ? { w: input.width, h: input.height }
        : {}),
    },
  };
}

export function newTxnId(now = Date.now()): string {
  return `m${now}.${Math.random().toString(36).slice(2, 10)}`;
}
