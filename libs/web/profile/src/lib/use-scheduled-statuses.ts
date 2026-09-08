import { userApi } from '@org/api-client';
import { toast } from '@org/ui';
import type {
  CreateScheduledStatusInput,
  UpdateScheduledStatusInput,
} from '@org/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const KEY = ['scheduled-statuses'] as const;

/** The user's scheduled-status queue (brief §9). */
export function useScheduledStatuses() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => userApi.scheduledStatuses(),
    staleTime: 30_000,
  });
}

export function useScheduledStatusMutations() {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: KEY });

  const create = useMutation({
    mutationFn: (input: CreateScheduledStatusInput) =>
      userApi.createScheduledStatus(input),
    onSuccess: () => {
      toast.success('Scheduled status added');
      invalidate();
    },
    onError: (error: unknown) =>
      toast.error(
        error instanceof Error ? error.message : 'Could not save the schedule',
      ),
  });

  const update = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: UpdateScheduledStatusInput;
    }) => userApi.updateScheduledStatus(id, input),
    onSuccess: () => invalidate(),
    onError: (error: unknown) =>
      toast.error(
        error instanceof Error ? error.message : 'Could not update the schedule',
      ),
  });

  const remove = useMutation({
    mutationFn: (id: string) => userApi.deleteScheduledStatus(id),
    onSuccess: () => {
      toast.info('Scheduled status removed');
      invalidate();
    },
  });

  return { create, update, remove };
}
