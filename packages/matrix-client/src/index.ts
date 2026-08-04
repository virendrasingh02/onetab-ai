/**
 * @org/matrix-client — the application's only door to Matrix.
 *
 * Nothing from `matrix-js-sdk` is re-exported here, by design: the rest of the
 * codebase speaks in the domain types below, so replacing the transport is a
 * change inside this package rather than across the app. `matrix-client.spec.ts`
 * asserts that isolation so it cannot regress unnoticed.
 */

export {
  OneTabMatrixClient,
  createMatrixClient,
  type LoginCredentials,
  type MatrixClientOptions,
} from './lib/matrix-client.js';

export {
  CallManager,
  createCallManager,
  type CallListener,
  type CallMediaConstraints,
} from './lib/calls.js';

export {
  LocalStorageSessionStore,
  MemorySessionStore,
  type SessionStore,
} from './lib/session-store.js';

export { MatrixError } from './lib/types.js';

export type {
  Attachment,
  Call,
  CallKind,
  CallState,
  ConnectionState,
  ConnectionStatus,
  Device,
  DeviceId,
  DeviceTrust,
  EncryptionStatus,
  EventId,
  MatrixClientEvent,
  MatrixErrorCode,
  MatrixEventListener,
  MatrixSession,
  MatrixUserId,
  Message,
  MessageKind,
  NotificationCounts,
  Presence,
  PresenceState,
  PushRegistration,
  Reaction,
  ReadReceipt,
  Room,
  RoomId,
  RoomKind,
  RoomMember,
  SendState,
  Thread,
  Timeline,
  Timestamp,
  TypingUpdate,
  VerificationRequestSummary,
} from './lib/types.js';

export { isRetryable, toMatrixError, withRetry } from './lib/errors.js';
