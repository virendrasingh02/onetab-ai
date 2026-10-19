/**
 * Direct messages and group DMs over plain Matrix REST, following the same
 * rules as the web client (`packages/matrix-client`):
 *
 * - A DM is a room listed in the caller's `m.direct` account data. A group DM
 *   is the same tag on a room with more than two people (or listed under more
 *   than one user); anything else is a channel. A space is never a DM.
 * - A pending invite counts too when the inviter flagged it `is_direct`, so a
 *   DM started on the web shows up here before it is accepted.
 * - Opening a 1:1 reuses the first open room in `m.direct` for that peer; a
 *   group reuses a DM holding exactly those people. New rooms are recorded in
 *   `m.direct` so every client groups them the same way.
 *
 * Platform-free so it is unit tested in Node.
 */
import {
  localpartOf,
  normalizeDirectMap,
  type MatrixEvent,
  type MatrixRestClient,
  type SyncResponse,
} from './matrix';

export interface DirectRoom {
  roomId: string;
  kind: 'direct' | 'group';
  membership: 'join' | 'invite';
  /** The room's explicit name (named group DMs); null to title by members. */
  name: string | null;
  /** The other people, as Matrix ids (empty for a note-to-self room). */
  peers: string[];
  /** Display names known from room state, keyed by Matrix id. */
  names: Record<string, string>;
  avatars: Record<string, string>;
  /** Joined + invited, including the caller. */
  memberCount: number;
  encrypted: boolean;
  lastMessage?: { sender: string; body: string; ts: number };
  lastActivity: number;
  unread: number;
  highlight: number;
  /** Who sent a pending invite. */
  inviter?: string;
}

/**
 * One sync for the DM list: no timeline beyond the latest message, the
 * state needed to classify and title a room, lazy-loaded members (so large
 * channels stay cheap) and the `m.direct` map.
 */
export function directListFilter(): Record<string, unknown> {
  return {
    room: {
      timeline: { limit: 1, types: ['m.room.message', 'm.room.encrypted'] },
      state: {
        lazy_load_members: true,
        types: [
          'm.room.create',
          'm.room.name',
          'm.room.member',
          'm.room.encryption',
        ],
      },
      ephemeral: { types: [] },
      account_data: { types: [] },
      include_leave: false,
    },
    presence: { types: [] },
    account_data: { types: ['m.direct'] },
  };
}

export function directMapOf(sync: SyncResponse): Record<string, string[]> {
  const event = sync.account_data?.events?.find((e) => e.type === 'm.direct');
  return normalizeDirectMap(event?.content);
}

function stateOf(events: MatrixEvent[], type: string, key = '') {
  return events.find((e) => e.type === type && (e.state_key ?? '') === key);
}

function memberInfo(events: MatrixEvent[]) {
  const names: Record<string, string> = {};
  const avatars: Record<string, string> = {};
  const open: string[] = [];
  for (const e of events) {
    if (e.type !== 'm.room.member' || !e.state_key) continue;
    const { membership, displayname, avatar_url } = e.content as {
      membership?: string;
      displayname?: unknown;
      avatar_url?: unknown;
    };
    if (typeof displayname === 'string' && displayname)
      names[e.state_key] = displayname;
    if (typeof avatar_url === 'string' && avatar_url)
      avatars[e.state_key] = avatar_url;
    if (membership === 'join' || membership === 'invite')
      open.push(e.state_key);
  }
  return { names, avatars, open };
}

function previewOf(event: MatrixEvent | undefined) {
  if (!event) return undefined;
  if (event.type === 'm.room.encrypted') {
    return {
      sender: event.sender,
      body: 'Encrypted message',
      ts: event.origin_server_ts,
    };
  }
  const body = event.content['body'];
  if (typeof body !== 'string') return undefined;
  return { sender: event.sender, body, ts: event.origin_server_ts };
}

