import type { FederatedSearchResultItem, SearchCategory } from '@org/types';
import { Button, Input, Switch } from '@org/ui';
import { cn, formatRelative } from '@org/utils';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ArrowLeft,
  Bot,
  CheckSquare,
  FileText,
  FolderKanban,
  Hash,
  LayoutDashboard,
  Paperclip,
  Search,
  Users,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  EMPTY_FEDERATED_FILTERS,
  useFederatedSearch,
  type FederatedSearchFilters,
} from './use-federated-search.js';
import { MIN_QUERY_LENGTH } from './use-search.js';

const CATEGORY_META: Record<
  SearchCategory,
  { label: string; icon: ComponentType<{ className?: string }> }
> = {
  channels: { label: 'Channels', icon: Hash },
  people: { label: 'People', icon: Users },
  docs: { label: 'Documents', icon: FileText },
  tasks: { label: 'Tasks', icon: CheckSquare },
  projects: { label: 'Projects', icon: FolderKanban },
  files: { label: 'Files', icon: Paperclip },
  agents: { label: 'AI agents', icon: Bot },
  canvases: { label: 'Canvases', icon: LayoutDashboard },
};
const ALL_CATEGORIES = Object.keys(CATEGORY_META) as SearchCategory[];

const FILE_TYPES: { value: string; label: string }[] = [
  { value: '', label: 'Any file type' },
  { value: 'image/', label: 'Images' },
  { value: 'video/', label: 'Video' },
  { value: 'audio/', label: 'Audio' },
  { value: 'application/pdf', label: 'PDF' },
  { value: 'text/', label: 'Text' },
];

const ROW_HEIGHT = 64;

/**
 * The dedicated cross-workspace search surface (brief §4). Server-side search,
 * debounced input, filter set (workspace / type / date / file type / exact
 * phrase), infinite loading and a virtualized result list so a few thousand
 * hits stay smooth.
 */
