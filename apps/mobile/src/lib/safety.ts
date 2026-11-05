import { queryKeys, safetyApi } from '@org/api-client';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

/** Everyone this person blocked, as the Matrix ids chat timelines use. */
export function useBlockedMatrixIds(): ReadonlySet<string> {
  const blocks = useQuery({
    queryKey: queryKeys.safety.blocks(),
    queryFn: () => safetyApi.blocks(),
    staleTime: 60_000,
  });
  return useMemo(
    () =>
      new Set(
        (blocks.data ?? [])
          .map((block) => block.matrixUserId)
          .filter((id): id is string => Boolean(id)),
      ),
    [blocks.data],
  );
}
