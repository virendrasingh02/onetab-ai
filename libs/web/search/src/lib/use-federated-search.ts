import { queryKeys, searchApi } from '@org/api-client';
import type { SearchCategory } from '@org/types';
import { useInfiniteQuery } from '@tanstack/react-query';
import { MIN_QUERY_LENGTH, useDebouncedValue } from './use-search.js';

export interface FederatedSearchFilters {
  workspaceIds: string[];
  categories: SearchCategory[];
  dateFrom: string | null;
  dateTo: string | null;
  fileType: string | null;
  projectId: string | null;
  /** Wrap the query in quotes so FTS treats it as a phrase. */
  exactPhrase: boolean;
}

export const EMPTY_FEDERATED_FILTERS: FederatedSearchFilters = {
  workspaceIds: [],
  categories: [],
  dateFrom: null,
  dateTo: null,
  fileType: null,
  projectId: null,
  exactPhrase: false,
};

/** Stable key for the filter set, so identical filters share a cache entry. */
function filtersKey(f: FederatedSearchFilters): string {
  return JSON.stringify({
    w: [...f.workspaceIds].sort(),
    c: [...f.categories].sort(),
    df: f.dateFrom,
    dt: f.dateTo,
    ft: f.fileType,
    p: f.projectId,
  });
}

/**
 * Cross-workspace search (brief §4), debounced + infinite.
 *
 * `data.pages[*].items` are the paged rows; `data.pages[0].workspaces` is the
 * full set the caller can search, for the workspace filter.
 */
export function useFederatedSearch(
  rawQuery: string,
  filters: FederatedSearchFilters,
) {
  const debounced = useDebouncedValue(rawQuery).trim();
  const effectiveQuery =
    filters.exactPhrase && debounced ? `"${debounced.replace(/"/g, '')}"` : debounced;
  const enabled = debounced.length >= MIN_QUERY_LENGTH;
  const key = filtersKey(filters);

  return useInfiniteQuery({
    queryKey: queryKeys.search.federated(effectiveQuery, key, 0),
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      searchApi.federated({
        q: effectiveQuery,
        workspaceIds: filters.workspaceIds,
        categories: filters.categories,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        fileType: filters.fileType,
        projectId: filters.projectId,
        page: pageParam,
      }),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length : undefined,
    enabled,
    staleTime: 20_000,
  });
}
