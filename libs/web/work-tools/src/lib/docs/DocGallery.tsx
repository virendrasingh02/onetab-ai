import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  ScrollArea,
  SearchInput,
  SkeletonList,
  Toolbar,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  BookOpen,
  Check,
  ChevronDown,
  CopyPlus,
  Download,
  FileText,
  Filter,
  Folder,
  FolderKanban,
  LayoutGrid,
  List,
  MoreVertical,
  Plus,
  Star,
  Tag,
  Trash2,
  Zap,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { readingMinutes } from './doc-content.js';
import { downloadDocAsMarkdown } from './doc-export.js';
import { CARD_ACTIONS_REVEAL, DocStatusBadge } from './DocStatusBadge.js';
import {
  DEFAULT_COVER,
  DOC_CATEGORIES,
  DOC_STATUSES,
  type CompanyItem,
  type DocCategory,
  type DocItem,
  type DocStatus,
} from './doc-types.js';

export interface DocGalleryProps {
  docs: DocItem[];
  companies: CompanyItem[];
  /** Live project names; a name stored on a doc goes stale on rename. */
  projects?: Array<{ id: string; name: string }>;
  activeDocId?: string;
  isLoading?: boolean;
  onSelectDoc: (id: string) => void;
  onNewDoc: () => void;
  onBrowseTemplates: () => void;
  onDuplicateDoc?: (id: string) => void;
  onDeleteDoc?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  /** Narrows the gallery to one author's docs. */
  filterAuthorId?: string;
}

interface DocCardActionsProps
  extends Pick<
    DocGalleryProps,
    'onSelectDoc' | 'onDuplicateDoc' | 'onDeleteDoc' | 'onToggleFavorite'
  > {
  doc: DocItem;
  /** Light icons for the coloured cover; theme icons on the card body. */
  onCover: boolean;
}

