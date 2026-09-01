import {
  channelApi,
  memberApi,
  queryKeys,
  workspaceApi,
  workToolsApi,
} from '@org/api-client';
import type {
  CalendarEvent,
  Cycle,
  DocumentKind,
  Epic,
  Initiative,
  IntakeRequest,
  Meeting,
  MeetingDetail,
  Module,
  ProjectDetail,
  ProjectUpdate,
  SavedView,
  Task,
  Team,
  Whiteboard,
  WorkDocument,
  WorkItemRelation,
  WorkspaceSummary,
} from '@org/types';
import type {
  ConvertIntakeRequestInput,
  CreateCalendarEventInput,
  CreateCycleInput,
  CreateDocumentInput,
  CreateEpicInput,
  CreateInitiativeInput,
  CreateIntakeRequestInput,
  CreateMeetingActionItemInput,
  CreateMeetingDecisionInput,
  CreateMeetingInput,
  CreateMeetingNoteInput,
  CreateModuleInput,
  CreateProjectInput,
  CreateProjectUpdateInput,
  CreateSavedViewInput,
  CreateTaskCommentInput,
  CreateTaskInput,
  CreateTeamInput,
  CreateWhiteboardInput,
  CreateWorkItemRelationInput,
  MeetingParticipantsInput,
  MeetingRsvpInput,
  MoveTaskInput,
  ProjectIdentifierSettingsInput,
  UpdateCalendarEventInput,
  UpdateCycleInput,
  UpdateDocumentInput,
  UpdateEpicInput,
  UpdateInitiativeInput,
  UpdateMeetingInput,
  UpdateModuleInput,
  UpdateProjectInput,
  UpdateSavedViewInput,
  UpdateTaskInput,
  UpdateTeamInput,
  UpdateWhiteboardInput,
} from '@org/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';

