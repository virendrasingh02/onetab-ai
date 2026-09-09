import { queryKeys } from '@org/api-client';
import { RealtimeEventType, type RealtimeEvent } from '@org/realtime';
import type { QueryClient } from '@tanstack/react-query';
import { syncMetrics } from './sync-metrics.js';

export interface InvalidationContext {
  queryClient: QueryClient;
  /** The workspace the app is currently showing. */
  workspaceId: string;
}

/**
 * The single source of truth for "a realtime event arrived — which cached
 * queries are now stale?". This logic previously lived inline in
 * `RealtimeProvider`; the background sync manager now drives it so that
 * scheduled polls, catch-up reconciliation and realtime events all go through
 * one consistent invalidation map.
 *
 * Returns the number of query keys invalidated (0 if the event was ignored),
 * for metrics.
 *
 * Workspace safety: an event whose `workspaceId` does not match the active
 * workspace is dropped. The server already scopes its fan-out per workspace;
 * this is defence in depth so a stray cross-tab broadcast can never touch
 * another workspace's cache.
 */
export function applyRealtimeEvent(
  event: RealtimeEvent,
  ctx: InvalidationContext,
): number {
  const { queryClient, workspaceId } = ctx;
  if (!workspaceId) return 0;

  const eventWorkspaceId =
    (event.workspaceId ?? undefined) ||
    ((event.payload as { workspaceId?: string } | undefined)?.workspaceId ??
      undefined);

  // User-scoped events (notifications, mentions) carry the workspace on the
  // payload; workspace-scoped events carry it at the top level. If we can see a
  // workspace id at all and it is not ours, drop it.
  if (eventWorkspaceId && eventWorkspaceId !== workspaceId) {
    syncMetrics.bump('realtimeDropped');
    return 0;
  }

  const ws = workspaceId;
  const invalidated: unknown[][] = [];
  const invalidate = (queryKey: readonly unknown[]) => {
    queryClient.invalidateQueries({ queryKey: queryKey as unknown[] });
    invalidated.push(queryKey as unknown[]);
  };

  switch (event.type) {
    case RealtimeEventType.NotificationCreated: {
      const payload = event.payload as
        | { notification?: { kind?: string } }
        | undefined;
      if (!payload?.notification) break;
      invalidate(queryKeys.notifications.unreadCount(ws));
      invalidate(queryKeys.notifications.list(ws, false));
      invalidate(queryKeys.notifications.list(ws, true));
      invalidate(queryKeys.notifications.feed(ws));
      // A swept temporary membership has no client mutation to refresh the
      // recipient's channel list — nudge it so the channel drops from their
      // sidebar right away rather than on the next poll.
      if (payload.notification.kind === 'CHANNEL_ACCESS_EXPIRED') {
        invalidate(queryKeys.channels.all(ws));
      }
      break;
    }

    case RealtimeEventType.NotificationRead: {
      invalidate(queryKeys.notifications.unreadCount(ws));
      invalidate(queryKeys.notifications.list(ws, false));
      invalidate(queryKeys.notifications.list(ws, true));
      break;
    }

    case RealtimeEventType.MentionCreated: {
      invalidate(queryKeys.notifications.unreadCount(ws));
      invalidate(queryKeys.notifications.feed(ws));
      invalidate(queryKeys.notifications.list(ws, false));
      invalidate(queryKeys.notifications.list(ws, true));
      break;
    }

    case RealtimeEventType.TaskCreated:
    case RealtimeEventType.TaskDeleted:
    case RealtimeEventType.KanbanUpdated: {
      invalidate(['work-tools', ws, 'tasks']);
      break;
    }

    case RealtimeEventType.TaskUpdated:
    case RealtimeEventType.TaskAssigned: {
      const taskId = (event.payload as { taskId?: string } | undefined)?.taskId;
      if (taskId) invalidate(queryKeys.workTools.task(ws, taskId));
      invalidate(['work-tools', ws, 'tasks']);
      break;
    }

    case RealtimeEventType.CommentCreated:
    case RealtimeEventType.CommentUpdated: {
      const taskId = (event.payload as { taskId?: string } | undefined)?.taskId;
      if (taskId) invalidate(queryKeys.workTools.taskComments(ws, taskId));
      break;
    }

    case RealtimeEventType.ProjectUpdated: {
      const projectId = (event.payload as { projectId?: string } | undefined)
        ?.projectId;
      if (projectId) invalidate(queryKeys.workTools.project(ws, projectId));
      invalidate(['work-tools', ws, 'projects']);
      break;
    }

    case RealtimeEventType.ChannelCreated:
    case RealtimeEventType.ChannelUpdated:
    case RealtimeEventType.ChannelDeleted: {
      invalidate(queryKeys.channels.all(ws));
      break;
    }

    case RealtimeEventType.WorkspaceMemberUpdated:
    case RealtimeEventType.UserStatusChanged: {
      invalidate(queryKeys.members.all(ws));
      break;
    }

    case RealtimeEventType.WorkspaceUpdated: {
      invalidate(queryKeys.workspaces.all());
      break;
    }

    case RealtimeEventType.InvitationCreated:
    case RealtimeEventType.InvitationUpdated: {
      invalidate(queryKeys.invitations.all(ws));
      break;
    }

    case RealtimeEventType.HuddleUpdated: {
      invalidate(['huddle', ws]);
      break;
    }

    case RealtimeEventType.SettingsUpdated: {
      const category = (event.payload as { category?: string } | undefined)
        ?.category;
      if (category === 'notifications') {
        invalidate(queryKeys.notifications.preferences(ws));
      }
      break;
    }

    // Message events are delivered through the Matrix client, not SSE; if one
    // does arrive over the socket it only affects the activity feed.
    case RealtimeEventType.MessageCreated:
    case RealtimeEventType.MessageUpdated:
    case RealtimeEventType.MessageDeleted: {
      invalidate(queryKeys.notifications.feed(ws));
      break;
    }

    default:
      break;
  }

  if (invalidated.length > 0) {
    syncMetrics.bump('realtimeApplied');
  } else {
    syncMetrics.bump('realtimeDropped');
  }
  return invalidated.length;
}

/** The realtime event types this map knows how to act on. */
export const HANDLED_REALTIME_EVENTS: string[] = [
  RealtimeEventType.NotificationCreated,
  RealtimeEventType.NotificationRead,
  RealtimeEventType.MentionCreated,
  RealtimeEventType.TaskCreated,
  RealtimeEventType.TaskUpdated,
  RealtimeEventType.TaskDeleted,
  RealtimeEventType.TaskAssigned,
  RealtimeEventType.KanbanUpdated,
  RealtimeEventType.CommentCreated,
  RealtimeEventType.CommentUpdated,
  RealtimeEventType.ProjectUpdated,
  RealtimeEventType.ChannelCreated,
  RealtimeEventType.ChannelUpdated,
  RealtimeEventType.ChannelDeleted,
  RealtimeEventType.WorkspaceMemberUpdated,
  RealtimeEventType.UserStatusChanged,
  RealtimeEventType.WorkspaceUpdated,
  RealtimeEventType.InvitationCreated,
  RealtimeEventType.InvitationUpdated,
  RealtimeEventType.HuddleUpdated,
  RealtimeEventType.SettingsUpdated,
  RealtimeEventType.MessageCreated,
  RealtimeEventType.MessageUpdated,
  RealtimeEventType.MessageDeleted,
];
