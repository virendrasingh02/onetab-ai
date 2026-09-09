import { notificationApi, userApi } from '@org/api-client';
import type { BackgroundSyncManager } from './background-sync-manager.js';

/**
 * The allow-list of actions that may be queued while offline and replayed on
 * reconnect. Every one is idempotent read-state — replaying it late can never
 * surprise the user. Content mutations are deliberately not here (this pass).
 */
export const OFFLINE_ACTION = {
  NotificationMarkRead: 'notification.markRead',
  NotificationMarkAllRead: 'notification.markAllRead',
  NotificationDismiss: 'notification.dismiss',
  PresenceSet: 'presence.set',
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
}
