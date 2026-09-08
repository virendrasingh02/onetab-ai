/**
 * Cross-workspace search merge/rank (brief §4) — pure.
 *
 * The API runs the existing per-workspace `SearchService` over each workspace
 * the caller belongs to, tags every hit with its workspace, then calls
 * {@link mergeFederatedResults} to fold the per-workspace lists into one ranked,
 * de-duplicated, paginated page. Kept pure so it is testable without a DB.
 */

import type {
  FederatedSearchResultItem,
  SearchWorkspaceRef,
} from './notifications.js';

export interface MergeFederatedOptions {
  /** 0-based page. */
  page: number;
  /** Rows per page. */
  pageSize: number;
  /** Inclusive ISO bounds on `item.timestamp`. */
  dateFrom?: string | null;
  dateTo?: string | null;
  /** Keep only `files` whose mime type starts with this (e.g. `image/`). */
  fileTypePrefix?: string | null;
  /** Keep only `tasks` under this project id. */
  projectId?: string | null;
}

export interface MergeFederatedResult {
  items: FederatedSearchResultItem[];
  hasMore: boolean;
}

function passesFilters(
  item: FederatedSearchResultItem,
  opts: MergeFederatedOptions,
): boolean {
  if (opts.dateFrom || opts.dateTo) {
    const t = item.timestamp ? Date.parse(item.timestamp) : NaN;
    if (Number.isNaN(t)) return false;
    if (opts.dateFrom && t < Date.parse(opts.dateFrom)) return false;
    if (opts.dateTo && t > Date.parse(opts.dateTo)) return false;
  }
  if (opts.fileTypePrefix && item.category === 'files') {
    const mime = String(
      (item.metadata as { mimeType?: string } | undefined)?.mimeType ?? '',
    );
    if (!mime.startsWith(opts.fileTypePrefix)) return false;
  }
  if (opts.projectId && item.category === 'tasks') {
    const pid = (item.metadata as { projectId?: string } | undefined)?.projectId;
    if (pid !== opts.projectId) return false;
  }
  return true;
}

/**
 * Folds per-workspace result lists into one ranked page.
 *
 * - Ranking: `score` descending (missing score sorts as 0), then newer
 *   `timestamp`, then title — so an FTS hit outranks an ILIKE one and ties are
 *   stable.
 * - Dedup: a `people` hit for the same user id appears once (someone in three
 *   workspaces is one person); every other category is naturally unique by
 *   `(workspaceId, category, id)` and kept as-is.
 */
export function mergeFederatedResults(
  perWorkspace: FederatedSearchResultItem[][],
  opts: MergeFederatedOptions,
): MergeFederatedResult {
  const flat = perWorkspace
    .flat()
    .filter((item) => passesFilters(item, opts));

  const seenPeople = new Set<string>();
  const deduped: FederatedSearchResultItem[] = [];
  for (const item of flat) {
    if (item.category === 'people') {
      if (seenPeople.has(item.id)) continue;
      seenPeople.add(item.id);
    }
    deduped.push(item);
  }

  deduped.sort(
    (a, b) =>
      (b.score ?? 0) - (a.score ?? 0) ||
      Date.parse(b.timestamp ?? '') - Date.parse(a.timestamp ?? '') ||
      a.title.localeCompare(b.title),
  );

  const start = opts.page * opts.pageSize;
  const items = deduped.slice(start, start + opts.pageSize);
  return { items, hasMore: deduped.length > start + opts.pageSize };
}

/** Intersect a requested workspace-id filter with what the caller may search. */
export function resolveSearchWorkspaces(
  memberships: SearchWorkspaceRef[],
  requestedIds: string[] | undefined,
): SearchWorkspaceRef[] {
  if (!requestedIds || requestedIds.length === 0) return memberships;
  const allowed = new Set(requestedIds);
  return memberships.filter((w) => allowed.has(w.id));
}
