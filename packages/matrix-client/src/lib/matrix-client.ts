import {
  ClientEvent,
  Direction,
  MatrixEventEvent,
  NotificationCountType,
  RoomEvent,
  RoomMemberEvent,
  SyncState,
  createClient,
  type MatrixClient as SdkClient,
  type MatrixEvent,
  type Room as SdkRoom,
} from 'matrix-js-sdk';
// Crypto lives in its own entry point: `matrix-js-sdk` does not re-export it.
import { CryptoEvent } from 'matrix-js-sdk/lib/crypto-api/index.js';
import { toMatrixError, withRetry } from './errors.js';
import {
  readDirectMap,
  resolveDirectMessageRoom,
  resolveGroupDirectMessageRoom,
  resolveMediaUrl,
  toMessage,
  toPresence,
  toRoom,
  toRoomKind,
  toRoomMember,
  toThread,
} from './mappers.js';
import {
  LocalStorageSessionStore,
  type SessionStore,
} from './session-store.js';
import { VerificationManager } from './verification.js';
import {
  MatrixError,
  type ConnectionState,
  type ConnectionStatus,
  type Device,
  type EncryptionStatus,
  type EventId,
  type MatrixClientEvent,
  type MatrixEventListener,
  type MatrixSession,
  type Message,
  type NotificationCounts,
  type PresenceState,
  type PushRegistration,
  type ReadReceipt,
  type Room,
  type RoomId,
  type RoomMember,
  type Thread,
  type Timeline,
  type VerificationRequestSummary,
  type StructuredChatMessage,
} from './types.js';

export interface MatrixClientOptions {
  homeserverUrl: string;
  /** Overrides the default localStorage-backed store. */
  sessionStore?: SessionStore;
  /** Initialise the Rust crypto stack. Requires WASM support in the bundler. */
  enableEncryption?: boolean;
  /** Events fetched on the first sync per room. */
  initialSyncLimit?: number;
}

export interface LoginCredentials {
  user: string;
  password: string;
  deviceDisplayName?: string;
}

/**
 * The application's entire view of Matrix.
 *
 * Everything the SDK exposes is deliberately funnelled through this class:
 * no `MatrixEvent`, `Room` or `MatrixClient` from `matrix-js-sdk` crosses the
 * package boundary. Consumers get plain domain objects and one typed event
 * stream, which is what makes the transport swappable.
 */
export class OneTabMatrixClient {
  private sdk: SdkClient | null = null;
  private session: MatrixSession | null = null;
  private readonly listeners = new Set<MatrixEventListener>();
  private status: ConnectionStatus = { state: 'disconnected' };
  private readonly sessionStore: SessionStore;
  private readonly options: Required<Omit<MatrixClientOptions, 'sessionStore'>>;
  /** Local echoes awaiting acknowledgement, keyed by transaction id. */
  private readonly pendingEchoes = new Map<string, Message>();
  private readonly verification = new VerificationManager(
    () => this.sdk?.getCrypto(),
    () => this.sdk?.getUserId() ?? null,
    (request) => this.emit({ type: 'verification.requested', request }),
  );

  constructor(options: MatrixClientOptions) {
    this.sessionStore = options.sessionStore ?? new LocalStorageSessionStore();
    this.options = {
      homeserverUrl: options.homeserverUrl,
      enableEncryption: options.enableEncryption ?? true,
      initialSyncLimit: options.initialSyncLimit ?? 30,
    };
  }

  // --- lifecycle -----------------------------------------------------------