/**
 * Data access for the work-tools screens.
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

// --- teams ------------------------------------------------------------------

export function useTeams(workspaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.workTools.teams(workspaceId ?? ''),
    queryFn: () => workToolsApi.teams(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
}

export function useTeamMutations(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.workTools.teams(workspaceId ?? ''),
    });

  const create = useMutation({
    mutationFn: (input: CreateTeamInput) =>
      workToolsApi.createTeam(workspaceId as string, input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ teamId, input }: { teamId: string; input: UpdateTeamInput }) =>
      workToolsApi.updateTeam(workspaceId as string, teamId, input),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (teamId: string) =>
      workToolsApi.deleteTeam(workspaceId as string, teamId),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

// --- initiatives ------------------------------------------------------------

export function useInitiatives(workspaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.workTools.initiatives(workspaceId ?? ''),
    queryFn: () => workToolsApi.initiatives(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
}

export function useInitiativeMutations(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.workTools.initiatives(workspaceId ?? ''),
    });

  const create = useMutation({
    mutationFn: (input: CreateInitiativeInput) =>
      workToolsApi.createInitiative(workspaceId as string, input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({
      initiativeId,
      input,
    }: {
      initiativeId: string;
      input: UpdateInitiativeInput;
    }) => workToolsApi.updateInitiative(workspaceId as string, initiativeId, input),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (initiativeId: string) =>
      workToolsApi.deleteInitiative(workspaceId as string, initiativeId),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

// --- projects ---------------------------------------------------------------

export function useProjects(workspaceId: string | undefined, teamId?: string) {
  return useQuery({
    queryKey: queryKeys.workTools.projects(workspaceId ?? '', teamId),
    queryFn: () => workToolsApi.projects(workspaceId as string, teamId),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
}

export function useProjectDetail(
  workspaceId: string | undefined,
  projectId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.workTools.project(workspaceId ?? '', projectId ?? ''),
    queryFn: () => workToolsApi.project(workspaceId as string, projectId as string),
    enabled: !!workspaceId && !!projectId,
    staleTime: 15_000,
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

  const update = useMutation({
    mutationFn: ({
      projectId,
      input,
    }: {
      projectId: string;
      input: UpdateProjectInput;
    }) => workToolsApi.updateProject(workspaceId as string, projectId, input),
    onSuccess: invalidate,
  });

  const updateIdentifierSettings = useMutation({
    mutationFn: ({
      projectId,
      input,
    }: {
      projectId: string;
      input: ProjectIdentifierSettingsInput;
    }) =>
      workToolsApi.updateIdentifierSettings(
        workspaceId as string,
        projectId,
        input,
      ),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (projectId: string) =>
      workToolsApi.deleteProject(workspaceId as string, projectId),
    onSuccess: invalidate,
  });

  return { create, update, updateIdentifierSettings, remove };
}

// --- epics & modules & cycles -----------------------------------------------

export function useEpics(
  workspaceId: string | undefined,
  projectId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.workTools.epics(workspaceId ?? '', projectId ?? ''),
    queryFn: () =>
      workToolsApi.epics(workspaceId as string, projectId as string),
    enabled: !!workspaceId && !!projectId,
  });
}

export function useEpicMutations(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.workTools.all(workspaceId ?? ''),
    });

  const create = useMutation({
    mutationFn: (input: CreateEpicInput) =>
      workToolsApi.createEpic(workspaceId as string, input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ epicId, input }: { epicId: string; input: UpdateEpicInput }) =>
      workToolsApi.updateEpic(workspaceId as string, epicId, input),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (epicId: string) =>
      workToolsApi.deleteEpic(workspaceId as string, epicId),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

export function useModules(
  workspaceId: string | undefined,
  projectId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.workTools.modules(workspaceId ?? '', projectId ?? ''),
    queryFn: () =>
      workToolsApi.modules(workspaceId as string, projectId as string),
    enabled: !!workspaceId && !!projectId,
  });
}

export function useModuleMutations(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.workTools.all(workspaceId ?? ''),
    });

  const create = useMutation({
    mutationFn: (input: CreateModuleInput) =>
      workToolsApi.createModule(workspaceId as string, input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({
      moduleId,
      input,
    }: {
      moduleId: string;
      input: UpdateModuleInput;
    }) => workToolsApi.updateModule(workspaceId as string, moduleId, input),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (moduleId: string) =>
      workToolsApi.deleteModule(workspaceId as string, moduleId),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

export function useCycles(
  workspaceId: string | undefined,
  projectId?: string,
  teamId?: string,
) {
  return useQuery({
    queryKey: queryKeys.workTools.cycles(workspaceId ?? '', projectId, teamId),
    queryFn: () => workToolsApi.cycles(workspaceId as string, projectId, teamId),
    enabled: !!workspaceId,
  });
}

export function useCycleMutations(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.workTools.cycles(workspaceId ?? ''),
    });

  const create = useMutation({
    mutationFn: (input: CreateCycleInput) =>
      workToolsApi.createCycle(workspaceId as string, input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({
      cycleId,
      input,
    }: {
      cycleId: string;
      input: UpdateCycleInput;
    }) => workToolsApi.updateCycle(workspaceId as string, cycleId, input),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (cycleId: string) =>
      workToolsApi.deleteCycle(workspaceId as string, cycleId),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

// --- tasks / universal work items -------------------------------------------

export function useTasks(
  workspaceId: string | undefined,
  params?: {
    projectId?: string;
    teamId?: string;
    cycleId?: string;
    epicId?: string;
    moduleId?: string;
    assigneeId?: string;
    search?: string;
  } | string,
) {
  const projectId = typeof params === 'string' ? params : params?.projectId;
  const filterParams = typeof params === 'object' ? params : undefined;

  return useQuery({
    queryKey: queryKeys.workTools.tasks(
      workspaceId ?? '',
      projectId,
      filterParams,
    ),
    queryFn: () => workToolsApi.tasks(workspaceId as string, params),
    enabled: !!workspaceId,
    staleTime: 15_000,
  });
}

export function useTaskDetail(
  workspaceId: string | undefined,
  taskId: string | null | undefined,
) {
  return useQuery({
    queryKey: queryKeys.workTools.task(workspaceId ?? '', taskId ?? ''),
    queryFn: () => workToolsApi.task(workspaceId as string, taskId as string),
    enabled: !!workspaceId && !!taskId,
  });
}

export function useTaskMutations(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
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

  const move = useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: MoveTaskInput }) =>
      workToolsApi.moveTask(workspaceId as string, taskId, input),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (taskId: string) =>
      workToolsApi.deleteTask(workspaceId as string, taskId),
    onSuccess: invalidate,
  });

  return { create, update, move, remove };
}

// --- relations --------------------------------------------------------------

export function useWorkItemRelations(
  workspaceId: string | undefined,
  taskId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.workTools.relations(workspaceId ?? '', taskId ?? ''),
    queryFn: () =>
      workToolsApi.relations(workspaceId as string, taskId as string),
    enabled: !!workspaceId && !!taskId,
  });
}

export function useRelationMutations(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.workTools.all(workspaceId ?? ''),
    });

  const addRelation = useMutation({
    mutationFn: (input: CreateWorkItemRelationInput) =>
      workToolsApi.addRelation(workspaceId as string, input),
    onSuccess: invalidate,
  });

  const removeRelation = useMutation({
    mutationFn: (relationId: string) =>
      workToolsApi.deleteRelation(workspaceId as string, relationId),
    onSuccess: invalidate,
  });

  return { addRelation, removeRelation };
}

// --- saved views ------------------------------------------------------------

export function useSavedViews(
  workspaceId: string | undefined,
  projectId?: string,
  teamId?: string,
) {
  return useQuery({
    queryKey: queryKeys.workTools.savedViews(workspaceId ?? '', projectId, teamId),
    queryFn: () => workToolsApi.savedViews(workspaceId as string, projectId, teamId),
    enabled: !!workspaceId,
  });
}

export function useSavedViewMutations(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.workTools.savedViews(workspaceId ?? ''),
    });

  const create = useMutation({
    mutationFn: (input: CreateSavedViewInput) =>
      workToolsApi.createSavedView(workspaceId as string, input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ viewId, input }: { viewId: string; input: UpdateSavedViewInput }) =>
      workToolsApi.updateSavedView(workspaceId as string, viewId, input),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (viewId: string) =>
      workToolsApi.deleteSavedView(workspaceId as string, viewId),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

// --- intake / triage --------------------------------------------------------

export function useIntakeRequests(
  workspaceId: string | undefined,
  status?: string,
) {
  return useQuery({
    queryKey: queryKeys.workTools.intake(workspaceId ?? '', status),
    queryFn: () => workToolsApi.intake(workspaceId as string, status),
    enabled: !!workspaceId,
  });
}

export function useIntakeMutations(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.workTools.all(workspaceId ?? ''),
    });

  const create = useMutation({
    mutationFn: (input: CreateIntakeRequestInput) =>
      workToolsApi.createIntakeRequest(workspaceId as string, input),
    onSuccess: invalidate,
  });

  const convert = useMutation({
    mutationFn: ({
      intakeId,
      input,
    }: {
      intakeId: string;
      input: ConvertIntakeRequestInput;
    }) =>
      workToolsApi.convertIntakeRequest(
        workspaceId as string,
        intakeId,
        input,
      ),
    onSuccess: invalidate,
  });

  const decline = useMutation({
    mutationFn: (intakeId: string) =>
      workToolsApi.declineIntakeRequest(workspaceId as string, intakeId),
    onSuccess: invalidate,
  });

  return { create, convert, decline };
}

// --- project updates --------------------------------------------------------

export function useProjectUpdates(
  workspaceId: string | undefined,
  projectId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.workTools.projectUpdates(workspaceId ?? '', projectId ?? ''),
    queryFn: () =>
      workToolsApi.projectUpdates(workspaceId as string, projectId as string),
    enabled: !!workspaceId && !!projectId,
  });
}

export function useProjectUpdateMutations(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.workTools.all(workspaceId ?? ''),
    });

  const create = useMutation({
    mutationFn: (input: CreateProjectUpdateInput) =>
      workToolsApi.createProjectUpdate(workspaceId as string, input),
    onSuccess: invalidate,
  });

  return { create };
}

// --- comments, calendar, documents, whiteboards ----------------------------

export function useTaskComments(
  workspaceId: string | undefined,
  taskId: string | null | undefined,
) {
  return useQuery({
    queryKey: queryKeys.workTools.taskComments(
      workspaceId ?? '',
      taskId ?? '',
    ),
    queryFn: () =>
      workToolsApi.taskComments(workspaceId as string, taskId as string),
    enabled: !!workspaceId && !!taskId,
  });
}

export function useAddTaskComment(
  workspaceId: string | undefined,
  taskId: string | null | undefined,
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
    },
  });
}

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
      queryKey: queryKeys.workTools.calendar(workspaceId ?? ''),
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

// --- meetings -------------------------------------------------------------

export interface MeetingListFilters {
  status?: string;
  projectId?: string;
  from?: string;
  to?: string;
  scope?: 'upcoming' | 'past' | 'all';
}

export function useMeetings(
  workspaceId: string | undefined,
  filters: MeetingListFilters = {},
) {
  return useQuery<Meeting[]>({
    queryKey: queryKeys.workTools.meetings(
      workspaceId ?? '',
      filters as Record<string, unknown>,
    ),
    queryFn: () => workToolsApi.meetings(workspaceId as string, filters),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
}

export function useMeeting(
  workspaceId: string | undefined,
  meetingId: string | null | undefined,
) {
  return useQuery<MeetingDetail>({
    queryKey: queryKeys.workTools.meeting(workspaceId ?? '', meetingId ?? ''),
    queryFn: () =>
      workToolsApi.meeting(workspaceId as string, meetingId as string),
    enabled: !!workspaceId && !!meetingId,
    retry: false,
  });
}

/**
 * Every meeting write. The detail cache is refreshed from each mutation's own
 * response, and the meeting list is invalidated so counts/status stay in step.
 */
