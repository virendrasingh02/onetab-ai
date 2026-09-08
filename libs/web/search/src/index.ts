export {
  WorkspaceSearchHint,
  WorkspaceSearchResults,
  type WorkspaceSearchResultsProps,
} from './lib/workspace-search.js';

export {
  WorkspaceSearchPanel,
  type WorkspaceSearchPanelProps,
} from './lib/workspace-search-panel.js';

export {
  MIN_QUERY_LENGTH,
  useDebouncedValue,
  useSearchCounts,
  useWorkspaceSearch,
} from './lib/use-search.js';

export { GlobalSearchView } from './lib/global-search-view.js';
export {
  EMPTY_FEDERATED_FILTERS,
  useFederatedSearch,
  type FederatedSearchFilters,
} from './lib/use-federated-search.js';
