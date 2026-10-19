/**
 * Live timeline for the one room on screen, kept current by a long-poll
 * `/sync` loop instead of polling `/messages`.
 *
 * The filter scopes the sync to that single room (no presence, no account
 * data, lazy-loaded members), so each long-poll returns only when something
 * happens there. The first sync doubles as the initial page: its timeline is
 * the latest messages and its `prev_batch` is where `/messages` back-paging
 * starts. A `limited` batch means the server skipped events (the app was
 * backgrounded for a while), so the loaded window is replaced rather than
 * leaving a silent gap.
 *
 * Platform-free — the screen subscribes with `useSyncExternalStore` and calls
 * `start()` / `stop()` on focus and app-state changes.
 */
import {
  MatrixError,
  type MatrixEvent,
  type MatrixRestClient,
  type SyncResponse,
} from './matrix';

export interface RoomTimelineState {
  /** Sync token to resume from; undefined until the first sync lands. */
  since?: string;
  /** Every event loaded for the room (sync batches + older pages). */
  events: MatrixEvent[];
  /** `/messages` token for older history; null at the start of the room. */
  prevBatch: string | null;
  encrypted: boolean;
  /** True once the first sync (the initial page) has been applied. */
  ready: boolean;
  /** Bumps whenever a `limited` batch replaced the loaded window. */
  resets: number;
  loadingOlder: boolean;
  /** The last failure; cleared by the next successful sync. */
  error: unknown;
  /** The loop gave up (revoked token, no access to the room). */
  fatal: boolean;
}

export const INITIAL_ROOM_TIMELINE: RoomTimelineState = {
  events: [],
  prevBatch: null,
  encrypted: false,
  ready: false,
  resets: 0,
  loadingOlder: false,
  error: null,
  fatal: false,
};

export function roomSyncFilter(
  roomId: string,
  timelineLimit = 40,
): Record<string, unknown> {
  return {
    room: {
      rooms: [roomId],
      timeline: { limit: timelineLimit },
      state: { lazy_load_members: true, types: ['m.room.encryption'] },
      ephemeral: { types: [] },
      account_data: { types: [] },
      include_leave: false,
    },
    presence: { types: [] },
    account_data: { types: [] },
  };
}

function mergeUnique(a: MatrixEvent[], b: MatrixEvent[]): MatrixEvent[] {
  const seen = new Set(a.map((e) => e.event_id));
  return [...a, ...b.filter((e) => !seen.has(e.event_id))];
}

/** Folds one sync response for `roomId` into the state. */
export function applyRoomSync(
  state: RoomTimelineState,
  response: SyncResponse,
  roomId: string,
): RoomTimelineState {
  const joined = response.rooms?.join?.[roomId];
  const next: RoomTimelineState = {
    ...state,
    since: response.next_batch,
    ready: true,
    error: null,
  };
  if (!joined) return next;

  const timeline = joined.timeline?.events ?? [];
  const encrypted =
    state.encrypted ||
    [...(joined.state?.events ?? []), ...timeline].some(
      (e) => e.type === 'm.room.encryption',
    );

  // The first sync is the initial page; a limited later one is a gap.
  if (!state.ready || joined.timeline?.limited) {
    return {
      ...next,
      encrypted,
      events: timeline,
      prevBatch: joined.timeline?.prev_batch ?? null,
      resets: state.ready ? state.resets + 1 : state.resets,
    };
  }
  return { ...next, encrypted, events: mergeUnique(state.events, timeline) };
}

/** Errors retrying cannot fix. */
export function isFatalSyncError(error: unknown): boolean {
  return (
    error instanceof MatrixError &&
    (error.isUnknownToken || error.status === 403 || error.status === 404)
  );
}

export function backoffMs(failures: number): number {
  return Math.min(30_000, 1000 * 2 ** Math.max(0, failures - 1));
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    }
    signal.addEventListener('abort', done);
  });
}

export type RoomTimelineClient = Pick<
  MatrixRestClient,
  'sync' | 'join' | 'messages'
>;

export class RoomTimeline {
  private state: RoomTimelineState = INITIAL_ROOM_TIMELINE;
  private readonly listeners = new Set<() => void>();
  private controller: AbortController | null = null;

  constructor(
    private readonly client: RoomTimelineClient,
    readonly roomId: string,
    private readonly options: {
      timeoutMs?: number;
      timelineLimit?: number;
      onFatalError?: (error: unknown) => void;
    } = {},
  ) {}

  getState = (): RoomTimelineState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  get running(): boolean {
    return this.controller !== null;
  }

  /** Starts (or resumes from the last token) the long-poll loop. */
  start(): void {
    if (this.controller) return;
    const controller = new AbortController();
    this.controller = controller;
    if (this.state.fatal)
      this.set({ ...this.state, fatal: false, error: null });
    void this.run(controller.signal);
  }

  /** Aborts the in-flight long-poll; `start()` resumes from `since`. */
  stop(): void {
    this.controller?.abort();
    this.controller = null;
  }

  /** Pages older history with `/messages` from the oldest loaded point. */
  async loadOlder(): Promise<void> {
    const { prevBatch, loadingOlder, ready } = this.state;
    if (!ready || loadingOlder || !prevBatch) return;
    const resets = this.state.resets;
    this.set({ ...this.state, loadingOlder: true });
    try {
      const page = await this.client.messages(this.roomId, prevBatch);
      // A gap reset while this was in flight makes the page stale.
      if (this.state.resets !== resets) return;
      this.set({
        ...this.state,
        events: mergeUnique(this.state.events, page.chunk),
        prevBatch: page.chunk.length ? (page.end ?? null) : null,
      });
    } catch (error) {
      this.set({ ...this.state, error });
      if (isFatalSyncError(error)) this.options.onFatalError?.(error);
    } finally {
      this.set({ ...this.state, loadingOlder: false });
    }
  }

  private set(state: RoomTimelineState) {
    this.state = state;
    for (const listener of this.listeners) listener();
  }

  private async run(signal: AbortSignal): Promise<void> {
    const filter = roomSyncFilter(this.roomId, this.options.timelineLimit);
    let failures = 0;
    let triedJoin = false;

    while (!signal.aborted) {
      try {
        const initial = !this.state.since;
        const response = await this.client.sync({
          since: this.state.since,
          filter,
          // The first sync returns at once; later ones wait for news.
          timeoutMs: initial ? 0 : (this.options.timeoutMs ?? 30_000),
          signal,
        });
        if (signal.aborted) return;

        // Not in the room yet — a public channel opened for the first time,
        // or a DM invite. Joining accepts it; the next sync carries the room.
        if (initial && !response.rooms?.join?.[this.roomId] && !triedJoin) {
          triedJoin = true;
          await this.client.join(this.roomId);
          continue;
        }

        this.set(applyRoomSync(this.state, response, this.roomId));
        failures = 0;
      } catch (error) {
        if (signal.aborted) return;
        if (isFatalSyncError(error)) {
          this.set({ ...this.state, error, fatal: true });
          if (this.controller?.signal === signal) this.controller = null;
          this.options.onFatalError?.(error);
          return;
        }
        failures += 1;
        this.set({ ...this.state, error });
        await sleep(backoffMs(failures), signal);
      }
    }
  }
}
