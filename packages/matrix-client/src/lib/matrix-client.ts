import {
  ClientEvent,
  Direction,
  HttpApiEvent,
  MatrixEventEvent,
  NotificationCountType,
  ReceiptType,
  RoomEvent,
  RoomMemberEvent,
  RoomStateEvent,
  SyncState,
  ThreadEvent,
  ConditionKind,
  PushRuleKind,
  createClient,
  type MatrixClient as SdkClient,
  type MatrixEvent,
  type Room as SdkRoom,
  type Thread as SdkThread,
  type MatrixCall,
} from 'matrix-js-sdk';
// Crypto lives in its own entry point: `matrix-js-sdk` does not re-export it.
import { CryptoEvent } from 'matrix-js-sdk/lib/crypto-api/index.js';
import { CallManager } from './calls.js';
import { toMatrixError, withRetry } from './errors.js';
import {
  collectUnreadMentions,
  ALSO_SEND_TO_CHANNEL_KEY,
  MENTIONS_KEY,
  ATTACHMENT_BATCH_KEY,
  FORWARDED_CONTENT_KEY,
  forwardFallbackBody,
  type ForwardedContent,
  MARKED_UNREAD_EVENT,
  MARKED_UNREAD_FROM_KEY,
  PINNED_EVENTS_EVENT,
  readDirectMap,
  readMutedThreadRootIds,
  readPinnedEventIds,
  readSavedMessages,
  SAVED_MESSAGES_EVENT,
  threadMuteRuleId,
  resolveDirectMessageRoom,
  resolveGroupDirectMessageRoom,
  resolveMediaUrl,
  pickForwardableContent,
  readForwardedContent,
  toForwarded,
  toMessage,
  toPresence,
  toReaders,
  toRoom,
  toRoomKind,
  toRoomMember,
  THREAD_NOTIFICATIONS_EVENT,
  toThread,
} from './mappers.js';
import { recordReceipt } from './seen-times.js';
import { KeyBackupManager } from './services/crypto/key-backup.js';
import { MatrixSearchService } from './services/search/search-service.js';
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
  type KeyBackupRestoreResult,
  type KeyBackupSetupResult,
  type KeyBackupStatus,
  type MatrixClientEvent,
  type MatrixEventListener,
  type MatrixSession,
  type Message,
  type MessageReader,
  type MessageSearchResult,
  type NotificationCounts,
  type UnreadMention,
  type PresenceState,
  type PushRegistration,
  type ReadReceipt,
  type Room,
  type RoomId,
  type RoomKind,
  type RoomMember,
  type SavedMessage,
  type Thread,
  type Timeline,
  type VerificationRequestSummary,
  type StructuredChatMessage,
  formatSystemEventFallbackText,
} from './types.js';

/** Upper bound on saved messages kept in account data. */
const MAX_SAVED_MESSAGES = 500;

/** Cap on 50-reply pages fetched when a thread is opened (2,500 replies). */
const MAX_THREAD_PAGES = 50;

interface ImageSize {
  w: number;
  h: number;
}

/**
 * An image's pixel size, sent as `info.w`/`info.h` so every reader can lay the
 * image out at its real aspect ratio before it loads. Undefined for
 * non-images, or where the browser cannot decode it — size is only a hint.
 */
async function readImageSize(file: File): Promise<ImageSize | undefined> {
  if (!file.type.startsWith('image/') || typeof createImageBitmap !== 'function') {
    return undefined;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const size = { w: bitmap.width, h: bitmap.height };
    bitmap.close();
    return size.w > 0 && size.h > 0 ? size : undefined;
  } catch {
    return undefined;
  }
}

/** The `m.room.message` content for an uploaded file (or a voice note). */
function fileMessageContent(
  file: File,
  contentUri: string,
  voice?: { durationMs: number; waveform: number[] },
  size?: ImageSize,
): Record<string, unknown> {
  const msgtype = voice
    ? 'm.audio'
    : file.type.startsWith('image/')
      ? 'm.image'
      : file.type.startsWith('video/')
        ? 'm.video'
        : file.type.startsWith('audio/')
          ? 'm.audio'
          : 'm.file';

  return {
    msgtype,
    body: file.name,
    url: contentUri,
    info: { mimetype: file.type, size: file.size, ...(size ?? {}) },
    ...(voice
      ? {
          // MSC3245 marks this as a voice note rather than an audio file.
          'org.matrix.msc3245.voice': {},
          'org.matrix.msc1767.audio': {
            duration: voice.durationMs,
            waveform: voice.waveform.map((v) =>
              Math.round(Math.min(1, Math.max(0, v)) * 1024),
            ),
          },
        }
      : {}),
  };
}

export interface MatrixClientOptions {
  homeserverUrl: string;
  /** Overrides the default localStorage-backed store. */
  sessionStore?: SessionStore;
  /** Initialise the Rust crypto stack. Requires WASM support in the bundler. */
  enableEncryption?: boolean;
  /** Events fetched on the first sync per room. */
  initialSyncLimit?: number;
  /** Clock for optimistic local echoes; pass a server-aligned one so they match what the server will stamp. */
  now?: () => number;
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
  /** Reaction event id → the message it reacts to (see the redaction handler). */
  private readonly reactionTargets = new Map<string, string>();
  /** Rooms whose automatic read receipts are held after "Mark unread". */
  private readonly readHolds = new Set<RoomId>();
  private readonly verification = new VerificationManager(
    () => this.sdk?.getCrypto(),
    () => this.sdk?.getUserId() ?? null,
    (request) => this.emit({ type: 'verification.requested', request }),
  );
  private readonly calls = new CallManager(this);
  private readonly keyBackup = new KeyBackupManager(
    () => this.sdk?.getCrypto(),
  );
  private readonly searchService = new MatrixSearchService(() => this.sdk);

