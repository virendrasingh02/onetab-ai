import { aiApi } from '@org/api-client';
import { type TaskStatus } from '@org/types';
import {
  Button,
  DatePicker,
  Dialog,
  DialogContent,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Textarea,
  toast,
  UserAvatar,
  UserAvatarGroup,
  useRightPanelStore,
} from '@org/ui';
import { cn, formatRelative } from '@org/utils';
import { useMutation } from '@tanstack/react-query';
import {
  AlertTriangle,
  AlignLeft,
  AtSign,
  CalendarDays,
  CalendarPlus,
  CalendarX2,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Expand,
  Filter,
  ListCheck,
  Maximize2,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  PanelRight,
  Pencil,
  Plus,
  Search,
  Send,
  Share2,
  Smile,
  Sparkles,
  Star,
  Tag,
  Timer,
  Trash2,
  Users,
  Video,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAddTaskComment, useTaskComments } from '../use-work-tools.js';
import { parseDay } from './card-meta.js';
import {
  useKanbanCardViewStore,
  type KanbanCardViewMode,
} from './kanban-card-view-store.js';
import {
  useKanbanCustomStore,
  type ChecklistItem,
} from './kanban-custom-store.js';
import { KanbanLabelPicker } from './KanbanLabelPicker.js';
import { KanbanLeadPicker } from './KanbanLeadPicker.js';
import {
  KanbanPriorityPicker,
  type PriorityOption,
} from './KanbanPriorityPicker.js';
import { KanbanStatusPicker } from './KanbanStatusPicker.js';
import {
  CubeProjectIcon,
  PriorityIcon,
  StatusIcon,
  UnassignedLeadIcon,
} from './kanban-icons.js';
import type { BoardAction } from './server-board.js';
import type { BoardState, KanbanCard, KanbanList, Priority } from './types.js';

export interface CardDetailsDialogProps {
  workspaceId: string | undefined;
  board: BoardState;
  /** Open card, or null when the dialog is closed. */
  cardId: string | null;
  dispatch: (action: BoardAction) => void;
  onClose: () => void;
}

function findCard(
  board: BoardState,
  cardId: string,
): { list: KanbanList; card: KanbanCard } | undefined {
  for (const list of board.lists) {
    const card = list.cards.find((entry) => entry.id === cardId);
    if (card) return { list, card };
  }
  return undefined;
}

/**
 * Hosts an open card in whichever of the three surfaces the user last chose.
 *
 * The rail case is a portal rather than a second copy of the body: the card's
 * edit state (a half-typed description, an open picker) lives in
 * `CardDetailsBody`, and re-mounting it on every view change would throw that
 * away. The shell publishes an empty element and this renders into it, so
 * switching between rail and dialog moves the same live component.
 */
export function CardDetailsDialog({
  workspaceId,
  board,
  cardId,
  dispatch,
  onClose,
}: CardDetailsDialogProps) {
  const found = cardId ? findCard(board, cardId) : undefined;
  const mode = useKanbanCardViewStore((s) => s.mode);

  const cardSlot = useRightPanelStore((s) => s.slots.card);
  const openHosted = useRightPanelStore((s) => s.openHosted);
  const closeHosted = useRightPanelStore((s) => s.closeHosted);

  const inPanel = mode === 'panel';

  /*
   * Claim the rail while a card is open in panel mode, and give it back on
   * close or on a switch to a dialog — otherwise the rail would outlive the
   * card and show an empty column. `onClose` goes with the claim so dismissing
   * the rail closes the card rather than orphaning it.
   */
  useEffect(() => {
    if (!found || !inPanel) return;
    /* The card draws its own toolbar, so it needs no title from the rail. */
    openHosted('card', { title: '', onClose });
    return () => closeHosted('card');
  }, [found, inPanel, onClose, openHosted, closeHosted]);

  if (!found) return null;

  const body = (
    <CardDetailsBody
      workspaceId={workspaceId}
      board={board}
      card={found.card}
      listId={found.list.id}
      listTitle={found.list.title}
      dispatch={dispatch}
      onClose={onClose}
      mode={mode}
    />
  );

  if (inPanel) {
    // Nothing to render until the shell has mounted its slot — one frame.
    return cardSlot ? createPortal(body, cardSlot) : null;
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className={cn(
          'p-0 overflow-hidden flex flex-col bg-card text-card-foreground transition-all duration-200 border border-border shadow-2xl rounded-2xl',
          mode === 'full'
            ? 'w-[98vw] h-[96vh] max-w-none'
            : 'w-[94vw] max-w-6xl h-[90vh]',
        )}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement | null)?.focus();
        }}
      >
        {body}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------- view switcher --- */

