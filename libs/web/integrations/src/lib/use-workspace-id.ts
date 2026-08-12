import { queryKeys, workspaceApi } from '@org/api-client';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';

/**
 * The current workspace's id, resolved from the route slug.
 *
 * `@org/web-workspace` exports `useCurrentWorkspace`, which is the same thing —
 * but this library cannot import it: the workspace settings page renders
 * `SlackNotionImportView` from here, so depending on it the other way would
 * make the two libraries circular.
 *
 * The query key is deliberately the shared one, so this resolves out of the
 * cache `useCurrentWorkspace` already populated rather than refetching.
 */
export function useWorkspaceId(): string | undefined {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();

  const query = useQuery({
    queryKey: queryKeys.workspaces.detail(workspaceSlug ?? ''),
    queryFn: () => workspaceApi.bySlug(workspaceSlug as string),
    enabled: !!workspaceSlug,
    staleTime: 30_000,
  });

  return query.data?.id;
}