/** The caller's DMs and group DMs from a `directListFilter()` sync. */
export function toDirectRooms(
  sync: SyncResponse,
  myUserId: string,
): DirectRoom[] {
  const direct = directMapOf(sync);
  const taggedUnder = new Map<string, string[]>();
  for (const [userId, roomIds] of Object.entries(direct)) {
    for (const roomId of roomIds) {
      taggedUnder.set(roomId, [...(taggedUnder.get(roomId) ?? []), userId]);
    }
  }

  const rooms: DirectRoom[] = [];

  for (const [roomId, joined] of Object.entries(sync.rooms?.join ?? {})) {
    const tagged = taggedUnder.get(roomId);
    if (!tagged) continue;
    const timeline = joined.timeline?.events ?? [];
    const state = [...(joined.state?.events ?? []), ...timeline];
    const create = stateOf(state, 'm.room.create');
    if (create?.content['type'] === 'm.space') continue;

    const { names, avatars, open } = memberInfo(state);
    const heroes = joined.summary?.['m.heroes'];
    const joinedCount = joined.summary?.['m.joined_member_count'];
    const invitedCount = joined.summary?.['m.invited_member_count'];
    const memberCount =
      joinedCount !== undefined || invitedCount !== undefined
        ? (joinedCount ?? 0) + (invitedCount ?? 0)
        : new Set([...open, myUserId]).size;

    let peers = (heroes ?? open).filter((id) => id !== myUserId);
    // A 1:1 whose peer has not synced yet: the m.direct key names them.
    if (!peers.length) peers = tagged.filter((id) => id !== myUserId);

    const rawName = stateOf(state, 'm.room.name')?.content['name'];
    const last = [...timeline]
      .reverse()
      .find(
        (e) => e.type === 'm.room.message' || e.type === 'm.room.encrypted',
      );
    const lastMessage = previewOf(last);

    rooms.push({
      roomId,
      kind: tagged.length > 1 || memberCount > 2 ? 'group' : 'direct',
      membership: 'join',
      name:
        typeof rawName === 'string' && rawName.trim() ? rawName.trim() : null,
      peers,
      names,
      avatars,
      memberCount,
      encrypted: Boolean(stateOf(state, 'm.room.encryption')),
      lastMessage,
      lastActivity: lastMessage?.ts ?? create?.origin_server_ts ?? 0,
      unread: joined.unread_notifications?.notification_count ?? 0,
      highlight: joined.unread_notifications?.highlight_count ?? 0,
    });
  }

  for (const [roomId, invited] of Object.entries(sync.rooms?.invite ?? {})) {
    const state = invited.invite_state?.events ?? [];
    const mine = stateOf(state, 'm.room.member', myUserId);
    if (!mine || mine.content['is_direct'] !== true) continue;
    if (stateOf(state, 'm.room.create')?.content['type'] === 'm.space')
      continue;
    const { names, avatars } = memberInfo(state);
    const rawName = stateOf(state, 'm.room.name')?.content['name'];
    const name =
      typeof rawName === 'string' && rawName.trim() ? rawName.trim() : null;
    rooms.push({
      roomId,
      kind: name ? 'group' : 'direct',
      membership: 'invite',
      name,
      peers: mine.sender === myUserId ? [] : [mine.sender],
      names,
      avatars,
      memberCount: 2,
      encrypted: Boolean(stateOf(state, 'm.room.encryption')),
      lastActivity: mine.origin_server_ts ?? 0,
      unread: 0,
      highlight: 0,
      inviter: mine.sender,
    });
  }

  // Invites first, then most recent activity.
  return rooms.sort(
    (a, b) =>
      Number(b.membership === 'invite') - Number(a.membership === 'invite') ||
      b.lastActivity - a.lastActivity,
  );
}

/** Display name for a Matrix id, falling back to its localpart. */
export function displayNameOf(
  room: Pick<DirectRoom, 'names'>,
  userId: string,
  extra: Record<string, string> = {},
): string {
  return room.names[userId] ?? extra[userId] ?? localpartOf(userId);
}

