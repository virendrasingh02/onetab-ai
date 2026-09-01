/**
 * Domain model for the communication layer.
 *
 * These types are the entire contract between the application and Matrix.
 * Nothing from `matrix-js-sdk` is re-exported anywhere in this package's public
 * surface — that isolation is what makes the transport replaceable, and it is
 * enforced by `matrix-client.spec.ts`.
 */

import type { CardMessageContent } from './card-schema.js';

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
  /** Optional structured application event (AI Agent card, App card, Approval, Form, Workflow, etc.) */
  structuredEvent?: StructuredChatMessage;
}

// --- structured chat events (AI Agents, Apps, Approvals, Forms, Workflows) ---

export type AgentExecutionState =
  | 'queued'
  | 'starting'
  | 'running'
  | 'waiting'
  | 'waiting_for_approval'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused';

export interface AgentToolExecution {
  id?: string;
  name: string;
  status: 'queued' | 'running' | 'success' | 'failed';
  durationMs?: number;
  input?: unknown;
  output?: unknown;
  error?: string;
  retriable?: boolean;
}

export interface MessageSource {
  id?: string;
  title: string;
  url: string;
  domain?: string;
  description?: string;
  type?: 'web' | 'doc' | 'knowledge_base' | 'app_record' | 'other';
  faviconUrl?: string;
}

export interface GeneratedFile {
  id?: string;
  name: string;
  url: string;
  mimeType: string;
  size?: number;
  previewUrl?: string;
  codeSnippet?: {
    language: string;
    code: string;
    isDiff?: boolean;
    filename?: string;
  };
}

export interface StructuredMessageAction {
  id: string;
  label: string;
  variant?:
    | 'default'
    | 'primary'
    | 'destructive'
    | 'outline'
    | 'secondary'
    | 'ghost';
  icon?: string;
  actionType?: string;
  payload?: Record<string, unknown>;
  url?: string;
  requiresConfirmation?: boolean;
  confirmationTitle?: string;
  confirmationMessage?: string;
  disabled?: boolean;
  loading?: boolean;
}

export interface AIAgentMessageContent {
  type: 'mie.ai.agent';
  version?: string;
  agentId: string;
  executionId?: string;
  status: AgentExecutionState;
  title?: string;
  agentName?: string;
  agentHandle?: string;
  agentAvatarSeed?: string;
  agentAvatarUrl?: string;
  agentRole?: string;
  agentDescription?: string;
  workspaceId?: string;
  teamName?: string;
  model?: string;
  durationMs?: number;
  startedAt?: number;
  completedAt?: number;
  summary?: string;
  responseText?: string;
  reasoning?: {
    summary?: string;
    details?: string;
    durationMs?: number;
  };
  keyFindings?: string[];
  actionsTaken?: string[];
  tools?: AgentToolExecution[];
  sources?: MessageSource[];
  files?: GeneratedFile[];
  suggestedActions?: StructuredMessageAction[];
  actions?: StructuredMessageAction[];
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface AppResponseMessageContent {
  type: 'mie.app.response';
  version?: string;
  appId: string;
  appName: string;
  appIcon?: string;
  category?:
    | 'developer'
    | 'productivity'
    | 'monitoring'
    | 'collaboration'
    | 'crm'
    | 'custom';
  eventType: string;
  cardType?:
    | 'data'
    | 'notification'
    | 'task'
    | 'calendar'
    | 'contact'
    | 'file'
    | 'activity'
    | 'github'
    | 'linear'
    | 'crm'
    | 'sentry'
    | 'jira'
    | 'custom';
  title: string;
  subtitle?: string;
  url?: string;
  accentColor?: string;
  badge?: {
    label: string;
    variant?:
      | 'primary'
      | 'neutral'
      | 'success'
      | 'warning'
      | 'destructive'
      | 'violet';
  };
  fields?: Array<{
    label: string;
    value: string | number | boolean;
    inline?: boolean;
    badge?: string;
  }>;
  data?: Record<string, unknown>;
  actions?: StructuredMessageAction[];
  footer?: string;
  timestamp?: number;
}

export interface ApprovalMessageContent {
  type: 'mie.approval';
  version?: string;
  approvalId: string;
  title: string;
  description: string;
  agentId?: string;
  agentName?: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  sideEffects?: string[];
  proposedAction?: string;
  diffPreview?: {
    language?: string;
    filename?: string;
    diff: string;
  };
  approverId?: string;
  approverName?: string;
  decidedAt?: number;
  expiresAt?: number;
  payload?: Record<string, unknown>;
  actions?: StructuredMessageAction[];
}

export interface FormFieldDefinition {
  id: string;
  name: string;
  label: string;
  type:
    | 'text'
    | 'email'
    | 'number'
    | 'select'
    | 'multiselect'
    | 'checkbox'
    | 'radio'
    | 'date'
    | 'time'
    | 'file'
    | 'user';
  placeholder?: string;
  required?: boolean;
  defaultValue?: unknown;
  options?: Array<{ label: string; value: string; description?: string }>;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

export interface FormMessageContent {
  type: 'mie.form';
  version?: string;
  formId: string;
  title: string;
  description?: string;
  fields: FormFieldDefinition[];
  submitLabel?: string;
  cancelLabel?: string;
  status?: 'idle' | 'submitting' | 'submitted' | 'disabled' | 'error';
  submittedValues?: Record<string, unknown>;
  submittedAt?: number;
  submittedBy?: string;
}

export interface FileMessageContent {
  type: 'mie.file';
  version?: string;
  fileId?: string;
  title?: string;
  description?: string;
  files: GeneratedFile[];
}

export interface WorkflowStep {
  id: string;
  name: string;
  agentId?: string;
  agentName?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  durationMs?: number;
  input?: unknown;
  output?: unknown;
  error?: string;
  logs?: string[];
}

export interface WorkflowMessageContent {
  type: 'mie.workflow';
  version?: string;
  workflowId: string;
  title: string;
  description?: string;
  currentStepIndex: number;
  totalSteps?: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';
  steps: WorkflowStep[];
  durationMs?: number;
  startedAt?: number;
  completedAt?: number;
  actions?: StructuredMessageAction[];
}

export interface SystemMessageContent {
  type: 'mie.system';
  version?: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  title: string;
  details?: string;
  code?: string;
  timestamp?: number;
  actions?: StructuredMessageAction[];
}

export type StructuredChatMessage =
  | AIAgentMessageContent
  | AppResponseMessageContent
  | ApprovalMessageContent
  | FormMessageContent
  | FileMessageContent
  | WorkflowMessageContent
  | SystemMessageContent
  | CardMessageContent;

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

export type PresenceState = 'online' | 'away' | 'busy' | 'offline' | 'unavailable';

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
