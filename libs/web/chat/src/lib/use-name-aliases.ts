import { memberApi, queryKeys } from '@org/api-client';
import { useQuery } from '@tanstack/react-query';

/**
 * Former names of the workspace's members. Old messages store `@Name` as text,
 * so this is what lets them follow a rename. Rarely changes: cached for minutes.
 */
export function useNameAliases(workspaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.members.aliases(workspaceId ?? ''),
    queryFn: () => memberApi.aliases(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 5 * 60_000,
  }).data;
}