export function useMeetingMutations(
  workspaceId: string | undefined,
  meetingId?: string,
) {
  const queryClient = useQueryClient();
  const ws = workspaceId ?? '';

  const invalidateList = () =>
    queryClient.invalidateQueries({
      queryKey: ['work-tools', ws, 'meetings'],
    });

  const syncDetail = (detail: MeetingDetail) => {
    queryClient.setQueryData(
      queryKeys.workTools.meeting(ws, detail.id),
      detail,
    );
    invalidateList();
    // Action items are real tasks — keep the board/list fresh too.
    queryClient.invalidateQueries({ queryKey: queryKeys.workTools.all(ws) });
  };

  const create = useMutation({
    mutationFn: (input: CreateMeetingInput) =>
      workToolsApi.createMeeting(ws, input),
    onSuccess: syncDetail,
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateMeetingInput }) =>
      workToolsApi.updateMeeting(ws, id, input),
    onSuccess: syncDetail,
  });

  const cancel = useMutation({
    mutationFn: (id: string) => workToolsApi.cancelMeeting(ws, id),
    onSuccess: syncDetail,
  });

  const end = useMutation({
    mutationFn: (id: string) => workToolsApi.endMeeting(ws, id),
    onSuccess: syncDetail,
  });

  const remove = useMutation({
    mutationFn: (id: string) => workToolsApi.deleteMeeting(ws, id),
    onSuccess: invalidateList,
  });

  const addParticipants = useMutation({
    mutationFn: ({ id, input }: { id: string; input: MeetingParticipantsInput }) =>
      workToolsApi.addMeetingParticipants(ws, id, input),
    onSuccess: syncDetail,
  });

  const removeParticipant = useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      workToolsApi.removeMeetingParticipant(ws, id, userId),
    onSuccess: syncDetail,
  });

  const respond = useMutation({
    mutationFn: ({ id, input }: { id: string; input: MeetingRsvpInput }) =>
      workToolsApi.respondToMeeting(ws, id, input),
    onSuccess: syncDetail,
  });

  const addNote = useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateMeetingNoteInput }) =>
      workToolsApi.addMeetingNote(ws, id, input),
    onSuccess: (_data, { id }) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.workTools.meeting(ws, id),
      }),
  });

  const deleteNote = useMutation({
    mutationFn: ({ id, noteId }: { id: string; noteId: string }) =>
      workToolsApi.deleteMeetingNote(ws, id, noteId),
    onSuccess: (_data, { id }) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.workTools.meeting(ws, id),
      }),
  });

  const addDecision = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: CreateMeetingDecisionInput;
    }) => workToolsApi.addMeetingDecision(ws, id, input),
    onSuccess: (_data, { id }) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.workTools.meeting(ws, id),
      }),
  });

  const deleteDecision = useMutation({
    mutationFn: ({ id, decisionId }: { id: string; decisionId: string }) =>
      workToolsApi.deleteMeetingDecision(ws, id, decisionId),
    onSuccess: (_data, { id }) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.workTools.meeting(ws, id),
      }),
  });

  const addActionItem = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: CreateMeetingActionItemInput;
    }) => workToolsApi.addMeetingActionItem(ws, id, input),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.workTools.meeting(ws, id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.workTools.all(ws) });
    },
  });

  return {
    meetingId,
    create,
    update,
    cancel,
    end,
    remove,
    addParticipants,
    removeParticipant,
    respond,
    addNote,
    deleteNote,
    addDecision,
    deleteDecision,
    addActionItem,
  };
}

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

export function groupTasksByStatus(tasks: Task[] | undefined): Record<string, Task[]> {
  const groups: Record<string, Task[]> = {};
  if (!tasks) return groups;
  for (const task of tasks) {
    if (!groups[task.status]) groups[task.status] = [];
    groups[task.status].push(task);
  }
  return groups;
}

export type {
  CalendarEvent,
  Cycle,
  Epic,
  Initiative,
  IntakeRequest,
  Module,
  ProjectDetail,
  ProjectUpdate,
  SavedView,
  Task,
  Team,
  Whiteboard,
  WorkDocument,
  WorkItemRelation,
};
