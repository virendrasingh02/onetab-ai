/**
 * Domain model for the communication layer.
 *
 * These types are the entire contract between the application and Matrix.
 * Nothing from `matrix-js-sdk` is re-exported anywhere in this package's public
 * surface — that isolation is what makes the transport replaceable, and it is
 * enforced by `matrix-client.spec.ts`.
 */

export type RoomId = string;
export type EventId = string;
export type MatrixUserId = string;
export type DeviceId = string;

/** Milliseconds since the epoch. */
export type Timestamp = number;

// --- session ---------------------------------------------------------------

export interface MatrixSession {
  userId: MatrixUserId;
  deviceId: DeviceId;
  accessToken: string;
  homeserverUrl: string;
  /** Present when the homeserver issued a refreshable token pair. */
  refreshToken?: string;
  expiresAtMs?: Timestamp;
}

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'syncing'
  | 'connected'
  /** Sync is failing but the client is retrying with backoff. */
  | 'reconnecting'
  /** The session is invalid; the user must sign in again. */
  | 'expired'
  | 'error';

export interface ConnectionStatus {
  state: ConnectionState;
  /** Populated in `reconnecting`; drives "retrying in Ns" copy. */
  retryInMs?: number;
  error?: string;
}

// --- rooms -----------------------------------------------------------------

export type RoomKind = 'channel' | 'direct' | 'group';

export interface Room {
  id: RoomId;
  kind: RoomKind;
  name: string;
  topic?: string;
  avatarUrl?: string;
  isEncrypted: boolean;
  /** Total unread, including non-highlight messages. */
  unreadCount: number;
  /** Unread messages that mention the user directly. */
  highlightCount: number;
  lastActivityAt?: Timestamp;
  memberCount: number;
  /** Set for `direct` rooms only. */
  directUserId?: MatrixUserId;
}

export interface RoomMember {
  userId: MatrixUserId;
  displayName: string;
  avatarUrl?: string;
  /** Matrix power level: 100 admin, 50 moderator, 0 default. */
  powerLevel: number;
  membership: 'join' | 'invite' | 'leave' | 'ban' | 'knock';
}

// --- messages --------------------------------------------------------------

export type MessageKind =
  | 'text'
  | 'emote'
  | 'notice'
  | 'image'
  | 'video'
  | 'audio'
  | 'voice'
  | 'file'
  | 'unknown';

export interface Attachment {
  /** Original filename as uploaded. */
  name: string;
  mimeType: string;
  /** Bytes. Absent when the homeserver did not report a size. */
  size?: number;
  /** Resolved HTTP URL. Encrypted attachments resolve to a blob URL. */
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  /** Seconds, for audio and video. */
  duration?: number;
  /** Normalised 0..1 samples for voice message waveforms. */
  waveform?: number[];
}

export interface Reaction {
  key: string;
  count: number;
  /** True when the local user is one of the reactors. */
  reactedByMe: boolean;
  userIds: MatrixUserId[];
}

export type SendState = 'sending' | 'sent' | 'failed';

export interface Message {
  id: EventId;
  roomId: RoomId;
  senderId: MatrixUserId;
  senderName: string;
  senderAvatarUrl?: string;
  kind: MessageKind;
  /** Plain-text body. Always populated, even for media (the filename). */
  body: string;
  /** Sanitised HTML, when the message carries formatted content. */
  formattedBody?: string;
  timestamp: Timestamp;
  attachment?: Attachment;
  reactions: Reaction[];
  /** True once the message has been edited at least once. */
  isEdited: boolean;
  isRedacted: boolean;
  /** Set when this message is a threaded reply. */
  threadRootId?: EventId;
  /** Set when this message is an inline reply. */
  replyToId?: EventId;
  /** Present for locally echoed messages that have not been acknowledged. */
  sendState?: SendState;
  /** Local-echo correlation id, so the echo can be replaced on ack. */
  transactionId?: string;
  isEncrypted: boolean;
  /** Set when decryption failed — render a placeholder, not an empty bubble. */
  decryptionError?: string;
}

