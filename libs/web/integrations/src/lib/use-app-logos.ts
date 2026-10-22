import { marketplaceApi, queryKeys } from '@org/api-client';
import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

/**
 * Real app logos from the marketplace API (INTEGRATION listings' `iconUrl`),
 * resolved by provider slug or name. Callers prefer this over their static
 * brand map so a new provider shows its real logo without a code change.
 */
export function useAppLogos(workspaceId?: string) {
  const params = { kind: 'INTEGRATION', pageSize: 100 } as const;
  const { data } = useQuery({
    queryKey: queryKeys.marketplace.browse(workspaceId ?? '', JSON.stringify(params)),
    queryFn: () => marketplaceApi.browse(params, workspaceId),
    staleTime: 5 * 60_000,
  });

  return useCallback(
    (provider?: string, name?: string): string | undefined => {
      const keys = [provider, name]
        .filter((k): k is string => !!k)
        .map((k) => k.toLowerCase().replace(/[^a-z0-9]/g, ''));
      return data?.items.find((l) => {
        const slug = l.slug.toLowerCase().replace(/[^a-z0-9]/g, '');
        const title = l.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return keys.some((k) => k === slug || k === title);
      })?.iconUrl ?? undefined;
    },
    [data],
  );
}
