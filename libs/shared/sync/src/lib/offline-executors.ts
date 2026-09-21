import { notificationApi, userApi, workToolsApi } from '@org/api-client';
import type { CreateTaskCommentInput, CreateTaskInput } from '@org/validation';
import type { BackgroundSyncManager } from './background-sync-manager.js';

/**
 * The allow-list of actions that may be queued while offline and replayed on
 * reconnect. The read-state ones (notification.*, presence.set) are
 * idempotent, so a late replay can never surprise the user. `task.create` and
 * `taskComment.create` are content mutations — each queued entry is a
 * distinct creation (never deduped against another), and a replay that comes
 * back permission/validation/conflict-class drops the entry and surfaces it
 * via `lastDroppedAction` (`sync-store.ts`) instead of silently discarding it.
 */
export const OFFLINE_ACTION = {
  NotificationMarkRead: 'notification.markRead',
  NotificationMarkAllRead: 'notification.markAllRead',
  NotificationDismiss: 'notification.dismiss',
  PresenceSet: 'presence.set',
  TaskCreate: 'task.create',
  TaskCommentCreate: 'taskComment.create',
} as const;

export function registerDefaultOfflineExecutors(
  manager: BackgroundSyncManager,
): void {
  manager.registerOfflineExecutor(
    OFFLINE_ACTION.NotificationMarkRead,
    async (payload, workspaceId) => {
      const { notificationId } = payload as { notificationId: string };
      await notificationApi.markRead(workspaceId, notificationId);
    },
  );

  manager.registerOfflineExecutor(
    OFFLINE_ACTION.NotificationMarkAllRead,
    async (_payload, workspaceId) => {
      await notificationApi.markAllRead(workspaceId);
    },
  );

  manager.registerOfflineExecutor(
    OFFLINE_ACTION.NotificationDismiss,
    async (payload, workspaceId) => {
      const { notificationId } = payload as { notificationId: string };
      await notificationApi.dismiss(workspaceId, notificationId);
    },
  );

  manager.registerOfflineExecutor(
    OFFLINE_ACTION.PresenceSet,
    async (payload) => {
      const { status } = payload as {
        status: Parameters<typeof userApi.setPresence>[0];
      };
      await userApi.setPresence(status);
    },
  );

  manager.registerOfflineExecutor(
    OFFLINE_ACTION.TaskCreate,
    async (payload, workspaceId) => {
      const { input } = payload as { input: CreateTaskInput };
      await workToolsApi.createTask(workspaceId, input);
    },
  );

  manager.registerOfflineExecutor(
    OFFLINE_ACTION.TaskCommentCreate,
    async (payload, workspaceId) => {
      const { taskId, input } = payload as {
        taskId: string;
        input: CreateTaskCommentInput;
      };
      await workToolsApi.addTaskComment(workspaceId, taskId, input);
    },
  );
}
