import type { Project } from '@org/types';
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
  IconRenderer,
  ProjectGlyph,
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

type ProjectMark = Pick<Project, 'icon' | 'iconColor' | 'color'>;

export interface DocGalleryProps {
  docs: DocItem[];
  companies: CompanyItem[];
  /** Live project names; a name stored on a doc goes stale on rename. */
  projects?: Array<{ id: string; name: string } & Partial<ProjectMark>>;
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

interface DocCardActionsProps extends Pick<
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
        'gap-1 flex items-center rounded-md',
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
  const [categoryFilter, setCategoryFilter] = useState<DocCategory | 'all'>(
    'all',
  );
  const [statusFilter, setStatusFilter] = useState<DocStatus | 'all'>('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const companyMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of companies) {
      map.set(c.id, c.name);
    }
    return map;
  }, [companies]);

  const projectsById = useMemo(
    () => new Map(projects?.map((p) => [p.id, p])),
    [projects],
  );
  const projectNameOf = useCallback(
    (doc: DocItem) =>
      (doc.projectId && projectsById.get(doc.projectId)?.name) ||
      doc.projectName,
    [projectsById],
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
      <Toolbar className="mb-4 gap-2 shrink-0 flex-wrap justify-between">
        <SearchInput
          value={search}
          onValueChange={setSearch}
          placeholder="Search documents…"
          className="bg-muted/40"
          wrapperClassName="w-48 sm:w-72"
        />

        <div className="gap-2 flex flex-wrap items-center">
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
                favoritesOnly
                  ? 'fill-accent-amber text-accent-amber'
                  : 'text-muted-foreground',
              )}
            />
            <span className="sm:inline hidden">Favorites</span>
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
                <span>
                  {categoryFilter === 'all' ? 'All categories' : categoryFilter}
                </span>
                <ChevronDown className="size-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel className="text-[11px]">
                Filter by category
              </DropdownMenuLabel>
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
                <span>
                  {statusFilter === 'all' ? 'All statuses' : statusFilter}
                </span>
                <ChevronDown className="size-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel className="text-[11px]">
                Filter by status
              </DropdownMenuLabel>
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
          <div className="p-0.5 flex items-center rounded-md border border-border">
            <button
              type="button"
              onClick={() => setLayout('grid')}
              aria-pressed={layout === 'grid'}
              title="Grid layout"
              aria-label="Grid layout"
              className={cn(
                'rounded p-1.5 cursor-pointer transition-colors',
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
                'rounded p-1.5 cursor-pointer transition-colors',
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
                <div className="gap-2 flex">
                  <Button size="sm" onClick={onNewDoc} leadingIcon={<Plus />}>
                    New Document
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onBrowseTemplates}
                    leadingIcon={<Zap />}
                  >
                    Use Template
                  </Button>
                </div>
              ) : undefined
            }
          />
        ) : (
          <div
            className={cn(
              'gap-3.5 grid',
              layout === 'grid'
                ? 'sm:grid-cols-2 lg:grid-cols-3'
                : 'grid-cols-1',
            )}
          >
            {visibleDocs.map((doc) => {
              const isActive = doc.id === activeDocId;
              const folderName = companyMap.get(doc.companyId) || 'General';
              const projectName = projectNameOf(doc);
              const linkedProject = doc.projectId
                ? projectsById.get(doc.projectId)
                : undefined;
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
                    'group cursor-pointer overflow-hidden border-border bg-surface text-foreground transition-all duration-200',
                    'hover:border-border-strong hover:bg-surface-raised hover:shadow-xs',
                    isActive && 'border-primary ring-1 ring-primary',
                  )}
                >
                  {/* Card Cover Banner Header (in grid mode) */}
                  {layout === 'grid' && (
                    <div
                      className="h-16 relative w-full transition-opacity"
                      style={{ background: doc.cover || DEFAULT_COVER }}
                    >
                      <div className="top-2 right-2 absolute">{actions}</div>
                    </div>
                  )}

                  <CardHeader
                    className={cn(layout === 'grid' ? 'pt-3 pb-2' : 'py-3')}
                  >
                    <div className="gap-2 flex items-start justify-between">
                      <div className="gap-2.5 min-w-0 flex items-center">
                        <span className="text-xl shrink-0 select-none">
                          <IconRenderer
                            icon={doc.icon}
                            iconColor={doc.iconColor}
                          />
                        </span>
                        <div className="min-w-0">
                          <CardTitle className="text-sm font-semibold truncate transition-colors group-hover:text-primary">
                            {/* The focusable control: its click bubbles to the card. */}
                            <button
                              type="button"
                              className="max-w-full cursor-pointer truncate text-left"
                            >
                              {doc.title || 'Untitled Document'}
                            </button>
                          </CardTitle>
                          <CardDescription className="gap-1.5 mt-0.5 flex items-center truncate text-[11px] text-muted-foreground">
                            <Folder className="size-3 text-muted-foreground" />
                            <span>{folderName}</span>
                            {projectName && (
                              <>
                                <span>•</span>
                                <span className="gap-1 flex items-center text-primary">
                                  <ProjectGlyph
                                    icon={linkedProject?.icon}
                                    iconColor={linkedProject?.iconColor}
                                    color={linkedProject?.color}
                                    size="xs"
                                  />
                                  {projectName}
                                </span>
                              </>
                            )}
                          </CardDescription>
                        </div>
                      </div>

                      <div className="gap-1.5 flex shrink-0 items-center">
                        {layout === 'compact' && actions}
                        <DocStatusBadge status={doc.status} />
                        {doc.favorite && (
                          <Star className="size-3.5 shrink-0 fill-accent-amber text-accent-amber" />
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0 pb-3">
                    {doc.snippet ? (
                      <p className="text-xs leading-relaxed mb-3 line-clamp-2 text-muted-foreground">
                        {doc.snippet}
                      </p>
                    ) : (
                      <p className="text-xs mb-3 text-muted-foreground/60 italic">
                        Empty document
                      </p>
                    )}

                    <div className="pt-2.5 flex items-center justify-between border-t border-border/60 text-[11px] text-muted-foreground">
                      <div className="gap-2 flex items-center truncate">
                        {doc.authorName && (
                          <>
                            <span className="font-medium max-w-[100px] truncate text-foreground">
                              {doc.authorName}
                            </span>
                            <span>•</span>
                          </>
                        )}
                        <span>{doc.updatedAt}</span>
                      </div>

                      <div className="gap-2 flex shrink-0 items-center">
                        <Badge
                          variant="neutral"
                          className="px-1.5 py-0 text-[10px]"
                        >
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
