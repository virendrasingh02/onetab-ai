import { peopleApi, queryKeys } from '@org/api-client';
import type {
  EmployeeDirectoryQuery,
  UpdateCelebrationPrefsInput,
  UpdateEmployeePrivacyInput,
  UpdateEmployeeProfileInput,
  UpdateEmploymentInput,
} from '@org/validation';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

export function useEmployeeDirectory(
  workspaceId: string | undefined,
  filters: Partial<EmployeeDirectoryQuery>,
) {
  return useQuery({
    queryKey: queryKeys.people.directory(workspaceId ?? '', filters),
    queryFn: () => peopleApi.directory(workspaceId as string, filters),
    enabled: !!workspaceId,
    // Keep the grid on screen while the next page / search result loads.
    placeholderData: keepPreviousData,
  });
}

export function useEmployeeProfile(
  workspaceId: string | undefined,
  userId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.people.profile(workspaceId ?? '', userId ?? ''),
    queryFn: () => peopleApi.profile(workspaceId as string, userId as string),
    enabled: !!workspaceId && !!userId,
  });
}

export function usePeopleMutations(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.people.all(workspaceId ?? ''),
    });

  const updateProfile = useMutation({
    mutationFn: (input: UpdateEmployeeProfileInput) =>
      peopleApi.updateProfile(workspaceId as string, input),
    onSuccess: invalidate,
  });
  const updatePrivacy = useMutation({
    mutationFn: (input: UpdateEmployeePrivacyInput) =>
      peopleApi.updatePrivacy(workspaceId as string, input),
    onSuccess: invalidate,
  });
  const updateCelebrations = useMutation({
    mutationFn: (input: UpdateCelebrationPrefsInput) =>
      peopleApi.updateCelebrations(workspaceId as string, input),
    onSuccess: invalidate,
  });
  const updateEmployment = useMutation({
    mutationFn: ({
      userId,
      input,
    }: {
      userId: string;
      input: UpdateEmploymentInput;
    }) => peopleApi.updateEmployment(workspaceId as string, userId, input),
    onSuccess: invalidate,
  });

  return { updateProfile, updatePrivacy, updateCelebrations, updateEmployment };
}
