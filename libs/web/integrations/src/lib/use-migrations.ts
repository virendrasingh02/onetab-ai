import { migrationsApi } from '@org/api-client';
import type {
  MigrationConflictResolutionInput,
  MigrationScope,
} from '@org/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useMigrationsList(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['migrations', 'list', workspaceId],
    queryFn: () => migrationsApi.list(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 5_000,
  });
}

export function useMigrationCapabilities(
  workspaceId: string | undefined,
  integrationId?: string,
) {
  return useQuery({
    queryKey: ['migrations', 'capabilities', workspaceId, integrationId],
    queryFn: () => migrationsApi.getCapabilities(workspaceId as string, integrationId),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
}

export function useMigrationDetail(
  workspaceId: string | undefined,
  migrationId: string | undefined,
) {
  return useQuery({
    queryKey: ['migrations', 'detail', workspaceId, migrationId],
    queryFn: () => migrationsApi.getDetail(workspaceId as string, migrationId as string),
    enabled: !!workspaceId && !!migrationId,
  });
}

export function useMigrationReadiness(
  workspaceId: string | undefined,
  migrationId: string | undefined,
) {
  return useQuery({
    queryKey: ['migrations', 'readiness', workspaceId, migrationId],
    queryFn: () => migrationsApi.getReadiness(workspaceId as string, migrationId as string),
    enabled: !!workspaceId && !!migrationId,
  });
}

export function useMigrationPreview(
  workspaceId: string | undefined,
  migrationId: string | undefined,
) {
  return useQuery({
    queryKey: ['migrations', 'preview', workspaceId, migrationId],
    queryFn: () => migrationsApi.getPreview(workspaceId as string, migrationId as string),
    enabled: !!workspaceId && !!migrationId,
  });
}

export function useMigrationProgress(
  workspaceId: string | undefined,
  migrationId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: ['migrations', 'progress', workspaceId, migrationId],
    queryFn: () => migrationsApi.getProgress(workspaceId as string, migrationId as string),
    enabled: !!workspaceId && !!migrationId && enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'IN_PROGRESS' ? 1_500 : false;
    },
  });
}

export function useMigrationReport(
  workspaceId: string | undefined,
  migrationId: string | undefined,
) {
  return useQuery({
    queryKey: ['migrations', 'report', workspaceId, migrationId],
    queryFn: () => migrationsApi.getReport(workspaceId as string, migrationId as string),
    enabled: !!workspaceId && !!migrationId,
  });
}

export function useCreateMigrationSession(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider?: string) =>
      migrationsApi.createSession(workspaceId as string, provider),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migrations', 'list', workspaceId] });
    },
  });
}

export function useUpdateMigrationScope(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ migrationId, scope }: { migrationId: string; scope: MigrationScope }) =>
      migrationsApi.updateScope(workspaceId as string, migrationId, scope),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['migrations', 'detail', workspaceId, variables.migrationId],
      });
      queryClient.invalidateQueries({
        queryKey: ['migrations', 'readiness', workspaceId, variables.migrationId],
      });
    },
  });
}

export function useResolveMigrationConflicts(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      migrationId,
      resolutions,
    }: {
      migrationId: string;
      resolutions: MigrationConflictResolutionInput;
    }) =>
      migrationsApi.resolveConflicts(workspaceId as string, migrationId, resolutions),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['migrations', 'preview', workspaceId, variables.migrationId],
      });
    },
  });
}

export function useStartMigration(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (migrationId: string) =>
      migrationsApi.start(workspaceId as string, migrationId),
    onSuccess: (_data, migrationId) => {
      queryClient.invalidateQueries({
        queryKey: ['migrations', 'detail', workspaceId, migrationId],
      });
      queryClient.invalidateQueries({
        queryKey: ['migrations', 'progress', workspaceId, migrationId],
      });
    },
  });
}

export function usePauseMigration(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (migrationId: string) =>
      migrationsApi.pause(workspaceId as string, migrationId),
    onSuccess: (_data, migrationId) => {
      queryClient.invalidateQueries({
        queryKey: ['migrations', 'detail', workspaceId, migrationId],
      });
      queryClient.invalidateQueries({
        queryKey: ['migrations', 'progress', workspaceId, migrationId],
      });
    },
  });
}

export function useResumeMigration(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (migrationId: string) =>
      migrationsApi.resume(workspaceId as string, migrationId),
    onSuccess: (_data, migrationId) => {
      queryClient.invalidateQueries({
        queryKey: ['migrations', 'detail', workspaceId, migrationId],
      });
      queryClient.invalidateQueries({
        queryKey: ['migrations', 'progress', workspaceId, migrationId],
      });
    },
  });
}

export function useRetryMigration(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (migrationId: string) =>
      migrationsApi.retry(workspaceId as string, migrationId),
    onSuccess: (_data, migrationId) => {
      queryClient.invalidateQueries({
        queryKey: ['migrations', 'detail', workspaceId, migrationId],
      });
      queryClient.invalidateQueries({
        queryKey: ['migrations', 'progress', workspaceId, migrationId],
      });
    },
  });
}

export function useCancelMigration(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (migrationId: string) =>
      migrationsApi.cancel(workspaceId as string, migrationId),
    onSuccess: (_data, migrationId) => {
      queryClient.invalidateQueries({
        queryKey: ['migrations', 'detail', workspaceId, migrationId],
      });
      queryClient.invalidateQueries({
        queryKey: ['migrations', 'progress', workspaceId, migrationId],
      });
    },
  });
}

export function useApplyAiRecommendation(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      migrationId,
      recId,
      actionType,
      payload,
    }: {
      migrationId: string;
      recId: string;
      actionType: string;
      payload?: Record<string, unknown>;
    }) =>
      migrationsApi.applyRecommendation(
        workspaceId as string,
        migrationId,
        recId,
        actionType,
        payload,
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['migrations', 'report', workspaceId, variables.migrationId],
      });
    },
  });
}
