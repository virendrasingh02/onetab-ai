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
  Filter,
  FolderKanban,
  Kanban,
  LayoutGrid,
  Plus,
  Search,
  Sparkles,
  SquareKanban,
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
      {/* ACTIVE KANBAN BOARD VIEW */}
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
