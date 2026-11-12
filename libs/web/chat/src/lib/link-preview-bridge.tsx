import { linkPreviewApi, workToolsApi } from '@org/api-client';
import { configureLinkPreviewApi } from '@org/chat-ui';
import type { LinkPreview, TaskStatus } from '@org/types';
import { useWorkspaceStore } from '@org/web-workspace';
import { useEffect } from 'react';

/**
 * Supplies `@org/chat-ui`'s `useLinkPreviewStore` the one thing it cannot get
 * on its own: the actual `linkPreviewApi` calls. `@org/chat-ui` is `type:ui`
 * and may not depend on `@org/api-client` (`type:data-access`) — the same
 * boundary `AuthenticatedMediaBridge` works around for authenticated media —
 * so the app wires it in here, once, near the root. Mounted as a leaf
 * alongside `CallOverlayBridge`; it renders nothing of its own.
 *
 * Links to a task in this workspace never go to the unfurl service (it would
 * only see the sign-in page): they are answered from the task itself, so a
 * task pasted or posted into a conversation shows as a card that opens it.
 */
export function LinkPreviewBridge() {
  useEffect(() => {
    configureLinkPreviewApi({
      getPreview: (url) => taskLinkPreview(url) ?? linkPreviewApi.getPreview(url),
      updateMessageVisibility: linkPreviewApi.updateMessageVisibility,
      getMessageVisibility: linkPreviewApi.getMessageVisibility,
    });
    return () => configureLinkPreviewApi(null);
  }, []);

  return null;
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  BACKLOG: 'Backlog',
  TODO: 'Planned',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Completed',
  CANCELLED: 'Cancelled',
};

/** A preview for `/w/<slug>/projects…?card=<id>` in the open workspace, else `null`. */
function taskLinkPreview(raw: string): Promise<LinkPreview> | null {
  let url: URL;
  try {
    url = new URL(raw, window.location.origin);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;
  const match = /^\/w\/([^/]+)\/projects(?:\/[^/]+)?\/?$/.exec(url.pathname);
  const taskId = url.searchParams.get('card') ?? url.searchParams.get('taskId');
  const workspace = useWorkspaceStore.getState().activeWorkspace;
  if (!match || !taskId || !workspace || workspace.slug !== match[1]) {
    return null;
  }

  return workToolsApi.task(workspace.id, taskId).then((task) => {
    const assignee = task.assignee?.displayName ?? task.assignee?.name;
    const details = [
      STATUS_LABELS[task.status] ?? task.status,
      assignee ? `Assigned to ${assignee}` : 'Unassigned',
      task.dueDate
        ? `Due ${new Date(task.dueDate).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })}`
        : null,
    ].filter(Boolean);
    return {
      id: `task:${task.id}`,
      url: url.toString(),
      normalizedUrl: url.toString(),
      title: task.identifier ? `${task.identifier} · ${task.title}` : task.title,
      description: details.join(' · '),
      domain: url.host,
      siteName: 'Task',
      mediaType: 'rich',
      status: 'ready',
      visibility: 'visible',
    } satisfies LinkPreview;
  });
}