const VIEW_OPTIONS: Array<{
  mode: KanbanCardViewMode;
  label: string;
  icon: typeof PanelRight;
}> = [
  { mode: 'panel', label: 'Open in side panel', icon: PanelRight },
  { mode: 'modal', label: 'Normal window', icon: Maximize2 },
  { mode: 'full', label: 'Full width', icon: Expand },
];

function CardViewSwitcher() {
  const mode = useKanbanCardViewStore((s) => s.mode);
  const setMode = useKanbanCardViewStore((s) => s.setMode);

  return (
    <div
      role="group"
      aria-label="Card view"
      className="p-0.5 gap-0.5 flex items-center rounded-btn border border-border/60 bg-muted/50"
    >
      {VIEW_OPTIONS.map((option) => {
        const isActive = option.mode === mode;
        return (
          <button
            key={option.mode}
            type="button"
            aria-pressed={isActive}
            aria-label={option.label}
            title={option.label}
            onClick={() => setMode(option.mode)}
            className={cn(
              'size-6 grid place-items-center rounded-[calc(var(--radius-btn)-2px)]',
              'transition-colors duration-(--duration-fast) ease-standard',
              'outline-none focus-visible:ring-1 focus-visible:ring-ring',
              isActive
                ? 'bg-card text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <option.icon className="size-3.5" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- body --- */

interface CardDetailsBodyProps {
  workspaceId: string | undefined;
  board: BoardState;
  card: KanbanCard;
  listId: KanbanList['id'];
  listTitle: string;
  dispatch: (action: BoardAction) => void;
  onClose: () => void;
  /** Drives how much the header dares to show — the rail is ~320px wide. */
  mode: KanbanCardViewMode;
}

function formatDateShort(dateStr?: string): string {
  if (!dateStr) return '';
  const d = parseDay(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function CardDetailsBody({
  workspaceId,
  board,
  card,
  listId,
  listTitle,
  dispatch,
  onClose,
  mode,
}: CardDetailsBodyProps) {
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState(card.description);
  const [commentDraft, setCommentDraft] = useState('');
  const [isFieldsOpen, setIsFieldsOpen] = useState(true);

  const [newChecklistText, setNewChecklistText] = useState('');
  const [isAddingChecklist, setIsAddingChecklist] = useState(false);

  const comments = useTaskComments(workspaceId, card.id);
  const addComment = useAddTaskComment(workspaceId, card.id);

  // Custom Kanban Store
  const customStore = useKanbanCustomStore();
  const cardCustomProps = customStore.getCardProperties(card.id);
  const storeLabels = customStore.labels;

  /*
   * Checklist and star persist per-card through the same local store the
   * lead/labels/start-date fields already use — real data, kept in this
   * browser, rather than throwaway `useState` that reset every time the
   * dialog reopened.
   */
  const checklists = cardCustomProps.checklist ?? [];
  const setChecklists = (next: ChecklistItem[]) =>
    customStore.setCardProperties(card.id, { checklist: next });
  const isStarred = cardCustomProps.isStarred ?? false;
  const setIsStarred = (next: boolean) =>
    customStore.setCardProperties(card.id, { isStarred: next });

  const currentStatus = listId;
  const currentPriority = card.priority || 'NO_PRIORITY';
  const currentLeadId = cardCustomProps.leadId ?? card.memberIds[0];
  const currentLead = board.members.find((m) => m.id === currentLeadId);
  const currentStartDate = cardCustomProps.startDate ?? '';
  const currentLabels = cardCustomProps.labels ?? [];

  const handleToggleLabel = (labelName: string) => {
    const nextLabels = currentLabels.includes(labelName)
      ? currentLabels.filter((l) => l !== labelName)
      : [...currentLabels, labelName];
    customStore.setCardProperties(card.id, { labels: nextLabels });
  };

  const handleStatusChange = (newStatus: TaskStatus) => {
    dispatch({
      type: 'card/move',
      cardId: card.id,
      toListId: newStatus,
      toIndex: Number.MAX_SAFE_INTEGER,
    });
  };

  const handlePriorityChange = (newPriority: PriorityOption) => {
    const priorityVal =
      newPriority === 'NO_PRIORITY' ? 'LOW' : (newPriority as Priority);
    dispatch({
      type: 'card/update',
      cardId: card.id,
      patch: { priority: priorityVal },
    });
  };

  const handleLeadChange = (memberId: string | null) => {
    customStore.setCardProperties(card.id, { leadId: memberId || undefined });
    dispatch({
      type: 'card/update',
      cardId: card.id,
      patch: { memberIds: memberId ? [memberId] : [] },
    });
  };

  const handleAssigneesChange = (memberIds: string[]) => {
    customStore.setCardProperties(card.id, {
      leadId: memberIds[0] || undefined,
    });
    dispatch({
      type: 'card/update',
      cardId: card.id,
      patch: { memberIds },
    });
  };

  const handleAddChecklist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistText.trim()) return;
    setChecklists([
      ...checklists,
      { id: `${Date.now()}`, text: newChecklistText.trim(), done: false },
    ]);
    setNewChecklistText('');
    setIsAddingChecklist(false);
  };

  const generateDescription = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error('Workspace context required');
      const response = await aiApi.chat(workspaceId, {
        messages: [
          {
            role: 'user',
            content: `Write a concise task description for a ${listTitle} card titled "${card.title}". Include a one- or two-sentence overview followed by a short markdown checklist of acceptance criteria.`,
          },
        ],
      });
      return response.message.content;
    },
    onError: () => {
      toast.error('Could not generate a description', {
        description: 'Try again in a moment.',
      });
    },
  });

  const handleGenerateWithAI = () => {
    if (generateDescription.isPending) return;
    generateDescription.mutate(undefined, {
      onSuccess: (content) => {
        setDescriptionDraft((prev) => (prev ? `${prev}\n\n${content}` : content));
        setEditingDescription(true);
      },
    });
  };

  /*
   * The rail is roughly a third of the dialog's width, so the header's
   * breadcrumb-plus-six-counters row and the side-by-side columns cannot simply
   * be reused there. Media queries are no help — the viewport is wide, the
   * container is not — so the layout branches on the mode instead.
   */
  const isPanel = mode === 'panel';

  return (
    <div className="flex flex-col h-full overflow-hidden bg-card text-card-foreground">
      {/* ---------------- 1. TOP TOOLBAR / HEADER ---------------- */}
      <header
        className={cn(
          'h-13 border-b border-border/70 bg-surface/50 backdrop-blur-sm flex items-center justify-between shrink-0',
          isPanel ? 'px-2 gap-1.5' : 'px-4 sm:px-6 gap-4',
        )}
      >
        {/* Left: Breadcrumbs & Meta Badges */}
        <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <span className="flex items-center gap-1 font-bold text-foreground">
              <CubeProjectIcon className="size-3.5 text-accent-amber" />
              <span>{board.title}</span>
            </span>
            <span>/</span>
            {/* Dynamic Ticket Identifier with Copy */}
            <button
              type="button"
              onClick={() => {
                const idStr = card.identifier || `TASK-${card.ticketNumber || card.id.slice(0, 4)}`;
                navigator.clipboard.writeText(idStr);
                toast.success(`Copied ${idStr}`);
              }}
              className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/30 px-2 py-0.5 rounded transition-colors cursor-pointer"
              title="Click to copy ticket identifier"
            >
              <span>{card.identifier || `TASK-${card.ticketNumber || card.id.slice(0, 4)}`}</span>
              <Copy className="size-2.5 opacity-60" />
            </button>
            <span>/</span>
            <span className="font-semibold text-primary">{listTitle}</span>
          </div>

          <div className="h-4 w-px bg-border/80 mx-1 hidden sm:block" />

          {/* Type Badge & Counter Metrics */}
          <div className="flex items-center gap-2 text-xs">
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/80 border border-border/60 text-foreground text-[11px] font-medium">
              <CheckSquare className="size-3 text-primary" />
              <span className="capitalize">{card.type ? card.type.toLowerCase() : 'Task'}</span>
            </div>

            <div
              className={cn(
                'items-center gap-2.5 text-muted-foreground text-[11px]',
                isPanel ? 'hidden' : 'hidden lg:flex',
              )}
            >
              {checklists.length > 0 ? (
                <span className="flex items-center gap-1 hover:text-foreground cursor-pointer" title="Completed checklist items">
                  <Check className="size-3 text-accent-green" />
                  <span>
                    {checklists.filter((c) => c.done).length}/{checklists.length}
                  </span>
                </span>
              ) : null}
              <span className="flex items-center gap-1 hover:text-foreground cursor-pointer" title="Comments">
                <MessageSquare className="size-3" />
                <span>{comments.data?.length ?? card.commentCount ?? 0}</span>
              </span>
              {currentLead && (
                <span className="flex items-center gap-1 px-1.5 py-0.2 rounded bg-accent-amber-soft text-accent-amber font-semibold text-[10px]">
                  <span className="size-3.5 rounded-full bg-warning text-warning-foreground flex items-center justify-center text-[8px] font-bold">
                    VI
                  </span>
                  <span>1 for me</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {formatDateShort(card.createdAt) ? (
            <span className="text-[11px] text-muted-foreground hidden md:inline-block mr-2">
              Created {formatDateShort(card.createdAt)}
            </span>
          ) : null}

          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateWithAI}
            loading={generateDescription.isPending}
            className="h-7 text-xs gap-1.5 text-accent-violet border-accent-violet/30 hover:bg-accent-violet-soft font-medium"
          >
            <Sparkles className="size-3.5" />
            <span className="hidden sm:inline">Brain² AI</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
          >
            <Share2 className="size-3.5" />
            <span className="hidden sm:inline">Share</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-7 text-muted-foreground hover:text-foreground"
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => dispatch({ type: 'card/copy', cardId: card.id })}>
                <Copy className="size-3.5 mr-2" />
                Copy task
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  dispatch({ type: 'card/remove', cardId: card.id });
                  onClose();
                }}
              >
                <Trash2 className="size-3.5 mr-2" />
                Delete task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsStarred(!isStarred)}
            className={cn('size-7', isStarred ? 'text-accent-amber' : 'text-muted-foreground')}
            title="Star task"
          >
            <Star className={cn('size-3.5', isStarred && 'fill-current')} />
          </Button>

          <CardViewSwitcher />

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="size-7 text-muted-foreground hover:text-foreground"
            title="Close card"
          >
            <X className="size-4" />
          </Button>
        </div>
      </header>

      {/* ---------------- 2. MAIN 2-COLUMN LAYOUT ---------------- */}
      <div
        className={cn(
          'flex min-h-0 flex-1 overflow-hidden divide-border/60',
          isPanel ? 'flex-col divide-y' : 'divide-x',
        )}
      >
        {/* LEFT COLUMN: Title, AI Banner, Properties, Description, Checklists */}
        <div
          className={cn(
            'flex-1 min-w-0 overflow-y-auto space-y-6',
            isPanel ? 'p-4' : 'p-6 md:p-8',
          )}
        >
          {/* Large Editable Title */}
          <div>
            {/* `DialogTitle` reads Radix's dialog context, so it only exists
                in the two dialog modes; in the rail there is no dialog to
                label and a plain heading is the accessible equivalent. */}
            {isPanel ? (
              <h2 className="sr-only">{card.title}</h2>
            ) : (
              <DialogTitle className="sr-only">{card.title}</DialogTitle>
            )}
            <Textarea
              rows={2}
              defaultValue={card.title}
              aria-label="Card title"
              placeholder="Task Title..."
              onBlur={(event) => {
                const title = event.target.value.trim();
                if (title && title !== card.title) {
                  dispatch({ type: 'card/update', cardId: card.id, patch: { title } });
                }
              }}
              className="text-2xl font-bold tracking-tight text-foreground border-transparent bg-transparent shadow-none hover:border-input focus-visible:border-ring w-full resize-none p-1 -ml-1 rounded-lg"
            />
          </div>

          {/* AI Banner */}
          <div className="flex items-center justify-between p-2.5 px-3.5 rounded-xl border border-accent-violet/30 bg-accent-violet-soft text-xs text-foreground animate-in fade-in">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="size-4 text-accent-violet shrink-0" />
              <span className="font-medium text-foreground">
                Ask Brain² for a presentation, document or prototype
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerateWithAI}
              loading={generateDescription.isPending}
              className="h-6 text-[11px] bg-surface text-accent-violet border-accent-violet/40 hover:bg-accent-violet-soft font-semibold px-2.5 shrink-0"
            >
              Generate
            </Button>
          </div>

          {/* Structured 2-Column Properties Grid */}
          <div
            className={cn(
              'grid gap-x-8 gap-y-3.5 py-3 border-y border-border/50 text-xs',
              isPanel ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2',
            )}
          >
            {/* Row 1 Left: Status */}
            <div className="flex items-center gap-3">
              <span className="w-24 text-muted-foreground flex items-center gap-1.5 font-medium">
                <StatusIcon status={currentStatus} />
                <span>Status</span>
              </span>
              <KanbanStatusPicker
                status={currentStatus}
                onStatusChange={handleStatusChange}
                trigger={
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/80 bg-surface text-foreground hover:bg-accent/60 transition-colors font-medium cursor-pointer"
                  >
                    <Check className="size-3 text-accent-green" />
                    <span>{listTitle}</span>
                  </button>
                }
              />
            </div>

            {/* Row 1 Right: Assignees */}
            <div className="flex items-center gap-3">
              <span className="w-24 text-muted-foreground flex items-center gap-1.5 font-medium">
                <Users className="size-3.5" />
                <span>Assignees</span>
              </span>
              <KanbanLeadPicker
                selectedMemberIds={card.memberIds}
                currentMemberId={currentLeadId}
                members={board.members}
                multiple={true}
                onSelectMembers={handleAssigneesChange}
                onSelectMember={handleLeadChange}
                trigger={
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border border-border/70 hover:bg-accent/50 transition-colors cursor-pointer"
                  >
                    {card.memberIds.length > 0 ? (
                      <div className="flex items-center gap-1.5">
                        <UserAvatarGroup
                          users={card.memberIds
                            .map((id) => board.members.find((m) => m.id === id))
                            .filter((m): m is BoardMember => Boolean(m))}
                          size="xs"
                        />
                        <span className="font-medium text-foreground text-xs">
                          {card.memberIds.length === 1
                            ? board.members.find((m) => m.id === card.memberIds[0])?.name
                            : `${card.memberIds.length} assigned`}
                        </span>
                      </div>
                    ) : (
                      <>
                        <UnassignedLeadIcon className="size-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Add assignee</span>
                      </>
                    )}
                  </button>
                }
              />
            </div>

            {/* Row 2 Left: Dates */}
            <div className="flex items-center gap-3">
              <span className="w-24 text-muted-foreground flex items-center gap-1.5 font-medium">
                <CalendarDays className="size-3.5" />
                <span>Dates</span>
              </span>
              <div className="flex items-center gap-1.5">
                <DatePicker
                  value={currentStartDate}
                  onChange={(d) =>
                    customStore.setCardProperties(card.id, { startDate: d || undefined })
                  }
                  trigger={
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-border/70 text-foreground hover:bg-accent/50 font-medium"
                    >
                      <CalendarPlus className="size-3 text-muted-foreground" />
                      <span>{currentStartDate ? formatDateShort(currentStartDate) : 'Start'}</span>
                    </button>
                  }
                />
                <span className="text-muted-foreground text-[11px]">→</span>
                <DatePicker
                  value={card.dueDate ?? ''}
                  onChange={(d) =>
                    dispatch({ type: 'card/update', cardId: card.id, patch: { dueDate: d || null } })
                  }
                  trigger={
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-accent-rose/30 bg-accent-rose-soft text-accent-rose hover:bg-accent-rose-soft font-medium"
                    >
                      <CalendarX2 className="size-3 text-accent-rose" />
                      <span>{card.dueDate ? formatDateShort(card.dueDate) : 'Due'}</span>
                    </button>
                  }
                />
              </div>
            </div>

            {/* Row 2 Right: Priority */}
            <div className="flex items-center gap-3">
              <span className="w-24 text-muted-foreground flex items-center gap-1.5 font-medium">
                <PriorityIcon priority={currentPriority} />
                <span>Priority</span>
              </span>
              <KanbanPriorityPicker
                priority={currentPriority}
                onPriorityChange={handlePriorityChange}
                trigger={
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border border-border/70 text-foreground hover:bg-accent/50 font-medium cursor-pointer"
                  >
                    <PriorityIcon priority={currentPriority} />
                    <span className="capitalize">{currentPriority.toLowerCase().replace('_', ' ')}</span>
                  </button>
                }
              />
            </div>

            {/* Row 3 Left: Track Time */}
            <div className="flex items-center gap-3">
              <span className="w-24 text-muted-foreground flex items-center gap-1.5 font-medium">
                <Timer className="size-3.5" />
                <span>Track time</span>
              </span>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-border/70 bg-surface font-mono font-medium text-foreground">
                <Clock className="size-3 text-primary" />
                <span>96h 17m</span>
              </div>
            </div>

            {/* Row 3 Right: Tags */}
            <div className="flex items-center gap-3">
              <span className="w-24 text-muted-foreground flex items-center gap-1.5 font-medium">
                <Tag className="size-3.5" />
                <span>Tags</span>
              </span>
              <div className="flex items-center gap-1 flex-wrap">
                {currentLabels.map((lbl) => {
                  const meta = storeLabels.find((l) => l.name === lbl);
                  return (
                    <span
                      key={lbl}
                      className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[11px] font-semibold border"
                      style={{
                        backgroundColor: meta ? `${meta.color}18` : '#8b5cf618',
                        borderColor: meta ? `${meta.color}40` : '#8b5cf640',
                        color: meta?.color || '#8b5cf6',
                      }}
                    >
                      <span>{lbl}</span>
                    </span>
                  );
                })}
                <KanbanLabelPicker
                  selectedLabels={currentLabels}
                  onToggleLabel={handleToggleLabel}
                  trigger={
                    <button
                      type="button"
                      className="px-1.5 py-0.5 rounded border border-dashed border-border/80 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    >
                      + Tag
                    </button>
                  }
                />
              </div>
            </div>
          </div>

          {/* Blocked by Alert Badge */}
          <div className="flex items-center gap-2 p-2.5 rounded-xl border border-accent-amber/25 bg-accent-amber-soft text-xs text-foreground">
            <AlertTriangle className="size-3.5 text-accent-amber shrink-0" />
            <span className="font-semibold text-accent-amber">Blocked by</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface border border-border/80 text-[11px] font-medium">
              <StatusIcon status="BACKLOG" className="size-3" />
              <span>subtask 2</span>
            </span>
          </div>

          {/* Description Section */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <AlignLeft className="size-3.5" />
                <span>Description</span>
              </h3>
              {!editingDescription && (
                <button
                  type="button"
                  onClick={() => setEditingDescription(true)}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Pencil className="size-3" />
                  <span>Edit</span>
                </button>
              )}
            </div>

            {editingDescription ? (
              <div className="space-y-2">
                <Textarea
                  autoFocus
                  rows={5}
                  value={descriptionDraft}
                  aria-label="Card description"
                  placeholder="Add description, or write with ✨ AI..."
                  onChange={(event) => setDescriptionDraft(event.target.value)}
                  className="text-xs"
                />
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        dispatch({
                          type: 'card/update',
                          cardId: card.id,
                          patch: { description: descriptionDraft },
                        });
                        setEditingDescription(false);
                      }}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setDescriptionDraft(card.description);
                        setEditingDescription(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="subtle"
                    onClick={handleGenerateWithAI}
                    loading={generateDescription.isPending}
                    className="text-xs text-accent-violet gap-1"
                  >
                    <Sparkles className="size-3" />
                    <span>Auto-write with AI</span>
                  </Button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => setEditingDescription(true)}
                className={cn(
                  'min-h-16 p-3 rounded-xl border border-transparent hover:border-input bg-surface-muted text-xs cursor-pointer whitespace-pre-wrap transition-colors',
                  !card.description && 'text-muted-foreground italic',
                )}
              >
                {card.description || 'Add description, or write with ✨ AI...'}
              </div>
            )}
          </section>

          {/* Collapsible Fields & Action Items Section */}
          <section className="border-t border-border/50 pt-4 space-y-3">
            <button
              type="button"
              onClick={() => setIsFieldsOpen(!isFieldsOpen)}
              className="flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
            >
              {isFieldsOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
              <span>Fields & Action Items</span>
            </button>

            {isFieldsOpen && (
              <div className="pl-5 space-y-2 text-xs">
                <div className="flex items-center justify-between text-muted-foreground font-medium pb-1">
                  <span className="flex items-center gap-1.5">
                    <ListCheck className="size-3.5 text-primary" />
                    <span>Action Items ({checklists.filter((c) => c.done).length}/{checklists.length})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddingChecklist(true)}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <Plus className="size-3" />
                    <span>Add item</span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  {checklists.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2.5 group p-1 rounded-lg hover:bg-accent/40 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={(e) =>
                          setChecklists(
                            checklists.map((c) =>
                              c.id === item.id ? { ...c, done: e.target.checked } : c,
                            ),
                          )
                        }
                        className="rounded border-border size-3.5 text-primary focus:ring-0 cursor-pointer"
                      />
                      <span
                        className={cn(
                          'flex-1 text-xs transition-colors',
                          item.done && 'line-through text-muted-foreground',
                        )}
                      >
                        {item.text}
                      </span>
                      <button
                        type="button"
                        onClick={() => setChecklists(checklists.filter((c) => c.id !== item.id))}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-0.5"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}

                  {isAddingChecklist && (
                    <form onSubmit={handleAddChecklist} className="flex items-center gap-2 pt-1">
                      <input
                        autoFocus
                        value={newChecklistText}
                        onChange={(e) => setNewChecklistText(e.target.value)}
                        placeholder="Add new action item..."
                        className="flex-1 text-xs bg-surface border border-border rounded-md px-2 py-1 outline-none focus:border-primary"
                      />
                      <Button size="sm" type="submit" className="h-7 text-xs">
                        Add
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsAddingChecklist(false)}
                        className="h-7 text-xs"
                      >
                        Cancel
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN: Activity & Comments Feed */}
        <div
          className={cn(
            'w-full flex flex-col bg-surface-inset/30 overflow-hidden',
            // Stacked under the card in the rail, capped so the card body it
            // belongs to never gets squeezed out of view above it.
            isPanel ? 'max-h-[45%] shrink-0' : 'md:w-96 h-full',
          )}
        >
          {/* Activity Header */}
          <div className="p-3.5 px-5 border-b border-border/60 bg-surface/40 flex items-center justify-between shrink-0">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
              <MessageSquare className="size-3.5 text-primary" />
              <span>Activity</span>
            </h3>
            <div className="flex items-center gap-1 text-muted-foreground">
              <button type="button" className="p-1 rounded hover:bg-muted" title="Search activity">
                <Search className="size-3.5" />
              </button>
              <button type="button" className="p-1 rounded hover:bg-muted flex items-center gap-0.5 text-xs">
                <MessageSquare className="size-3.5" />
                <span className="text-[10px] font-mono">{comments.data?.length ?? card.commentCount ?? 0}</span>
              </button>
              <button type="button" className="p-1 rounded hover:bg-muted" title="Filter activity">
                <Filter className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Activity Stream Scrollable Area */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 text-xs">
            {comments.isLoading ? (
              <p className="text-muted-foreground/70 text-center py-4">
                Loading comments…
              </p>
            ) : (comments.data ?? []).length === 0 ? (
              <p className="text-muted-foreground/70 text-center py-4">
                No comments yet. Start the conversation below.
              </p>
            ) : null}

            {(comments.data ?? []).map((comment) => (
              <div key={comment.id} className="space-y-1.5 p-3 rounded-xl bg-surface border border-border/60 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserAvatar
                      name={comment.author.displayName ?? comment.author.name}
                      seed={comment.author.id}
                      src={comment.author.avatarUrl ?? undefined}
                      size="xs"
                    />
                    <span className="font-semibold text-foreground text-xs">
                      {comment.author.displayName ?? comment.author.name}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {formatRelative(comment.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-foreground pl-6 whitespace-pre-wrap">{comment.content}</p>
              </div>
            ))}
          </div>

          {/* Comment Composer Footer */}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const content = commentDraft.trim();
              if (!content) return;
              addComment.mutate({ content });
              setCommentDraft('');
            }}
            className="p-3 border-t border-border/60 bg-surface/50 space-y-2 shrink-0"
          >
            <input
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              placeholder="Write a comment..."
              className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/70 outline-none px-1"
            />
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <button type="button" className="p-1 hover:text-foreground rounded hover:bg-muted" title="Add item">
                  <Plus className="size-3.5" />
                </button>
                <button type="button" className="p-1 hover:text-accent-violet rounded hover:bg-muted" title="Brain AI">
                  <Sparkles className="size-3.5 text-accent-violet" />
                </button>
                <button type="button" className="p-1 hover:text-foreground rounded hover:bg-muted" title="Mention">
                  <AtSign className="size-3.5" />
                </button>
                <button type="button" className="p-1 hover:text-foreground rounded hover:bg-muted" title="Attachment">
                  <Paperclip className="size-3.5" />
                </button>
                <button type="button" className="p-1 hover:text-foreground rounded hover:bg-muted" title="Emoji">
                  <Smile className="size-3.5" />
                </button>
                <button type="button" className="p-1 hover:text-foreground rounded hover:bg-muted" title="Video note">
                  <Video className="size-3.5" />
                </button>
              </div>

              <Button
                type="submit"
                size="icon-sm"
                disabled={!commentDraft.trim() || addComment.isPending}
                className="size-7"
              >
                <Send className="size-3" />
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
