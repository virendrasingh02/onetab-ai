import { useMediaPreview } from '@org/media-preview';
import type { SearchCategory, SearchResultItem } from '@org/types';
import { cn } from '@org/utils';
import { Hint } from '@org/ui';
import { useUploadMediaAdapter } from '@org/web-upload';
import {
  CheckSquare,
  Eye,
  FileText,
  FolderKanban,
  Hash,
  Paperclip,
  Search,
  Users,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { MIN_QUERY_LENGTH } from './use-search.js';

const CATEGORY_ORDER: SearchCategory[] = [
  'channels',
  'people',
  'docs',
  'tasks',
  'projects',
  'files',
];

const CATEGORY_LABEL: Record<SearchCategory, string> = {
  channels: 'Channels',
  people: 'People',
  docs: 'Documents',
  tasks: 'Tasks',
  projects: 'Projects',
  files: 'Files',
};

const CATEGORY_ICON: Record<SearchCategory, ComponentType<{ className?: string }>> = {
  channels: Hash,
  people: Users,
  docs: FileText,
  tasks: CheckSquare,
  projects: FolderKanban,
  files: Paperclip,
};

export interface WorkspaceSearchResultsProps {
  /** Only needed to preview `files`-category results (an authenticated
   * blob fetch) — every other category just navigates via `href`. */
  workspaceId?: string;
  workspaceSlug: string;
  results: SearchResultItem[] | undefined;
  query: string;
  isLoading?: boolean;
  isError?: boolean;
  /** Per-category totals for the filter chips; omitted hides the chip row. */
  counts?: Record<SearchCategory, number>;
  activeCategory?: SearchCategory;
  onCategoryChange?: (category: SearchCategory | undefined) => void;
  onNavigate?: () => void;
}

/**
 * Result list for the command palette.
 *
 * Rendering is split from data fetching so the palette shell can stay in
 * `@org/ui` (presentational) while the workspace-aware query lives in
 * `use-search.ts` beside this file.
 */
export function WorkspaceSearchResults({
  workspaceId,
  workspaceSlug,
  results,
  query,
  isLoading,
  isError,
  counts,
  activeCategory,
  onCategoryChange,
  onNavigate,
}: WorkspaceSearchResultsProps) {
  const { openPreview } = useMediaPreview();
  const { toMediaItem } = useUploadMediaAdapter(workspaceId);
  const trimmed = query.trim();

  if (trimmed.length < MIN_QUERY_LENGTH) {
    return (
      <p className="px-2 py-6 text-sm text-center text-muted-foreground">
        Type at least {MIN_QUERY_LENGTH} characters to search this workspace.
      </p>
    );
  }

  if (isError) {
    return (
      <p className="px-2 py-6 text-sm text-center text-destructive">
        Search is unavailable right now.
      </p>
    );
  }

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    items: (results ?? []).filter((item) => item.category === category),
  })).filter((group) => group.items.length > 0);

  const rowClass = cn(
    'gap-2 px-2 py-1.5 text-sm flex items-start rounded-md',
    'hover:bg-accent hover:text-accent-foreground',
  );

  return (
    <div className="space-y-3">
      {counts && onCategoryChange ? (
        <div className="gap-1 px-1 flex flex-wrap">
          <CategoryChip
            label="All"
            count={Object.values(counts).reduce((sum, n) => sum + n, 0)}
            isActive={!activeCategory}
            onClick={() => onCategoryChange(undefined)}
          />
          {CATEGORY_ORDER.filter((category) => counts[category] > 0).map(
            (category) => (
              <CategoryChip
                key={category}
                label={CATEGORY_LABEL[category]}
                count={counts[category]}
                isActive={activeCategory === category}
                onClick={() => onCategoryChange(category)}
              />
            ),
          )}
        </div>
      ) : null}

      {grouped.length === 0 ? (
        <p className="px-2 py-6 text-sm text-center text-muted-foreground">
          {isLoading ? 'Searching…' : 'Nothing matched that search.'}
        </p>
      ) : (
        <div className={cn('space-y-3', isLoading && 'opacity-60')}>
          {grouped.map(({ category, items }) => {
            const Icon = CATEGORY_ICON[category];
            return (
              <section key={category}>
                <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
                  {CATEGORY_LABEL[category]}
                </p>
                <ul>
                  {items.map((item) => {
                    const metadata = item.metadata as
                      | { mimeType?: string; size?: number }
                      | undefined;
                    const fileMimeType =
                      category === 'files' ? metadata?.mimeType : undefined;
                    const fileSize = metadata?.size ?? 0;

                    return (
                      <li key={`${item.category}-${item.id}`} className="flex items-center">
                        <Link
                          // `href` is workspace-relative, so the prefix is added here.
                          to={`/w/${workspaceSlug}/${item.href ?? ''}`}
                          onClick={onNavigate}
                          className={cn(rowClass, 'flex-1')}
                        >
                          <Icon className="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1">
                            <span className="truncate block">{item.title}</span>
                            {item.snippet ? (
                              <span className="truncate block text-xs text-muted-foreground">
                                {item.snippet}
                              </span>
                            ) : null}
                          </span>
                        </Link>

                        {fileMimeType ? (
                          <Hint label="Preview">
                            <button
                              type="button"
                              aria-label={`Preview ${item.title}`}
                              onClick={() =>
                                openPreview([
                                  toMediaItem({
                                    id: item.id,
                                    filename: item.title,
                                    mimeType: fileMimeType,
                                    size: fileSize,
                                  }),
                                ])
                              }
                              className="size-7 mr-1 shrink-0 flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            >
                              <Eye className="size-3.5" />
                            </button>
                          </Hint>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CategoryChip({
  label,
  count,
  isActive,
  onClick,
}: {
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={cn(
        'gap-1 rounded-full border px-2 py-0.5 text-xs inline-flex items-center',
        'transition-colors duration-(--duration-fast)',
        isActive
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border text-muted-foreground hover:text-foreground',
      )}
    >
      <span>{label}</span>
      <span className="tabular-nums opacity-70">{count}</span>
    </button>
  );
}

/** Empty-state placeholder shown before the user has typed anything. */
export function WorkspaceSearchHint() {
  return (
    <p className="gap-2 px-2 py-6 text-sm text-muted-foreground flex items-center justify-center">
      <Search className="size-4" aria-hidden />
      Search channels, people, docs, tasks, projects and files.
    </p>
  );
}