  /** Subscribe to the event stream. Returns an unsubscribe function. */
  on(listener: MatrixEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: MatrixClientEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        // One bad subscriber must not stop the others or kill the sync loop.
        console.error('[matrix] listener threw', error);
      }
    }
  }

  private setStatus(
    state: ConnectionState,
    extra: Partial<ConnectionStatus> = {},
  ) {
    this.status = { state, ...extra };
    this.emit({ type: 'connection', status: this.status });
  }

  getConnectionStatus(): ConnectionStatus {
    return this.status;
  }

  getSession(): MatrixSession | null {
    return this.session;
  }

  isReady(): boolean {
    return this.sdk !== null && this.status.state === 'connected';
  }

  /** Password login. Persists the session and starts syncing. */
  async login(credentials: LoginCredentials): Promise<MatrixSession> {
    this.setStatus('connecting');

    try {
      const temporary = createClient({ baseUrl: this.options.homeserverUrl });
      const response = await temporary.login('m.login.password', {
        identifier: { type: 'm.id.user', user: credentials.user },
        password: credentials.password,
        initial_device_display_name:
          credentials.deviceDisplayName ?? 'OneTab AI Web',
      });

      const session: MatrixSession = {
        userId: response.user_id,
        deviceId: response.device_id ?? '',
        accessToken: response.access_token,
        homeserverUrl: this.options.homeserverUrl,
      };

      await this.sessionStore.save(session);
      await this.start(session);
      return session;
    } catch (error) {
      const mapped = toMatrixError(error);
      this.setStatus('error', { error: mapped.message });
      throw mapped;
    }
  }

  /**
   * Takes over a session minted by our own backend.
   *
   * This is the path the application actually uses: the user authenticates
   * against our API, which provisions the Matrix identity and opens the
   * session for them. The browser never sees a Matrix password.
   *
   * The credentials arrive already bound to a device, so this only has to
   * persist them and start syncing — there is no login round trip.
   */
  async adoptSession(credentials: {
    userId: string;
    accessToken: string;
    deviceId: string;
  }): Promise<MatrixSession> {
    this.setStatus('connecting');

    try {
      const session: MatrixSession = {
        userId: credentials.userId,
        deviceId: credentials.deviceId,
        accessToken: credentials.accessToken,
        homeserverUrl: this.options.homeserverUrl,
      };

      await this.sessionStore.save(session);
      await this.start(session);
      return session;
    } catch (error) {
      const mapped = toMatrixError(error);
      this.setStatus('error', { error: mapped.message });
      throw mapped;
    }
  }

  /**
   * Signs in with a `m.login.token` minted by a homeserver that supports them.
   *
   * Kept for deployments that broker sessions that way; `adoptSession` is what
   * this application uses.
   */
  async loginWithToken(token: string): Promise<MatrixSession> {
    this.setStatus('connecting');

    try {
      const temporary = createClient({ baseUrl: this.options.homeserverUrl });
      const response = await temporary.login('m.login.token', {
        token,
        initial_device_display_name: 'OneTab AI Web',
      });

      const session: MatrixSession = {
        userId: response.user_id,
        deviceId: response.device_id ?? '',
        accessToken: response.access_token,
        homeserverUrl: this.options.homeserverUrl,
      };

      await this.sessionStore.save(session);
      await this.start(session);
      return session;
    } catch (error) {
      const mapped = toMatrixError(error);
      this.setStatus('error', { error: mapped.message });
      throw mapped;
    }
  }

  /**
   * Restores a persisted session. Returns false when there is none.
   *
   * `expectedUserId` guards the shared-browser case: a stored session for
   * somebody else is discarded rather than resumed, so signing into a second
   * account never lands in the first account's conversations.
   */
  async restore(expectedUserId?: string): Promise<boolean> {
    const session = await this.sessionStore.load();
    if (!session) return false;

    if (
      session.homeserverUrl !== this.options.homeserverUrl ||
      (expectedUserId && session.userId !== expectedUserId)
    ) {
      await this.sessionStore.clear();
      return false;
    }

    try {
      await this.start(session);
      return true;
    } catch (error) {
      const mapped = toMatrixError(error);
      // An invalid stored token is a normal expiry, not a fault: clear it and
      // let the caller route to sign-in.
      if (mapped.code === 'SESSION_EXPIRED') {
        await this.sessionStore.clear();
        this.setStatus('expired');
        return false;
      }
      throw mapped;
    }
  }

  private async start(session: MatrixSession): Promise<void> {
    this.session = session;

    const sdk = createClient({
      baseUrl: session.homeserverUrl,
      accessToken: session.accessToken,
      userId: session.userId,
      deviceId: session.deviceId,
      // Threads are a first-class surface in this app.
      timelineSupport: true,
    });

    this.sdk = sdk;

    // Crypto is per-device, so a session the homeserver issued without one
    // cannot participate however the deployment is configured.
    if (this.options.enableEncryption && session.deviceId) {
      try {
        await sdk.initRustCrypto();
      } catch (error) {
        // Encryption is degraded, not fatal: unencrypted rooms still work and
        // encrypted ones render a decryption placeholder.
        console.error('[matrix] crypto init failed', error);
      }
    }

    this.attachListeners(sdk);
    this.setStatus('syncing');

    await sdk.startClient({
      initialSyncLimit: this.options.initialSyncLimit,
      // Organise threaded replies into `Room.getThreads()` instead of letting
      // them collapse into the main timeline — the Threads page and the
      // per-channel thread panel both read from it.
      threadSupport: true,
    });
  }

  /** Stops syncing and clears the persisted session. */
  async logout(): Promise<void> {
    const sdk = this.sdk;
    this.sdk = null;
    this.session = null;
    this.verification.dispose();

    try {
      sdk?.stopClient();
      await sdk?.logout(true);
    } catch {
      // A failed server-side logout must not strand the user signed in
      // locally; the local session is cleared regardless.
    } finally {
      sdk?.removeAllListeners();
      await this.sessionStore.clear();
      this.setStatus('disconnected');
    }
  }

  /** Stops syncing but keeps the session, for page unload. */
  stop(): void {
    this.sdk?.stopClient();
    this.verification.dispose();
    this.setStatus('disconnected');
  }

  private require(): SdkClient {
    if (!this.sdk) {
      throw new MatrixError('SESSION_EXPIRED', 'Not signed in to Matrix.');
    }
    return this.sdk;
  }

  // --- sync wiring ---------------------------------------------------------

  private countsFor(room: SdkRoom): NotificationCounts {
    return {
      total: room.getUnreadNotificationCount() ?? 0,
      highlight:
        room.getUnreadNotificationCount(NotificationCountType.Highlight) ?? 0,
    };
  }

  private attachListeners(sdk: SdkClient): void {
    sdk.on(ClientEvent.Sync, (state: SyncState) => {
      switch (state) {
        case SyncState.Prepared:
        case SyncState.Syncing:
          this.setStatus('connected');
          break;
        case SyncState.Reconnecting:
        case SyncState.Catchup:
          this.setStatus('reconnecting');
          break;
        case SyncState.Error:
          this.setStatus('reconnecting', {
            error: 'Lost connection to the homeserver. Retrying…',
          });
          break;
        case SyncState.Stopped:
          this.setStatus('disconnected');
          break;
      }
    });

    sdk.on(RoomEvent.Timeline, (event, room, toStartOfTimeline) => {
      // Backfill is delivered through pagination, not the live stream.
      if (toStartOfTimeline || !room) return;
      const type = event.getType();
      if (
        type !== 'm.room.message' &&
        !type.startsWith('mie.') &&
        !type.startsWith('org.onetab.')
      ) {
        return;
      }

      const message = toMessage(sdk, event, room);
      if (message) {
        this.emit({ type: 'message.received', message });
        emitCounts(room);
      }
    });

    sdk.on(RoomEvent.LocalEchoUpdated, (event, room) => {
      const message = toMessage(sdk, event, room);
      if (!message) return;

      const txnId = event.getTxnId();
      if (txnId) {
        message.transactionId = txnId;
        this.pendingEchoes.delete(txnId);
      }
      this.emit({ type: 'message.updated', message });
    });

    sdk.on(RoomEvent.Redaction, (event, room) => {
      const redactedId = event.getAssociatedId();
      if (redactedId && room) {
        this.emit({
          type: 'message.redacted',
          roomId: room.roomId,
          eventId: redactedId,
        });
      }
    });

    // A decrypted event arrives with an empty body first; re-emit once the
    // keys land so the placeholder is replaced in place.
    sdk.on(MatrixEventEvent.Decrypted, (event: MatrixEvent) => {
      const roomId = event.getRoomId();
      const room = roomId ? sdk.getRoom(roomId) : null;
      const message = toMessage(sdk, event, room);
      if (message) this.emit({ type: 'message.updated', message });
    });

    sdk.on(RoomEvent.Receipt, (event, room) => {
      const receipts: ReadReceipt[] = [];
      const content = event.getContent() as Record<
        string,
        Record<string, Record<string, { ts?: number }>>
      >;

      for (const [eventId, byType] of Object.entries(content)) {
        for (const [userId, data] of Object.entries(byType['m.read'] ?? {})) {
          receipts.push({ userId, eventId, timestamp: data?.ts ?? Date.now() });
        }
      }

      if (receipts.length) {
        this.emit({ type: 'receipt', roomId: room.roomId, receipts });
        emitCounts(room);
      }
    });

    sdk.on(RoomMemberEvent.Typing, (_event, member) => {
      const room = sdk.getRoom(member.roomId);
      if (!room) return;

      this.emit({
        type: 'typing',
        update: {
          roomId: room.roomId,
          userIds: room
            .getMembers()
            .filter((m) => m.typing && m.userId !== sdk.getUserId())
            .map((m) => m.userId),
        },
      });
    });

    // `RoomEvent.UnreadNotifications` is emitted on Room objects, not on the
    // client, so counts are derived from the events that already reach here.
    const emitCounts = (room: SdkRoom) => {
      this.emit({
        type: 'notifications',
        roomId: room.roomId,
        counts: this.countsFor(room),
      });
    };

    sdk.on(RoomEvent.Name, (room: SdkRoom) => {
      this.emit({ type: 'room.upserted', room: toRoom(sdk, room) });
    });

    sdk.on(ClientEvent.Room, (room: SdkRoom) => {
      this.emit({ type: 'room.upserted', room: toRoom(sdk, room) });
    });

    // A join or leave changes a room's roster and, for an unnamed group DM,
    // its displayed title — surface it so headers and member lists refresh
    // without waiting for the next sync.
    sdk.on(RoomMemberEvent.Membership, (_event, member) => {
      const room = sdk.getRoom(member.roomId);
      if (room) this.emit({ type: 'room.upserted', room: toRoom(sdk, room) });
    });

    sdk.on(ClientEvent.DeleteRoom, (roomId: string) => {
      this.emit({ type: 'room.removed', roomId });
    });

    // Another of our devices — or another user — wants to verify. Handing the
    // request to the manager is what makes it visible to the UI.
    sdk.on(CryptoEvent.VerificationRequestReceived, (request) => {
      this.verification.track(request);
    });

    sdk.on(CryptoEvent.DevicesUpdated, (userIds: string[]) => {
      const myUserId = sdk.getUserId();
      // Only our own device list drives the session-management screen.
      if (!myUserId || !userIds.includes(myUserId)) return;

      void this.getDevices()
        .then((devices) => this.emit({ type: 'device.updated', devices }))
        .catch(() => undefined);
    });
  }

  // --- rooms ---------------------------------------------------------------

  getRooms(): Room[] {
    const sdk = this.require();
    return sdk
      .getRooms()
      .map((room) => toRoom(sdk, room))
      .sort((a, b) => (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0));
  }

  getRoom(roomId: RoomId): Room | null {
    const sdk = this.require();
    const room = sdk.getRoom(roomId);
    return room ? toRoom(sdk, room) : null;
  }

  getMembers(roomId: RoomId): RoomMember[] {
    const sdk = this.require();
    const room = sdk.getRoom(roomId);
    if (!room) return [];

    return room
      .getMembers()
      .filter((member) => member.membership === 'join')
      .map((member) => toRoomMember(sdk, member))
      .sort((a, b) => b.powerLevel - a.powerLevel);
  }

  /** Creates a room for one of our channels. */
  async createRoom(input: {
    name: string;
    topic?: string;
    isPrivate: boolean;
    encrypted?: boolean;
    inviteUserIds?: string[];
  }): Promise<RoomId> {
    const sdk = this.require();

    return withRetry(async () => {
      const response = await sdk.createRoom({
        name: input.name,
        topic: input.topic,
        preset: input.isPrivate
          ? ('private_chat' as never)
          : ('public_chat' as never),
        invite: input.inviteUserIds,
        initial_state: input.encrypted
          ? [
              {
                type: 'm.room.encryption',
                state_key: '',
                content: { algorithm: 'm.megolm.v1.aes-sha2' },
              },
            ]
          : [],
      });
      return response.room_id;
    });
  }

  /** Finds an existing DM with the user, or creates one. */
  async getOrCreateDirectMessage(userId: string): Promise<RoomId> {
    const sdk = this.require();

    const existing = resolveDirectMessageRoom(sdk, userId);
    if (existing) {
      // A room found by the fallback scan is not in `m.direct` yet; recording
      // it now means the next lookup — and `toRoomKind` — trust the map.
      await this.recordDirectMessage(sdk, userId, existing);
      return existing;
    }

    const roomId = await this.createRoom({
      name: '',
      isPrivate: true,
      encrypted: true,
      inviteUserIds: [userId],
    });

    await this.recordDirectMessage(sdk, userId, roomId);
    return roomId;
  }

  /**
   * Finds an existing group direct message with exactly `userIds`, or creates
   * one.
   *
   * A group DM is a private, encrypted room tagged in `m.direct` under every
   * participant — the same tag a 1:1 carries, which is what stops `toRoomKind`
   * seeing it as a channel. `name` is optional; an unnamed group is titled from
   * its members by the UI.
   */
  async getOrCreateGroupDirectMessage(
    userIds: string[],
    name?: string,
  ): Promise<RoomId> {
    const sdk = this.require();
    const peers = [...new Set(userIds)];
    if (peers.length < 2) {
      throw new MatrixError(
        'UNSUPPORTED',
        'A group direct message needs at least two other people.',
      );
    }

    // Reuse whatever already holds exactly these people — a prior group DM or
    // a private channel — rather than create a duplicate room.
    const existing = resolveGroupDirectMessageRoom(sdk, peers, {
      includeChannels: true,
    });
    if (existing) {
      // Tag it as a DM only if it is not already a channel: tagging a channel
      // would reclassify it (see `toRoomKind`).
      const room = sdk.getRoom(existing);
      if (room && toRoomKind(room, sdk) !== 'channel') {
        await this.recordDirectMessage(sdk, peers, existing);
      }
      return existing;
    }

    const roomId = await this.createRoom({
      name: name?.trim() ?? '',
      isPrivate: true,
      encrypted: true,
      inviteUserIds: peers,
    });

    await this.recordDirectMessage(sdk, peers, roomId);
    return roomId;
  }

  /** Renames a room. Used for channels and named group DMs. */
  async setRoomName(roomId: RoomId, name: string): Promise<void> {
    const sdk = this.require();
    await withRetry(() => sdk.setRoomName(roomId, name.trim()));
  }

  /**
   * Invites people to an existing group DM and tags the room in their
   * `m.direct` map, so it groups as a DM for them too.
   */
  async addToGroupDirectMessage(
    roomId: RoomId,
    userIds: string[],
  ): Promise<void> {
    const sdk = this.require();
    const peers = [...new Set(userIds)];
    for (const peer of peers) await this.inviteToRoom(roomId, peer);
    await this.recordDirectMessage(sdk, peers, roomId);
  }

  /** Removes a member from a room. The caller needs the power level to kick. */
  async removeFromRoom(roomId: RoomId, userId: string): Promise<void> {
    const sdk = this.require();
    await withRetry(() => sdk.kick(roomId, userId));
  }

  /**
   * Adds `roomId` to the `m.direct` map for one user or several, in a single
   * account-data write, so every client groups it as a DM.
   */
  private async recordDirectMessage(
    sdk: SdkClient,
    userIds: string | string[],
    roomId: RoomId,
  ): Promise<void> {
    const ids = Array.isArray(userIds) ? userIds : [userIds];
    const direct = readDirectMap(sdk);
    const next: Record<string, string[]> = { ...direct };
    let changed = false;

    for (const id of ids) {
      const forUser = next[id] ?? [];
      if (forUser.includes(roomId)) continue;
      next[id] = [...forUser, roomId];
      changed = true;
    }

    if (!changed) return;
    await sdk.setAccountData('m.direct' as never, next as never);
  }

  async joinRoom(roomIdOrAlias: string): Promise<RoomId> {
    const sdk = this.require();
    const room = await withRetry(() => sdk.joinRoom(roomIdOrAlias));
    return room.roomId;
  }

  async leaveRoom(roomId: RoomId): Promise<void> {
    const sdk = this.require();
    await withRetry(() => sdk.leave(roomId));
  }

  async inviteToRoom(roomId: RoomId, userId: string): Promise<void> {
    const sdk = this.require();
    await withRetry(() => sdk.invite(roomId, userId));
  }

  // --- timeline ------------------------------------------------------------

  /** The currently loaded timeline for a room, newest last. */
  getTimeline(roomId: RoomId): Timeline {
    const sdk = this.require();
    const room = sdk.getRoom(roomId);
    if (!room) return { messages: [], paginationToken: null, hasMore: false };

    const timeline = room.getUnfilteredTimelineSet().getLiveTimeline();

    const messages = timeline
      .getEvents()
      .filter((event) => {
        const type = event.getType();
        return (
          type === 'm.room.message' ||
          type.startsWith('mie.') ||
          type.startsWith('org.onetab.')
        );
      })
      .map((event) => toMessage(sdk, event, room))
      .filter((message): message is Message => message !== null);

    return {
      messages,
      paginationToken: timeline.getPaginationToken(Direction.Backward),
      hasMore: !!timeline.getPaginationToken(Direction.Backward),
    };
  }

  /**
   * Loads older history. Returns the newly prepended page only, so the caller
   * can splice it in without re-rendering the whole list.
   */
  async loadOlderMessages(roomId: RoomId, limit = 30): Promise<Timeline> {
    const sdk = this.require();
    const room = sdk.getRoom(roomId);
    if (!room) return { messages: [], paginationToken: null, hasMore: false };

    const timeline = room.getUnfilteredTimelineSet().getLiveTimeline();
    const before = timeline.getEvents().length;

    await withRetry(() =>
      sdk.paginateEventTimeline(timeline, {
        backwards: true,
        limit,
      }),
    );

    const events = timeline.getEvents();
    const added = events.slice(0, Math.max(0, events.length - before));

    return {
      messages: added
        .filter((event) => {
          const type = event.getType();
          return (
            type === 'm.room.message' ||
            type.startsWith('mie.') ||
            type.startsWith('org.onetab.')
          );
        })
        .map((event) => toMessage(sdk, event, room))
        .filter((message): message is Message => message !== null),
      paginationToken: timeline.getPaginationToken(Direction.Backward),
      hasMore: !!timeline.getPaginationToken(Direction.Backward),
    };
  }

  // --- messages ------------------------------------------------------------

  /**
   * Sends a structured application message (AI Agent response, App card, Approval, Form, Workflow, etc.)
   */
  async sendStructuredMessage(
    roomId: RoomId,
    structuredEvent: StructuredChatMessage,
    options: {
      threadRootId?: EventId;
      replyToId?: EventId;
      fallbackBody?: string;
    } = {},
  ): Promise<string> {
    const sdk = this.require();
    const transactionId = `m.${Date.now()}.${Math.random().toString(36).slice(2)}`;
    const fallbackBody =
      options.fallbackBody ||
      (structuredEvent.type === 'mie.ai.agent'
        ? structuredEvent.responseText ||
          structuredEvent.summary ||
          'AI Agent Response'
        : structuredEvent.type === 'mie.app.response'
          ? structuredEvent.title || 'App Response'
          : structuredEvent.type === 'mie.approval'
            ? `Approval Required: ${structuredEvent.title}`
            : structuredEvent.type === 'mie.form'
              ? `Form: ${structuredEvent.title}`
              : structuredEvent.type === 'mie.workflow'
                ? `Workflow: ${structuredEvent.title}`
                : 'Application Message');

    const content: Record<string, unknown> = {
      msgtype: structuredEvent.type,
      body: fallbackBody,
      mie_event: structuredEvent,
      [structuredEvent.type]: structuredEvent,
      'org.onetab.structured_event': structuredEvent,
      ...(options.replyToId
        ? {
            'm.relates_to': {
              'm.in_reply_to': { event_id: options.replyToId },
            },
          }
        : {}),
    };

    await withRetry(() =>
      sdk.sendMessage(
        roomId,
        options.threadRootId ?? null,
        content as never,
        transactionId,
      ),
    );

    return transactionId;
  }

  /**
   * Updates an existing structured message in place (e.g. agent execution status running -> completed, approval pending -> approved, form submission).
   */
  async updateStructuredMessage(
    roomId: RoomId,
    eventId: EventId,
    structuredEvent: StructuredChatMessage,
    options: {
      fallbackBody?: string;
    } = {},
  ): Promise<void> {
    const sdk = this.require();
    const fallbackBody =
      options.fallbackBody ||
      (structuredEvent.type === 'mie.ai.agent'
        ? structuredEvent.responseText ||
          structuredEvent.summary ||
          'AI Agent Response'
        : structuredEvent.type === 'mie.app.response'
          ? structuredEvent.title || 'App Response'
          : structuredEvent.type === 'mie.approval'
            ? `Approval [${structuredEvent.status}]: ${structuredEvent.title}`
            : 'Application Message');

    await withRetry(() =>
      sdk.sendMessage(roomId, {
        msgtype: structuredEvent.type,
        body: `* ${fallbackBody}`,
        mie_event: structuredEvent,
        [structuredEvent.type]: structuredEvent,
        'org.onetab.structured_event': structuredEvent,
        'm.new_content': {
          msgtype: structuredEvent.type,
          body: fallbackBody,
          mie_event: structuredEvent,
          [structuredEvent.type]: structuredEvent,
          'org.onetab.structured_event': structuredEvent,
        },
        'm.relates_to': { rel_type: 'm.replace', event_id: eventId },
      } as never),
    );
  }

  /**
   * Sends a text message.
   *
   * Returns immediately with a local echo so the composer can clear without
   * waiting for the round trip; the real event replaces it via
   * `message.updated` once the homeserver acknowledges.
   */
  async sendMessage(
    roomId: RoomId,
    body: string,
    options: {
      threadRootId?: EventId;
      replyToId?: EventId;
      html?: string;
    } = {},
  ): Promise<string> {
    const sdk = this.require();
    const transactionId = `m.${Date.now()}.${Math.random().toString(36).slice(2)}`;

    const content: Record<string, unknown> = {
      msgtype: 'm.text',
      body,
      ...(options.html
        ? { format: 'org.matrix.custom.html', formatted_body: options.html }
        : {}),
      ...(options.replyToId
        ? {
            'm.relates_to': {
              'm.in_reply_to': { event_id: options.replyToId },
            },
          }
        : {}),
    };

    await withRetry(() =>
      sdk.sendMessage(
        roomId,
        options.threadRootId ?? null,
        content as never,
        transactionId,
      ),
    );

    return transactionId;
  }

  async editMessage(
    roomId: RoomId,
    eventId: EventId,
    newBody: string,
  ): Promise<void> {
    const sdk = this.require();

    await withRetry(() =>
      sdk.sendMessage(roomId, {
        msgtype: 'm.text',
        // Fallback body for clients that do not understand replacements.
        body: `* ${newBody}`,
        'm.new_content': { msgtype: 'm.text', body: newBody },
        'm.relates_to': { rel_type: 'm.replace', event_id: eventId },
      } as never),
    );
  }

  async deleteMessage(
    roomId: RoomId,
    eventId: EventId,
    reason?: string,
  ): Promise<void> {
    const sdk = this.require();
    await withRetry(() =>
      sdk.redactEvent(
        roomId,
        eventId,
        undefined,
        reason ? { reason } : undefined,
      ),
    );
  }

  async react(roomId: RoomId, eventId: EventId, key: string): Promise<void> {
    const sdk = this.require();
    await withRetry(() =>
      sdk.sendEvent(
        roomId,
        'm.reaction' as never,
        {
          'm.relates_to': { rel_type: 'm.annotation', event_id: eventId, key },
        } as never,
      ),
    );
  }

  /** Removes the local user's reaction. No-op when they have not reacted. */
  async removeReaction(
    roomId: RoomId,
    eventId: EventId,
    key: string,
  ): Promise<void> {
    const sdk = this.require();
    const room = sdk.getRoom(roomId);
    const myUserId = sdk.getUserId();
    if (!room || !myUserId) return;

    const mine = room
      .getUnfilteredTimelineSet()
      .relations?.getChildEventsForEvent(eventId, 'm.annotation', 'm.reaction')
      ?.getRelations()
      .find(
        (event) =>
          event.getSender() === myUserId &&
          event.getRelation()?.key === key &&
          !event.isRedacted(),
      );

    const reactionId = mine?.getId();
    if (reactionId) await this.deleteMessage(roomId, reactionId);
  }

  // --- threads -------------------------------------------------------------

  getThreads(roomId: RoomId): Thread[] {
    const sdk = this.require();
    const room = sdk.getRoom(roomId);
    if (!room) return [];

    return room.getThreads().map((thread) => toThread(room, thread));
  }

  async getThreadMessages(roomId: RoomId, rootId: EventId): Promise<Message[]> {
    const sdk = this.require();
    const room = sdk.getRoom(roomId);
    if (!room) return [];

    const thread = room.getThread(rootId);
    if (!thread) return [];

    return thread.events
      .map((event) => toMessage(sdk, event, room))
      .filter((message): message is Message => message !== null);
  }

  // --- presence, typing, receipts -----------------------------------------

  async setTyping(roomId: RoomId, isTyping: boolean): Promise<void> {
    const sdk = this.require();
    // 20s matches the SDK's own default timeout; the server expires it for us
    // if the client disappears mid-compose.
    await sdk.sendTyping(roomId, isTyping, isTyping ? 20_000 : 0);
  }

  async markRead(roomId: RoomId, eventId: EventId): Promise<void> {
    const sdk = this.require();
    const room = sdk.getRoom(roomId);
    const event = room?.getUnfilteredTimelineSet().findEventById(eventId);
    if (event) await sdk.sendReadReceipt(event);
  }

  /**
   * Marks a thread caught up to its latest reply.
   *
   * A thread carries its own read marker, separate from the room's — the SDK
   * routes the receipt to the thread from the event's own relation, so this is
   * the same call as `markRead` pointed at a threaded event.
   */
  async markThreadRead(roomId: RoomId, threadRootId: EventId): Promise<void> {
    const sdk = this.require();
    const thread = sdk.getRoom(roomId)?.getThread(threadRootId);
    const latest = thread?.replyToEvent ?? thread?.rootEvent;
    if (latest) await sdk.sendReadReceipt(latest);
  }

  async setPresence(
    state: PresenceState,
    statusMessage?: string,
  ): Promise<void> {
    const sdk = this.require();
    await sdk.setPresence({
      presence: state === 'unavailable' ? 'unavailable' : state,
      status_msg: statusMessage,
    });
  }

  getPresence(userId: string) {
    const sdk = this.require();
    const user = sdk.getUser(userId);
    return toPresence(
      userId,
      user?.presence,
      user?.lastActiveAgo,
      user?.presenceStatusMsg,
    );
  }

  // --- media ---------------------------------------------------------------

  /**
   * Uploads a file and sends it as a message.
   *
   * The homeserver encrypts the payload transparently when the room is
   * encrypted, so no branch is needed here.
   */
  async sendFile(
    roomId: RoomId,
    file: File,
    options: {
      threadRootId?: EventId;
      onProgress?: (percent: number) => void;
      /** Voice note metadata, when recording rather than attaching. */
      voice?: { durationMs: number; waveform: number[] };
    } = {},
  ): Promise<void> {
    const sdk = this.require();

    const upload = await withRetry(() =>
      sdk.uploadContent(file, {
        name: file.name,
        type: file.type,
        progressHandler: ({ loaded, total }) =>
          options.onProgress?.(total ? Math.round((loaded / total) * 100) : 0),
      }),
    );

    const msgtype = options.voice
      ? 'm.audio'
      : file.type.startsWith('image/')
        ? 'm.image'
        : file.type.startsWith('video/')
          ? 'm.video'
          : file.type.startsWith('audio/')
            ? 'm.audio'
            : 'm.file';

    const content: Record<string, unknown> = {
      msgtype,
      body: file.name,
      url: upload.content_uri,
      info: { mimetype: file.type, size: file.size },
      ...(options.voice
        ? {
            // MSC3245 marks this as a voice note rather than an audio file.
            'org.matrix.msc3245.voice': {},
            'org.matrix.msc1767.audio': {
              duration: options.voice.durationMs,
              waveform: options.voice.waveform.map((v) =>
                Math.round(Math.min(1, Math.max(0, v)) * 1024),
              ),
            },
          }
        : {}),
    };

    await withRetry(() =>
      sdk.sendMessage(roomId, options.threadRootId ?? null, content as never),
    );
  }

  /** Resolves an `mxc://` URI for rendering. */
  resolveMedia(mxcUrl: string, width?: number, height?: number): string | null {
    return resolveMediaUrl(this.require(), mxcUrl, { width, height });
  }

  // --- devices & encryption ------------------------------------------------

  async getDevices(): Promise<Device[]> {
    const sdk = this.require();
    const crypto = sdk.getCrypto();
    const myUserId = sdk.getUserId();

    const response = await withRetry(() => sdk.getDevices());

    return Promise.all(
      response.devices.map(async (device) => {
        let trust: Device['trust'] = 'unverified';

        if (crypto && myUserId) {
          const status = await crypto.getDeviceVerificationStatus(
            myUserId,
            device.device_id,
          );
          if (status?.isVerified()) trust = 'verified';
        }

        return {
          id: device.device_id,
          displayName: device.display_name ?? undefined,
          lastSeenIp: device.last_seen_ip ?? undefined,
          lastSeenAt: device.last_seen_ts ?? undefined,
          trust,
          isCurrent: device.device_id === sdk.getDeviceId(),
        };
      }),
    );
  }

  async deleteDevice(deviceId: string): Promise<void> {
    const sdk = this.require();
    await withRetry(() => sdk.deleteDevice(deviceId));
  }

  async getEncryptionStatus(): Promise<EncryptionStatus> {
    const sdk = this.require();
    const crypto = sdk.getCrypto();

    if (!crypto) {
      return {
        available: false,
        crossSigningReady: false,
        keyBackupEnabled: false,
        ownDeviceTrust: 'unverified',
      };
    }

    const [crossSigningReady, backupVersion] = await Promise.all([
      crypto.isCrossSigningReady(),
      crypto.getActiveSessionBackupVersion(),
    ]);

    const myUserId = sdk.getUserId();
    const deviceId = sdk.getDeviceId();
    let ownDeviceTrust: Device['trust'] = 'unverified';

    if (myUserId && deviceId) {
      const status = await crypto.getDeviceVerificationStatus(
        myUserId,
        deviceId,
      );
      if (status?.isVerified()) ownDeviceTrust = 'verified';
    }

    return {
      available: true,
      crossSigningReady,
      keyBackupEnabled: !!backupVersion,
      ownDeviceTrust,
    };
  }

  /**
   * Sets up cross-signing.
   *
   * `authUploadDeviceSigningKeys` is required because publishing signing keys
   * is a User-Interactive Auth operation; the caller supplies the interaction.
   */
  async bootstrapCrossSigning(
    onUiaRequest: (
      makeRequest: (authData: Record<string, unknown> | null) => Promise<void>,
    ) => Promise<void>,
  ): Promise<void> {
    const sdk = this.require();
    const crypto = sdk.getCrypto();
    if (!crypto) {
      throw new MatrixError('ENCRYPTION', 'Encryption is not available.');
    }

    await crypto.bootstrapCrossSigning({
      // Cast at the boundary so the SDK auth-dict type does not leak outward.
      authUploadDeviceSigningKeys: onUiaRequest as never,
    });
  }

  // --- device verification -------------------------------------------------

  /**
   * Asks one of our other devices to verify this one, via emoji comparison.
   *
   * Progress arrives as `verification.requested` events rather than on the
   * returned promise, because both sides drive the flow and either can cancel.
   */
  requestDeviceVerification(
    deviceId: string,
  ): Promise<VerificationRequestSummary> {
    return this.verification.requestOwnDevice(deviceId);
  }

  /** Asks every other device we own to verify this one. */
  requestOwnUserVerification(): Promise<VerificationRequestSummary> {
    return this.verification.requestOwnUser();
  }

  /** Verifies another user over an existing DM room. */
  requestUserVerification(
    userId: string,
    roomId: RoomId,
  ): Promise<VerificationRequestSummary> {
    return this.verification.requestUser(userId, roomId);
  }

  /** Accepts an incoming verification request. */
  acceptVerification(id: string): Promise<void> {
    return this.verification.accept(id);
  }

  /** Chooses emoji comparison; the emoji arrive on the next event. */
  startVerificationSas(id: string): Promise<void> {
    return this.verification.startSas(id);
  }

  /** The emoji matched on both screens. */
  confirmVerification(id: string): Promise<void> {
    return this.verification.confirm(id);
  }

  /** The emoji did not match — cancels with `m.mismatched_sas`. */
  rejectVerificationSas(id: string): void {
    this.verification.mismatch(id);
  }

  /** Declines or aborts a verification from any phase. */
  cancelVerification(id: string): Promise<void> {
    return this.verification.cancel(id);
  }

  getVerification(id: string): VerificationRequestSummary | null {
    return this.verification.get(id);
  }

  getActiveVerifications(): VerificationRequestSummary[] {
    return this.verification.list();
  }

  async isRoomEncrypted(roomId: RoomId): Promise<boolean> {
    const crypto = this.require().getCrypto();
    if (!crypto) return false;
    return crypto.isEncryptionEnabledInRoom(roomId);
  }

  // --- notifications -------------------------------------------------------

  /** Registers this device with the homeserver's push gateway. */
  async registerPush(registration: PushRegistration): Promise<void> {
    const sdk = this.require();
    const session = this.session;
    if (!session) throw new MatrixError('SESSION_EXPIRED', 'Not signed in.');

    await withRetry(() =>
      sdk.setPusher({
        kind: 'http',
        app_id: registration.appId,
        pushkey: registration.pushKey,
        app_display_name: 'OneTab AI',
        device_display_name: registration.deviceDisplayName,
        lang: 'en',
        // `format: event_id_only` keeps message content off the push service.
        data: { url: registration.gatewayUrl, format: 'event_id_only' },
        append: false,
      }),
    );
  }

  async unregisterPush(pushKey: string, appId: string): Promise<void> {
    const sdk = this.require();
    await withRetry(() =>
      sdk.setPusher({
        kind: null,
        app_id: appId,
        pushkey: pushKey,
        app_display_name: 'OneTab AI',
        device_display_name: '',
        lang: 'en',
        data: {},
      } as never),
    );
  }

  getNotificationCounts(roomId: RoomId): NotificationCounts {
    const room = this.require().getRoom(roomId);
    return {
      total: room?.getUnreadNotificationCount() ?? 0,
      highlight:
        room?.getUnreadNotificationCount(NotificationCountType.Highlight) ?? 0,
    };
  }
}

/** Factory, so consumers never import the class or the SDK directly. */
export function createMatrixClient(
  options: MatrixClientOptions,
): OneTabMatrixClient {
  return new OneTabMatrixClient(options);
}
