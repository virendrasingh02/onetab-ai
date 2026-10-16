/**
 * When each member actually saw each message, as far as this client can know.
 *
 * Matrix keeps only one read receipt per member (per thread): the *latest*
 * event they have read, with the time they read it. That timestamp is exact for
 * the event the receipt sits on, but says nothing precise about the earlier
 * messages it also covers. So while the client is running it records the
 * moment a member's receipt moves past each message — the first receipt to
 * cover a message is when they saw it. Anything not recorded here falls back
 * to the receipt itself (see `toReaders`), flagged as not exact.
 *
 * Keyed by the SDK room object so a dropped room takes its entries with it.
 */
interface UserSeenState {
  /** Event id → first time this member's receipt covered it. */
  seenAt: Map<string, number>;
  /** Where this member's receipt last sat, per thread (`''` = main timeline). */
  lastReceipt: Map<string, string>;
}

/** The slice of an SDK room this module reads — kept structural so the SDK stays confined to the adapter modules. */
interface TimelineEvent {
  getId(): string | undefined;
}
interface EventTimelineLike {
  getEvents?(): TimelineEvent[];
}
export interface SeenTimesRoom {
  getLiveTimeline?(): EventTimelineLike;
  getThread?(threadId: string): { liveTimeline?: EventTimelineLike } | null | undefined;
}

const store = new WeakMap<SeenTimesRoom, Map<string, UserSeenState>>();

/** Upper bound on remembered events per member per room. */
const MAX_ENTRIES_PER_USER = 1000;
/** Upper bound on events walked back for one receipt. */
const MAX_WALK = 300;

function stateFor(room: SeenTimesRoom, userId: string): UserSeenState {
  let byUser = store.get(room);
  if (!byUser) {
    byUser = new Map();
    store.set(room, byUser);
  }
  let state = byUser.get(userId);
  if (!state) {
    state = { seenAt: new Map(), lastReceipt: new Map() };
    byUser.set(userId, state);
  }
  return state;
}

function remember(state: UserSeenState, eventId: string, ts: number): void {
  if (state.seenAt.has(eventId)) return;
  state.seenAt.set(eventId, ts);
  if (state.seenAt.size > MAX_ENTRIES_PER_USER) {
    // Maps iterate in insertion order — drop the oldest record.
    const oldest = state.seenAt.keys().next().value;
    if (oldest !== undefined) state.seenAt.delete(oldest);
  }
}

function timelineEvents(room: SeenTimesRoom, threadId: string): TimelineEvent[] {
  if (!threadId) return room.getLiveTimeline?.().getEvents?.() ?? [];
  return room.getThread?.(threadId)?.liveTimeline?.getEvents?.() ?? [];
}

/**
 * Records a member's receipt landing on `eventId` at `ts`.
 *
 * The receipt's own event is always exact. Events between the member's
 * previous receipt and this one were first covered now, so they get `ts` too —
 * but only when the previous position is known, otherwise there is no telling
 * how much of the history was read earlier.
 */
export function recordReceipt(
  room: SeenTimesRoom,
  userId: string,
  eventId: string,
  ts: number,
  threadId = '',
): void {
  const state = stateFor(room, userId);
  const previous = state.lastReceipt.get(threadId);
  state.lastReceipt.set(threadId, eventId);
  remember(state, eventId, ts);
  if (!previous || previous === eventId) return;

  const events = timelineEvents(room, threadId);
  let index = -1;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].getId() === eventId) {
      index = i;
      break;
    }
  }
  if (index < 0) return;

  for (let i = index - 1, walked = 0; i >= 0 && walked < MAX_WALK; i--, walked++) {
    const id = events[i].getId();
    if (!id || id === previous || state.seenAt.has(id)) break;
    remember(state, id, ts);
  }
}

/**
 * Notes where a member's receipt already sits, so the next receipt has a
 * known starting point. Called whenever readers are mapped; never overwrites a
 * live position.
 */
export function noteReceiptPosition(
  room: SeenTimesRoom,
  userId: string,
  eventId: string,
  ts: number,
  threadId = '',
): void {
  const state = stateFor(room, userId);
  if (state.lastReceipt.has(threadId)) return;
  state.lastReceipt.set(threadId, eventId);
  remember(state, eventId, ts);
}

/** The recorded first-seen time of `eventId` for `userId`, if this client saw it happen. */
export function recordedSeenAt(
  room: SeenTimesRoom,
  userId: string,
  eventId: string,
): number | undefined {
  return store.get(room)?.get(userId)?.seenAt.get(eventId);
}