export function GlobalSearchView() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [query, setQuery] = useState(params.get('q') ?? '');
  const [filters, setFilters] = useState<FederatedSearchFilters>(
    EMPTY_FEDERATED_FILTERS,
  );

  // Keep ?q= in the URL so the search is shareable / survives reload.
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (query) next.set('q', query);
    else next.delete('q');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const search = useFederatedSearch(query, filters);
  const pages = search.data?.pages ?? [];
  const items = useMemo(
    () => pages.flatMap((p) => p.items),
    [pages],
  );
  const workspaces = pages[0]?.workspaces ?? [];

  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  // Infinite loading — pull the next page when the last row nears the viewport.
  useEffect(() => {
    const rows = virtualizer.getVirtualItems();
    const last = rows[rows.length - 1];
    if (
      last &&
      last.index >= items.length - 6 &&
      search.hasNextPage &&
      !search.isFetchingNextPage
    ) {
      void search.fetchNextPage();
    }
  }, [virtualizer.getVirtualItems(), items.length, search]);

  const toggle = <K extends 'workspaceIds' | 'categories'>(
    key: K,
    value: string,
  ) =>
    setFilters((f) => {
      const list = f[key] as string[];
      return {
        ...f,
        [key]: list.includes(value)
          ? list.filter((v) => v !== value)
          : [...list, value],
      };
    });

  const trimmed = query.trim();
  const tooShort = trimmed.length < MIN_QUERY_LENGTH;

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Back"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground">
          Search all workspaces
        </h1>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search messages, files, channels, people, projects…"
          className="h-11 pl-10 text-sm"
          autoFocus
        />
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* Filters */}
        <aside className="hidden w-56 shrink-0 space-y-5 overflow-y-auto pr-1 text-xs sm:block">
          <FilterGroup title="Workspace">
            {workspaces.length === 0 ? (
              <p className="text-muted-foreground">—</p>
            ) : (
              workspaces.map((w) => (
                <Check
                  key={w.id}
                  label={w.name}
                  checked={
                    filters.workspaceIds.length === 0 ||
                    filters.workspaceIds.includes(w.id)
                  }
                  onChange={() => toggle('workspaceIds', w.id)}
                />
              ))
            )}
          </FilterGroup>

          <FilterGroup title="Type">
            {ALL_CATEGORIES.map((c) => (
              <Check
                key={c}
                label={CATEGORY_META[c].label}
                checked={
                  filters.categories.length === 0 ||
                  filters.categories.includes(c)
                }
                onChange={() => toggle('categories', c)}
              />
            ))}
          </FilterGroup>

          <FilterGroup title="Date">
            <label className="block text-muted-foreground">
              After
              <Input
                type="date"
                value={filters.dateFrom?.slice(0, 10) ?? ''}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    dateFrom: e.target.value
                      ? new Date(`${e.target.value}T00:00:00`).toISOString()
                      : null,
                  }))
                }
                className="mt-0.5 h-8 text-xs"
              />
            </label>
            <label className="mt-1.5 block text-muted-foreground">
              Before
              <Input
                type="date"
                value={filters.dateTo?.slice(0, 10) ?? ''}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    dateTo: e.target.value
                      ? new Date(`${e.target.value}T23:59:59`).toISOString()
                      : null,
                  }))
                }
                className="mt-0.5 h-8 text-xs"
              />
            </label>
          </FilterGroup>

          <FilterGroup title="File type">
            <select
              value={filters.fileType ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  fileType: e.target.value || null,
                }))
              }
              className="h-8 w-full rounded-md border border-border bg-surface px-2 text-xs text-foreground"
            >
              {FILE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </FilterGroup>

          <label className="flex items-center justify-between text-foreground">
            <span>Exact phrase</span>
            <Switch
              checked={filters.exactPhrase}
              onCheckedChange={(v) =>
                setFilters((f) => ({ ...f, exactPhrase: v }))
              }
              aria-label="Exact phrase"
            />
          </label>
        </aside>

        {/* Results */}
        <div className="min-w-0 flex-1">
          {tooShort ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Type at least {MIN_QUERY_LENGTH} characters to search.
            </p>
          ) : search.isError ? (
            <p className="py-16 text-center text-sm text-destructive">
              Search is unavailable right now.
            </p>
          ) : items.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              {search.isFetching ? 'Searching…' : 'Nothing matched that search.'}
            </p>
          ) : (
            <div
              ref={scrollRef}
              className="h-full overflow-y-auto"
              aria-busy={search.isFetching}
            >
              <div
                style={{ height: virtualizer.getTotalSize() }}
                className="relative w-full"
              >
                {virtualizer.getVirtualItems().map((row) => {
                  const item = items[row.index];
                  return (
                    <div
                      key={`${item.workspace.id}-${item.category}-${item.id}`}
                      className="absolute left-0 top-0 w-full px-1"
                      style={{
                        height: ROW_HEIGHT,
                        transform: `translateY(${row.start}px)`,
                      }}
                    >
                      <ResultRow item={item} />
                    </div>
                  );
                })}
              </div>
              {search.isFetchingNextPage && (
                <p className="py-3 text-center text-xs text-muted-foreground">
                  Loading more…
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultRow({ item }: { item: FederatedSearchResultItem }) {
  const Icon = CATEGORY_META[item.category].icon;
  return (
    <Link
      to={`/w/${item.workspace.slug}/${item.href ?? ''}`}
      className={cn(
        'flex h-full items-center gap-3 rounded-lg px-3 transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
      )}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">
          {item.title}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {item.snippet ? `${item.snippet} · ` : ''}
          {CATEGORY_META[item.category].label} · {item.workspace.name}
          {item.timestamp ? ` · ${formatRelative(item.timestamp)}` : ''}
        </span>
      </span>
    </Link>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="font-semibold uppercase tracking-wide text-[11px] text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="size-3.5 rounded border-border text-primary focus:ring-ring"
      />
      <span className="truncate">{label}</span>
    </label>
  );
}