function DocCardActions({
  doc,
  onCover,
  onSelectDoc,
  onDuplicateDoc,
  onDeleteDoc,
  onToggleFavorite,
}: DocCardActionsProps) {
  const iconButton = cn(
    'p-1 rounded cursor-pointer',
    onCover
      ? 'text-white/80 hover:text-white'
      : 'text-muted-foreground hover:text-foreground',
  );

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-md',
        onCover && 'bg-black/40 backdrop-blur-md p-1',
        CARD_ACTIONS_REVEAL,
      )}
    >
      {onToggleFavorite && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(doc.id);
          }}
          className={iconButton}
          title={doc.favorite ? 'Unfavorite' : 'Favorite'}
          aria-label={doc.favorite ? 'Unfavorite' : 'Favorite'}
          aria-pressed={Boolean(doc.favorite)}
        >
          <Star
            className={cn(
              'size-3.5',
              doc.favorite && 'fill-accent-amber text-accent-amber',
            )}
          />
        </button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className={iconButton}
            title="Document actions"
            aria-label="Document actions"
          >
            <MoreVertical className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        {/* Portalled, but React events still bubble to the card, so a click
            anywhere in the menu would otherwise open the document too. */}
        <DropdownMenuContent
          align="end"
          className="w-44"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenuItem
            onClick={() => onSelectDoc(doc.id)}
            className="gap-2 text-xs"
          >
            <BookOpen className="size-3.5 text-muted-foreground" />
            Open editor
          </DropdownMenuItem>
          {onDuplicateDoc && (
            <DropdownMenuItem
              onClick={() => onDuplicateDoc(doc.id)}
              className="gap-2 text-xs"
            >
              <CopyPlus className="size-3.5 text-muted-foreground" />
              Duplicate
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => downloadDocAsMarkdown(doc)}
            className="gap-2 text-xs"
          >
            <Download className="size-3.5 text-muted-foreground" />
            Export markdown
          </DropdownMenuItem>
          {onDeleteDoc && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDeleteDoc(doc.id)}
                className="gap-2 text-xs text-destructive focus:text-destructive"
              >
                <Trash2 className="size-3.5" />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function DocGallery({
  docs,
  companies,
  projects,
  activeDocId,
  isLoading = false,
  onSelectDoc,
  onNewDoc,
  onBrowseTemplates,
  onDuplicateDoc,
  onDeleteDoc,
  onToggleFavorite,
  filterAuthorId,
}: DocGalleryProps) {
  const [search, setSearch] = useState('');
  const [layout, setLayout] = useState<'grid' | 'compact'>('grid');
  const [categoryFilter, setCategoryFilter] = useState<DocCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<DocStatus | 'all'>('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const companyMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of companies) {
      map.set(c.id, c.name);
    }
    return map;
  }, [companies]);

  const projectNames = useMemo(
    () => new Map(projects?.map((p) => [p.id, p.name])),
    [projects],
  );
  const projectNameOf = useCallback(
    (doc: DocItem) =>
      (doc.projectId && projectNames.get(doc.projectId)) || doc.projectName,
    [projectNames],
  );

  const scopedDocs = useMemo(
    () =>
      filterAuthorId === undefined
        ? docs
        : docs.filter((doc) => doc.authorId === filterAuthorId),
    [docs, filterAuthorId],
  );

  const visibleDocs = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return scopedDocs.filter((doc) => {
      if (favoritesOnly && !doc.favorite) {
        return false;
      }
      if (categoryFilter !== 'all' && doc.category !== categoryFilter) {
        return false;
      }
      if (statusFilter !== 'all' && doc.status !== statusFilter) {
        return false;
      }
      if (!needle) return true;
      return (
        doc.title.toLowerCase().includes(needle) ||
        (doc.snippet ?? '').toLowerCase().includes(needle) ||
        (projectNameOf(doc) ?? '').toLowerCase().includes(needle)
      );
    });
  }, [
    scopedDocs,
    search,
    categoryFilter,
    statusFilter,
    favoritesOnly,
    projectNameOf,
  ]);

  return (
    <div className="px-4 sm:px-6 py-4 sm:py-6 flex h-full flex-col overflow-hidden">
      <Toolbar className="mb-4 shrink-0 justify-between gap-2 flex-wrap">
        <SearchInput
          value={search}
          onValueChange={setSearch}
          placeholder="Search documents…"
          className="bg-muted/40"
          wrapperClassName="w-48 sm:w-72"
        />

        <div className="flex items-center gap-2 flex-wrap">
          {/* Favorite filter toggle */}
          <Button
            variant={favoritesOnly ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setFavoritesOnly((prev) => !prev)}
            className="h-8 gap-1.5 text-xs"
            title="Show favorites only"
          >
            <Star
              className={cn(
                'size-3.5',
                favoritesOnly ? 'fill-accent-amber text-accent-amber' : 'text-muted-foreground',
              )}
            />
            <span className="hidden sm:inline">Favorites</span>
          </Button>

          {/* Category Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={categoryFilter === 'all' ? 'outline' : 'secondary'}
                size="sm"
                className="h-8 gap-1.5 text-xs"
              >
                <Tag className="size-3.5 text-muted-foreground" />
                <span>{categoryFilter === 'all' ? 'All categories' : categoryFilter}</span>
                <ChevronDown className="size-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel className="text-[11px]">Filter by category</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setCategoryFilter('all')}
                className="gap-2 text-xs"
              >
                <Check
                  className={cn(
                    'size-3.5 text-primary',
                    categoryFilter !== 'all' && 'opacity-0',
                  )}
                />
                All categories
              </DropdownMenuItem>
              {DOC_CATEGORIES.map((cat) => (
                <DropdownMenuItem
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className="gap-2 text-xs"
                >
                  <Check
                    className={cn(
                      'size-3.5 text-primary',
                      categoryFilter !== cat && 'opacity-0',
                    )}
                  />
                  {cat}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Status Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={statusFilter === 'all' ? 'outline' : 'secondary'}
                size="sm"
                className="h-8 gap-1.5 text-xs"
              >
                <Filter className="size-3.5 text-muted-foreground" />
                <span>{statusFilter === 'all' ? 'All statuses' : statusFilter}</span>
                <ChevronDown className="size-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel className="text-[11px]">Filter by status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setStatusFilter('all')}
                className="gap-2 text-xs"
              >
                <Check
                  className={cn(
                    'size-3.5 text-primary',
                    statusFilter !== 'all' && 'opacity-0',
                  )}
                />
                All statuses
              </DropdownMenuItem>
              {DOC_STATUSES.map((st) => (
                <DropdownMenuItem
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className="gap-2 text-xs"
                >
                  <Check
                    className={cn(
                      'size-3.5 text-primary',
                      statusFilter !== st && 'opacity-0',
                    )}
                  />
                  {st}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Layout Toggle */}
          <div className="flex items-center rounded-md border border-border p-0.5">
            <button
              type="button"
              onClick={() => setLayout('grid')}
              aria-pressed={layout === 'grid'}
              title="Grid layout"
              aria-label="Grid layout"
              className={cn(
                'rounded p-1.5 transition-colors cursor-pointer',
                layout === 'grid'
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <LayoutGrid className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setLayout('compact')}
              aria-pressed={layout === 'compact'}
              title="Compact layout"
              aria-label="Compact layout"
              className={cn(
                'rounded p-1.5 transition-colors cursor-pointer',
                layout === 'compact'
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <List className="size-3.5" />
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onBrowseTemplates}
            className="h-8 gap-1.5 text-xs"
          >
            <Zap className="size-3.5 text-accent-amber" />
            <span>Templates</span>
          </Button>

          <Button
            size="sm"
            onClick={onNewDoc}
            className="h-8 gap-1.5 text-xs font-semibold"
          >
            <Plus className="size-4" />
            <span>New Document</span>
          </Button>
        </div>
      </Toolbar>

      <ScrollArea className="min-h-0 flex-1" contentClassName="pb-6">
        {isLoading ? (
          <SkeletonList rows={6} />
        ) : visibleDocs.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-8 text-muted-foreground" />}
            title={
              scopedDocs.length > 0
                ? 'No documents match your filter'
                : filterAuthorId !== undefined
                ? 'No documents managed by you'
                : 'No documents yet'
            }
            description={
              scopedDocs.length > 0
                ? 'Try adjusting your search query, or clear the category or status filter.'
                : 'Create a document to start writing notes, project requirements, and architecture specs.'
            }
            action={
              scopedDocs.length === 0 ? (
                <div className="flex gap-2">
                  <Button size="sm" onClick={onNewDoc} leadingIcon={<Plus />}>
                    New Document
                  </Button>
                  <Button size="sm" variant="outline" onClick={onBrowseTemplates} leadingIcon={<Zap />}>
                    Use Template
                  </Button>
                </div>
              ) : undefined
            }
          />
        ) : (
          <div
            className={cn(
              'grid gap-3.5',
              layout === 'grid' ? 'sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1',
            )}
          >
            {visibleDocs.map((doc) => {
              const isActive = doc.id === activeDocId;
              const folderName = companyMap.get(doc.companyId) || 'General';
              const projectName = projectNameOf(doc);
              const actions = (
                <DocCardActions
                  doc={doc}
                  onCover={layout === 'grid'}
                  onSelectDoc={onSelectDoc}
                  onDuplicateDoc={onDuplicateDoc}
                  onDeleteDoc={onDeleteDoc}
                  onToggleFavorite={onToggleFavorite}
                />
              );

              return (
                <Card
                  key={doc.id}
                  onClick={() => onSelectDoc(doc.id)}
                  className={cn(
                    'group cursor-pointer bg-surface text-foreground border-border overflow-hidden transition-all duration-200',
                    'hover:border-border-strong hover:bg-surface-raised hover:shadow-xs',
                    isActive && 'ring-1 ring-primary border-primary',
                  )}
                >
                  {/* Card Cover Banner Header (in grid mode) */}
                  {layout === 'grid' && (
                    <div
                      className="h-16 w-full relative transition-opacity"
                      style={{ background: doc.cover || DEFAULT_COVER }}
                    >
                      <div className="absolute top-2 right-2">{actions}</div>
                    </div>
                  )}

                  <CardHeader className={cn(layout === 'grid' ? 'pt-3 pb-2' : 'py-3')}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xl shrink-0 select-none">
                          {doc.icon || '📝'}
                        </span>
                        <div className="min-w-0">
                          <CardTitle className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                            {/* The focusable control: its click bubbles to the card. */}
                            <button
                              type="button"
                              className="max-w-full truncate cursor-pointer text-left"
                            >
                              {doc.title || 'Untitled Document'}
                            </button>
                          </CardTitle>
                          <CardDescription className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate mt-0.5">
                            <Folder className="size-3 text-muted-foreground" />
                            <span>{folderName}</span>
                            {projectName && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1 text-primary">
                                  <FolderKanban className="size-3" />
                                  {projectName}
                                </span>
                              </>
                            )}
                          </CardDescription>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {layout === 'compact' && actions}
                        <DocStatusBadge status={doc.status} />
                        {doc.favorite && (
                          <Star className="size-3.5 fill-accent-amber text-accent-amber shrink-0" />
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0 pb-3">
                    {doc.snippet ? (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-3">
                        {doc.snippet}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground/60 italic mb-3">
                        Empty document
                      </p>
                    )}

                    <div className="flex items-center justify-between border-t border-border/60 pt-2.5 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-2 truncate">
                        {doc.authorName && (
                          <>
                            <span className="truncate max-w-[100px] font-medium text-foreground">
                              {doc.authorName}
                            </span>
                            <span>•</span>
                          </>
                        )}
                        <span>{doc.updatedAt}</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="neutral" className="text-[10px] px-1.5 py-0">
                          {doc.category}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {readingMinutes(doc.blocks)}m read
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
