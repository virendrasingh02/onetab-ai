/**
 * Platform-free half of the mobile offline queue: the allow-list of actions
 * that may wait for the network, how a mutation decides between "send now"
 * and "queue", and the user-facing wording. Storage, NetInfo and React live in
 * `offline-queue.ts`. Kept free of workspace imports so it unit-tests in Node.
 */

/** Structural copy of `@org/sync`'s `QueuedAction`. */
export interface QueuedAction {
  id: string;
  kind: string;
  workspaceId: string;
  dedupeKey: string;
  payload: unknown;
  enqueuedAt: string;
  attempts: number;
}

/**
 * Matches `classifyError(...).class === 'network'` in `@org/sync`: the API
 * client reports "no response at all" as status 0, and anything without a
 * numeric status never reached the server either.
 */
export function isNetworkFailure(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status !== 'number' || status === 0;
}

export const MOBILE_OFFLINE_ACTION = {
  TaskCreate: 'task.create',
  TaskUpdate: 'task.update',
  TaskCommentCreate: 'taskComment.create',
  NotificationMarkRead: 'notification.markRead',
  NotificationMarkAllRead: 'notification.markAllRead',
} as const;

export type MobileOfflineActionKind =
  (typeof MOBILE_OFFLINE_ACTION)[keyof typeof MOBILE_OFFLINE_ACTION];

export interface QueueLike {
  enqueue(action: Omit<QueuedAction, 'id' | 'enqueuedAt' | 'attempts'>): void;
}

export interface QueueableRequest<T> {
  kind: MobileOfflineActionKind;
  workspaceId: string;
  /** Same key = same intent; a newer one replaces the queued one. */
  dedupeKey: string;
  payload: unknown;
  send: () => Promise<T>;
}

export type QueueOutcome<T> =
  { status: 'sent'; result: T } | { status: 'queued' };

/**
 * Sends now when online; queues when offline, or when the request failed only
 * because the network dropped. Every other failure (validation, permission,
 * conflict, server) is thrown so the screen can show it — the queue only ever
 * holds work that has a real chance of succeeding later.
 */
export async function sendOrQueue<T>(
  queue: QueueLike,
  online: boolean,
  request: QueueableRequest<T>,
): Promise<QueueOutcome<T>> {
  const enqueue = () =>
    queue.enqueue({
      kind: request.kind,
      workspaceId: request.workspaceId,
      dedupeKey: request.dedupeKey,
      payload: request.payload,
    });
  if (!online) {
    enqueue();
    return { status: 'queued' };
  }
  try {
    return { status: 'sent', result: await request.send() };
  } catch (error) {
    if (!isNetworkFailure(error)) throw error;
    enqueue();
    return { status: 'queued' };
  }
}

const LABELS: Record<string, string> = {
  [MOBILE_OFFLINE_ACTION.TaskCreate]: 'a new task',
  [MOBILE_OFFLINE_ACTION.TaskUpdate]: 'a task change',
  [MOBILE_OFFLINE_ACTION.TaskCommentCreate]: 'a comment',
  [MOBILE_OFFLINE_ACTION.NotificationMarkRead]: 'a notification read state',
  [MOBILE_OFFLINE_ACTION.NotificationMarkAllRead]: '"mark all read"',
};

/** "Your comment “Looks good…” couldn't be saved" style detail. */
export function describeDroppedAction(action: QueuedAction): string {
  const what = LABELS[action.kind] ?? 'an offline change';
  const preview = previewOf(action);
  return preview ? `${what} (“${preview}”)` : what;
}

function previewOf(action: QueuedAction): string | null {
  const payload = action.payload as
    { input?: { content?: unknown; title?: unknown } } | null | undefined;
  const text = payload?.input?.content ?? payload?.input?.title;
  if (typeof text !== 'string' || !text.trim()) return null;
  const clean = text.trim().replace(/\s+/g, ' ');
  return clean.length > 40 ? `${clean.slice(0, 40)}…` : clean;
}

/** Sign-out dialog body; warns when offline changes would be discarded. */
export function signOutMessage(pending: number): string {
  const base = 'This device stops receiving notifications for your account.';
  if (pending === 0) return base;
  return (
    `${base}\n\n${pendingLabel(pending)} you made offline ` +
    `${pending === 1 ? "hasn't" : "haven't"} reached the server yet and will ` +
    'be discarded. Connect to the internet first to keep them.'
  );
}

/** "1 change" / "3 changes". */
export function pendingLabel(count: number): string {
  return `${count} ${count === 1 ? 'change' : 'changes'}`;
}
