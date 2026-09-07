import { appVersionsApi, queryKeys } from '@org/api-client';
import type {
  AppOperatingSystem,
  AppPlatform,
  AppReleaseChannel,
  AppReleaseStatus,
  CreateAppReleaseInput,
  RolloutAppReleaseInput,
  ScheduleAppReleaseInput,
  UpdateAppReleaseInput,
  RollbackAppReleaseInput,
} from '@org/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useAppVersionsOverview() {
  return useQuery({
    queryKey: queryKeys.appVersions.overview(),
    queryFn: () => appVersionsApi.overview(),
    staleTime: 15_000,
  });
}

export function useAppVersionsList(filters: {
  platform?: AppPlatform;
  operatingSystem?: AppOperatingSystem;
  releaseChannel?: AppReleaseChannel;
  status?: AppReleaseStatus;
  q?: string;
  page?: number;
  pageSize?: number;
}) {
  return useQuery({
    queryKey: queryKeys.appVersions.list(filters),
    queryFn: () => appVersionsApi.list(filters),
    staleTime: 10_000,
  });
}

export function useAppVersionsAuditLogs(filters: {
  platform?: AppPlatform;
  releaseId?: string;
  page?: number;
  pageSize?: number;
}) {
  return useQuery({
    queryKey: queryKeys.appVersions.auditLogs(filters),
    queryFn: () => appVersionsApi.auditLogs(filters),
    staleTime: 15_000,
  });
}

export function useAppVersionsMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.appVersions.all() });
  };

  const createRelease = useMutation({
    mutationFn: (input: CreateAppReleaseInput) => appVersionsApi.create(input),
    onSuccess: invalidate,
  });

  const updateRelease = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAppReleaseInput }) =>
      appVersionsApi.update(id, input),
    onSuccess: invalidate,
  });

  const releaseNow = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      appVersionsApi.release(id, { reason }),
    onSuccess: invalidate,
  });

  const scheduleRelease = useMutation({
    mutationFn: ({ id, input }: { id: string; input: ScheduleAppReleaseInput }) =>
      appVersionsApi.schedule(id, input),
    onSuccess: invalidate,
  });

  const updateRollout = useMutation({
    mutationFn: ({ id, input }: { id: string; input: RolloutAppReleaseInput }) =>
      appVersionsApi.rollout(id, input),
    onSuccess: invalidate,
  });

  const deprecateRelease = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      appVersionsApi.deprecate(id, { reason }),
    onSuccess: invalidate,
  });

  const disableRelease = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      appVersionsApi.disable(id, { reason }),
    onSuccess: invalidate,
  });

  const rollbackRelease = useMutation({
    mutationFn: ({ id, input }: { id: string; input: RollbackAppReleaseInput }) =>
      appVersionsApi.rollback(id, input),
    onSuccess: invalidate,
  });

  return {
    createRelease,
    updateRelease,
    releaseNow,
    scheduleRelease,
    updateRollout,
    deprecateRelease,
    disableRelease,
    rollbackRelease,
  };
}
