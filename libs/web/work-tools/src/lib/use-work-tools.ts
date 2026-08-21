import {
  channelApi,
  memberApi,
  queryKeys,
  workspaceApi,
  workToolsApi,
} from '@org/api-client';
import type {
  CalendarEvent,
  DocumentKind,
  ProjectDetail,
  Task,
  Whiteboard,
  WorkDocument,
  WorkspaceSummary,
} from '@org/types';
import type {
  CreateCalendarEventInput,
  CreateDocumentInput,
  CreateProjectInput,
  CreateTaskCommentInput,
  CreateTaskInput,
  CreateWhiteboardInput,
  MoveTaskInput,
  UpdateCalendarEventInput,
  UpdateDocumentInput,
  UpdateProjectInput,
  UpdateTaskInput,
  UpdateWhiteboardInput,
} from '@org/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';

/**
 * Data access for the work-tools screens.
 *
 * Everything is keyed by workspace because the API is too: the workspace is a
 * path segment the server authorises, not a filter the client chooses.
 */

// --- current workspace ------------------------------------------------------

export function useCurrentWorkspace(): {
  slug: string | undefined;
  workspace: WorkspaceSummary | undefined;
  workspaceId: string | undefined;
  isLoading: boolean;
  isError: boolean;
} {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const query = useQuery({
    queryKey: queryKeys.workspaces.detail(workspaceSlug ?? ''),
    queryFn: (): Promise<WorkspaceSummary> =>
      workspaceApi.bySlug(workspaceSlug as string),
    enabled: !!workspaceSlug,
    staleTime: 30_000,
    retry: false,
  });

  return {
    slug: workspaceSlug,
    workspace: query.data,
    workspaceId: query.data?.id,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

// --- members ----------------------------------------------------------------

export function useWorkspaceMembers(workspaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.members.list(workspaceId ?? ''),
    queryFn: () => memberApi.list(workspaceId as string),
    enabled: !!workspaceId,
  });
}

// --- channels ---------------------------------------------------------------

export function useWorkspaceChannels(
  workspaceId: string | undefined,
  includeArchived = false,
) {
  return useQuery({
    queryKey: queryKeys.channels.list(workspaceId ?? '', includeArchived),
    queryFn: () => channelApi.list(workspaceId as string, includeArchived),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
}

// --- projects ---------------------------------------------------------------

export function useProjects(workspaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.workTools.projects(workspaceId ?? ''),
    queryFn: () => workToolsApi.projects(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
}

export function useProjectMutations(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.workTools.all(workspaceId ?? ''),
    });

  const create = useMutation({
    mutationFn: (input: CreateProjectInput) =>
      workToolsApi.createProject(workspaceId as string, input),
    onSuccess: invalidate,
  });

  const projectsKey = queryKeys.workTools.projects(workspaceId ?? '');

  const update = useMutation({
    mutationFn: ({
      projectId,
      input,
    }: {
      projectId: string;
      input: UpdateProjectInput;
    }) => workToolsApi.updateProject(workspaceId as string, projectId, input),

    /**
     * Applied optimistically, for the same reason the task move is: dragging a
     * column rewrites `columnOrder`, and a column that springs back to where it
     * was while the request is in flight reads as a failed drag.
     */
    onMutate: async ({ projectId, input }) => {
      await queryClient.cancelQueries({ queryKey: projectsKey });
      const previous = queryClient.getQueryData<ProjectDetail[]>(projectsKey);

      queryClient.setQueryData<ProjectDetail[]>(projectsKey, (current) =>
        current?.map((project) =>
          project.id === projectId ? { ...project, ...input } : project,
        ),
      );

      return { previous };
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(projectsKey, context.previous);
      }
    },

    onSettled: invalidate,
  });

  const remove = useMutation({
    mutationFn: (projectId: string) =>
      workToolsApi.deleteProject(workspaceId as string, projectId),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

// --- tasks ------------------------------------------------------------------

export function useTasks(workspaceId: string | undefined, projectId?: string) {
  return useQuery({
    queryKey: queryKeys.workTools.tasks(workspaceId ?? '', projectId),
    queryFn: () => workToolsApi.tasks(workspaceId as string, projectId),
    enabled: !!workspaceId,
    staleTime: 15_000,
  });
}

export function useTaskMutations(
  workspaceId: string | undefined,
  projectId?: string,
) {
  const queryClient = useQueryClient();
  const listKey = queryKeys.workTools.tasks(workspaceId ?? '', projectId);
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.workTools.all(workspaceId ?? ''),
    });

  const create = useMutation({
    mutationFn: (input: CreateTaskInput) =>
      workToolsApi.createTask(workspaceId as string, input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: UpdateTaskInput }) =>
      workToolsApi.updateTask(workspaceId as string, taskId, input),
    onSuccess: invalidate,
  });

  /**
   * Drag-and-drop, applied optimistically.
   *
   * A card that snaps back to its old column while the request is in flight
   * reads as a failed drag, so the board is rewritten immediately and rolled
   * back only if the server refuses.
   */
  const move = useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: MoveTaskInput }) =>
      workToolsApi.moveTask(workspaceId as string, taskId, input),

    onMutate: async ({ taskId, input }) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<Task[]>(listKey);

      queryClient.setQueryData<Task[]>(listKey, (current) =>
        current?.map((task) =>
          task.id === taskId
            ? { ...task, status: input.status, orderIndex: input.orderIndex }
            : task,
        ),
      );

      return { previous };
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(listKey, context.previous);
    },

    onSettled: invalidate,
  });

  const remove = useMutation({
    mutationFn: (taskId: string) =>
      workToolsApi.deleteTask(workspaceId as string, taskId),
    onSuccess: invalidate,
  });

  return { create, update, move, remove };
}

