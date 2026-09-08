import type { SearchCategory } from '@org/types';
import { Globe } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { WorkspaceSearchResults } from './workspace-search.js';
import { MIN_QUERY_LENGTH, useSearchCounts, useWorkspaceSearch } from './use-search.js';

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
    <div className="space-y-1">
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
      {query.trim().length >= MIN_QUERY_LENGTH ? (
        <Link
          to={`/search?q=${encodeURIComponent(query.trim())}`}
          onClick={onNavigate}
          className="gap-2 mx-1 px-2 py-1.5 text-xs flex items-center rounded-md border-t border-border text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Globe className="size-3.5" />
          Search all workspaces for “{query.trim()}”
        </Link>
      ) : null}
    </div>
  );
}
