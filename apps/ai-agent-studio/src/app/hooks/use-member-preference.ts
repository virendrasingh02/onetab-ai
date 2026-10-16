import { queryKeys, workspaceApi } from '@org/api-client';
import { toast } from '@org/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useStudioSession } from '../session-guard.js';

/**
 * One key of the signed-in member's per-workspace preferences — saved on the
 * server (so it follows them across devices), updated optimistically.
 * `parse` narrows the stored JSON; anything it rejects reads as `fallback`.
 */
export function useMemberPreference<T>(
  key: string,
  fallback: T,
  parse: (raw: unknown) => T | undefined,
): readonly [T, (next: T) => void] {
  const { activeWorkspace } = useStudioSession();
  const queryClient = useQueryClient();
  const queryKey = queryKeys.workspaces.memberPreferences(activeWorkspace.id);
  const prefs = useQuery({
    queryKey,
    queryFn: () => workspaceApi.getMemberPreferences(activeWorkspace.id),
    staleTime: 60_000,
  });
  const value = parse(prefs.data?.[key]) ?? fallback;

  const save = useMutation({
    mutationFn: (next: T) => workspaceApi.saveMemberPreferences(activeWorkspace.id, { [key]: next }),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Record<string, unknown>>(queryKey);
      queryClient.setQueryData(queryKey, { ...(previous ?? {}), [key]: next });
      return { previous };
    },
    onError: (err, _next, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
      toast.error('Could not save that preference', { description: err instanceof Error ? err.message : undefined });
    },
  });
  const set = useCallback((next: T) => save.mutate(next), [save]);
  return [value, set] as const;
}
