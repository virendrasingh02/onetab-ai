import type { SearchCategory } from '@org/types';
import { useState } from 'react';
import { WorkspaceSearchResults } from './workspace-search.js';
import { useSearchCounts, useWorkspaceSearch } from './use-search.js';

export interface WorkspaceSearchPanelProps {
  workspaceId: string | undefined;
  workspaceSlug: string;
  query: string;
  onNavigate?: () => void;
}

/**
 * Search results wired to the API, for embedding in the command palette.
 *
 * The palette owns the input (it is the thing with focus), so the query
 * arrives as a prop; the category filter is local because nothing outside
 * this panel reads it.
 */
export function WorkspaceSearchPanel({
  workspaceId,
  workspaceSlug,
  query,
  onNavigate,
}: WorkspaceSearchPanelProps) {
  const [category, setCategory] = useState<SearchCategory | undefined>();
  const results = useWorkspaceSearch(workspaceId, query, category);
  const counts = useSearchCounts(workspaceId, query);

  return (
    <WorkspaceSearchResults
      workspaceId={workspaceId}
      workspaceSlug={workspaceSlug}
      results={results.data}
      query={query}
      isLoading={results.isFetching}
      isError={results.isError}
      counts={counts.data}
      activeCategory={category}
      onCategoryChange={setCategory}
      onNavigate={onNavigate}
    />
  );
}
