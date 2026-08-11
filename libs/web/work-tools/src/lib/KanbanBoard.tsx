import {
  accentClasses,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Progress,
  Toolbar,
  UserAvatar,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Download,
  Filter,
  FolderKanban,
  Import,
  Kanban,
  LayoutGrid,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import { boardReducer } from './kanban/board-state.js';
import {
  countActiveFilters,
  EMPTY_FILTER,
  matchesFilter,
  type BoardFilter,
} from './kanban/card-meta.js';
import { LinearFilterMenu } from './kanban/LinearFilterMenu.js';
import { CardDetailsDialog } from './kanban/CardDetailsDialog.js';
import { KanbanListColumn } from './kanban/KanbanListColumn.js';
import {
  ImportBoardDialog,
  type ImportResult,
} from './kanban/import/ImportBoardDialog.js';
import { exportBoard, mergeBoards } from './kanban/import/normalize.js';
import { IMPORT_SOURCES } from './kanban/import/sources.js';
import {
  useProjectBoards,
  type ProjectCategory,
  type ProjectColor,
} from './kanban/project-boards-hook.js';
import type { KanbanCard } from './kanban/types.js';

export type {
  BoardLabel,
  BoardMember,
  BoardState,
  CardComment,
  ChecklistItem,
  KanbanCard,
  KanbanList,
  Priority,
  TaskItem,
} from './kanban/types.js';

type DragState =
  | { kind: 'card'; cardId: string; height: number }
  | { kind: 'list'; listId: string };

const EDGE_ZONE = 96;
const EDGE_SPEED = 22;

/** List titles that mean "finished", used to score project completion. */
const DONE_LIST = /^(done|closed|resolved|approved|complete[d]?|shipped)\b/i;

const PROJECT_CATEGORIES: readonly ProjectCategory[] = [
  'Engineering',
  'Design',
  'Marketing',
  'Product',
  'Operations',
];

export interface KanbanBoardProps {
  filter?: BoardFilter;
  setFilter?: React.Dispatch<React.SetStateAction<BoardFilter>>;
  isFilterMenuOpen?: boolean;
  setIsFilterMenuOpen?: (open: boolean) => void;
  showAIFilterInput?: boolean;
  setShowAIFilterInput?: (show: boolean) => void;
}

export function KanbanBoard({
  filter: externalFilter,
  setFilter: externalSetFilter,
  isFilterMenuOpen: externalIsFilterMenuOpen,
  setIsFilterMenuOpen: externalSetIsFilterMenuOpen,
  showAIFilterInput: externalShowAIFilterInput,
  setShowAIFilterInput: externalSetShowAIFilterInput,
}: KanbanBoardProps = {}) {
  const [searchParams] = useSearchParams();
  const {
    projects,
    activeProject,
    activeProjectId,
    setActiveProjectId,
    updateActiveBoardState,
    createProject,
    importProject,
    deleteProject,
  } = useProjectBoards();

  const [viewMode, setViewMode] = useState<'board' | 'projects'>('board');
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectCategory, setNewProjectCategory] = useState<ProjectCategory>('Engineering');
  const [newProjectColor, setNewProjectColor] = useState<ProjectColor>('violet');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectPreset, setNewProjectPreset] = useState<'standard' | 'sprint' | 'bug'>('standard');

  // Project gallery controls
  const [projectSearch, setProjectSearch] = useState('');
  const [projectLayout, setProjectLayout] = useState<'grid' | 'compact'>('grid');
  const [categoryFilter, setCategoryFilter] = useState<ProjectCategory | 'all'>('all');

  // Handle URL query parameters for project selection and modals
  useEffect(() => {
    const projParam = searchParams.get('project');
    const viewParam = searchParams.get('view');
    const newProjParam = searchParams.get('newProject');

    if (projParam && projects.some((p) => p.id === projParam)) {
      setActiveProjectId(projParam);
      setViewMode('board');
    } else if (viewParam === 'projects') {
      setViewMode('projects');
    }

    if (newProjParam === 'true') {
      setIsNewProjectOpen(true);
    }

    // `?import=true` lets any entry point — the create menu, a link in an
    // onboarding email — land straight on the importer.
    if (searchParams.get('import') === 'true') {
      setIsImportOpen(true);
    }
  }, [searchParams, projects, setActiveProjectId]);

  // Active board state reducer
  const [board, dispatch] = useReducer(boardReducer, activeProject.board);

  /*
   * Load the selected project's own board. This has to be `board/replace` and
   * not `board/reset` — the latter installs the seed board, which then syncs
   * back over whatever the project actually contained.
   */
  useEffect(() => {
    dispatch({ type: 'board/replace', state: activeProject.board });
    // Only the identity of the project should trigger a reload; reacting to
    // `activeProject.board` too would undo every edit as it is saved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  // Sync board state back to project container when board state updates
  useEffect(() => {
    updateActiveBoardState(board);
  }, [board]);

  const [internalFilter, setInternalFilter] = useState<BoardFilter>(EMPTY_FILTER);
  const filter = externalFilter ?? internalFilter;
  const setFilter = externalSetFilter ?? setInternalFilter;

  const [internalIsFilterMenuOpen, setInternalIsFilterMenuOpen] = useState(false);
  const isFilterMenuOpen = externalIsFilterMenuOpen ?? internalIsFilterMenuOpen;
  const setIsFilterMenuOpen = externalSetIsFilterMenuOpen ?? setInternalIsFilterMenuOpen;

  const [internalShowAIFilterInput, setInternalShowAIFilterInput] = useState(false);
  const showAIFilterInput = externalShowAIFilterInput ?? internalShowAIFilterInput;
  const setShowAIFilterInput = externalSetShowAIFilterInput ?? setInternalShowAIFilterInput;
  const [aiPromptInput, setAiPromptInput] = useState('');
  const [showLabelText] = useState(true);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [addingList, setAddingList] = useState(false);
  const [listDraft, setListDraft] = useState('');

  const [drag, setDrag] = useState<DragState | null>(null);
  const [liftedCardId, setLiftedCardId] = useState<string | null>(null);
  const [liftedListId, setLiftedListId] = useState<string | null>(null);
  const [cardDrop, setCardDrop] = useState<{
    listId: string;
    index: number;
  } | null>(null);
  const [listDropIndex, setListDropIndex] = useState<number | null>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);

  const visibleByList = useMemo(() => {
    const map = new Map<string, KanbanCard[]>();
    for (const list of board.lists) {
      map.set(
        list.id,
        list.cards.filter((card) => matchesFilter(card, filter, board.labels, list.id)),
      );
    }
    return map;
  }, [board.lists, board.labels, filter]);

  const filterCount = useMemo(() => countActiveFilters(filter), [filter]);

  /*
   * A project's completion is read off its own board rather than stored, so it
   * stays correct when cards are dragged between lists. A card counts as done
   * when it sits in a terminal list or its due date has been ticked off.
   */
  const projectStats = useMemo(() => {
    const stats = new Map<string, { total: number; done: number; percent: number }>();

    for (const project of projects) {
      let total = 0;
      let done = 0;

      for (const list of project.board.lists) {
        const terminal = DONE_LIST.test(list.title);
        total += list.cards.length;
        for (const card of list.cards) {
          if (terminal || card.dueComplete) done += 1;
        }
      }

      stats.set(project.id, {
        total,
        done,
        percent: total === 0 ? 0 : Math.round((done / total) * 100),
      });
    }

    return stats;
  }, [projects]);

  const visibleProjects = useMemo(() => {
    const needle = projectSearch.trim().toLowerCase();

    return projects.filter((project) => {
      if (categoryFilter !== 'all' && project.category !== categoryFilter) {
        return false;
      }
      if (!needle) return true;
      return (
        project.name.toLowerCase().includes(needle) ||
        project.description.toLowerCase().includes(needle) ||
        project.category.toLowerCase().includes(needle)
      );
    });
  }, [projects, projectSearch, categoryFilter]);

  const openProject = useCallback(
    (projectId: string) => {
      setActiveProjectId(projectId);
      setViewMode('board');
    },
    [setActiveProjectId],
  );

  const clearDrag = useCallback(() => {
    setDrag(null);
    setLiftedCardId(null);
    setLiftedListId(null);
    setCardDrop(null);
    setListDropIndex(null);
  }, []);

  const handleCardDragStart = useCallback(
    (event: DragEvent<HTMLLIElement>, card: KanbanCard) => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', card.id);
      setDrag({
        kind: 'card',
        cardId: card.id,
        height: event.currentTarget.getBoundingClientRect().height,
      });

      for (const [listId, cards] of visibleByList) {
        const at = cards.findIndex((entry) => entry.id === card.id);
        if (at !== -1) {
          setCardDrop({ listId, index: at });
          break;
        }
      }

      requestAnimationFrame(() => setLiftedCardId(card.id));
    },
    [visibleByList],
  );

  const handleCardDragOver = useCallback((listId: string, index: number) => {
    setCardDrop((current) =>
      current && current.listId === listId && current.index === index
        ? current
        : { listId, index },
    );
  }, []);

  const handleCardDrop = useCallback(
    (toListId: string, visualIndex: number) => {
      if (drag?.kind !== 'card') return;

      const list = board.lists.find((entry) => entry.id === toListId);
      if (!list) return;

      const visible = (visibleByList.get(toListId) ?? []).filter(
        (card) => card.id !== drag.cardId,
      );
      const remaining = list.cards.filter((card) => card.id !== drag.cardId);

      let toIndex = remaining.length;
      if (visualIndex < visible.length) {
        const anchor = remaining.findIndex(
          (card) => card.id === visible[visualIndex].id,
        );
        if (anchor !== -1) toIndex = anchor;
      }

      dispatch({ type: 'card/move', cardId: drag.cardId, toListId, toIndex });
      clearDrag();
    },
    [board.lists, clearDrag, dispatch, drag, visibleByList],
  );

  const handleListDragStart = useCallback(
    (event: DragEvent<HTMLElement>, listId: string) => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', listId);
      const column =
        event.currentTarget.closest<HTMLElement>('[data-kanban-list]');
      if (column) event.dataTransfer.setDragImage(column, 24, 24);
      setDrag({ kind: 'list', listId });
      requestAnimationFrame(() => setLiftedListId(listId));
    },
    [],
  );

  const handleBoardDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!drag) return;
    event.preventDefault();

    const scroller = scrollerRef.current;
    if (scroller) {
      const rect = scroller.getBoundingClientRect();
      if (event.clientX < rect.left + EDGE_ZONE) {
        scroller.scrollLeft -= EDGE_SPEED;
      } else if (event.clientX > rect.right - EDGE_ZONE) {
        scroller.scrollLeft += EDGE_SPEED;
      }
    }

    if (drag.kind !== 'list') return;

    const columns = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[data-kanban-list]'),
    );

    let index = columns.length;
    for (let i = 0; i < columns.length; i += 1) {
      const bounds = columns[i].getBoundingClientRect();
      if (event.clientX < bounds.left + bounds.width / 2) {
        index = i;
        break;
      }
    }
    setListDropIndex((current) => (current === index ? current : index));
  };

  const handleBoardDrop = (event: DragEvent<HTMLDivElement>) => {
    if (drag?.kind !== 'list' || listDropIndex === null) return;
    event.preventDefault();
    dispatch({
      type: 'list/move',
      listId: drag.listId,
      toIndex: listDropIndex,
    });
    clearDrag();
  };

  const submitList = () => {
    const title = listDraft.trim();
    if (!title) return;
    dispatch({ type: 'list/add', title });
    setListDraft('');
    requestAnimationFrame(() => {
      const scroller = scrollerRef.current;
      if (scroller) scroller.scrollLeft = scroller.scrollWidth;
    });
  };

  const handleListDraftKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitList();
    }
    if (event.key === 'Escape') setAddingList(false);
  };

  /**
   * A merge lands in the reducer so the open board updates in place; a new
   * board goes through the project store, which then swaps the reducer over.
   */
  const handleImport = useCallback(
    (result: ImportResult) => {
      const sourceName =
        IMPORT_SOURCES.find((entry) => entry.id === result.source)?.name ??
        result.source;

      if (result.mode === 'merge') {
        dispatch({ type: 'board/replace', state: mergeBoards(board, result.board) });
      } else {
        importProject({
          name: result.name,
          category: result.category,
          color: result.color,
          description: `Imported from ${sourceName}.`,
          board: result.board,
        });
      }
      setViewMode('board');
    },
    [board, importProject],
  );

  /** Downloads a board as JSON that the `OneTab board` importer can read back. */
  const handleExport = useCallback((projectId: string) => {
    const project = projects.find((entry) => entry.id === projectId);
    if (!project) return;

    const blob = new Blob([exportBoard(project.board)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.name.replace(/[^\w.-]+/g, '-').toLowerCase()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [projects]);

  const handleCreateProjectSubmit = () => {
    if (!newProjectName.trim()) return;
    createProject({
      name: newProjectName.trim(),
      category: newProjectCategory,
      color: newProjectColor,
      description: newProjectDesc.trim() || 'Custom project workspace board.',
      preset: newProjectPreset,
    });
    setNewProjectName('');
    setNewProjectDesc('');
    setIsNewProjectOpen(false);
    setViewMode('board');
  };

  let stationaryIndex = 0;

  return (
    <div className="group/board min-h-128 px-4 sm:px-6 py-4 sm:py-6 flex h-full flex-col overflow-hidden text-foreground">
      {/* ACTIVE KANBAN BOARD VIEW */}
      {viewMode === 'board' && (
        <Fragment>


          {/* Board Filter Controls & AI Overlay */}
          <div className="relative mb-2 shrink-0 space-y-2">

            {/* AI Filter Input Prompt Overlay Bar */}
            {showAIFilterInput && (
              <div className="flex items-center gap-2 p-2 rounded-xl border border-accent-violet/40 bg-accent-violet-soft text-xs animate-in fade-in">
                <Sparkles className="size-4 text-accent-violet shrink-0" />
                <Input
                  autoFocus
                  value={aiPromptInput}
                  onChange={(e) => {
                    setAiPromptInput(e.target.value);
                    setFilter((prev) => ({ ...prev, aiQuery: e.target.value }));
                  }}
                  placeholder='Ask AI filter (e.g. "show high priority tasks in progress" or "overdue tasks")...'
                  className="flex-1 text-xs h-7 bg-transparent border-none shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/70"
                />
                {aiPromptInput && (
                  <button
                    onClick={() => {
                      setAiPromptInput('');
                      setFilter((prev) => ({ ...prev, aiQuery: '' }));
                    }}
                    className="p-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Active Filter Chips Pill Bar */}
            {filterCount > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap text-xs pt-1">
                <span className="text-[11px] font-medium text-muted-foreground">Active filters:</span>

                {filter.query && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-[11px] font-medium">
                    Query: "{filter.query}"
                    <X
                      className="size-3 cursor-pointer hover:text-foreground"
                      onClick={() => setFilter((prev) => ({ ...prev, query: '' }))}
                    />
                  </span>
                )}

                {filter.aiQuery && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-violet-soft text-accent-violet text-[11px] font-medium">
                    ✨ AI: "{filter.aiQuery}"
                    <X
                      className="size-3 cursor-pointer hover:text-foreground"
                      onClick={() => setFilter((prev) => ({ ...prev, aiQuery: '' }))}
                    />
                  </span>
                )}

                {filter.status.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-[11px] font-medium">
                    Status ({filter.status.length})
                    <X
                      className="size-3 cursor-pointer hover:text-foreground"
                      onClick={() => setFilter((prev) => ({ ...prev, status: [] }))}
                    />
                  </span>
                )}

                {filter.priorities.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-[11px] font-medium">
                    Priority ({filter.priorities.length})
                    <X
                      className="size-3 cursor-pointer hover:text-foreground"
                      onClick={() => setFilter((prev) => ({ ...prev, priorities: [] }))}
                    />
                  </span>
                )}

                {filter.labelIds.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-[11px] font-medium">
                    Labels ({filter.labelIds.length})
                    <X
                      className="size-3 cursor-pointer hover:text-foreground"
                      onClick={() => setFilter((prev) => ({ ...prev, labelIds: [] }))}
                    />
                  </span>
                )}

                {filter.due !== 'any' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-[11px] font-medium capitalize">
                    Due: {filter.due}
                    <X
                      className="size-3 cursor-pointer hover:text-foreground"
                      onClick={() => setFilter((prev) => ({ ...prev, due: 'any' }))}
                    />
                  </span>
                )}

                <button
                  onClick={() => {
                    setFilter(EMPTY_FILTER);
                    setAiPromptInput('');
                  }}
                  className="text-[11px] text-muted-foreground hover:text-foreground underline ml-1"
                >
                  Clear all
                </button>
              </div>
            )}

            {/* Floating Linear Filter Popover Menu */}
            <LinearFilterMenu
              filter={filter}
              setFilter={setFilter}
              labels={board.labels}
              members={board.members}
              lists={board.lists}
              isOpen={isFilterMenuOpen}
              onClose={() => setIsFilterMenuOpen(false)}
              onActivateAIFilter={() => {
                setShowAIFilterInput(true);
              }}
            />
          </div>

          {/* Kanban Columns Drag Scroller */}
          <div
            ref={scrollerRef}
            onDragOver={handleBoardDragOver}
            onDrop={handleBoardDrop}
            className="no-scrollbar flex flex-1 items-start gap-4 overflow-x-auto pb-4"
          >
            {board.lists.map((list, index) => {
              const visibleCards = visibleByList.get(list.id) ?? [];
              const isDropTarget =
                drag?.kind === 'list' && listDropIndex === stationaryIndex;
              stationaryIndex += 1;

              return (
                <Fragment key={list.id}>
                  {isDropTarget ? (
                    <div className="w-72 shrink-0 rounded-card border-2 border-dashed border-primary/40 bg-accent/20 h-64" />
                  ) : null}

                  <KanbanListColumn
                    key={list.id}
                    list={list}
                    lists={board.lists}
                    labels={board.labels}
                    members={board.members}
                    visibleCards={visibleCards}
                    hiddenCount={list.cards.length - visibleCards.length}
                    index={index}
                    showLabelText={showLabelText}
                    dispatch={dispatch}
                    draggingCardId={drag?.kind === 'card' ? drag.cardId : undefined}
                    liftedCardId={liftedCardId ?? undefined}
                    liftedList={liftedListId === list.id}
                    dropIndex={cardDrop?.listId === list.id ? cardDrop.index : undefined}
                    dropHeight={drag?.kind === 'card' ? drag.height : 0}
                    onOpenCard={(cardId: string) => setOpenCardId(cardId)}
                    onCardDragStart={handleCardDragStart}
                    onCardDragEnd={clearDrag}
                    onCardDragOver={handleCardDragOver}
                    onCardDrop={handleCardDrop}
                    onListDragStart={handleListDragStart}
                    onListDragEnd={clearDrag}
                  />
                </Fragment>
              );
            })}

            {/* Add Column Button */}
            {addingList ? (
              <div className="w-72 shrink-0 rounded-card border border-border bg-surface p-3 space-y-2">
                <Input
                  autoFocus
                  value={listDraft}
                  placeholder="Enter list title..."
                  aria-label="List title"
                  onChange={(e) => setListDraft(e.target.value)}
                  onKeyDown={handleListDraftKeyDown}
                  className="text-xs"
                />
                <div className="flex items-center gap-1.5">
                  <Button size="sm" onClick={submitList} className="text-xs h-7">
                    Add List
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAddingList(false)}
                    className="text-xs h-7"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingList(true)}
                className="flex w-72 shrink-0 items-center gap-2 rounded-card border border-dashed border-border bg-surface/40 p-3 text-xs font-medium text-subtle hover:border-border-strong hover:bg-surface hover:text-foreground transition-colors"
              >
                <Plus className="size-4" />
                <span>Add another list</span>
              </button>
            )}
          </div>
        </Fragment>
      )}

      {/* PROJECT GALLERY VIEW */}
      {viewMode === 'projects' && (
        <Fragment>
          {/* Gallery Toolbar: search, category filter, layout toggle, new board */}
          <Toolbar className="mb-4 shrink-0 justify-between">
            <div className="relative w-48 sm:w-72">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                placeholder="Search project boards..."
                aria-label="Search project boards"
                className="h-8 bg-muted/40 pl-8 text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              {/* Category Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={categoryFilter === 'all' ? 'outline' : 'secondary'}
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                  >
                    <Filter className="size-3.5 text-muted-foreground" />
                    <span>
                      {categoryFilter === 'all' ? 'All categories' : categoryFilter}
                    </span>
                    <ChevronDown className="size-3.5 text-muted-foreground" />
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
                  {PROJECT_CATEGORIES.map((category) => (
                    <DropdownMenuItem
                      key={category}
                      onClick={() => setCategoryFilter(category)}
                      className="gap-2 text-xs"
                    >
                      <Check
                        className={cn(
                          'size-3.5 text-primary',
                          categoryFilter !== category && 'opacity-0',
                        )}
                      />
                      {category}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Layout Toggle */}
              <div className="flex items-center rounded-md border border-border p-0.5">
                <button
                  type="button"
                  onClick={() => setProjectLayout('grid')}
                  aria-pressed={projectLayout === 'grid'}
                  title="Grid layout"
                  className={cn(
                    'rounded p-1.5 transition-colors',
                    projectLayout === 'grid'
                      ? 'bg-accent text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <LayoutGrid className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setProjectLayout('compact')}
                  aria-pressed={projectLayout === 'compact'}
                  title="Compact layout"
                  className={cn(
                    'rounded p-1.5 transition-colors',
                    projectLayout === 'compact'
                      ? 'bg-accent text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Kanban className="size-3.5" />
                </button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsImportOpen(true)}
                className="h-8 gap-1.5 text-xs"
              >
                <Import className="size-3.5 text-muted-foreground" />
                Import
              </Button>

              <Button
                size="sm"
                onClick={() => setIsNewProjectOpen(true)}
                className="h-8 gap-1.5 text-xs font-semibold"
              >
                <Plus className="size-4" />
                New Board
              </Button>
            </div>
          </Toolbar>

          {/* Project Cards */}
          <div className="flex-1 overflow-y-auto pb-4">
            {visibleProjects.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <FolderKanban className="size-8 text-subtle" />
                <p className="text-sm font-medium text-foreground">
                  No boards match your search
                </p>
                <p className="text-xs text-muted-foreground">
                  Try a different term, or clear the category filter.
                </p>
              </div>
            ) : (
              <div
                className={cn(
                  'grid gap-3',
                  projectLayout === 'grid'
                    ? 'sm:grid-cols-2 xl:grid-cols-3'
                    : 'grid-cols-1',
                )}
              >
                {visibleProjects.map((project) => {
                  const stats = projectStats.get(project.id) ?? {
                    total: 0,
                    done: 0,
                    percent: 0,
                  };
                  const accent = accentClasses[project.color];
                  const isActive = project.id === activeProjectId;

                  return (
                    <Card
                      key={project.id}
                      onClick={() => openProject(project.id)}
                      className={cn(
                        'cursor-pointer bg-surface text-foreground border-border',
                        'hover:border-border-strong hover:bg-surface-raised',
                        isActive && `ring-1 ${accent.ring} border-transparent`,
                      )}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className={cn('size-2 shrink-0 rounded-full', accent.bg)}
                              aria-hidden
                            />
                            <CardTitle className="truncate text-foreground">
                              {project.name}
                            </CardTitle>
                            {isActive ? (
                              <Check className="size-3.5 shrink-0 text-primary" />
                            ) : null}
                          </div>

                          {/* Per-project actions */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                onClick={(e) => e.stopPropagation()}
                                title="Board options"
                                className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                              >
                                <ChevronDown className="size-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-44"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <DropdownMenuLabel className="text-[11px]">
                                {project.name}
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => openProject(project.id)}
                                className="gap-2 text-xs"
                              >
                                <ArrowRight className="size-3.5 text-primary" />
                                Open board
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleExport(project.id)}
                                className="gap-2 text-xs"
                              >
                                <Download className="size-3.5 text-muted-foreground" />
                                Export as JSON
                              </DropdownMenuItem>
                              {projects.length > 1 && (
                                <DropdownMenuItem
                                  onClick={() => deleteProject(project.id)}
                                  className="gap-2 text-xs text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="size-3.5" />
                                  Delete board
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <CardDescription className="line-clamp-2 text-muted-foreground">
                          {project.description}
                        </CardDescription>
                      </CardHeader>

                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="neutral">{project.category}</Badge>
                          <span className="text-[11px] tabular-nums text-muted-foreground">
                            {stats.done}/{stats.total} done
                          </span>
                        </div>

                        <Progress
                          value={stats.percent}
                          accent={project.color}
                          size="sm"
                          label={`${project.name} is ${stats.percent}% complete`}
                        />

                        <div className="flex items-center justify-between">
                          {/* Member stack */}
                          <div className="flex -space-x-1.5">
                            {project.board.members.slice(0, 4).map((member) => (
                              <UserAvatar
                                key={member.id}
                                name={member.name}
                                seed={member.id}
                                src={member.avatarUrl}
                                size="xs"
                                className="ring-1 ring-surface"
                              />
                            ))}
                            {project.board.members.length > 4 && (
                              <span className="flex size-5 items-center justify-center rounded-full bg-surface-inset text-[10px] font-medium text-muted-foreground ring-1 ring-surface">
                                +{project.board.members.length - 4}
                              </span>
                            )}
                          </div>

                          <span className="text-[11px] text-subtle">
                            {new Date(project.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </Fragment>
      )}

      {/* Card Details Dialog */}
      {openCardId ? (
        <CardDetailsDialog
          cardId={openCardId}
          board={board}
          dispatch={dispatch}
          onClose={() => setOpenCardId(null)}
        />
      ) : null}

      {/* Import Board Dialog */}
      <ImportBoardDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onImport={handleImport}
        currentBoardName={activeProject?.name}
      />

      {/* New Project Dialog */}
      <Dialog open={isNewProjectOpen} onOpenChange={setIsNewProjectOpen}>
        <DialogContent className="sm:max-w-md text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <FolderKanban className="size-4 text-primary" />
              <span>Create Project Board</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Project Name
              </label>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g. Customer Mobile App v2.0"
                className="w-full px-3 py-1.5 bg-surface border border-border rounded-md text-xs text-foreground placeholder:text-subtle focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Department / Category
                </label>
                <select
                  value={newProjectCategory}
                  onChange={(e) => setNewProjectCategory(e.target.value as ProjectCategory)}
                  className="w-full px-3 py-1.5 bg-surface border border-border rounded-md text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Engineering">Engineering</option>
                  <option value="Design">Design</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Product">Product</option>
                  <option value="Operations">Operations</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Color Tag
                </label>
                <select
                  value={newProjectColor}
                  onChange={(e) => setNewProjectColor(e.target.value as ProjectColor)}
                  className="w-full px-3 py-1.5 bg-surface border border-border rounded-md text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="violet">Violet</option>
                  <option value="blue">Blue</option>
                  <option value="emerald">Emerald</option>
                  <option value="amber">Amber</option>
                  <option value="rose">Rose</option>
                  <option value="cyan">Cyan</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Template Preset
              </label>
              <select
                value={newProjectPreset}
                onChange={(e) => setNewProjectPreset(e.target.value as 'standard' | 'sprint' | 'bug')}
                className="w-full px-3 py-1.5 bg-surface border border-border rounded-md text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="standard">Standard Kanban (To Do, In Progress, Review, Done)</option>
                <option value="sprint">Agile Sprint Backlog (Backlog, In Progress, Review, QA, Done)</option>
                <option value="bug">Bug Tracking (Reported, Investigating, Fix Progress, Closed)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Description
              </label>
              <textarea
                rows={2}
                value={newProjectDesc}
                onChange={(e) => setNewProjectDesc(e.target.value)}
                placeholder="Brief project summary or sprint goals..."
                className="w-full px-3 py-1.5 bg-surface border border-border rounded-md text-xs text-foreground placeholder:text-subtle focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsNewProjectOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreateProjectSubmit}
              disabled={!newProjectName.trim()}
              className="bg-primary hover:bg-primary-hover text-primary-foreground"
            >
              Create Board
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
