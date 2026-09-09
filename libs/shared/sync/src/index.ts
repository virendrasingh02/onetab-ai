export { BackgroundSyncManager } from './lib/background-sync-manager.js';
export { SyncScheduler } from './lib/sync-scheduler.js';
export type { SchedulerConditions } from './lib/sync-scheduler.js';
export { SyncLeader } from './lib/sync-leader.js';
export type { SyncBroadcast } from './lib/sync-leader.js';
export { OfflineActionQueue } from './lib/offline-queue.js';
export type { QueuedAction, ActionExecutor } from './lib/offline-queue.js';
export {
  RetryPolicy,
  classifyError,
  BACKOFF_LADDER_MS,
  MAX_BACKOFF_MS,
} from './lib/retry-policy.js';
export type { ClassifiedError, ErrorClass } from './lib/retry-policy.js';
export {
  applyRealtimeEvent,
  HANDLED_REALTIME_EVENTS,
} from './lib/realtime-invalidation-map.js';
export { runCatchup, applyDigest, readCursor, writeCursor } from './lib/sync-catchup.js';
export type { CatchupResult } from './lib/sync-catchup.js';
export {
  syncMetrics,
  installSyncMetricsProbe,
} from './lib/sync-metrics.js';
export type { SyncMetricsSnapshot } from './lib/sync-metrics.js';
export { useSyncStore, syncStore } from './lib/sync-store.js';
export type { SyncStatusState } from './lib/sync-store.js';
export {
  CADENCE_BASE_MS,
  normalizeResource,
  queryKeyMentionsWorkspace,
} from './lib/sync-resource.js';
export type {
  CadenceClass,
  SyncPriority,
  SyncPhase,
  SyncResource,
  RegisterResourceInput,
} from './lib/sync-resource.js';
export {
  OFFLINE_ACTION,
  registerDefaultOfflineExecutors,
} from './lib/offline-executors.js';
export {
  SyncProvider,
  useBackgroundSync,
  useOptionalBackgroundSync,
} from './lib/sync-provider.js';
export type { SyncProviderProps } from './lib/sync-provider.js';
export {
  useBackgroundResource,
  useSyncStatus,
  useManualResync,
  useEnqueueOfflineAction,
  useSyncCadence,
} from './lib/hooks.js';
export type { SyncStatus } from './lib/hooks.js';
