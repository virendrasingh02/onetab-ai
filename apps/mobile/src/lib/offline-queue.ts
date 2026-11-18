import NetInfo from '@react-native-community/netinfo';
import { notificationApi, queryKeys, workToolsApi } from '@org/api-client';
import { OfflineActionQueue, type QueuedAction } from '@org/sync';
import { onlineManager } from '@tanstack/react-query';
import { Directory, File, Paths } from 'expo-file-system';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import { Alert } from './alert';
import {
  describeDroppedAction,
  MOBILE_OFFLINE_ACTION,
  sendOrQueue,
  type QueueableRequest,
  type QueueOutcome,
} from './offline-queue-core';
import { queryClient } from './query';
import { useSession } from './session';

/**
 * Mobile offline queue. Built on the web's `OfflineActionQueue` (`@org/sync`)
 * — same ordering, dedupe and terminal-drop rules — with storage that fits a
 * phone: one JSON file per user + workspace in the app's private documents
 * directory (localStorage on web).
 *
 * Scoped per user so a different account signing in on the same device never
 * replays someone else's changes. An explicit sign-out discards the signed-in
 * user's queue (the sign-out dialog warns first); a session that merely
 * expired keeps it and replays after that same person signs back in.
 */

const isWeb = Platform.OS === 'web';
const WEB_PREFIX = 'onetab:mobile:queue:';

function safe(part: string): string {
  return part.replace(/[^A-Za-z0-9_-]+/g, '_');
}

interface Persistence {
  read(workspaceId: string): QueuedAction[];
  write(workspaceId: string, actions: QueuedAction[]): void;
  /** Workspaces with a stored queue for this user. */
  workspaces(): string[];
  wipe(): void;
}

function parseList(raw: string | null | undefined): QueuedAction[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedAction[]) : [];
  } catch {
    return [];
  }
}

function fileStore(userId: string): Persistence {
  const dir = () => {
    const d = new Directory(Paths.document, 'offline-queue', safe(userId));
    if (!d.exists) d.create({ intermediates: true, idempotent: true });
    return d;
  };
  const file = (workspaceId: string) =>
    new File(dir(), `${safe(workspaceId)}.json`);
  return {
    read(workspaceId) {
      try {
        const f = file(workspaceId);
        return f.exists ? parseList(f.textSync()) : [];
      } catch {
        return [];
      }
    },
    write(workspaceId, actions) {
      try {
        const f = file(workspaceId);
        if (actions.length === 0) {
          if (f.exists) f.delete();
        } else {
          f.writeSync(JSON.stringify(actions));
        }
      } catch {
        // Sandbox/disk error — the in-memory queue still holds the actions.
      }
    },
    workspaces() {
      try {
        return dir()
          .list()
          .filter((entry): entry is File => entry instanceof File)
          .map((f) => parseList(f.textSync())[0]?.workspaceId)
          .filter((id): id is string => Boolean(id));
      } catch {
        return [];
      }
    },
    wipe() {
      try {
        const d = new Directory(Paths.document, 'offline-queue', safe(userId));
        if (d.exists) d.delete();
      } catch {
        // ignore
      }
    },
  };
}

function webStore(userId: string): Persistence {
  const prefix = `${WEB_PREFIX}${safe(userId)}:`;
  const storage = (): Storage | null => {
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch {
      return null;
    }
  };
  const keys = () => {
    const s = storage();
    const out: string[] = [];
    if (!s) return out;
    for (let i = 0; i < s.length; i += 1) {
      const key = s.key(i);
      if (key?.startsWith(prefix)) out.push(key);
    }
    return out;
  };
  return {
    read: (workspaceId) => parseList(storage()?.getItem(prefix + workspaceId)),
    write(workspaceId, actions) {
      try {
        if (actions.length === 0) storage()?.removeItem(prefix + workspaceId);
        else storage()?.setItem(prefix + workspaceId, JSON.stringify(actions));
      } catch {
        // Quota — in-memory only.
      }
    },
    workspaces: () => keys().map((key) => key.slice(prefix.length)),
    wipe() {
      for (const key of keys()) storage()?.removeItem(key);
    },
  };
}

// --- observable state ------------------------------------------------------

interface QueueSnapshot {
  userId: string | null;
  byWorkspace: Readonly<Record<string, readonly QueuedAction[]>>;
  syncing: boolean;
}

let snapshot: QueueSnapshot = { userId: null, byWorkspace: {}, syncing: false };
const listeners = new Set<() => void>();

