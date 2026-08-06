import {
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
  DropdownMenuCheckboxItem,
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
  Filter,
  FolderKanban,
  Kanban,
  LayoutGrid,
  Plus,
  Search,
  SquareKanban,
  Tag,
  Trash2,
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
import { CardDetailsDialog } from './kanban/CardDetailsDialog.js';
import { KanbanListColumn } from './kanban/KanbanListColumn.js';
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

export function KanbanBoard() {
  const [searchParams] = useSearchParams();
  const {
    projects,
    activeProject,
    activeProjectId,
    setActiveProjectId,
    updateActiveBoardState,
    createProject,
    deleteProject,
  } = useProjectBoards();

  const [viewMode, setViewMode] = useState<'board' | 'projects'>('board');
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectCategory, setNewProjectCategory] = useState<ProjectCategory>('Engineering');
  const [newProjectColor, setNewProjectColor] = useState<ProjectColor>('violet');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectPreset, setNewProjectPreset] = useState<'standard' | 'sprint' | 'bug'>('standard');

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
  }, [searchParams, projects, setActiveProjectId]);

  // Active board state reducer
  const [board, dispatch] = useReducer(boardReducer, activeProject.board);

  // Keep board state in sync when switching projects or dispatching actions
  useEffect(() => {
    dispatch({ type: 'board/reset' });
  }, [activeProjectId]);

  // Sync board state back to project container when board state updates
  useEffect(() => {
    updateActiveBoardState(board);
  }, [board]);

  const [filter, setFilter] = useState<BoardFilter>(EMPTY_FILTER);
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
        list.cards.filter((card) => matchesFilter(card, filter, board.labels)),
      );
    }
    return map;
  }, [board.lists, board.labels, filter]);

  const totals = useMemo(() => {
    const all = board.lists.reduce((sum, list) => sum + list.cards.length, 0);
    let shown = 0;
    for (const cards of visibleByList.values()) shown += cards.length;
    return { all, shown };
  }, [board.lists, visibleByList]);

  const filterCount = useMemo(() => countActiveFilters(filter), [filter]);

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
      {/* 1. Top Header: Project Selector & View Mode Switcher */}
      <header className="mb-4 gap-x-4 gap-y-3 flex flex-wrap items-center justify-between">
        <div className="min-w-0 flex items-center gap-3">
          {/* Project Switcher Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="group flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-left hover:bg-accent transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="Switch project board"
              >
                <div
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-md text-primary-foreground font-bold text-xs',
                    activeProject.color === 'violet' && 'bg-violet-600',
                    activeProject.color === 'blue' && 'bg-blue-600',
                    activeProject.color === 'emerald' && 'bg-emerald-600',
                    activeProject.color === 'amber' && 'bg-amber-600',
                    activeProject.color === 'rose' && 'bg-rose-600',
                    activeProject.color === 'cyan' && 'bg-cyan-600',
                  )}
                >
                  <Kanban className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs sm:text-sm font-semibold text-foreground">
                      {activeProject.name}
                    </span>
                    <ChevronDown className="size-3.5 text-subtle group-hover:text-foreground transition-colors" />
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {activeProject.category} · {totals.all} tasks
                  </p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72 p-1 text-xs">
              <DropdownMenuLabel className="px-2 py-1 text-[10px] uppercase font-semibold text-subtle">
                Project Boards ({projects.length})
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="space-y-0.5 max-h-60 overflow-y-auto">
                {projects.map((p) => {
                  const isSelected = p.id === activeProjectId;
                  const totalCards = p.board.lists.reduce((acc, l) => acc + l.cards.length, 0);
                  const doneCards = p.board.lists.find((l) => l.title.toLowerCase().includes('done'))?.cards.length ?? 0;

                  return (
                    <DropdownMenuItem
                      key={p.id}
                      onSelect={() => {
                        setActiveProjectId(p.id);
                        setViewMode('board');
                      }}
                      className={cn(
                        'flex items-center justify-between gap-2 p-2 rounded-md cursor-pointer',
                        isSelected && 'bg-selected font-medium',
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={cn(
                            'size-2.5 rounded-full shrink-0',
                            p.color === 'violet' && 'bg-violet-500',
                            p.color === 'blue' && 'bg-blue-500',
                            p.color === 'emerald' && 'bg-emerald-500',
                            p.color === 'amber' && 'bg-amber-500',
                            p.color === 'rose' && 'bg-rose-500',
                            p.color === 'cyan' && 'bg-cyan-500',
                          )}
                        />
                        <div className="min-w-0">
                          <p className="font-medium truncate text-foreground">{p.name}</p>
                          <p className="text-[10px] text-subtle truncate">
                            {p.category} · {doneCards}/{totalCards} completed
                          </p>
                        </div>
                      </div>
                      {isSelected ? <Check className="size-3.5 text-primary shrink-0" /> : null}
                    </DropdownMenuItem>
                  );
                })}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setIsNewProjectOpen(true)}
                className="cursor-pointer text-primary font-medium flex items-center gap-1.5"
              >
                <Plus className="size-3.5" />
                <span>Create New Project Board</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View Mode Pills */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
            <button
              onClick={() => setViewMode('board')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors select-none',
                viewMode === 'board'
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <SquareKanban className="size-3.5" />
              <span>Board</span>
            </button>
            <button
              onClick={() => setViewMode('projects')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors select-none',
                viewMode === 'projects'
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <LayoutGrid className="size-3.5" />
              <span>All Projects ({projects.length})</span>
            </button>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsNewProjectOpen(true)}
            className="gap-1 text-xs px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
          >
            <Plus className="size-3.5" />
            <span>New Project</span>
          </Button>
        </div>
      </header>

      {/* 2. Content View: Either All Projects Grid OR Active Board View */}
      {viewMode === 'projects' ? (
        /* ALL PROJECTS GRID VIEW */
        <div className="flex-1 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Company Project Boards
            </h2>
            <span className="text-xs text-subtle">
              Showing {projects.length} project board{projects.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((proj) => {
              const totalCards = proj.board.lists.reduce((acc, l) => acc + l.cards.length, 0);
              const doneCards = proj.board.lists.find((l) => l.title.toLowerCase().includes('done'))?.cards.length ?? 0;
              const percent = totalCards > 0 ? Math.round((doneCards / totalCards) * 100) : 0;
              const isCurrent = proj.id === activeProjectId;

              return (
                <Card
                  key={proj.id}
                  className={cn(
                    'relative flex flex-col justify-between transition-all duration-200 hover:border-primary/50 hover:shadow-xs',
                    isCurrent && 'border-primary/60 ring-1 ring-primary/30',
                  )}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <Badge
                        variant="neutral"
                        className={cn(
                          'text-[10px] font-semibold uppercase',
                          proj.color === 'violet' && 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
                          proj.color === 'blue' && 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
                          proj.color === 'emerald' && 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
                          proj.color === 'amber' && 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
                          proj.color === 'rose' && 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
                          proj.color === 'cyan' && 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
                        )}
                      >
                        {proj.category}
                      </Badge>
                      {projects.length > 1 ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteProject(proj.id);
                          }}
                          className="text-subtle hover:text-destructive p-1 rounded-md transition-colors"
                          title="Delete project"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      ) : null}
                    </div>

                    <CardTitle className="text-base font-semibold mt-2 group-hover:text-primary transition-colors">
                      {proj.name}
                    </CardTitle>
                    <CardDescription className="text-xs line-clamp-2 leading-relaxed">
                      {proj.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-3 pt-0">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="text-muted-foreground text-[11px]">Task Progress</span>
                        <span className="font-mono text-[11px] text-foreground">
                          {doneCards}/{totalCards} ({percent}%)
                        </span>
                      </div>
                      <Progress value={percent} className="h-1.5" />
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/60">
                      <div className="flex items-center -space-x-1.5 overflow-hidden">
                        {proj.board.members.slice(0, 3).map((m) => (
                          <UserAvatar
                            key={m.id}
                            name={m.name}
                            seed={m.id}
                            size="xs"
                            className="ring-2 ring-background"
                          />
                        ))}
                      </div>

                      <Button
                        size="sm"
                        variant={isCurrent ? 'primary' : 'outline'}
                        onClick={() => {
                          setActiveProjectId(proj.id);
                          setViewMode('board');
                        }}
                        className="text-xs gap-1 h-7"
                      >
                        <span>{isCurrent ? 'Active Board' : 'Open Board'}</span>
                        <ArrowRight className="size-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ) : (
        /* ACTIVE KANBAN BOARD VIEW */
        <Fragment>
          {/* Board Filter Toolbar */}
          <Toolbar className="mb-4 shrink-0">
            <div className="relative min-w-40 flex-1 sm:max-w-64">
              <Search
                aria-hidden
                className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle"
              />
              <Input
                value={filter.query}
                placeholder="Filter cards..."
                aria-label="Filter cards by title"
                className="pl-8 text-xs"
                onChange={(event) =>
                  setFilter((prev) => ({ ...prev, query: event.target.value }))
                }
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <Filter className="size-3.5" />
                  <span>Labels</span>
                  {filter.labelIds.length > 0 ? (
                    <Badge variant="count">{filter.labelIds.length}</Badge>
                  ) : null}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 text-xs">
                <DropdownMenuLabel>Filter by label</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {board.labels.map((label) => {
                  const checked = filter.labelIds.includes(label.id);
                  return (
                    <DropdownMenuCheckboxItem
                      key={label.id}
                      checked={checked}
                      onCheckedChange={() =>
                        setFilter((prev) => ({
                          ...prev,
                          labelIds: checked
                            ? prev.labelIds.filter((id) => id !== label.id)
                            : [...prev.labelIds, label.id],
                        }))
                      }
                    >
                      <Tag className="size-3.5 mr-2" />
                      <span>{label.name}</span>
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {filterCount > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilter(EMPTY_FILTER)}
                className="text-xs text-subtle hover:text-foreground"
              >
                Clear filters ({filterCount})
              </Button>
            ) : null}
          </Toolbar>

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

      {/* Card Details Dialog */}
      {openCardId ? (
        <CardDetailsDialog
          cardId={openCardId}
          board={board}
          dispatch={dispatch}
          onClose={() => setOpenCardId(null)}
        />
      ) : null}

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
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Create Board
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
