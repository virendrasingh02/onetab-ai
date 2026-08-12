import { queryKeys, searchApi } from '@org/api-client';
import type { SearchCategory } from '@org/types';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

/** Below this a query matches most of the workspace and tells you nothing. */
export const MIN_QUERY_LENGTH = 2;

/** One keystroke pause. Short enough to feel live, long enough to batch. */
const DEBOUNCE_MS = 200;

/**
 * Trails `value` by `DEBOUNCE_MS`.
 *
 * The palette fires a request per render otherwise — six category queries per
 * keystroke, most of them abandoned before they resolve.
 */
export function useDebouncedValue<T>(value: T, delayMs = DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

export function useWorkspaceSearch(
  workspaceId: string | undefined,
  query: string,
  category?: SearchCategory,
) {
  const debouncedQuery = useDebouncedValue(query).trim();
  const enabled = !!workspaceId && debouncedQuery.length >= MIN_QUERY_LENGTH;

  return useQuery({
    queryKey: queryKeys.search.query(workspaceId ?? '', debouncedQuery, category),
    queryFn: () =>
      searchApi.query(workspaceId as string, debouncedQuery, category),
    enabled,
    /*
     * Holding the previous page keeps the palette from blanking between
     * keystrokes — the list dims and updates instead of collapsing to empty.
     */
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/** Counts per category, for the filter chips above the results. */
export function useSearchCounts(
  workspaceId: string | undefined,
  query: string,
) {
  const debouncedQuery = useDebouncedValue(query).trim();

  return useQuery({
    queryKey: queryKeys.search.counts(workspaceId ?? '', debouncedQuery),
    queryFn: () => searchApi.counts(workspaceId as string, debouncedQuery),
    enabled: !!workspaceId && debouncedQuery.length >= MIN_QUERY_LENGTH,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