function setSnapshot(next: Partial<QueueSnapshot>) {
  snapshot = { ...snapshot, ...next };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => snapshot;

// --- the queue for the signed-in user --------------------------------------

let active: {
  userId: string;
  queue: OfflineActionQueue;
  store: Persistence;
} | null = null;

function invalidateWorkspace(workspaceId: string) {
  void queryClient.invalidateQueries({
    queryKey: queryKeys.workTools.all(workspaceId),
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.notifications.all(workspaceId),
  });
}

function createQueue(userId: string) {
  const base = isWeb ? webStore(userId) : fileStore(userId);
  // Mirror every write into the observable snapshot (screens show what is
  // still waiting, e.g. an unsent comment).
  const store: Persistence = {
    ...base,
    write(workspaceId, actions) {
      base.write(workspaceId, actions);
      const previous = snapshot.byWorkspace[workspaceId]?.length ?? 0;
      setSnapshot({
        byWorkspace: { ...snapshot.byWorkspace, [workspaceId]: [...actions] },
      });
      // Something drained — let the screens refetch the server's version.
      if (actions.length < previous) invalidateWorkspace(workspaceId);
    },
  };
  const queue = new OfflineActionQueue(store, undefined, (_ws, action) => {
    Alert.alert(
      "A change couldn't be saved",
      `While you were offline you made ${describeDroppedAction(action)}. ` +
        'The server rejected it (it may have been changed or removed by ' +
        'someone else, or you no longer have access), so it was not applied.',
    );
  });
  registerExecutors(queue);
  return { userId, queue, store };
}

function registerExecutors(queue: OfflineActionQueue) {
  queue.registerExecutor(MOBILE_OFFLINE_ACTION.TaskCreate, async (p, ws) => {
    const { input } = p as {
      input: Parameters<typeof workToolsApi.createTask>[1];
    };
    await workToolsApi.createTask(ws, input);
  });
  queue.registerExecutor(MOBILE_OFFLINE_ACTION.TaskUpdate, async (p, ws) => {
    const { taskId, input } = p as {
      taskId: string;
      input: Parameters<typeof workToolsApi.updateTask>[2];
    };
    await workToolsApi.updateTask(ws, taskId, input);
  });
  queue.registerExecutor(
    MOBILE_OFFLINE_ACTION.TaskCommentCreate,
    async (p, ws) => {
      const { taskId, input } = p as {
        taskId: string;
        input: Parameters<typeof workToolsApi.addTaskComment>[2];
      };
      await workToolsApi.addTaskComment(ws, taskId, input);
    },
  );
  queue.registerExecutor(
    MOBILE_OFFLINE_ACTION.NotificationMarkRead,
    async (p, ws) => {
      const { notificationId } = p as { notificationId: string };
      await notificationApi.markRead(ws, notificationId);
    },
  );
  queue.registerExecutor(
    MOBILE_OFFLINE_ACTION.NotificationMarkAllRead,
    async (_p, ws) => {
      await notificationApi.markAllRead(ws);
    },
  );
}

function activate(userId: string | null) {
  if (active?.userId === userId) return;
  if (!userId) {
    active = null;
    setSnapshot({ userId: null, byWorkspace: {} });
    return;
  }
  active = createQueue(userId);
  const byWorkspace: Record<string, QueuedAction[]> = {};
  for (const ws of active.store.workspaces()) {
    byWorkspace[ws] = active.store.read(ws);
  }
  setSnapshot({ userId, byWorkspace });
}

function isOnline(): boolean {
  return onlineManager.isOnline();
}

/** Drains every workspace's queue for the signed-in user, oldest first. */
export async function replayOfflineQueue(): Promise<void> {
  const current = active;
  if (!current || !isOnline() || snapshot.syncing) return;
  const workspaces = Object.entries(snapshot.byWorkspace)
    .filter(([, list]) => list.length > 0)
    .map(([ws]) => ws);
  if (workspaces.length === 0) return;
  setSnapshot({ syncing: true });
  try {
    for (const ws of workspaces) {
      if (active !== current || !isOnline()) break;
      await current.queue.replay(ws);
    }
  } finally {
    setSnapshot({ syncing: false });
  }
}

/** Used by mutations: send now, or keep it for when the network is back. */
export function sendOrQueueAction<T>(
  request: QueueableRequest<T>,
): Promise<QueueOutcome<T>> {
  const current = active;
  // No signed-in queue (should not happen inside the app) — just send.
  if (!current) {
    return request.send().then((result) => ({ status: 'sent', result }));
  }
  return sendOrQueue(current.queue, isOnline(), request);
}

/** Explicit sign-out: this user's unsent changes go with the session. */
function discardActiveQueue() {
  active?.store.wipe();
  if (active) active = createQueue(active.userId);
  setSnapshot({ byWorkspace: {} });
}

// --- hooks ------------------------------------------------------------------

/**
 * Mount once inside the signed-in app: binds the queue to the user, replays
 * on reconnect / foreground / start, and drops it on explicit sign-out.
 */
export function useOfflineQueueSync() {
  const { user, registerSignOutHook } = useSession();
  const userId = user?.id ?? null;

  useEffect(() => {
    activate(userId);
    void replayOfflineQueue();
  }, [userId]);

  useEffect(
    () =>
      registerSignOutHook(async () => {
        discardActiveQueue();
      }),
    [registerSignOutHook],
  );

  useEffect(() => {
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      if (state.isConnected !== false) void replayOfflineQueue();
    });
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') void replayOfflineQueue();
    });
    return () => {
      unsubscribeNet();
      appState.remove();
    };
  }, []);
}

export interface OfflineQueueStatus {
  /** Changes waiting across all of this user's workspaces. */
  pending: number;
  syncing: boolean;
}

export function useOfflineQueueStatus(): OfflineQueueStatus {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  let pending = 0;
  for (const list of Object.values(state.byWorkspace)) pending += list.length;
  return { pending, syncing: state.syncing };
}

const EMPTY: readonly QueuedAction[] = [];

/** What is still waiting in one workspace (stable reference between edits). */
export function usePendingActions(
  workspaceId: string,
): readonly QueuedAction[] {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return state.byWorkspace[workspaceId] ?? EMPTY;
}

/** Pending count without subscribing, for one-off dialogs (sign-out). */
export function pendingOfflineCount(): number {
  let pending = 0;
  for (const list of Object.values(snapshot.byWorkspace))
    pending += list.length;
  return pending;
}
