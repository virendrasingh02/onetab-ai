import { integrationsApi, queryKeys } from '@org/api-client';
import type {
  AppActionResult,
  IntegrationExecuteRequestInput,
  ReplyMessageInput,
  SendMessageInput,
} from '@org/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Connected integrations for the current workspace and user.
 */
export function useIntegrations(workspaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.integrations.list(workspaceId ?? ''),
    queryFn: () => integrationsApi.list(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 15_000,
  });
}

/**
 * Available provider capabilities.
 */
export function useIntegrationProviders(workspaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.integrations.providers(workspaceId ?? ''),
    queryFn: () => integrationsApi.getProviders(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 60_000,
  });
}

/**
 * Detail of a single integration.
 */
export function useIntegrationDetail(
  workspaceId: string | undefined,
  integrationId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.integrations.detail(workspaceId ?? '', integrationId ?? ''),
    queryFn: () => integrationsApi.getDetail(workspaceId as string, integrationId as string),
    enabled: !!workspaceId && !!integrationId,
  });
}

/**
 * Normalized messages list for an email or messaging integration.
 */
export function useIntegrationMessages(
  workspaceId: string | undefined,
  integrationId: string | undefined,
  params?: { q?: string; pageToken?: string },
) {
  return useQuery({
    queryKey: queryKeys.integrations.messages(workspaceId ?? '', integrationId ?? '', params),
    queryFn: () =>
      integrationsApi.getMessages(workspaceId as string, integrationId as string, params),
    enabled: !!workspaceId && !!integrationId,
  });
}

/**
 * Normalized message thread.
 */
export function useIntegrationThread(
  workspaceId: string | undefined,
  integrationId: string | undefined,
  threadId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.integrations.thread(
      workspaceId ?? '',
      integrationId ?? '',
      threadId ?? '',
    ),
    queryFn: () =>
      integrationsApi.getThread(
        workspaceId as string,
        integrationId as string,
        threadId as string,
      ),
    enabled: !!workspaceId && !!integrationId && !!threadId,
  });
}

/**
 * Sync jobs for an integration.
 */
export function useIntegrationSyncJobs(
  workspaceId: string | undefined,
  integrationId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.integrations.syncJobs(workspaceId ?? '', integrationId ?? ''),
    queryFn: () =>
      integrationsApi.getSyncJobs(workspaceId as string, integrationId as string),
    enabled: !!workspaceId && !!integrationId,
    refetchInterval: 5_000, // poll while viewing sync jobs
  });
}

/**
 * The named actions a connected app exposes (`getActions()` on its
 * provider adapter) — the same list `AppMatrixBridgeService` uses to answer
 * `/help` in the app's chat DM, surfaced here so a bespoke viewer UI (e.g.
 * `GoogleCalendarModal`) can call the exact same backend action rather than
 * duplicating request logic per screen.
 */
export function useIntegrationActions(
  workspaceId: string | undefined,
  integrationId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.integrations.actions(workspaceId ?? '', integrationId ?? ''),
    queryFn: () => integrationsApi.getActions(workspaceId as string, integrationId as string),
    enabled: !!workspaceId && !!integrationId,
    staleTime: 60_000,
  });
}

/**
 * Runs one registered action. Read actions (`requiresConfirmation: false`)
 * can be called immediately; a write/destructive action must be called again
 * with `confirm: true` once the user has approved a preview — the server
 * refuses it otherwise (`IntegrationsService.executeAction`).
 */
export function useExecuteIntegrationAction(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      integrationId,
      actionId,
      input,
      confirm,
    }: {
      integrationId: string;
      actionId: string;
      input?: Record<string, unknown>;
      confirm?: boolean;
    }): Promise<AppActionResult> =>
      integrationsApi.executeAction(workspaceId as string, integrationId, actionId, {
        input,
        confirm,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.all(workspaceId ?? ''),
      }),
  });
}

/**
 * Runs a read-only action (`requiresConfirmation: false`) as a cached query
 * instead of an imperative mutation — the shape a list/detail screen wants
 * (e.g. Calendar's `list_events`, Drive's `search_files`). Never use this for
 * a write/destructive action: those belong behind `useExecuteIntegrationAction`
 * so the confirm step is explicit.
 */