/** How the web titles a DM: its name, else the other people, else "you". */
export function directRoomTitle(
  room: DirectRoom,
  extra: Record<string, string> = {},
): string {
  if (room.name) return room.name;
  if (!room.peers.length) return 'Notes to self';
  const shown = room.peers
    .slice(0, 3)
    .map((id) => displayNameOf(room, id, extra));
  const others = Math.max(0, room.memberCount - 1 - shown.length);
  return others > 0
    ? `${shown.join(', ')} and ${others} other${others === 1 ? '' : 's'}`
    : shown.join(', ');
}

/** Peers that have no display name in room state yet. */
export function unnamedPeers(rooms: DirectRoom[]): Map<string, string[]> {
  const missing = new Map<string, string[]>();
  for (const room of rooms) {
    if (room.membership !== 'join') continue;
    const ids = room.peers.filter((id) => !room.names[id]);
    if (ids.length) missing.set(room.roomId, ids);
  }
  return missing;
}

/** Adds `roomId` under each user; returns null when nothing changed. */
export function addToDirectMap(
  map: Record<string, string[]>,
  userIds: string[],
  roomId: string,
  options: { preferred?: boolean } = {},
): Record<string, string[]> | null {
  const next = { ...map };
  let changed = false;
  for (const userId of userIds) {
    const current = next[userId] ?? [];
    if (options.preferred) {
      if (current[0] === roomId) continue;
      next[userId] = [roomId, ...current.filter((id) => id !== roomId)];
      changed = true;
    } else if (!current.includes(roomId)) {
      next[userId] = [...current, roomId];
      changed = true;
    }
  }
  return changed ? next : null;
}

export type DirectClient = Pick<
  MatrixRestClient,
  'userId' | 'directMap' | 'setDirectMap' | 'createRoom' | 'memberIds'
>;

async function record(
  client: DirectClient,
  userIds: string[],
  roomId: string,
  options: { preferred?: boolean } = {},
) {
  // Re-read so a change made on another device is not overwritten.
  const latest = await client.directMap();
  const next = addToDirectMap(latest, userIds, roomId, options);
  if (next) await client.setDirectMap(next);
}

/**
 * Finds or creates the DM with `peerMatrixIds` (Matrix ids; the caller is
 * dropped). None left → note-to-self, one → 1:1, more → group DM.
 * `known` is the current DM list, used to reuse an existing room.
 */
export async function openDirectRoom(
  client: DirectClient,
  peerMatrixIds: string[],
  known: DirectRoom[],
  name?: string,
): Promise<string> {
  const me = client.userId;
  const peers = [...new Set(peerMatrixIds)].filter((id) => id && id !== me);
  const open = new Set(known.map((r) => r.roomId));

  if (peers.length <= 1) {
    const target = peers[0] ?? me;
    const map = await client.directMap();
    const existing = (map[target] ?? []).find((id) => open.has(id));
    if (existing) return existing;
    const { room_id } = await client.createRoom({
      invite: peers,
      isDirect: true,
    });
    // First in the list, so later lookups on any client pick this room.
    await record(client, [target], room_id, { preferred: true });
    return room_id;
  }

  const wanted = new Set(peers);
  const candidates = known.filter(
    (r) =>
      r.membership === 'join' &&
      r.kind === 'group' &&
      r.memberCount === peers.length + 1,
  );
  for (const candidate of candidates) {
    const others = (await client.memberIds(candidate.roomId)).filter(
      (id) => id !== me,
    );
    if (others.length === wanted.size && others.every((id) => wanted.has(id))) {
      return candidate.roomId;
    }
  }

  const { room_id } = await client.createRoom({
    name: name?.trim() || undefined,
    invite: peers,
    isDirect: true,
  });
  await record(client, peers, room_id);
  return room_id;
}

/** Records an accepted DM invite under the inviter, as the web does. */
export async function recordAcceptedInvite(
  client: DirectClient,
  room: DirectRoom,
): Promise<void> {
  if (room.membership !== 'invite' || !room.inviter) return;
  await record(client, [room.inviter], room.roomId);
}