export interface Thread {
  rootId: EventId;
  roomId: RoomId;
  replyCount: number;
  latestReplyAt?: Timestamp;
  participantIds: MatrixUserId[];
  hasUnread: boolean;
}

/** A page of timeline history, with the cursor needed to fetch older events. */
export interface Timeline {
  messages: Message[];
  /** Opaque pagination token; null when the start of history is reached. */
  paginationToken: string | null;
  hasMore: boolean;
}

// --- presence & receipts ---------------------------------------------------

export type PresenceState = 'online' | 'unavailable' | 'offline';

export interface Presence {
  userId: MatrixUserId;
  state: PresenceState;
  lastActiveAgoMs?: number;
  statusMessage?: string;
}

export interface TypingUpdate {
  roomId: RoomId;
  userIds: MatrixUserId[];
}

export interface ReadReceipt {
  userId: MatrixUserId;
  eventId: EventId;
  timestamp: Timestamp;
}

// --- devices & encryption --------------------------------------------------

export type DeviceTrust = 'verified' | 'unverified' | 'blocked';

export interface Device {
  id: DeviceId;
  displayName?: string;
  lastSeenIp?: string;
  lastSeenAt?: Timestamp;
  trust: DeviceTrust;
  /** True for the device this session is running on. */
  isCurrent: boolean;
}

export interface EncryptionStatus {
  /** False when the crypto stack could not be initialised. */
  available: boolean;
  /** True once cross-signing keys exist and are trusted locally. */
  crossSigningReady: boolean;
  /** True when a server-side key backup is active. */
  keyBackupEnabled: boolean;
  ownDeviceTrust: DeviceTrust;
}

export interface VerificationRequestSummary {
  id: string;
  otherUserId: MatrixUserId;
  otherDeviceId?: DeviceId;
  /** Emoji shown to both sides for out-of-band comparison. */
  emoji?: { symbol: string; name: string }[];
  phase: 'requested' | 'ready' | 'started' | 'done' | 'cancelled';
}

// --- calls -----------------------------------------------------------------

export type CallKind = 'voice' | 'video';
export type CallState =
  'ringing' | 'connecting' | 'connected' | 'ended' | 'rejected' | 'failed';

export interface Call {
  id: string;
  roomId: RoomId;
  kind: CallKind;
  state: CallState;
  isIncoming: boolean;
  remoteUserId?: MatrixUserId;
  startedAt?: Timestamp;
}

// --- notifications ---------------------------------------------------------

export interface PushRegistration {
  /** Web Push endpoint or FCM/APNs token. */
  pushKey: string;
  appId: string;
  /** URL of our push gateway. */
  gatewayUrl: string;
  deviceDisplayName: string;
}

export interface NotificationCounts {
  total: number;
  highlight: number;
}

// --- events ----------------------------------------------------------------

/**
 * Everything the client emits. One discriminated union rather than an
 * `EventEmitter` of loose strings, so consumers get exhaustive checking.
 */
export type MatrixClientEvent =
  | { type: 'connection'; status: ConnectionStatus }
  | { type: 'room.upserted'; room: Room }
  | { type: 'room.removed'; roomId: RoomId }
  | { type: 'message.received'; message: Message }
  | { type: 'message.updated'; message: Message }
  | { type: 'message.redacted'; roomId: RoomId; eventId: EventId }
  | { type: 'typing'; update: TypingUpdate }
  | { type: 'presence'; presence: Presence }
  | { type: 'receipt'; roomId: RoomId; receipts: ReadReceipt[] }
  | { type: 'thread.updated'; thread: Thread }
  | { type: 'notifications'; roomId: RoomId; counts: NotificationCounts }
  | { type: 'device.updated'; devices: Device[] }
  | { type: 'verification.requested'; request: VerificationRequestSummary }
  | { type: 'call.updated'; call: Call };

export type MatrixEventListener = (event: MatrixClientEvent) => void;