export function useTaskComments(
  workspaceId: string | undefined,
  taskId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.workTools.taskComments(workspaceId ?? '', taskId ?? ''),
    queryFn: () =>
      workToolsApi.taskComments(workspaceId as string, taskId as string),
    enabled: !!workspaceId && !!taskId,
  });
}

export function useAddTaskComment(
  workspaceId: string | undefined,
  taskId: string | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTaskCommentInput) =>
      workToolsApi.addTaskComment(
        workspaceId as string,
        taskId as string,
        input,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.workTools.taskComments(
          workspaceId ?? '',
          taskId ?? '',
        ),
      });
      // The card tile shows a comment count, so the board is stale too.
      queryClient.invalidateQueries({
        queryKey: queryKeys.workTools.tasks(workspaceId ?? ''),
      });
    },
  });
}

/** Groups tasks into their board columns, ordered as the board draws them. */
export function groupTasksByStatus(tasks: Task[] | undefined) {
  const columns = new Map<string, Task[]>();
  for (const task of tasks ?? []) {
    const bucket = columns.get(task.status);
    if (bucket) bucket.push(task);
    else columns.set(task.status, [task]);
  }
  for (const bucket of columns.values()) {
    bucket.sort((a, b) => a.orderIndex - b.orderIndex);
  }
  return columns;
}

// --- calendar ---------------------------------------------------------------

export function useCalendarEvents(
  workspaceId: string | undefined,
  from?: string,
  to?: string,
) {
  return useQuery({
    queryKey: queryKeys.workTools.calendar(workspaceId ?? '', from, to),
    queryFn: () => workToolsApi.calendar(workspaceId as string, from, to),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
}

export function useCalendarMutations(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.workTools.all(workspaceId ?? ''),
    });

  const create = useMutation({
    mutationFn: (input: CreateCalendarEventInput) =>
      workToolsApi.createEvent(workspaceId as string, input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({
      eventId,
      input,
    }: {
      eventId: string;
      input: UpdateCalendarEventInput;
    }) => workToolsApi.updateEvent(workspaceId as string, eventId, input),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (eventId: string) =>
      workToolsApi.deleteEvent(workspaceId as string, eventId),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

// --- documents --------------------------------------------------------------

export function useDocuments(
  workspaceId: string | undefined,
  kind?: DocumentKind,
) {
  return useQuery({
    queryKey: queryKeys.workTools.documents(workspaceId ?? '', kind),
    queryFn: () => workToolsApi.documents(workspaceId as string, kind),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
}

export function useDocument(
  workspaceId: string | undefined,
  docId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.workTools.document(workspaceId ?? '', docId ?? ''),
    queryFn: () => workToolsApi.document(workspaceId as string, docId as string),
    enabled: !!workspaceId && !!docId,
    retry: false,
  });
}

export function useDocumentMutations(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.workTools.all(workspaceId ?? ''),
    });

  const create = useMutation({
    mutationFn: (input: CreateDocumentInput) =>
      workToolsApi.createDocument(workspaceId as string, input),
    onSuccess: invalidate,
  });

  /**
   * Saves an edit without invalidating on every keystroke.
   *
   * The editor is the source of truth while it is focused, so the response is
   * written straight into the cache; a refetch here would fight the user's
   * cursor.
   */
  const update = useMutation({
    mutationFn: ({ docId, input }: { docId: string; input: UpdateDocumentInput }) =>
      workToolsApi.updateDocument(workspaceId as string, docId, input),
    onSuccess: (doc) => {
      queryClient.setQueryData(
        queryKeys.workTools.document(workspaceId ?? '', doc.id),
        doc,
      );
      queryClient.invalidateQueries({
        queryKey: queryKeys.workTools.documents(workspaceId ?? ''),
      });
    },
  });

  const remove = useMutation({
    mutationFn: (docId: string) =>
      workToolsApi.deleteDocument(workspaceId as string, docId),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

// --- whiteboards ------------------------------------------------------------

export function useWhiteboards(workspaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.workTools.whiteboards(workspaceId ?? ''),
    queryFn: () => workToolsApi.whiteboards(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
}

export function useWhiteboard(
  workspaceId: string | undefined,
  whiteboardId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.workTools.whiteboard(
      workspaceId ?? '',
      whiteboardId ?? '',
    ),
    queryFn: () =>
      workToolsApi.whiteboard(workspaceId as string, whiteboardId as string),
    enabled: !!workspaceId && !!whiteboardId,
    retry: false,
  });
}

export function useWhiteboardMutations(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.workTools.all(workspaceId ?? ''),
    });

  const create = useMutation({
    mutationFn: (input: CreateWhiteboardInput) =>
      workToolsApi.createWhiteboard(workspaceId as string, input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({
      whiteboardId,
      input,
    }: {
      whiteboardId: string;
      input: UpdateWhiteboardInput;
    }) =>
      workToolsApi.updateWhiteboard(workspaceId as string, whiteboardId, input),
    onSuccess: (board) => {
      queryClient.setQueryData(
        queryKeys.workTools.whiteboard(workspaceId ?? '', board.id),
        board,
      );
    },
  });

  const remove = useMutation({
    mutationFn: (whiteboardId: string) =>
      workToolsApi.deleteWhiteboard(workspaceId as string, whiteboardId),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

export type {
  CalendarEvent,
  ProjectDetail,
  Task,
  Whiteboard,
  WorkDocument,
};
