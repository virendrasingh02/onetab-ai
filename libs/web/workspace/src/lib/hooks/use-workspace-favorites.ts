import { queryKeys, workspaceApi } from '@org/api-client';
import { toast } from '@org/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

export type FavoriteType =
  | 'project'
  | 'doc'
  | 'coworker'
  | 'agent'
  | 'app'
  | 'workflow';

export type WorkspaceFavorites = Record<FavoriteType, string[]>;

/** Key in the member's workspace preference blob. */
export const WORKSPACE_FAVORITES_KEY = 'sidebarFavorites';

const FAVORITE_TYPES: FavoriteType[] = ['project', 'doc', 'coworker', 'agent', 'app', 'workflow'];

const TYPE_LABELS: Record<FavoriteType, string> = {
  project: 'Project',
  doc: 'Doc',
  coworker: 'Coworker',
  agent: 'Agent',
  app: 'App',
  workflow: 'Workflow',
};

export function emptyFavorites(): WorkspaceFavorites {
  return { project: [], doc: [], coworker: [], agent: [], app: [], workflow: [] };
}

/** Tolerates a missing or hand-edited blob: unknown types and non-string ids are dropped. */
export function normalizeFavorites(raw: unknown): WorkspaceFavorites {
  const out = emptyFavorites();
  if (!raw || typeof raw !== 'object') return out;
  for (const type of FAVORITE_TYPES) {
    const list = (raw as Record<string, unknown>)[type];
    if (Array.isArray(list)) {
      out[type] = [...new Set(list.filter((v): v is string => typeof v === 'string' && v.length > 0))];
    }
  }
  return out;
}

const errorText = (err: unknown) => (err instanceof Error && err.message ? err.message : undefined);

/**
 * The member's starred projects, docs, coworkers, agents, apps and workflows for
 * a workspace — the sidebar's Starred section. Kept in the server-side member
 * preference blob, so stars follow the member across browsers and devices.
 */
export function useWorkspaceFavorites(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const key = useMemo(() => queryKeys.workspaces.memberPreferences(workspaceId ?? ''), [workspaceId]);

  const query = useQuery({
    queryKey: key,
    queryFn: () => workspaceApi.getMemberPreferences(workspaceId as string),
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
  });

  const favorites = useMemo(() => normalizeFavorites(query.data?.[WORKSPACE_FAVORITES_KEY]), [query.data]);

  const save = useMutation({
    mutationFn: ({ next }: { next: WorkspaceFavorites; previous: Record<string, unknown> | undefined }) =>
      workspaceApi.saveMemberPreferences(workspaceId as string, { [WORKSPACE_FAVORITES_KEY]: next }),
    onMutate: () => queryClient.cancelQueries({ queryKey: key }),
    onError: (err, { previous }) => {
      if (previous) queryClient.setQueryData(key, previous);
      toast.error('Could not update favorites', { description: errorText(err) });
    },
  });

  // Read and write the cache synchronously, so rapid toggles build on each other
  // instead of racing the mutation's async onMutate.
  const current = useCallback(
    () => normalizeFavorites(queryClient.getQueryData<Record<string, unknown>>(key)?.[WORKSPACE_FAVORITES_KEY]),
    [queryClient, key],
  );
  const commit = useCallback(
    (next: WorkspaceFavorites) => {
      const previous = queryClient.getQueryData<Record<string, unknown>>(key);
      queryClient.setQueryData(key, { ...(previous ?? {}), [WORKSPACE_FAVORITES_KEY]: next });
      save.mutate({ next, previous });
    },
    [queryClient, key, save],
  );

  const toggleFavorite = useCallback(
    (type: FavoriteType, id: string) => {
      if (!workspaceId || !id) return;
      const next = current();
      const exists = next[type].includes(id);
      next[type] = exists ? next[type].filter((v) => v !== id) : [...next[type], id];
      commit(next);
      if (exists) toast.info(`Removed ${TYPE_LABELS[type]} from favorites`);
      else toast.success(`Added ${TYPE_LABELS[type]} to favorites`);
    },
    [workspaceId, current, commit],
  );

  /** Merges ids into the stored favorites without toasting — for one-off imports. */
  const mergeFavorites = useCallback(
    (extra: Partial<WorkspaceFavorites>) => {
      if (!workspaceId) return;
      const next = current();
      for (const type of FAVORITE_TYPES) {
        next[type] = [...new Set([...next[type], ...(extra[type] ?? [])])];
      }
      commit(next);
    },
    [workspaceId, current, commit],
  );

  const isFavorite = useCallback((type: FavoriteType, id: string) => favorites[type].includes(id), [favorites]);

  return { favorites, isFavorite, toggleFavorite, mergeFavorites, isLoaded: query.isSuccess };
}