export function useIntegrationActionQuery<T = unknown>(
  workspaceId: string | undefined,
  integrationId: string | undefined,
  actionId: string | undefined,
  input?: Record<string, unknown>,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.integrations.actionResult(
      workspaceId ?? '',
      integrationId ?? '',
      actionId ?? '',
      input,
    ),
    queryFn: async () => {
      const result = await integrationsApi.executeAction(
        workspaceId as string,
        integrationId as string,
        actionId as string,
        { input },
      );
      if (!result.success) {
        throw new Error(result.message || `${actionId} failed.`);
      }
      return result.data as T;
    },
    enabled:
      !!workspaceId && !!integrationId && !!actionId && (options?.enabled ?? true),
    staleTime: 15_000,
  });
}

export function useIntegrationMutations(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.integrations.all(workspaceId ?? ''),
    });

  const connect = useMutation({
    mutationFn: ({
      provider,
      scopeType,
      accessToken,
      config,
      redirectUri,
    }: {
      provider: string;
      scopeType?: 'WORKSPACE' | 'USER';
      accessToken?: string;
      config?: Record<string, unknown>;
      redirectUri?: string;
    }) =>
      integrationsApi.connect(workspaceId as string, provider, {
        scopeType,
        accessToken,
        config,
        redirectUri,
      }),
    onSuccess: invalidate,
  });

  const disconnect = useMutation({
    mutationFn: (integrationId: string) =>
      integrationsApi.disconnect(workspaceId as string, integrationId),
    onSuccess: invalidate,
  });

  const sync = useMutation({
    mutationFn: (integrationId: string) =>
      integrationsApi.sync(workspaceId as string, integrationId),
    onSuccess: () => {
      invalidate();
    },
  });

  const sendMessage = useMutation({
    mutationFn: ({
      integrationId,
      input,
    }: {
      integrationId: string;
      input: SendMessageInput;
    }) => integrationsApi.sendMessage(workspaceId as string, integrationId, input),
    onSuccess: invalidate,
  });

  const replyMessage = useMutation({
    mutationFn: ({
      integrationId,
      input,
    }: {
      integrationId: string;
      input: ReplyMessageInput;
    }) => integrationsApi.replyMessage(workspaceId as string, integrationId, input),
    onSuccess: invalidate,
  });

  const createDraft = useMutation({
    mutationFn: ({
      integrationId,
      input,
    }: {
      integrationId: string;
      input: SendMessageInput;
    }) => integrationsApi.createDraft(workspaceId as string, integrationId, input),
    onSuccess: invalidate,
  });

  const modifyLabels = useMutation({
    mutationFn: ({
      integrationId,
      messageId,
      input,
    }: {
      integrationId: string;
      messageId: string;
      input: { addLabelIds?: string[]; removeLabelIds?: string[] };
    }) =>
      integrationsApi.modifyLabels(
        workspaceId as string,
        integrationId,
        messageId,
        input,
      ),
    onSuccess: invalidate,
  });

  const testCustomApi = useMutation({
    mutationFn: (config: Record<string, unknown>) =>
      integrationsApi.testCustomApi(workspaceId as string, config),
  });

  const executeCustomRequest = useMutation({
    mutationFn: ({
      integrationId,
      input,
    }: {
      integrationId: string;
      input: IntegrationExecuteRequestInput;
    }) =>
      integrationsApi.executeCustomRequest(
        workspaceId as string,
        integrationId,
        input,
      ),
  });

  const importSlack = useMutation({
    mutationFn: (
      channels: Array<{ name: string; topic?: string; messagesCount: number }>,
    ) => integrationsApi.importSlack(workspaceId as string, channels),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['channels', workspaceId] });
    },
  });

  const importNotion = useMutation({
    mutationFn: (pages: Array<{ title: string; content: string }>) =>
      integrationsApi.importNotion(workspaceId as string, pages),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['work-tools', workspaceId] });
    },
  });

  return {
    connect,
    disconnect,
    sync,
    sendMessage,
    replyMessage,
    createDraft,
    modifyLabels,
    testCustomApi,
    executeCustomRequest,
    importSlack,
    importNotion,
  };
}