  constructor(options: MatrixClientOptions) {
    this.sessionStore = options.sessionStore ?? new LocalStorageSessionStore();
    this.options = {
      homeserverUrl: options.homeserverUrl,
      enableEncryption: options.enableEncryption ?? true,
      initialSyncLimit: options.initialSyncLimit ?? 30,
      now: options.now ?? Date.now,
    };
    this.calls.on((call) => this.emit({ type: 'call.updated', call }));
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

  /**
   * The bearer token this client's own sync connection is using, or `null`
   * when not connected.
   *
   * Every `mxc://` URL this client resolves to HTTP (`resolveMediaUrl` in
   * `mappers.ts`) points at Matrix's *authenticated* media repo — the browser
   * cannot attach an `Authorization` header to a plain `<img>`/`<video>` tag,
   * so callers that need to render one (see `@org/hooks`'s
   * `useAuthenticatedMediaSrc`) fetch it themselves with this token. This
   * exposes nothing the client did not already hold for its own `/sync`
   * calls.
   */
  getAccessToken(): string | null {
    return this.sdk?.getAccessToken() ?? null;
  }

  /** Internal SDK reference for package-private managers (Calls, Crypto, Search). */
  getSdk(): SdkClient | null {
    return this.sdk;
  }

  /** The VoIP and WebRTC call manager for 1:1 voice/video calls. */
  getCallManager(): CallManager {
    return this.calls;
  }

  /** Gets current key backup and recovery status. */
  async getKeyBackupStatus(): Promise<KeyBackupStatus> {
    return this.keyBackup.getStatus();
  }

  /** Sets up 4S secret storage and server-side key backup. */
  async setupKeyBackup(passphrase?: string): Promise<KeyBackupSetupResult> {
    return this.keyBackup.setupKeyBackup(passphrase);
  }

  /** Restores room encryption keys using a recovery key or passphrase. */
  async restoreKeyBackup(keyOrPassphrase: string): Promise<KeyBackupRestoreResult> {
    return this.keyBackup.restoreKeyBackup(keyOrPassphrase);
  }

  /** Searches message content in rooms and loaded timelines. */
  async searchMessages(
    query: string,
    roomId?: RoomId,
    limit = 25,
  ): Promise<MessageSearchResult[]> {
    return this.searchService.searchMessages(query, roomId, limit);
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
          credentials.deviceDisplayName ?? 'Onetab AI Web',
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
        initial_device_display_name: 'Onetab AI Web',
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
    this.calls.hangUp();

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
    this.calls.hangUp();
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
    /*
     * The homeserver refused our token — device deleted, token revoked, user
     * deactivated. The SDK stops syncing for good on its own and then reports
     * a plain sync *error*, which below would read as a blip it is retrying:
     * a timeline stuck on "Reconnecting…" forever. The stored session can
     * never be resumed either, so drop it and say `expired`, which the owner
     * answers by minting a fresh session.
     */
    sdk.on(HttpApiEvent.SessionLoggedOut, () => {
      if (this.sdk !== sdk) return;
      sdk.stopClient();
      void this.sessionStore.clear();
      this.setStatus('expired');
    });

    sdk.on(ClientEvent.Sync, (state: SyncState) => {
      // Sync states from a replaced client, or trailing the logout above,
      // describe nothing the caller can act on.
      if (this.sdk !== sdk || this.status.state === 'expired') return;
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
      const type = event.getType();
      // Remember what every reaction we see points at, backfill included: by
      // the time `RoomEvent.Redaction` fires the SDK has stripped the
      // reaction's content, relation and all (see the handler below).
      if (type === 'm.reaction') {
        const reactionId = event.getId();
        const targetId = event.getRelation()?.event_id;
        if (reactionId && targetId) this.reactionTargets.set(reactionId, targetId);
      }

      // Backfill is delivered through pagination, not the live stream.
      if (toStartOfTimeline || !room) return;

      // When a reaction arrives, find the target message and emit an update for it
      if (type === 'm.reaction') {
        const relation = event.getRelation();
        const targetId = relation?.event_id;
        if (targetId) {
          const targetEvent = room.findEventById(targetId);
          if (targetEvent) {
            const message = toMessage(sdk, targetEvent, room);
            if (message) this.emit({ type: 'message.updated', message });
          }
        }
        return;
      }

      // An edit (`m.replace`) is not a timeline entry of its own — the SDK folds
      // it into the original event. Without re-emitting that original, anything
      // rewritten in place (an AI agent going queued → running → completed, a
      // user's edited message) stays stale until the room is reloaded.
      const edit = event.getRelation();
      if (edit?.rel_type === 'm.replace' && edit.event_id) {
        const targetId = edit.event_id;
        const emitTarget = () => {
          const original = room.findEventById(targetId);
          const message = original ? toMessage(sdk, original, room) : null;
          if (message) this.emit({ type: 'message.updated', message });
        };
        emitTarget();
        // The SDK may apply the replacement just after this event is emitted.
        setTimeout(emitTarget, 0);
        return;
      }

      if (
        type !== 'm.room.message' &&
        !type.startsWith('mie.') &&
        !type.startsWith('org.onetab.')
      ) {
        return;
      }

      const message = toMessage(sdk, event, room);
      if (message) {
        // If this event corresponds to a pending echo that we already sent, reconcile it instead of appending duplicate
        const txnId = event.getTxnId();
        if (txnId && this.pendingEchoes.has(txnId)) {
          const pending = this.pendingEchoes.get(txnId);
          const oldId = pending?.id;
          this.pendingEchoes.delete(txnId);
          this.emit({ type: 'message.updated', message, oldId });
          emitCounts(room);
          return;
        }

        this.emit({ type: 'message.received', message });
        emitCounts(room);
      }
    });

    sdk.on(RoomEvent.LocalEchoUpdated, (event, room) => {
      const message = toMessage(sdk, event, room);
      if (!message) return;

      const txnId = event.getTxnId();
      let oldId: string | undefined;
      if (txnId) {
        message.transactionId = txnId;
        const pending = this.pendingEchoes.get(txnId);
        if (pending) {
          oldId = pending.id;
          if (message.id !== pending.id && !message.sendState) {
            this.pendingEchoes.delete(txnId);
          }
        }
      }
      this.emit({ type: 'message.updated', message, oldId });
    });

    sdk.on(RoomEvent.Redaction, (event, room) => {
      const redactedId = event.getAssociatedId();
      if (redactedId && room) {
        this.emit({
          type: 'message.redacted',
          roomId: room.roomId,
          eventId: redactedId,
        });

        // If the redacted event was a reaction, re-emit an update for the
        // target message. The redaction has already been applied, so the
        // reaction's own relation is usually gone — fall back to the record.
        const redactedEvent = room.findEventById(redactedId);
        const parentId =
          redactedEvent?.getRelation()?.event_id ??
          this.reactionTargets.get(redactedId);
        this.reactionTargets.delete(redactedId);
        if (parentId) {
          const parentEvent = room.findEventById(parentId);
          if (parentEvent) {
            const message = toMessage(sdk, parentEvent, room);
            if (message) this.emit({ type: 'message.updated', message });
          }
        }
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

    // "Mark unread" and per-thread mutes live in room account data; a change
    // (from this device or another) must refresh the sidebar and open views.
    sdk.on(RoomEvent.AccountData, (_event, room) => {
      this.emit({ type: 'room.upserted', room: toRoom(sdk, room) });
    });

    // Pins are room state, and who may pin follows the power levels: either
    // changing (from anyone, on any device) refreshes the pinned bar.
    sdk.on(RoomStateEvent.Events, (event) => {
      const type = event.getType();
      if (type !== PINNED_EVENTS_EVENT && type !== 'm.room.power_levels') return;
      const room = sdk.getRoom(event.getRoomId() ?? '');
      if (room) this.emit({ type: 'room.upserted', room: toRoom(sdk, room) });
    });

    // Saved-for-later lives in global account data, so a save on another
    // device (or tab) shows up here without a reload.
    // Push rules are global account data too — a mute made on another device
    // or workspace arrives here.
    sdk.on(ClientEvent.AccountData, (event) => {
      // A new DM is created first and tagged in m.direct afterwards, so its
      // room reads as a channel until this lands; re-announce every room whose
      // kind may have changed, then the map itself.
      if (event.getType() === 'm.direct') {
        for (const room of sdk.getRooms()) {
          this.emit({ type: 'room.upserted', room: toRoom(sdk, room) });
        }
        this.emit({ type: 'direct.updated' });
        return;
      }
      if (event.getType() === 'm.push_rules') {
        this.settlePendingMutes(sdk);
        this.emit({ type: 'pushrules.updated' });
        return;
      }
      if (event.getType() !== SAVED_MESSAGES_EVENT) return;
      this.emit({ type: 'saved.updated', saved: readSavedMessages(sdk) });
    });

    sdk.on(RoomEvent.Receipt, (event, room) => {
      const receipts: ReadReceipt[] = [];
      const content = event.getContent() as Record<
        string,
        Record<string, Record<string, { ts?: number; thread_id?: string }>>
      >;

      for (const [eventId, byType] of Object.entries(content)) {
        for (const [userId, data] of Object.entries(byType['m.read'] ?? {})) {
          const timestamp = data?.ts ?? Date.now();
          receipts.push({ userId, eventId, timestamp });
          // Remember when this receipt first covered each message, so "Seen"
          // shows the real time rather than the reader's latest receipt.
          const threadId =
            data?.thread_id && data.thread_id !== 'main' ? data.thread_id : '';
          recordReceipt(room, userId, eventId, timestamp, threadId);
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

    /*
     * With `threadSupport` the SDK keeps thread replies in per-thread
     * timelines, and loads each thread's replies on its own after sync (or
     * after older history is paged in). Those loads arrive as backfill, which
     * the timeline listener above skips, and `Thread.*` events are emitted on
     * the room only — the client does not re-emit them. Without this a reply
     * sent before the last reload never reached the thread panel, the Threads
     * page or the "N replies" count.
     */
    const watchedRooms = new WeakSet<SdkRoom>();
    const watchThreads = (room: SdkRoom) => {
      if (watchedRooms.has(room)) return;
      watchedRooms.add(room);
      const onThread = (thread: SdkThread) => {
        if (this.sdk !== sdk) return;
        this.emit({ type: 'thread.updated', thread: toThread(room, thread) });
      };
      room.on(ThreadEvent.New, onThread);
      room.on(ThreadEvent.Update, onThread);
    };
    for (const room of sdk.getRooms()) watchThreads(room);

    sdk.on(ClientEvent.Room, (room: SdkRoom) => {
      watchThreads(room);
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

    (
      sdk as unknown as {
        on(event: string, listener: (call: MatrixCall) => void): void;
      }
    ).on('Call.incoming', (incomingCall: MatrixCall) => {
      this.calls.handleIncomingCall(incomingCall);
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

  /**
   * Finds an existing DM with the user, or creates one.
   *
   * `userId` may be the caller's own id — a note-to-self room. That room has a
   * single member (you), so it is created with no invite: the homeserver
   * rejects inviting yourself to a room you just made, and you are joined to it
   * already. It is still tagged in `m.direct` so it groups as a DM everywhere.
   *
   * A new room is encrypted only when this session can encrypt. With crypto
   * off (`MATRIX_ENCRYPTION=false`, where sessions come from the admin API and
   * have no device) or failed to start, an encrypted room refuses every send
   * — "your client does not support encryption". Your own notes have nobody
   * else in them, so an encrypted notes room you can no longer write to is
   * replaced rather than reused; a 1:1 with someone else is never forked.
   */
  async getOrCreateDirectMessage(userId: string): Promise<RoomId> {
    const sdk = this.require();
    const isSelf = userId === sdk.getUserId();
    const canEncrypt = Boolean(sdk.getCrypto());

    const existing = resolveDirectMessageRoom(sdk, userId, {
      skipEncrypted: isSelf && !canEncrypt,
    });
    if (existing) {
      // A room found by the fallback scan is not in `m.direct` yet; recording
      // it now means the next lookup — and `toRoomKind` — trust the map.
      await this.recordDirectMessage(sdk, userId, existing);
      return existing;
    }

    const roomId = await this.createRoom({
      name: '',
      isPrivate: true,
      encrypted: canEncrypt,
      inviteUserIds: isSelf ? [] : [userId],
    });

    // First in the list, so a replaced notes room never wins a later lookup.
    await this.recordDirectMessage(sdk, userId, roomId, { preferred: true });
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
      // Same rule as a 1:1: only encrypt what this session can send into.
      encrypted: Boolean(sdk.getCrypto()),
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

  /** Sets or updates a room avatar image. */
  async setRoomAvatar(roomId: RoomId, file: File): Promise<string> {
    const sdk = this.require();
    const upload = await withRetry(() =>
      sdk.uploadContent(file, {
        name: file.name,
        type: file.type,
      }),
    );
    await withRetry(() =>
      sdk.sendStateEvent(roomId, 'm.room.avatar' as any, { url: upload.content_uri }, ''),
    );
    return upload.content_uri;
  }

  /** Clears a room avatar. */
  async clearRoomAvatar(roomId: RoomId): Promise<void> {
    const sdk = this.require();
    await withRetry(() =>
      sdk.sendStateEvent(roomId, 'm.room.avatar' as any, {}, ''),
    );
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
    options: { preferred?: boolean } = {},
  ): Promise<void> {
    const ids = Array.isArray(userIds) ? userIds : [userIds];
    const direct = readDirectMap(sdk);
    const next: Record<string, string[]> = { ...direct };
    let changed = false;

    for (const id of ids) {
      const forUser = next[id] ?? [];
      if (options.preferred) {
        // Lookups take the first open room, so the preferred one leads.
        if (forUser[0] === roomId) continue;
        next[id] = [roomId, ...forUser.filter((existing) => existing !== roomId)];
        changed = true;
        continue;
      }
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
    const rawEvents = timeline.getEvents();

    const messages = rawEvents
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

    /*
     * Thread replies live in their threads' timelines, not the room's (see
     * `threadSupport` in `start`), yet every surface derives threads from this
     * list: the panel, "N replies", the Threads tab. Appended after the main
     * timeline, oldest first — they never render in it (a reply is filtered
     * out by its `threadRootId`), so where they sit only matters to grouping.
     */
    const seen = new Set(messages.map((message) => message.id));
    const replies = room
      .getThreads()
      .flatMap((thread) => this.loadedThreadReplies(sdk, room, thread.id))
      .filter((reply) => !seen.has(reply.id));
    replies.sort((a, b) => a.timestamp - b.timestamp);
    messages.push(...replies);

    // Append pending local echoes for this room that aren't already present
    for (const pending of this.pendingEchoes.values()) {
      if (
        pending.roomId === roomId &&
        !messages.some(
          (m) =>
            m.id === pending.id ||
            (pending.transactionId && m.transactionId === pending.transactionId),
        )
      ) {
        messages.push(pending);
      }
    }

    /*
     * The homeserver hands back a backward `prev_batch` token on almost every
     * synced timeline, including a room's very first page — it is a stream
     * position, not a promise that paginating it yields more events. Trusting
     * its mere presence made a brand-new room's welcome block flicker away
     * the instant its first real message arrived (see `ChannelWelcome`):
     * `messages.length` went from 0 to 1, which switches the caller from an
     * unconditional "empty conversation" render to one gated on `hasMore`, and
     * the stale token made that gate say "more history" when there was none.
     * If this page holds fewer raw events than a full initial sync fetches,
     * the sync was never truncated — there is nothing left for the token to
     * point at, whatever it claims.
     */
    const paginationToken = timeline.getPaginationToken(Direction.Backward);
    const hasMore =
      rawEvents.length >= this.options.initialSyncLimit && !!paginationToken;

    return { messages, paginationToken, hasMore };
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
                : structuredEvent.type === 'mie.system_event'
                  ? formatSystemEventFallbackText(structuredEvent)
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
      /** With `threadRootId`: also show this reply in the channel timeline. */
      alsoSendToChannel?: boolean;
      /** People @mentioned; `label` is the text typed after the `@`. */
      mentions?: { userId: string; label: string }[];
    } = {},
  ): Promise<string> {
    const { alsoSendToChannel, mentions, ...rest } = options;
    const mentionContent = mentions?.length
      ? {
          // `m.mentions` is for Matrix ids only; platform ids ride in ours.
          'm.mentions': {
            user_ids: [
              ...new Set(
                mentions.map((m) => m.userId).filter((id) => id.startsWith('@')),
              ),
            ],
          },
          [MENTIONS_KEY]: mentions.map((m) => ({
            user_id: m.userId,
            label: m.label,
          })),
        }
      : undefined;
    const mentionEcho = mentions?.length ? { mentions } : undefined;
    if (!alsoSendToChannel || !options.threadRootId) {
      return this.sendTextEvent(roomId, body, {
        ...rest,
        extraContent: mentionContent,
        echo: mentionEcho,
      });
    }
    return this.sendTextEvent(roomId, body, {
      ...rest,
      extraContent: { ...mentionContent, [ALSO_SEND_TO_CHANNEL_KEY]: true },
      echo: { ...mentionEcho, alsoSentToChannel: true },
    });
  }

  /**
   * Forwards `message` into `targetRoomId`, optionally with a note of the
   * sender's own.
   *
   * The original is copied into the new event (see `ForwardedContent`) rather
   * than linked, because the people in the destination usually cannot read the
   * source room. Forwarding a forward with no note of its own passes the
   * original along, so attribution stays with whoever first wrote it.
   *
   * Resolves to the send's transaction id, like `sendMessage`.
   */
  async forwardMessage(
    targetRoomId: RoomId,
    message: Message,
    options: {
      /** The forwarder's note, as markdown. */
      comment?: string;
      /** The source channel's display name; unset for DMs. */
      roomName?: string;
      roomKind?: RoomKind;
      /** Workspace-relative path that reopens the original. */
      link?: string;
    } = {},
  ): Promise<string> {
    const sdk = this.require();
    const comment = options.comment?.trim() ?? '';
    const sourceRoom = sdk.getRoom(message.roomId);
    const sourceEvent = sourceRoom?.findEventById(message.id);
    const sourceContent = (sourceEvent?.getContent() ?? null) as Record<
      string,
      unknown
    > | null;

    // A forward of a bare forward: pass the original along untouched.
    const inner = readForwardedContent(sourceContent);
    let payload: ForwardedContent;
    if (inner && !inner.comment?.trim()) {
      payload = { ...inner, comment };
    } else {
      const member = sourceRoom?.getMember(message.senderId);
      const content = sourceContent
        ? pickForwardableContent(sourceContent)
        : { msgtype: 'm.text', body: message.body };
      // The note on a forward we re-forward is what's being passed on.
      if (inner) {
        content['msgtype'] = 'm.text';
        content['body'] = inner.comment ?? '';
        delete content['format'];
        delete content['formatted_body'];
      }
      payload = {
        event_id: message.id,
        room_id: message.roomId,
        room_kind:
          options.roomKind ??
          (sourceRoom ? toRoomKind(sourceRoom, sdk) : undefined),
        room_name: options.roomName,
        sender: message.senderId,
        sender_name: member?.name ?? message.senderName,
        sender_avatar_url: member?.getMxcAvatarUrl() ?? undefined,
        origin_server_ts: message.timestamp,
        thread_root_id: message.threadRootId,
        link: options.link,
        content,
        comment,
      };
    }

    const originalBody =
      typeof payload.content['body'] === 'string'
        ? (payload.content['body'] as string)
        : '';
    const body = forwardFallbackBody(
      comment,
      payload.sender_name ?? payload.sender,
      originalBody,
    );

    return this.sendTextEvent(targetRoomId, body, {
      extraContent: { [FORWARDED_CONTENT_KEY]: payload },
      echo: { body: comment, forwarded: toForwarded(sdk, payload) },
    });
  }

  /**
   * The text send behind `sendMessage` and `forwardMessage`: a local echo now,
   * replaced by the real event once the homeserver acknowledges it.
   */
  private async sendTextEvent(
    roomId: RoomId,
    body: string,
    options: {
      threadRootId?: EventId;
      replyToId?: EventId;
      html?: string;
      /** Extra keys merged into the event content. */
      extraContent?: Record<string, unknown>;
      /** Overrides for the local echo — what the timeline should show. */
      echo?: Partial<Message>;
    } = {},
  ): Promise<string> {
    const sdk = this.require();
    const transactionId = `m.${Date.now()}.${Math.random().toString(36).slice(2)}`;
    const myUserId = sdk.getUserId() ?? '';
    const room = sdk.getRoom(roomId);
    const member = myUserId ? room?.getMember(myUserId) : null;

    const optimisticMessage: Message = {
      id: transactionId,
      roomId,
      senderId: myUserId,
      senderName: member?.name ?? myUserId,
      senderAvatarUrl:
        resolveMediaUrl(sdk, member?.getMxcAvatarUrl() ?? undefined, {
          width: 64,
          height: 64,
        }) ?? undefined,
      kind: 'text',
      body,
      formattedBody: options.html,
      timestamp: this.options.now(),
      reactions: [],
      isEdited: false,
      isRedacted: false,
      threadRootId: options.threadRootId,
      replyToId: options.replyToId,
      sendState: 'sending',
      transactionId,
      isEncrypted: room ? room.hasEncryptionStateEvent() : false,
      ...options.echo,
    };

    this.pendingEchoes.set(transactionId, optimisticMessage);
    this.emit({ type: 'message.received', message: optimisticMessage });

    const content: Record<string, unknown> = {
      ...options.extraContent,
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

    withRetry(() =>
      sdk.sendMessage(
        roomId,
        options.threadRootId ?? null,
        content as never,
        transactionId,
      ),
    )
      .then((res) => {
        const realEventId = res?.event_id;
        const pending = this.pendingEchoes.get(transactionId);
        if (pending && realEventId) {
          const updated: Message = {
            ...pending,
            id: realEventId,
            sendState: 'sent',
          };
          this.pendingEchoes.delete(transactionId);
          this.emit({
            type: 'message.updated',
            message: updated,
            oldId: transactionId,
          });
        }
      })
      .catch((_err) => {
        const pending = this.pendingEchoes.get(transactionId);
        if (pending) {
          const failed: Message = {
            ...pending,
            sendState: 'failed',
          };
          this.pendingEchoes.set(transactionId, failed);
          this.emit({
            type: 'message.updated',
            message: failed,
          });
        }
      });

    return transactionId;
  }

  /**
   * Retries sending a previously failed message.
   */
  async retryMessage(
    roomId: RoomId,
    transactionOrEventId: string,
  ): Promise<string> {
    const sdk = this.require();
    const pending =
      this.pendingEchoes.get(transactionOrEventId) ||
      [...this.pendingEchoes.values()].find(
        (m) => m.id === transactionOrEventId,
      );
    if (!pending) {
      throw new MatrixError('NOT_FOUND', 'Message not found or already sent.');
    }

    const newTxnId = `m.${Date.now()}.${Math.random().toString(36).slice(2)}`;
    const oldId = pending.id;
    const oldTxnId = pending.transactionId ?? oldId;
    this.pendingEchoes.delete(oldTxnId);

    const retriedMessage: Message = {
      ...pending,
      id: newTxnId,
      transactionId: newTxnId,
      sendState: 'sending',
      timestamp: this.options.now(),
    };
    this.pendingEchoes.set(newTxnId, retriedMessage);
    this.emit({
      type: 'message.updated',
      message: retriedMessage,
      oldId,
    });

    const content: Record<string, unknown> = {
      ...(retriedMessage.alsoSentToChannel
        ? { [ALSO_SEND_TO_CHANNEL_KEY]: true }
        : {}),
      ...(retriedMessage.mentions?.length
        ? {
            'm.mentions': {
              user_ids: [
                ...new Set(
                  retriedMessage.mentions
                    .map((m) => m.userId)
                    .filter((id) => id.startsWith('@')),
                ),
              ],
            },
            [MENTIONS_KEY]: retriedMessage.mentions.map((m) => ({
              user_id: m.userId,
              label: m.label,
            })),
          }
        : {}),
      msgtype: 'm.text',
      body: retriedMessage.body,
      ...(retriedMessage.formattedBody
        ? {
            format: 'org.matrix.custom.html',
            formatted_body: retriedMessage.formattedBody,
          }
        : {}),
      ...(retriedMessage.replyToId
        ? {
            'm.relates_to': {
              'm.in_reply_to': { event_id: retriedMessage.replyToId },
            },
          }
        : {}),
    };

    withRetry(() =>
      sdk.sendMessage(
        roomId,
        retriedMessage.threadRootId ?? null,
        content as never,
        newTxnId,
      ),
    )
      .then((res) => {
        const realEventId = res?.event_id;
        const current = this.pendingEchoes.get(newTxnId);
        if (current && realEventId) {
          const updated: Message = {
            ...current,
            id: realEventId,
            sendState: 'sent',
          };
          this.pendingEchoes.delete(newTxnId);
          this.emit({
            type: 'message.updated',
            message: updated,
            oldId: newTxnId,
          });
        }
      })
      .catch(() => {
        const current = this.pendingEchoes.get(newTxnId);
        if (current) {
          const failed: Message = { ...current, sendState: 'failed' };
          this.pendingEchoes.set(newTxnId, failed);
          this.emit({ type: 'message.updated', message: failed });
        }
      });

    return newTxnId;
  }

  async editMessage(
    roomId: RoomId,
    eventId: EventId,
    newBody: string,
    mentions?: { userId: string; label: string }[],
  ): Promise<void> {
    const sdk = this.require();

    // Editing a forward edits only the note: the forwarded original rides
    // along in the new content, or the card would vanish with the edit.
    const original = sdk
      .getRoom(roomId)
      ?.findEventById(eventId)
      ?.getContent();
    const forwarded = readForwardedContent(original);
    const newContent: Record<string, unknown> = forwarded
      ? {
          msgtype: 'm.text',
          body: forwardFallbackBody(
            newBody,
            forwarded.sender_name ?? forwarded.sender,
            typeof forwarded.content['body'] === 'string'
              ? (forwarded.content['body'] as string)
              : '',
          ),
          [FORWARDED_CONTENT_KEY]: { ...forwarded, comment: newBody.trim() },
        }
      : { msgtype: 'm.text', body: newBody };

    // A replacement replaces the content, so keep the original's mention ids
    // for every person the edited text still names.
    const body = newBody.toLowerCase();
    const previous = (original?.[MENTIONS_KEY] ?? []) as {
      user_id?: unknown;
      label?: unknown;
    }[];
    const keptMentions = [
      ...previous,
      // Mentions picked while editing.
      ...(mentions ?? []).map((m) => ({ user_id: m.userId, label: m.label })),
    ].filter(
      (m, i, all) =>
        typeof m?.user_id === 'string' &&
        typeof m.label === 'string' &&
        body.includes(`@${m.label.toLowerCase()}`) &&
        all.findIndex((o) => o.user_id === m.user_id && o.label === m.label) === i,
    );
    if (keptMentions.length) {
      newContent[MENTIONS_KEY] = keptMentions;
      newContent['m.mentions'] = {
        user_ids: keptMentions
          .map((m) => m.user_id as string)
          .filter((id) => id.startsWith('@')),
      };
    }

    await withRetry(() =>
      sdk.sendMessage(roomId, {
        msgtype: 'm.text',
        // Fallback body for clients that do not understand replacements.
        body: `* ${newBody}`,
        'm.new_content': newContent,
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
    if (!reactionId) return;
    await this.deleteMessage(roomId, reactionId);

    // Refresh the message now rather than trusting the redaction echo to find
    // its way back to it.
    const target = room.findEventById(eventId);
    const message = target ? toMessage(sdk, target, room) : null;
    if (message) this.emit({ type: 'message.updated', message });
  }

  // --- threads -------------------------------------------------------------

  getThreads(roomId: RoomId): Thread[] {
    const sdk = this.require();
    const room = sdk.getRoom(roomId);
    if (!room) return [];

    return room.getThreads().map((thread) => toThread(room, thread));
  }

  /**
   * The replies of one thread the client already holds, oldest first, without
   * fetching anything — what a room view merges in on `thread.updated`.
   */
  getThreadReplies(roomId: RoomId, rootId: EventId): Message[] {
    const sdk = this.require();
    const room = sdk.getRoom(roomId);
    return room ? this.loadedThreadReplies(sdk, room, rootId) : [];
  }

  private loadedThreadReplies(
    sdk: SdkClient,
    room: SdkRoom,
    rootId: EventId,
  ): Message[] {
    const thread = room.getThread(rootId);
    if (!thread) return [];
    return thread.events
      .filter((event) => event.getId() !== rootId)
      .map((event) => toMessage(sdk, event, room))
      .filter((message): message is Message => message !== null);
  }

  async getThreadMessages(roomId: RoomId, rootId: EventId): Promise<Message[]> {
    const sdk = this.require();
    const room = sdk.getRoom(roomId);
    if (!room) return [];

    const thread = room.getThread(rootId);
    if (!thread) return [];

    /*
     * The SDK only loads a thread's newest page on its own. Page the rest in
     * so a long thread opens complete — once the initial load has landed
     * (paging before it would race the SDK's own reset of the timeline).
     */
    let pagedIn = false;
    if (thread.initialEventsFetched) {
      for (let page = 0; page < MAX_THREAD_PAGES; page++) {
        if (!thread.liveTimeline.getPaginationToken(Direction.Backward)) break;
        const before = thread.events.length;
        const more = await withRetry(() =>
          sdk.paginateEventTimeline(thread.liveTimeline, {
            backwards: true,
            limit: 50,
          }),
        );
        if (thread.events.length > before) pagedIn = true;
        if (!more) break;
      }
    }

    const messages = thread.events
      .map((event) => toMessage(sdk, event, room))
      .filter((message): message is Message => message !== null);

    // A reply still on its way up shows straight away, as in the room.
    for (const pending of this.pendingEchoes.values()) {
      if (
        pending.roomId === roomId &&
        pending.threadRootId === rootId &&
        !messages.some(
          (m) =>
            m.id === pending.id ||
            (!!pending.transactionId && m.transactionId === pending.transactionId),
        )
      ) {
        messages.push(pending);
      }
    }

    // Older replies came in as backfill, which no live listener reports:
    // tell the room views so their copy of the thread fills in too.
    if (pagedIn) this.emit({ type: 'thread.updated', thread: toThread(room, thread) });

    return messages;
  }

  // --- presence, typing, receipts -----------------------------------------

  async setTyping(roomId: RoomId, isTyping: boolean): Promise<void> {
    const sdk = this.require();
    // 20s matches the SDK's own default timeout; the server expires it for us
    // if the client disappears mid-compose.
    await sdk.sendTyping(roomId, isTyping, isTyping ? 20_000 : 0);
  }

  /**
   * Sends a read receipt up to `eventId`, marking it and everything before it
   * read. `private: true` uses an `m.read.private` receipt — the read marker
   * still moves (so unread / highlight counts fall) but other members are not
   * told, which is the right choice when the reader has read receipts switched
   * off but a surface still needs their unread state to settle.
   */
  async markRead(
    roomId: RoomId,
    eventId: EventId,
    options: { private?: boolean; force?: boolean } = {},
  ): Promise<void> {
    // The reader just marked this room unread while looking at it: automatic
    // "you have seen this" receipts wait until they leave (see
    // `releaseReadHold`). An explicit "mark as read" passes `force`.
    if (this.readHolds.has(roomId) && !options.force) return;
    if (options.force) this.readHolds.delete(roomId);

    const sdk = this.require();
    const room = sdk.getRoom(roomId);
    const event = room?.getUnfilteredTimelineSet().findEventById(eventId);
    if (!event) return;
    // A local echo (`~room:txn` id) has no server event to point a receipt
    // at — the homeserver rejects it with a 400. The acknowledged event
    // re-triggers this once it lands.
    if (event.status !== null || !event.getId()?.startsWith('$')) return;
    await sdk.sendReadReceipt(
      event,
      options.private ? ReceiptType.ReadPrivate : ReceiptType.Read,
    );
    // Reading a room ends its "marked unread" state, as in every Matrix client.
    if (room && toRoom(sdk, room).markedUnread) {
      await this.setMarkedUnread(roomId, false);
    }
  }

  /**
   * "Mark unread" from a message: flags the room unread (Matrix
   * `m.marked_unread`, so other clients and devices agree) and remembers the
   * message, which becomes the "new messages" line. Read receipts cannot move
   * backwards, so this flag — not the receipt — is what the sidebar reads.
   *
   * Automatic read receipts for the room are held until `releaseReadHold`, so
   * marking the conversation you are looking at unread actually sticks.
   */
  async markUnread(roomId: RoomId, fromEventId: EventId): Promise<void> {
    this.readHolds.add(roomId);
    await this.setMarkedUnread(roomId, true, fromEventId);
  }

  /** Clears a "mark unread" without sending a receipt. */
  async setMarkedUnread(
    roomId: RoomId,
    unread: boolean,
    fromEventId?: EventId,
  ): Promise<void> {
    const sdk = this.require();
    await sdk.setRoomAccountData(roomId, MARKED_UNREAD_EVENT as never, {
      unread,
      ...(unread && fromEventId ? { [MARKED_UNREAD_FROM_KEY]: fromEventId } : {}),
    } as never);
  }

  /** The reader left the room — automatic read receipts may resume. */
  releaseReadHold(roomId: RoomId): void {
    this.readHolds.delete(roomId);
  }

  /** Whether automatic read receipts are currently held for a room. */
  isReadHeld(roomId: RoomId): boolean {
    return this.readHolds.has(roomId);
  }

  /**
   * This user's `m.direct` map: peer Matrix user id → the DM room ids recorded
   * for them. Unlike `Room.directUserId`, it knows a DM the peer has only been
   * invited to and not joined yet.
   */
  getDirectRoomIds(): Record<string, RoomId[]> {
    return readDirectMap(this.require());
  }

  /**
   * Room mutes written by this client that the synced push rules may not
   * reflect yet — the SDK only refreshes `pushRules` from the next sync's
   * account data. Entries drop once the synced rules agree.
   */
  private readonly pendingMutes = new Map<RoomId, boolean>();

  private syncedRoomMuted(sdk: SdkClient, roomId: RoomId): boolean {
    return !!sdk.pushRules?.global?.override?.some(
      (rule) => rule.rule_id === roomId && rule.enabled !== false,
    );
  }

  /**
   * Whether this user has silenced the whole room with a push rule — the rule
   * {@link setRoomMuted} writes. Push rules are per account, so the answer is
   * the same in every workspace and on every device.
   */
  isRoomMuted(roomId: RoomId): boolean {
    const sdk = this.require();
    return this.pendingMutes.get(roomId) ?? this.syncedRoomMuted(sdk, roomId);
  }

  /**
   * Silences (or restores) every notification from one room — phone/desktop
   * push and the room's notification counts — via a user override push rule
   * keyed on the room id, the same rule Element writes for "Mute". User
   * override rules outrank the server-default ones, so mentions are silenced
   * too: muting a conversation means it stays quiet. Applied optimistically;
   * listeners hear `pushrules.updated` immediately and again on failure.
   */
  async setRoomMuted(roomId: RoomId, muted: boolean): Promise<void> {
    const sdk = this.require();
    if (this.isRoomMuted(roomId) === muted) return;
    const previous = this.pendingMutes.get(roomId);
    this.pendingMutes.set(roomId, muted);
    this.emit({ type: 'pushrules.updated' });
    try {
      if (muted) {
        await sdk.addPushRule('global', PushRuleKind.Override, roomId, {
          actions: [],
          conditions: [
            { kind: ConditionKind.EventMatch, key: 'room_id', pattern: roomId },
          ],
        });
      } else {
        await sdk.deletePushRule('global', PushRuleKind.Override, roomId);
      }
    } catch (error) {
      // Unmuting a room whose rule is already gone is the outcome we wanted.
      if (!muted && (error as { httpStatus?: number })?.httpStatus === 404) {
        return;
      }
      if (previous === undefined) this.pendingMutes.delete(roomId);
      else this.pendingMutes.set(roomId, previous);
      this.emit({ type: 'pushrules.updated' });
      throw error;
    }
  }

  /** Drops optimistic mutes the freshly synced push rules now agree with. */
  private settlePendingMutes(sdk: SdkClient): void {
    for (const [roomId, muted] of this.pendingMutes) {
      if (this.syncedRoomMuted(sdk, roomId) === muted) {
        this.pendingMutes.delete(roomId);
      }
    }
  }

  /**
   * Turns reply notifications for one thread off or on. Stored as room account
   * data, so every device of this user honours it; mentions still notify.
   */
  async setThreadNotificationsMuted(
    roomId: RoomId,
    threadRootId: EventId,
    muted: boolean,
  ): Promise<void> {
    const sdk = this.require();
    const room = sdk.getRoom(roomId);
    const current = new Set(room ? readMutedThreadRootIds(room) : []);
    if (muted) current.add(threadRootId);
    else current.delete(threadRootId);
    await sdk.setRoomAccountData(roomId, THREAD_NOTIFICATIONS_EVENT as never, {
      muted: [...current],
    } as never);

    // Account data only reaches our own clients. Phone/desktop push comes from
    // the homeserver's push rules, so mirror the mute as a silent underride
    // rule on the thread's replies. Underride sits below the mention rules, so
    // an @mention inside the thread still notifies.
    const ruleId = threadMuteRuleId(threadRootId);
    try {
      if (muted) {
        await sdk.addPushRule('global', PushRuleKind.Underride, ruleId, {
          actions: [],
          conditions: [
            { kind: ConditionKind.EventMatch, key: 'room_id', pattern: roomId },
            {
              kind: ConditionKind.EventPropertyIs,
              key: 'content.m\\.relates_to.rel_type',
              value: 'm.thread',
            },
            {
              kind: ConditionKind.EventPropertyIs,
              key: 'content.m\\.relates_to.event_id',
              value: threadRootId,
            },
          ],
        });
      } else {
        await sdk.deletePushRule('global', PushRuleKind.Underride, ruleId);
      }
    } catch (error) {
      // Unmuting a thread muted before push rules were written: no rule.
      if (muted || (error as { httpStatus?: number })?.httpStatus !== 404) {
        console.warn('[matrix] could not sync thread mute to push rules', error);
      }
    }
  }

  /**
   * Pins or unpins a message for everyone in the room (`m.room.pinned_events`
   * state). The newest pin goes last, matching other Matrix clients.
   */
  async setMessagePinned(
    roomId: RoomId,
    eventId: EventId,
    pinned: boolean,
  ): Promise<void> {
    const sdk = this.require();
    const room = sdk.getRoom(roomId);
    const current = room ? readPinnedEventIds(room) : [];
    if (current.includes(eventId) === pinned) return;
    const next = current.filter((id) => id !== eventId);
    if (pinned) next.push(eventId);
    await withRetry(() =>
      sdk.sendStateEvent(
        roomId,
        PINNED_EVENTS_EVENT as never,
        { pinned: next } as never,
        '',
      ),
    );
  }

  /** The reader's saved-for-later messages (account data, newest first). */
  getSavedMessages(): SavedMessage[] {
    return this.sdk ? readSavedMessages(this.sdk) : [];
  }

  /**
   * Replaces the saved list in one write. Callers merge against
   * `getSavedMessages()` first, so concurrent devices only lose on a true race.
   */
  async setSavedMessages(saved: SavedMessage[]): Promise<void> {
    const sdk = this.require();
    await withRetry(() =>
      sdk.setAccountData(
        SAVED_MESSAGES_EVENT as never,
        { messages: saved.slice(0, MAX_SAVED_MESSAGES) } as never,
      ),
    );
  }

  /** Saves or unsaves one message, reading the latest list just before writing. */
  async setMessageSaved(entry: SavedMessage, saved: boolean): Promise<void> {
    const current = this.getSavedMessages();
    const rest = current.filter((item) => item.id !== entry.id);
    await this.setSavedMessages(saved ? [entry, ...rest] : rest);
  }

  /**
   * Loads one message by id, even when it is outside the loaded timeline — e.g.
   * a pin on an old message. Resolves `null` when it is gone or unreadable.
   */
  async fetchMessage(roomId: RoomId, eventId: EventId): Promise<Message | null> {
    const sdk = this.require();
    const room = sdk.getRoom(roomId);
    const loaded = room?.findEventById(eventId);
    if (loaded) return toMessage(sdk, loaded, room ?? null);
    try {
      const raw = await sdk.fetchRoomEvent(roomId, eventId);
      const event = sdk.getEventMapper()(raw);
      await sdk.decryptEventIfNeeded(event);
      return toMessage(sdk, event, room ?? null);
    } catch {
      return null;
    }
  }

  /** True when replies in this thread should make no sound or notification. */
  isThreadMuted(roomId: RoomId, threadRootId: EventId): boolean {
    const room = this.sdk?.getRoom(roomId);
    return room ? readMutedThreadRootIds(room).includes(threadRootId) : false;
  }

  /**
   * The id of the last event this user has a read receipt for in a room, or
   * `null`. The first loaded message *after* it is the room's "new messages"
   * line. Returns `null` before the client has synced.
   */
  getReadUpToId(roomId: RoomId): EventId | null {
    const sdk = this.sdk;
    const myUserId = this.session?.userId;
    if (!sdk || !myUserId) return null;
    try {
      return sdk.getRoom(roomId)?.getEventReadUpTo(myUserId, false) ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Returns all users who have read up to or past `eventId` in `roomId`,
   * excluding the current logged-in user, ordered by most recent read timestamp.
   */
  getMessageReaders(roomId: RoomId, eventId: EventId): MessageReader[] {
    const sdk = this.sdk;
    if (!sdk) return [];
    try {
      const room = sdk.getRoom(roomId);
      const event = room?.findEventById(eventId);
      // Readers are only shown under the viewer's own messages.
      if (!event || event.getSender() !== sdk.getUserId() || event.isRedacted()) return [];
      // A thread root is itself a main-timeline message; only replies are
      // read on the thread's own receipt.
      const threadRootId = event.threadRootId;
      return toReaders(
        sdk,
        room,
        eventId,
        threadRootId && threadRootId !== eventId ? threadRootId : undefined,
      );
    } catch {
      return [];
    }
  }

  /**
   * Marks a thread caught up to its latest reply.
   *
   * A thread carries its own read marker, separate from the room's — the SDK
   * routes the receipt to the thread from the event's own relation, so this is
   * the same call as `markRead` pointed at a threaded event. `private` keeps
   * the receipt to this user, as for `markRead`.
   */
  async markThreadRead(
    roomId: RoomId,
    threadRootId: EventId,
    options: { private?: boolean } = {},
  ): Promise<void> {
    const sdk = this.require();
    const thread = sdk.getRoom(roomId)?.getThread(threadRootId);
    const latest = thread?.replyToEvent ?? thread?.rootEvent;
    if (latest) {
      await sdk.sendReadReceipt(
        latest,
        options.private ? ReceiptType.ReadPrivate : ReceiptType.Read,
      );
    }
  }

  async setPresence(
    state: PresenceState,
    statusMessage?: string,
  ): Promise<void> {
    const sdk = this.require();
    const matrixPresence =
      state === 'online'
        ? 'online'
        : state === 'offline'
        ? 'offline'
        : 'unavailable';
    await sdk.setPresence({
      presence: matrixPresence,
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
    const [contentUri, size] = await Promise.all([
      this.uploadFile(file, options.onProgress),
      readImageSize(file),
    ]);
    const content = fileMessageContent(file, contentUri, options.voice, size);

    await withRetry(() =>
      sdk.sendMessage(roomId, options.threadRootId ?? null, content as never),
    );
  }

  /**
   * Sends several files as one upload. Matrix has no multi-file message, so
   * each file is still its own event — but every event carries the same
   * {@link ATTACHMENT_BATCH_KEY} id, which is what lets the timeline render
   * them as one message with a grid.
   *
   * Uploads run in parallel (a few at a time) and report per-file progress;
   * the events are then sent in the order the files were picked, back to
   * back, so they land together. A file that fails to upload is skipped
   * rather than sinking the rest — its index comes back in `failed` so the
   * caller can offer a retry. Rejects only if sending the events fails.
   */
  async sendFiles(
    roomId: RoomId,
    files: File[],
    options: {
      threadRootId?: EventId;
      /** Shared by every event of the upload; generated when omitted. */
      batchId?: string;
      /** Upload progress of the file at `index`, 0..100. */
      onFileProgress?: (index: number, percent: number) => void;
      /** The file at `index` finished uploading (`ok`) or gave up. */
      onFileUploaded?: (index: number, ok: boolean) => void;
    } = {},
  ): Promise<{ failed: number[] }> {
    if (files.length === 0) return { failed: [] };
    const sdk = this.require();

    const UPLOAD_CONCURRENCY = 3;
    const uploads: ({ uri: string; size?: ImageSize } | null)[] = new Array(
      files.length,
    ).fill(null);
    let next = 0;
    const worker = async () => {
      while (next < files.length) {
        const index = next++;
        try {
          const [uri, size] = await Promise.all([
            this.uploadFile(files[index], (percent) =>
              options.onFileProgress?.(index, percent),
            ),
            readImageSize(files[index]),
          ]);
          uploads[index] = { uri, size };
          options.onFileProgress?.(index, 100);
          options.onFileUploaded?.(index, true);
        } catch {
          uploads[index] = null;
          options.onFileUploaded?.(index, false);
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(UPLOAD_CONCURRENCY, files.length) }, worker),
    );

    const failed = files.flatMap((_, index) => (uploads[index] ? [] : [index]));
    const uploaded = files.flatMap((file, index) => {
      const upload = uploads[index];
      return upload ? [{ file, ...upload }] : [];
    });

    // A lone file needs no batch tag — it is already one message.
    const id =
      uploaded.length > 1
        ? (options.batchId ??
          `b.${Date.now()}.${Math.random().toString(36).slice(2)}`)
        : undefined;
    for (const [index, { file, uri, size }] of uploaded.entries()) {
      const content = {
        ...fileMessageContent(file, uri, undefined, size),
        ...(id
          ? { [ATTACHMENT_BATCH_KEY]: { id, index, count: uploaded.length } }
          : {}),
      };
      await withRetry(() =>
        sdk.sendMessage(roomId, options.threadRootId ?? null, content as never),
      );
    }

    return { failed };
  }

  private async uploadFile(
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<string> {
    const sdk = this.require();
    const upload = await withRetry(() =>
      sdk.uploadContent(file, {
        name: file.name,
        type: file.type,
        progressHandler: ({ loaded, total }) =>
          onProgress?.(total ? Math.round((loaded / total) * 100) : 0),
      }),
    );
    return upload.content_uri;
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
        app_display_name: 'Onetab AI',
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
        app_display_name: 'Onetab AI',
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

  /**
   * The unread `@mentions` currently resolvable in a room — every loaded event
   * that fires a highlight push rule for this user and sits after their read
   * receipt, oldest first. Thread replies are included, tagged with their root.
   *
   * This only scans what is loaded, which the virtualised timeline already
   * bounds; `Room.highlightCount` remains the authoritative *count*, and the
   * difference is mentions further back than the current page (the caller shows
   * an "older" affordance and pages history in to reach them). Returns `[]`
   * while the client is still syncing — reading rooms then throws.
   */
  getUnreadMentions(roomId: RoomId): UnreadMention[] {
    const sdk = this.sdk;
    const myUserId = this.session?.userId;
    if (!sdk || !myUserId) return [];

    try {
      const room = sdk.getRoom(roomId);
      return room ? collectUnreadMentions(sdk, room, myUserId) : [];
    } catch {
      // Client present but not synced yet — reading rooms throws through require().
      return [];
    }
  }
}

/** Factory, so consumers never import the class or the SDK directly. */
export function createMatrixClient(
  options: MatrixClientOptions,
): OneTabMatrixClient {
  return new OneTabMatrixClient(options);
}
