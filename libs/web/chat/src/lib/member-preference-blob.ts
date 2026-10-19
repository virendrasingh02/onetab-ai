import { queryKeys, workspaceApi } from '@org/api-client';
import { toast } from '@org/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

/**
 * The member's server-side workspace preference blob
 * (`/workspaces/:id/settings/member-preferences`). Kept free of the chat
 * runtime so surfaces that only need preferences — bookmarks on a channel page,
 * say — do not pull in matrix-js-sdk.
 */

export const DM_BOOKMARKS_KEY = 'dmBookmarks';

const errorText = (err: unknown) =>
  err instanceof Error && err.message ? err.message : undefined;

/**
 * The member's preference blob for a workspace, plus an optimistic partial
 * write. Shares its query key with the settings screen and Studio favorites.
 */
export function useMemberPreferenceBlob(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const key = useMemo(
    () => queryKeys.workspaces.memberPreferences(workspaceId ?? ''),
    [workspaceId],
  );

  const query = useQuery({
    queryKey: key,
    queryFn: () => workspaceApi.getMemberPreferences(workspaceId as string),
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
  });

  const save = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      workspaceApi.saveMemberPreferences(workspaceId as string, patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Record<string, unknown>>(key);
      queryClient.setQueryData(key, { ...(previous ?? {}), ...patch });
      return { previous };
    },
    onError: (err, _patch, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      toast.error('Could not save conversation preference', {
        description: errorText(err),
      });
    },
  });

  /** Reads the freshest cached blob — rapid toggles must build on each other. */
  const current = useCallback(
    () => queryClient.getQueryData<Record<string, unknown>>(key) ?? {},
    [queryClient, key],
  );

  return { query, save: save.mutate, current };
}
