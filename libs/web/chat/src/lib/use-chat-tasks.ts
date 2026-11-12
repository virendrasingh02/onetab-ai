import { contextLinksApi, queryKeys, workToolsApi } from '@org/api-client';
import {
  TaskPriority,
  TaskStatus,
  type ProjectDetail,
  type Task,
} from '@org/types';
import { toast } from '@org/ui';
import { useWorkspaceStore } from '@org/web-workspace';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { create } from 'zustand';
import { useMatrix } from './matrix-provider.js';

/** A task being raised from a conversation, before it has a project. */
export interface ChatTaskDraft {
  title: string;
  description?: string;
  /** Platform user id, never a Matrix id. */
  assigneeId?: string;
  /** Room it was raised in: remembers the project and can receive the link. */
  roomId?: string | null;
  /** The message it came from, linked to the task as context. */
  sourceMessageId?: string;
}

export interface ChatTaskFields {
  title: string;
  description?: string | null;
  projectId: string | null;
  assigneeId?: string | null;
  priority?: TaskPriority;
  dueDate?: string | null;
  /** Post the new task's link back into the conversation it came from. */
  share?: boolean;
}

interface ChatTaskDraftState {
  draft: ChatTaskDraft | null;
  open: (draft: ChatTaskDraft) => void;
  close: () => void;
}

/** The one "New task" dialog (`ChatTaskDialogHost`) renders whatever is here. */
export const useChatTaskDraft = create<ChatTaskDraftState>((set) => ({
  draft: null,
  open: (draft) => set({ draft }),
  close: () => set({ draft: null }),
}));

/*
 * The project a conversation's tasks last went to, per browser. A convenience
 * only: the dialog and the quick paths work without it.
 */
const STORAGE_KEY = 'onetab_chat_task_project';

function readRemembered(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function rememberedProjectId(
  workspaceId: string,
  roomId?: string | null,
): string | undefined {
  const map = readRemembered();
  return (roomId ? map[roomId] : undefined) ?? map[`ws:${workspaceId}`];
}

function rememberProject(
  workspaceId: string,
  roomId: string | null | undefined,
  projectId: string,
) {
  try {
    const map = readRemembered();
    map[`ws:${workspaceId}`] = projectId;
    if (roomId) map[roomId] = projectId;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Storage is unavailable; the picker simply starts on the first project.
  }
}

/** In-app path that opens a task on its project's board. */
export function taskPath(
  workspaceSlug: string,
  project: Pick<ProjectDetail, 'slug'> | undefined,
  taskId: string,
): string {
  return project
    ? `/w/${workspaceSlug}/projects/${project.slug}?card=${taskId}`
    : `/w/${workspaceSlug}/projects?card=${taskId}`;
}

/**
 * Creating tasks from a conversation: the message action, "Assign to me" and
 * the `/task` and `/assign` commands all go through here, so every one of them
 * lands the task in a project and offers a link that opens it.
 */
export function useChatTasks() {
  // The store, not the route: the dialog host renders above the routes.
  const workspace = useWorkspaceStore((state) => state.activeWorkspace);
  const workspaceId = workspace?.id;
  const slug = workspace?.slug;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { client } = useMatrix();
  const openDraft = useChatTaskDraft((state) => state.open);

  const loadProjects = useCallback(
    () =>
      queryClient.fetchQuery({
        queryKey: queryKeys.workTools.projects(workspaceId ?? ''),
        queryFn: () => workToolsApi.projects(workspaceId as string),
        staleTime: 30_000,
      }),
    [queryClient, workspaceId],
  );

  /** Creates the task for real. Rejects on failure. */
  const createTask = useCallback(
    async (draft: ChatTaskDraft, fields: ChatTaskFields): Promise<Task> => {
      if (!workspaceId) throw new Error('Open a workspace to create tasks.');
      const task = await workToolsApi.createTask(workspaceId, {
        title: fields.title.slice(0, 200),
        description: fields.description || null,
        status: TaskStatus.TODO,
        priority: fields.priority ?? TaskPriority.MEDIUM,
        projectId: fields.projectId,
        assigneeId: fields.assigneeId ?? null,
        assigneeIds: fields.assigneeId ? [fields.assigneeId] : [],
        dueDate: fields.dueDate ?? null,
      });

      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.workTools.all(workspaceId), 'tasks'],
      });
      if (fields.projectId) {
        rememberProject(workspaceId, draft.roomId, fields.projectId);
      }
      if (draft.sourceMessageId) {
        // Powers "View related context"; the task exists either way.
        void contextLinksApi
          .createLink(workspaceId, {
            sourceType: 'message',
            sourceId: draft.sourceMessageId,
            targetType: 'task',
            targetId: task.id,
            linkType: 'RESOLVES',
          })
          .catch(() => undefined);
      }

      const projects =
        queryClient.getQueryData<ProjectDetail[]>(
          queryKeys.workTools.projects(workspaceId),
        ) ?? [];
      const project = projects.find((entry) => entry.id === fields.projectId);
      const path = slug ? taskPath(slug, project, task.id) : undefined;

      if (fields.share && draft.roomId && client && path) {
        void client
          .sendMessage(
            draft.roomId,
            `Task created: ${task.title}\n${window.location.origin}${path}`,
          )
          .catch(() =>
            toast.error('The task was created, but could not be posted here.'),
          );
      }

      toast.success(
        project ? `Task created in ${project.name}` : 'Task created',
        {
          description: task.identifier
            ? `${task.identifier} · ${task.title}`
            : task.title,
          action:
            path && project
              ? { label: 'Open task', onClick: () => navigate(path) }
              : undefined,
        },
      );
      return task;
    },
    [workspaceId, slug, queryClient, client, navigate],
  );

  /**
   * Starts a task. `quick` skips the dialog when the project is not in doubt:
   * the one this conversation used last, or the workspace's only project.
   */
  const startTask = useCallback(
    async (draft: ChatTaskDraft, options: { quick?: boolean } = {}) => {
      if (!workspaceId) {
        toast.error('Open a workspace to create tasks.');
        return;
      }
      if (!options.quick) {
        openDraft(draft);
        return;
      }
      try {
        const projects = await loadProjects();
        const remembered = rememberedProjectId(workspaceId, draft.roomId);
        const project =
          projects.find((entry) => entry.id === remembered) ??
          (projects.length === 1 ? projects[0] : undefined);
        if (!project) {
          openDraft(draft);
          return;
        }
        await createTask(draft, {
          title: draft.title,
          description: draft.description,
          projectId: project.id,
          assigneeId: draft.assigneeId,
        });
      } catch (error) {
        toast.error(
          error instanceof Error && error.message
            ? error.message
            : 'Could not create the task.',
        );
      }
    },
    [workspaceId, openDraft, loadProjects, createTask],
  );

  return { startTask, createTask };
}
