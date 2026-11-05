import { aiApi } from '@org/api-client';
import { useCurrentUser } from '@org/auth';
import { type RelationType, type TaskStatus } from '@org/types';
import { useSaveForLater } from '@org/web-chat/bookmarks';
import { FiledFilesSection } from '@org/web-upload';
import {
  Button,
  confirm,
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
  AppSelect,
} from '@org/ui';
import { cn, formatRelative } from '@org/utils';
import { useMutation } from '@tanstack/react-query';
import {
  AlertTriangle,
  AlignLeft,
  AtSign,
  Boxes,
  CalendarDays,
  CalendarPlus,
  CalendarX2,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock,
  CornerUpLeft,
  Copy,
  Expand,
  Filter,
  Gauge,
  Layers,
  Link2,
  ListCheck,
  ListTree,
  Maximize2,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  PanelRight,
  Pencil,
  Plus,
  Repeat,
  Search,
  Send,
  Share2,
  Smile,
  Sparkles,
  Star,
  Tag,
  Timer,
  Trash2,
  UsersRound,
  Users,
  Video,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  useAddTaskComment,
  useCurrentWorkspace,
  useCycles,
  useEpics,
  useModules,
  useRelationMutations,
  useTaskComments,
  useTaskDetail,
  useTaskMutations,
  useTasks,
  useTeams,
  useWorkItemRelations,
} from '../use-work-tools.js';
import { parseDay } from './card-meta.js';
import {
  useKanbanCardViewStore,
  type KanbanCardViewMode,
} from './kanban-card-view-store.js';
import { useKanbanLabels, type ChecklistItem } from './kanban-custom-store.js';
import { KanbanEstimatePicker } from './KanbanEstimatePicker.js';
import { KanbanLabelPicker } from './KanbanLabelPicker.js';
import { KanbanLeadPicker } from './KanbanLeadPicker.js';
import {
  KanbanPriorityPicker,
  type PriorityOption,
} from './KanbanPriorityPicker.js';
import {
  KanbanRefPicker,
  type KanbanRefPickerItem,
} from './KanbanRefPicker.js';
import { KanbanStatusPicker } from './KanbanStatusPicker.js';
import {
  KanbanTaskLinkPicker,
  type KanbanTaskLinkOption,
} from './KanbanTaskLinkPicker.js';
import {
  CubeProjectIcon,
  PriorityIcon,
  StatusIcon,
  UnassignedLeadIcon,
} from './kanban-icons.js';
import {
  formatMinutes,
  isBlockingView,
  LINKABLE_RELATION_TYPES,
  relationsFor,
  relationVerb,
} from './relation-meta.js';
import type { BoardAction } from './server-board.js';
import type {
  BoardMember,
  BoardState,
  KanbanCard,
  KanbanList,
  Priority,
} from './types.js';

export interface CardDetailsDialogProps {
  workspaceId: string | undefined;
  /** The open project — Epic/Module/Cycle and the parent/relation task pickers scope to it. */
  projectId: string | undefined;
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
  projectId,
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
      projectId={projectId}
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
          'p-0 shadow-2xl flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground transition-all duration-200',
          mode === 'full'
            ? 'h-[96vh] w-[98vw] max-w-none'
            : 'max-w-6xl h-[90vh] w-[94vw]',
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
                ? 'shadow-2xs bg-card text-foreground'
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
  projectId: string | undefined;
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
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function CardDetailsBody({
  workspaceId,
  projectId,
  board,
  card,
  listId,
  listTitle,
  dispatch,
  onClose,
  mode,
}: CardDetailsBodyProps) {
  const currentUser = useCurrentUser();
  const navigate = useNavigate();
  const { slug: workspaceSlug } = useCurrentWorkspace();
  const currentUserId = currentUser?.id;

  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState(card.description);
  const [commentDraft, setCommentDraft] = useState('');
  const [isFieldsOpen, setIsFieldsOpen] = useState(true);

  const [newChecklistText, setNewChecklistText] = useState('');
  const [isAddingChecklist, setIsAddingChecklist] = useState(false);

  const comments = useTaskComments(workspaceId, card.id);
  const addComment = useAddTaskComment(workspaceId, card.id);

  /*
   * Team/Epic/Module/Cycle/Estimate/time/Parent/sub-issues/relations all live
   * on the real `Task`, not the board's narrower `KanbanCard` projection — so
   * the dialog fetches its own full detail, the same way it already fetches
   * comments separately rather than through `board`.
   */
  const taskDetail = useTaskDetail(workspaceId, card.id);
  const detail = taskDetail.data;
  const taskMutations = useTaskMutations(workspaceId);
  const teamsQuery = useTeams(workspaceId);
  const epicsQuery = useEpics(workspaceId, projectId);
  const modulesQuery = useModules(workspaceId, projectId);
  const cyclesQuery = useCycles(workspaceId, projectId);
  // Shares its query key (and cache) with the board's own `useTasks` call.
  const projectTasksQuery = useTasks(workspaceId, projectId);
  const relationsQuery = useWorkItemRelations(workspaceId, card.id);
  const relationMutations = useRelationMutations(workspaceId);

  const [isSubIssuesOpen, setIsSubIssuesOpen] = useState(true);
  const [newSubIssueText, setNewSubIssueText] = useState('');
  const [isAddingSubIssue, setIsAddingSubIssue] = useState(false);
  const [isLoggingTime, setIsLoggingTime] = useState(false);
  const [logHours, setLogHours] = useState('');
  const [logMinutes, setLogMinutes] = useState('');
  const [addRelationType, setAddRelationType] =
    useState<RelationType>('BLOCKS');

  const relations = relationsFor(relationsQuery.data, card.id);
  const blockingRelations = relations.filter(isBlockingView);
  const activeBlockingRelations = blockingRelations.filter(
    (view) =>
      view.otherTask.status !== 'DONE' && view.otherTask.status !== 'CANCELLED',
  );

  const subIssues = detail?.subItems ?? [];
  const linkableTasks: KanbanTaskLinkOption[] = (
    projectTasksQuery.data ?? []
  ).map((t) => ({
    id: t.id,
    title: t.title,
    identifier: t.identifier,
    status: t.status,
  }));
  // A parent can't be one of this card's own descendants, or the card itself.
  const parentExcludeIds = [card.id, ...subIssues.map((s) => s.id)];

  const teamItems: KanbanRefPickerItem[] = (teamsQuery.data ?? []).map((t) => ({
    id: t.id,
    label: t.name,
    color: t.color,
  }));
  const epicItems: KanbanRefPickerItem[] = (epicsQuery.data ?? []).map((e) => ({
    id: e.id,
    label: e.name,
    color: e.color,
  }));
  const moduleItems: KanbanRefPickerItem[] = (modulesQuery.data ?? []).map(
    (m) => ({
      id: m.id,
      label: m.name,
      color: m.color,
    }),
  );
  const cycleItems: KanbanRefPickerItem[] = (cyclesQuery.data ?? []).map(
    (c) => ({
      id: c.id,
      label: c.name,
      sublabel: c.status,
    }),
  );

  const handleTeamChange = (teamId: string | null) =>
    taskMutations.update.mutate({ taskId: card.id, input: { teamId } });
  const handleEpicChange = (epicId: string | null) =>
    taskMutations.update.mutate({ taskId: card.id, input: { epicId } });
  const handleModuleChange = (moduleId: string | null) =>
    taskMutations.update.mutate({ taskId: card.id, input: { moduleId } });
  const handleCycleChange = (cycleId: string | null) =>
    taskMutations.update.mutate({ taskId: card.id, input: { cycleId } });
  const handleEstimateChange = (estimate: number | null) =>
    taskMutations.update.mutate({ taskId: card.id, input: { estimate } });
  const handleParentChange = (parentId: string | null) =>
    taskMutations.update.mutate({ taskId: card.id, input: { parentId } });

  const handleLogTime = (e: React.FormEvent) => {
    e.preventDefault();
    const addedMinutes =
      (Number(logHours) || 0) * 60 + (Number(logMinutes) || 0);
    if (addedMinutes <= 0) return;
    taskMutations.update.mutate({
      taskId: card.id,
      input: { timeSpent: (detail?.timeSpent ?? 0) + addedMinutes },
    });
    setLogHours('');
    setLogMinutes('');
    setIsLoggingTime(false);
  };

  const handleAddSubIssue = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newSubIssueText.trim();
    if (!title) return;
    taskMutations.create.mutate({
      title,
      parentId: card.id,
      projectId: projectId ?? null,
    });
    setNewSubIssueText('');
    setIsAddingSubIssue(false);
  };

  const handleToggleSubIssue = (subId: string, done: boolean) =>
    taskMutations.update.mutate({
      taskId: subId,
      input: { status: done ? 'TODO' : 'DONE' },
    });

  const handleAddRelation = (target: KanbanTaskLinkOption) =>
    relationMutations.addRelation.mutate({
      sourceId: card.id,
      targetId: target.id,
      type: addRelationType,
    });

  const handleRemoveRelation = (relationId: string) =>
    relationMutations.removeRelation.mutate(relationId);

  const { colorOf } = useKanbanLabels();

  /*
   * Labels, start date and checklist are task fields (`labels`, `startDate`,
   * `customFields.checklist`), so every member sees the same card. The star is
   * the viewer's own "Save for later" — the same bookmark the card menu and the
   * Saved page use.
   */
  const checklists = card.checklist;
  const setChecklists = (next: ChecklistItem[]) =>
    dispatch({
      type: 'card/update',
      cardId: card.id,
      patch: { checklist: next },
    });
  const { isSaved, toggleSaved } = useSaveForLater();
  const isStarred = isSaved('task', card.id);
  const toggleStarred = () =>
    toggleSaved({
      type: 'task',
      id: card.id,
      title: card.ticketId ? `${card.ticketId} ${card.title}` : card.title,
      snippet: card.description,
      href: `${window.location.pathname}?card=${card.id}`,
    });

  const currentStatus = listId;
  const currentPriority = card.priority || 'NO_PRIORITY';
  const currentLeadId = card.memberIds[0];
  const currentLead = board.members.find((m) => m.id === currentLeadId);
  const currentStartDate = card.startDate ?? '';
  const currentLabels = card.labels;

  const handleToggleLabel = (labelName: string) => {
    const nextLabels = currentLabels.includes(labelName)
      ? currentLabels.filter((l) => l !== labelName)
      : [...currentLabels, labelName];
    dispatch({
      type: 'card/update',
      cardId: card.id,
      patch: { labels: nextLabels },
    });
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
    dispatch({
      type: 'card/update',
      cardId: card.id,
      patch: { memberIds: memberId ? [memberId] : [] },
    });
  };

  const handleAssigneesChange = (memberIds: string[]) => {
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
        setDescriptionDraft((prev) =>
          prev ? `${prev}\n\n${content}` : content,
        );
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
    <div className="flex h-full flex-col overflow-hidden bg-card text-card-foreground">
      {/* ---------------- 1. TOP TOOLBAR / HEADER ---------------- */}
      <header
        className={cn(
          'h-13 backdrop-blur-sm flex shrink-0 items-center justify-between border-b border-border/70 bg-surface/50',
          isPanel ? 'px-2 gap-1.5' : 'px-4 sm:px-6 gap-4',
        )}
      >
        {/* Left: Breadcrumbs & Meta Badges */}
        <div className="gap-2.5 min-w-0 flex flex-wrap items-center">
          <div className="gap-1.5 text-xs font-medium flex items-center text-muted-foreground">
            <span className="gap-1 font-bold flex items-center text-foreground">
              <CubeProjectIcon className="size-3.5 text-accent-amber" />
              <span>{board.title}</span>
            </span>
            <span>/</span>
            {/* Dynamic Ticket Identifier with Copy */}
            <button
              type="button"
              onClick={() => {
                const idStr =
                  card.identifier ||
                  `TASK-${card.ticketNumber || card.id.slice(0, 4)}`;
                navigator.clipboard.writeText(idStr);
                toast.success(`Copied ${idStr}`);
              }}
              className="gap-1 font-bold px-2 py-0.5 rounded inline-flex cursor-pointer items-center border border-brand/30 bg-brand/10 font-mono text-[11px] text-brand-text transition-colors hover:bg-brand/20"
              title="Click to copy ticket identifier"
            >
              <span>
                {card.identifier ||
                  `TASK-${card.ticketNumber || card.id.slice(0, 4)}`}
              </span>
              <Copy className="size-2.5 opacity-60" />
            </button>
            <span>/</span>
            <span className="font-semibold text-primary">{listTitle}</span>
          </div>

          <div className="h-4 mx-1 sm:block hidden w-px bg-border/80" />

          {/* Type Badge & Counter Metrics */}
          <div className="gap-2 text-xs flex items-center">
            <div className="gap-1 px-2 py-0.5 font-medium inline-flex items-center rounded-md border border-border/60 bg-muted/80 text-[11px] text-foreground">
              <CheckSquare className="size-3 text-primary" />
              <span className="capitalize">
                {card.type ? card.type.toLowerCase() : 'Task'}
              </span>
            </div>

            {card.createdByAgent ? (
              <button
                type="button"
                disabled={!card.createdByAgent.workflowId}
                onClick={() =>
                  navigate(
                    `/w/${workspaceSlug}/ai/planned/${card.createdByAgent?.workflowId}`,
                  )
                }
                title={`Created by the agent ${card.createdByAgent.name}`}
                className="gap-1 px-2 py-0.5 font-medium inline-flex items-center rounded-md border border-border/60 bg-accent-violet-soft text-[11px] text-accent-violet enabled:hover:underline disabled:cursor-default"
              >
                <Sparkles className="size-3" />
                <span className="max-w-[140px] truncate">
                  {card.createdByAgent.name}
                </span>
              </button>
            ) : null}

            <div
              className={cn(
                'gap-2.5 items-center text-[11px] text-muted-foreground',
                isPanel ? 'hidden' : 'lg:flex hidden',
              )}
            >
              {checklists.length > 0 ? (
                <span
                  className="gap-1 flex cursor-pointer items-center hover:text-foreground"
                  title="Completed checklist items"
                >
                  <Check className="size-3 text-accent-green" />
                  <span>
                    {checklists.filter((c) => c.done).length}/
                    {checklists.length}
                  </span>
                </span>
              ) : null}
              <span
                className="gap-1 flex cursor-pointer items-center hover:text-foreground"
                title="Comments"
              >
                <MessageSquare className="size-3" />
                <span>{comments.data?.length ?? card.commentCount ?? 0}</span>
              </span>
              {currentLead && (
                <span className="gap-1 px-1.5 py-0.2 rounded font-semibold flex items-center bg-accent-amber-soft text-[10px] text-accent-amber">
                  <span className="size-3.5 font-bold flex items-center justify-center rounded-full bg-warning text-[8px] text-warning-foreground">
                    VI
                  </span>
                  <span>1 for me</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="gap-1.5 flex shrink-0 items-center">
          {formatDateShort(card.createdAt) ? (
            <span className="md:inline-block mr-2 hidden text-[11px] text-muted-foreground">
              Created {formatDateShort(card.createdAt)}
            </span>
          ) : null}

          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateWithAI}
            loading={generateDescription.isPending}
            className="h-7 text-xs gap-1.5 font-medium border-accent-violet/30 text-accent-violet hover:bg-accent-violet-soft"
          >
            <Sparkles className="size-3.5" />
            <span className="sm:inline hidden">Brain² AI</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
          >
            <Share2 className="size-3.5" />
            <span className="sm:inline hidden">Share</span>
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
              <DropdownMenuItem
                onClick={() => dispatch({ type: 'card/copy', cardId: card.id })}
              >
                <Copy className="size-3.5 mr-2" />
                Copy task
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  void confirm({
                    title: `Delete “${card.title}”?`,
                    description:
                      "The task and its details are removed. This can't be undone.",
                    confirmLabel: 'Delete task',
                    destructive: true,
                  }).then((ok) => {
                    if (!ok) return;
                    dispatch({ type: 'card/remove', cardId: card.id });
                    onClose();
                  });
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
            onClick={toggleStarred}
            className={cn(
              'size-7',
              isStarred ? 'text-accent-amber' : 'text-muted-foreground',
            )}
            title={isStarred ? 'Remove from saved' : 'Save for later'}
            aria-pressed={isStarred}
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
          'min-h-0 flex flex-1 divide-border/60 overflow-hidden',
          isPanel ? 'flex-col divide-y' : 'divide-x',
        )}
      >
        {/* LEFT COLUMN: Title, AI Banner, Properties, Description, Checklists */}
        <div
          className={cn(
            'min-w-0 space-y-6 flex-1 overflow-y-auto',
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
                  dispatch({
                    type: 'card/update',
                    cardId: card.id,
                    patch: { title },
                  });
                }
              }}
              className="text-2xl font-bold tracking-tight p-1 -ml-1 w-full resize-none rounded-lg border-transparent bg-transparent text-foreground shadow-none hover:border-input focus-visible:border-ring"
            />
          </div>

          {/* AI Banner */}
          <div className="p-2.5 px-3.5 text-xs animate-in fade-in flex items-center justify-between rounded-xl border border-accent-violet/30 bg-accent-violet-soft text-foreground">
            <div className="gap-2 min-w-0 flex items-center">
              <Sparkles className="size-4 shrink-0 text-accent-violet" />
              <span className="font-medium text-foreground">
                Ask Brain² for a presentation, document or prototype
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerateWithAI}
              loading={generateDescription.isPending}
              className="h-6 font-semibold px-2.5 shrink-0 border-accent-violet/40 bg-surface text-[11px] text-accent-violet hover:bg-accent-violet-soft"
            >
              Generate
            </Button>
          </div>

          {/* Structured 2-Column Properties Grid */}
          <div
            className={cn(
              'gap-x-8 gap-y-3.5 py-3 text-xs grid border-y border-border/50',
              isPanel ? 'grid-cols-1' : 'md:grid-cols-2 grid-cols-1',
            )}
          >
            {/* Row 1 Left: Status */}
            <div className="gap-3 flex items-center">
              <span className="w-24 gap-1.5 font-medium flex items-center text-muted-foreground">
                <StatusIcon status={currentStatus} />
                <span>Status</span>
              </span>
              <KanbanStatusPicker
                status={currentStatus}
                onStatusChange={handleStatusChange}
                trigger={
                  <button
                    type="button"
                    className="gap-1.5 px-2.5 py-1 font-medium inline-flex cursor-pointer items-center rounded-lg border border-border/80 bg-surface text-foreground transition-colors hover:bg-accent/60"
                  >
                    <Check className="size-3 text-accent-green" />
                    <span>{listTitle}</span>
                  </button>
                }
              />
            </div>

            {/* Row 1 Right: Assignees */}
            <div className="gap-3 flex items-center">
              <span className="w-24 gap-1.5 font-medium flex items-center text-muted-foreground">
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
                    className="gap-1.5 px-2 py-0.5 inline-flex cursor-pointer items-center rounded-lg border border-border/70 transition-colors hover:bg-accent/50"
                  >
                    {card.memberIds.length > 0 ? (
                      <div className="gap-1.5 flex items-center">
                        <UserAvatarGroup
                          users={card.memberIds
                            .map((id) => board.members.find((m) => m.id === id))
                            .filter((m): m is BoardMember => Boolean(m))}
                          size="xs"
                        />
                        <span className="font-medium text-xs text-foreground">
                          {card.memberIds.length === 1
                            ? board.members.find(
                                (m) => m.id === card.memberIds[0],
                              )?.name
                            : `${card.memberIds.length} assigned`}
                        </span>
                      </div>
                    ) : (
                      <>
                        <UnassignedLeadIcon className="size-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          Add assignee
                        </span>
                      </>
                    )}
                  </button>
                }
              />
            </div>

            {/* Row 2 Left: Dates */}
            <div className="gap-3 flex items-center">
              <span className="w-24 gap-1.5 font-medium flex items-center text-muted-foreground">
                <CalendarDays className="size-3.5" />
                <span>Dates</span>
              </span>
              <div className="gap-1.5 flex items-center">
                <DatePicker
                  value={currentStartDate}
                  onChange={(d) =>
                    dispatch({
                      type: 'card/update',
                      cardId: card.id,
                      patch: { startDate: d || null },
                    })
                  }
                  trigger={
                    <button
                      type="button"
                      className="gap-1 px-2 py-0.5 font-medium inline-flex items-center rounded-md border border-border/70 text-foreground hover:bg-accent/50"
                    >
                      <CalendarPlus className="size-3 text-muted-foreground" />
                      <span>
                        {currentStartDate
                          ? formatDateShort(currentStartDate)
                          : 'Start'}
                      </span>
                    </button>
                  }
                />
                <span className="text-[11px] text-muted-foreground">→</span>
                <DatePicker
                  value={card.dueDate ?? ''}
                  onChange={(d) =>
                    dispatch({
                      type: 'card/update',
                      cardId: card.id,
                      patch: { dueDate: d || null },
                    })
                  }
                  trigger={
                    <button
                      type="button"
                      className="gap-1 px-2 py-0.5 font-medium inline-flex items-center rounded-md border border-accent-rose/30 bg-accent-rose-soft text-accent-rose hover:bg-accent-rose-soft"
                    >
                      <CalendarX2 className="size-3 text-accent-rose" />
                      <span>
                        {card.dueDate ? formatDateShort(card.dueDate) : 'Due'}
                      </span>
                    </button>
                  }
                />
              </div>
            </div>

            {/* Row 2 Right: Priority */}
            <div className="gap-3 flex items-center">
              <span className="w-24 gap-1.5 font-medium flex items-center text-muted-foreground">
                <PriorityIcon priority={currentPriority} />
                <span>Priority</span>
              </span>
              <KanbanPriorityPicker
                priority={currentPriority}
                onPriorityChange={handlePriorityChange}
                trigger={
                  <button
                    type="button"
                    className="gap-1.5 px-2 py-0.5 font-medium inline-flex cursor-pointer items-center rounded-lg border border-border/70 text-foreground hover:bg-accent/50"
                  >
                    <PriorityIcon priority={currentPriority} />
                    <span className="capitalize">
                      {currentPriority.toLowerCase().replace('_', ' ')}
                    </span>
                  </button>
                }
              />
            </div>

            {/* Row 3 Left: Track Time */}
            <div className="gap-3 flex items-center">
              <span className="w-24 gap-1.5 font-medium flex items-center text-muted-foreground">
                <Timer className="size-3.5" />
                <span>Track time</span>
              </span>
              <DropdownMenu
                open={isLoggingTime}
                onOpenChange={setIsLoggingTime}
              >
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="gap-1.5 px-2 py-0.5 font-medium inline-flex cursor-pointer items-center rounded-md border border-border/70 bg-surface font-mono text-foreground transition-colors hover:bg-accent/50"
                  >
                    <Clock className="size-3 text-primary" />
                    <span>
                      {detail?.timeSpent
                        ? formatMinutes(detail.timeSpent)
                        : 'No time logged'}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-56 p-3 shadow-xl rounded-xl border border-border bg-popover text-popover-foreground"
                >
                  <form onSubmit={handleLogTime} className="space-y-2">
                    <p className="font-semibold tracking-wide text-[11px] text-muted-foreground uppercase">
                      Log time
                    </p>
                    <div className="gap-1.5 flex items-center">
                      <input
                        type="number"
                        min={0}
                        value={logHours}
                        onChange={(e) => setLogHours(e.target.value)}
                        placeholder="0"
                        aria-label="Hours"
                        className="w-16 text-xs px-2 py-1 rounded-md border border-border bg-surface outline-none focus:border-ring"
                      />
                      <span className="text-xs text-muted-foreground">h</span>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={logMinutes}
                        onChange={(e) => setLogMinutes(e.target.value)}
                        placeholder="0"
                        aria-label="Minutes"
                        className="w-16 text-xs px-2 py-1 rounded-md border border-border bg-surface outline-none focus:border-ring"
                      />
                      <span className="text-xs text-muted-foreground">m</span>
                    </div>
                    <Button
                      type="submit"
                      size="sm"
                      className="h-7 text-xs w-full"
                    >
                      Add to logged time
                    </Button>
                  </form>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Row 3 Right: Tags */}
            <div className="gap-3 flex items-center">
              <span className="w-24 gap-1.5 font-medium flex items-center text-muted-foreground">
                <Tag className="size-3.5" />
                <span>Tags</span>
              </span>
              <div className="gap-1 flex flex-wrap items-center">
                {currentLabels.map((lbl) => {
                  const color = colorOf(lbl);
                  return (
                    <span
                      key={lbl}
                      className="gap-1 px-2 py-0.2 font-semibold inline-flex items-center rounded-full border text-[11px]"
                      style={{
                        backgroundColor: `${color}18`,
                        borderColor: `${color}40`,
                        color,
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
                      className="px-1.5 py-0.5 rounded border border-dashed border-border/80 text-[11px] text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    >
                      + Tag
                    </button>
                  }
                />
              </div>
            </div>

            {/* Row 4 Left: Team */}
            <div className="gap-3 flex items-center">
              <span className="w-24 gap-1.5 font-medium flex items-center text-muted-foreground">
                <UsersRound className="size-3.5" />
                <span>Team</span>
              </span>
              <KanbanRefPicker
                items={teamItems}
                selectedId={detail?.teamId}
                onSelect={handleTeamChange}
                noneLabel="No team"
                emptyMessage="No teams in this workspace yet"
                trigger={
                  <button
                    type="button"
                    className="gap-1.5 px-2 py-0.5 font-medium inline-flex cursor-pointer items-center rounded-lg border border-border/70 text-foreground hover:bg-accent/50"
                  >
                    <UsersRound className="size-3 text-muted-foreground" />
                    <span>{detail?.team?.name ?? 'No team'}</span>
                  </button>
                }
              />
            </div>

            {/* Row 4 Right: Epic */}
            <div className="gap-3 flex items-center">
              <span className="w-24 gap-1.5 font-medium flex items-center text-muted-foreground">
                <Layers className="size-3.5" />
                <span>Epic</span>
              </span>
              <KanbanRefPicker
                items={epicItems}
                selectedId={detail?.epicId}
                onSelect={handleEpicChange}
                noneLabel="No epic"
                emptyMessage="No epics in this project yet"
                trigger={
                  <button
                    type="button"
                    className="gap-1.5 px-2 py-0.5 font-medium inline-flex cursor-pointer items-center rounded-lg border border-border/70 text-foreground hover:bg-accent/50"
                  >
                    <Layers className="size-3 text-muted-foreground" />
                    <span>{detail?.epic?.name ?? 'No epic'}</span>
                  </button>
                }
              />
            </div>

            {/* Row 5 Left: Module */}
            <div className="gap-3 flex items-center">
              <span className="w-24 gap-1.5 font-medium flex items-center text-muted-foreground">
                <Boxes className="size-3.5" />
                <span>Module</span>
              </span>
              <KanbanRefPicker
                items={moduleItems}
                selectedId={detail?.moduleId}
                onSelect={handleModuleChange}
                noneLabel="No module"
                emptyMessage="No modules in this project yet"
                trigger={
                  <button
                    type="button"
                    className="gap-1.5 px-2 py-0.5 font-medium inline-flex cursor-pointer items-center rounded-lg border border-border/70 text-foreground hover:bg-accent/50"
                  >
                    <Boxes className="size-3 text-muted-foreground" />
                    <span>{detail?.module?.name ?? 'No module'}</span>
                  </button>
                }
              />
            </div>

            {/* Row 5 Right: Cycle */}
            <div className="gap-3 flex items-center">
              <span className="w-24 gap-1.5 font-medium flex items-center text-muted-foreground">
                <Repeat className="size-3.5" />
                <span>Cycle</span>
              </span>
              <KanbanRefPicker
                items={cycleItems}
                selectedId={detail?.cycleId}
                onSelect={handleCycleChange}
                noneLabel="No cycle"
                emptyMessage="No cycles in this project yet"
                trigger={
                  <button
                    type="button"
                    className="gap-1.5 px-2 py-0.5 font-medium inline-flex cursor-pointer items-center rounded-lg border border-border/70 text-foreground hover:bg-accent/50"
                  >
                    <Repeat className="size-3 text-muted-foreground" />
                    <span>{detail?.cycle?.name ?? 'No cycle'}</span>
                  </button>
                }
              />
            </div>

            {/* Row 6 Left: Estimate */}
            <div className="gap-3 flex items-center">
              <span className="w-24 gap-1.5 font-medium flex items-center text-muted-foreground">
                <Gauge className="size-3.5" />
                <span>Estimate</span>
              </span>
              <KanbanEstimatePicker
                estimate={detail?.estimate}
                onEstimateChange={handleEstimateChange}
                trigger={
                  <button
                    type="button"
                    className="gap-1.5 px-2 py-0.5 font-medium inline-flex cursor-pointer items-center rounded-lg border border-border/70 font-mono text-foreground hover:bg-accent/50"
                  >
                    <span>
                      {detail?.estimate != null
                        ? `${detail.estimate} pts`
                        : 'No estimate'}
                    </span>
                  </button>
                }
              />
            </div>

            {/* Row 6 Right: Parent */}
            <div className="gap-3 flex items-center">
              <span className="w-24 gap-1.5 font-medium flex items-center text-muted-foreground">
                <CornerUpLeft className="size-3.5" />
                <span>Parent</span>
              </span>
              <div className="gap-1.5 flex items-center">
                <KanbanTaskLinkPicker
                  options={linkableTasks}
                  excludeIds={parentExcludeIds}
                  onSelect={(task) => handleParentChange(task.id)}
                  placeholder="Search tasks..."
                  emptyMessage="No other tasks in this project"
                  trigger={
                    <button
                      type="button"
                      className="gap-1.5 px-2 py-0.5 font-medium max-w-56 inline-flex cursor-pointer items-center rounded-lg border border-border/70 text-foreground hover:bg-accent/50"
                    >
                      <span className="truncate">
                        {detail?.parent
                          ? (detail.parent.identifier ?? detail.parent.title)
                          : 'No parent'}
                      </span>
                    </button>
                  }
                />
                {detail?.parent && (
                  <button
                    type="button"
                    onClick={() => handleParentChange(null)}
                    className="p-0.5 rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Clear parent"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Blocked by Alert Badge — only while something un-done actually blocks this card */}
          {activeBlockingRelations.length > 0 && (
            <div className="gap-2 p-2.5 text-xs flex flex-wrap items-center rounded-xl border border-accent-amber/25 bg-accent-amber-soft text-foreground">
              <AlertTriangle className="size-3.5 shrink-0 text-accent-amber" />
              <span className="font-semibold text-accent-amber">
                Blocked by
              </span>
              {activeBlockingRelations.map((view) => (
                <span
                  key={view.id}
                  className="gap-1.5 px-2 py-0.5 font-medium inline-flex items-center rounded-md border border-border/80 bg-surface text-[11px]"
                >
                  <StatusIcon
                    status={view.otherTask.status}
                    className="size-3"
                  />
                  {view.otherTask.identifier && (
                    <span className="font-mono text-muted-foreground">
                      {view.otherTask.identifier}
                    </span>
                  )}
                  <span className="max-w-40 truncate">
                    {view.otherTask.title}
                  </span>
                </span>
              ))}
            </div>
          )}

          {/* Relations */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold tracking-wide gap-1.5 flex items-center text-muted-foreground uppercase">
                <Link2 className="size-3.5" />
                <span>Relations</span>
              </h3>
              <KanbanTaskLinkPicker
                options={linkableTasks}
                excludeIds={[card.id]}
                onSelect={handleAddRelation}
                placeholder="Search tasks to link..."
                emptyMessage="No other tasks in this project"
                header={
                  <div className="mb-1">
                    <AppSelect
                      size="sm"
                      value={addRelationType}
                      onValueChange={(v) =>
                        setAddRelationType(v as RelationType)
                      }
                      options={LINKABLE_RELATION_TYPES.map((option) => ({
                        value: option.type,
                        label: option.label,
                      }))}
                      aria-label="Relation type"
                    />
                  </div>
                }
                trigger={
                  <button
                    type="button"
                    className="text-xs gap-1 flex items-center text-primary hover:underline"
                  >
                    <Plus className="size-3" />
                    <span>Add relation</span>
                  </button>
                }
              />
            </div>

            {relations.length === 0 ? (
              <p className="text-xs text-muted-foreground/70 italic">
                No linked tasks yet.
              </p>
            ) : (
              <div className="space-y-1">
                {relations.map((view) => (
                  <div
                    key={view.id}
                    className={cn(
                      'gap-2 px-2.5 py-1.5 text-xs group flex items-center rounded-lg',
                      isBlockingView(view)
                        ? 'bg-accent-amber-soft/60'
                        : 'bg-surface-muted',
                    )}
                  >
                    <span
                      className={cn(
                        'font-medium shrink-0',
                        isBlockingView(view)
                          ? 'text-accent-amber'
                          : 'text-muted-foreground',
                      )}
                    >
                      {relationVerb(view.type, view.direction)}
                    </span>
                    <StatusIcon
                      status={view.otherTask.status}
                      className="size-3 shrink-0"
                    />
                    {view.otherTask.identifier && (
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        {view.otherTask.identifier}
                      </span>
                    )}
                    <span className="flex-1 truncate">
                      {view.otherTask.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRelation(view.id)}
                      className="p-0.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"
                      aria-label="Remove relation"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Description Section */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold tracking-wide gap-1.5 flex items-center text-muted-foreground uppercase">
                <AlignLeft className="size-3.5" />
                <span>Description</span>
              </h3>
              {!editingDescription && (
                <button
                  type="button"
                  onClick={() => setEditingDescription(true)}
                  className="text-xs gap-1 flex items-center text-primary hover:underline"
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
                  <div className="gap-2 flex">
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
                    className="text-xs gap-1 text-accent-violet"
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
                  'min-h-16 p-3 text-xs cursor-pointer rounded-xl border border-transparent bg-surface-muted whitespace-pre-wrap transition-colors hover:border-input',
                  !card.description && 'text-muted-foreground italic',
                )}
              >
                {card.description || 'Add description, or write with ✨ AI...'}
              </div>
            )}
          </section>

          {/* Collapsible Fields & Action Items Section */}
          <section className="pt-4 space-y-3 border-t border-border/50">
            <button
              type="button"
              onClick={() => setIsFieldsOpen(!isFieldsOpen)}
              className="gap-1.5 text-xs font-semibold flex cursor-pointer items-center text-foreground transition-colors hover:text-primary"
            >
              {isFieldsOpen ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
              <span>Fields & Action Items</span>
            </button>

            {isFieldsOpen && (
              <div className="pl-5 space-y-2 text-xs">
                <div className="font-medium pb-1 flex items-center justify-between text-muted-foreground">
                  <span className="gap-1.5 flex items-center">
                    <ListCheck className="size-3.5 text-primary" />
                    <span>
                      Action Items ({checklists.filter((c) => c.done).length}/
                      {checklists.length})
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddingChecklist(true)}
                    className="text-xs gap-1 flex items-center text-primary hover:underline"
                  >
                    <Plus className="size-3" />
                    <span>Add item</span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  {checklists.map((item) => (
                    <div
                      key={item.id}
                      className="gap-2.5 group p-1 flex items-center rounded-lg transition-colors hover:bg-accent/40"
                    >
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={(e) =>
                          setChecklists(
                            checklists.map((c) =>
                              c.id === item.id
                                ? { ...c, done: e.target.checked }
                                : c,
                            ),
                          )
                        }
                        className="rounded size-3.5 cursor-pointer border-border text-primary focus:ring-0"
                      />
                      <span
                        className={cn(
                          'text-xs flex-1 transition-colors',
                          item.done && 'text-muted-foreground line-through',
                        )}
                      >
                        {item.text}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setChecklists(
                            checklists.filter((c) => c.id !== item.id),
                          )
                        }
                        className="p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}

                  {isAddingChecklist && (
                    <form
                      onSubmit={handleAddChecklist}
                      className="gap-2 pt-1 flex items-center"
                    >
                      <input
                        autoFocus
                        value={newChecklistText}
                        onChange={(e) => setNewChecklistText(e.target.value)}
                        placeholder="Add new action item..."
                        className="text-xs px-2 py-1 flex-1 rounded-md border border-border bg-surface outline-none focus:border-ring"
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

          {/* Sub-issues — real child tasks (`Task.parentId`), the same hierarchy
              the spreadsheet view's "X/Y" badge already summarises. */}
          <section className="pt-4 space-y-3 border-t border-border/50">
            <button
              type="button"
              onClick={() => setIsSubIssuesOpen(!isSubIssuesOpen)}
              className="gap-1.5 text-xs font-semibold flex cursor-pointer items-center text-foreground transition-colors hover:text-primary"
            >
              {isSubIssuesOpen ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
              <ListTree className="size-3.5" />
              <span>
                Sub-issues (
                {subIssues.filter((s) => s.status === 'DONE').length}/
                {subIssues.length})
              </span>
            </button>

            {isSubIssuesOpen && (
              <div className="pl-5 space-y-1.5 text-xs">
                {subIssues.map((sub) => (
                  <div
                    key={sub.id}
                    className="gap-2.5 group p-1 flex items-center rounded-lg transition-colors hover:bg-accent/40"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        handleToggleSubIssue(sub.id, sub.status === 'DONE')
                      }
                      aria-label={
                        sub.status === 'DONE'
                          ? 'Mark as not done'
                          : 'Mark as done'
                      }
                      className="shrink-0"
                    >
                      <StatusIcon status={sub.status} className="size-3.5" />
                    </button>
                    {sub.identifier && (
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        {sub.identifier}
                      </span>
                    )}
                    <span
                      className={cn(
                        'text-xs flex-1 truncate transition-colors',
                        sub.status === 'DONE' &&
                          'text-muted-foreground line-through',
                      )}
                    >
                      {sub.title}
                    </span>
                  </div>
                ))}

                {isAddingSubIssue ? (
                  <form
                    onSubmit={handleAddSubIssue}
                    className="gap-2 pt-1 flex items-center"
                  >
                    <input
                      autoFocus
                      value={newSubIssueText}
                      onChange={(e) => setNewSubIssueText(e.target.value)}
                      placeholder="Add sub-issue title..."
                      className="text-xs px-2 py-1 flex-1 rounded-md border border-border bg-surface outline-none focus:border-ring"
                    />
                    <Button size="sm" type="submit" className="h-7 text-xs">
                      Add
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsAddingSubIssue(false)}
                      className="h-7 text-xs"
                    >
                      Cancel
                    </Button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddingSubIssue(true)}
                    className="text-xs gap-1 pt-1 flex items-center text-primary hover:underline"
                  >
                    <Plus className="size-3" />
                    <span>Add sub-issue</span>
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Attachments — real Upload rows filed against this issue; they also
              surface in the workspace Files hub. */}
          <section className="pt-4 border-t border-border/50">
            <FiledFilesSection
              workspaceId={workspaceId}
              workspaceSlug={workspaceSlug}
              currentUserId={currentUserId}
              target={{ type: 'ISSUE', id: card.id }}
              uploadLabel="Attach files to this issue"
              emptyDescription="Attach a file to keep it with this issue."
              onNavigateSource={(href) => navigate(href)}
            />
          </section>
        </div>

        {/* RIGHT COLUMN: Activity & Comments Feed */}
        <div
          className={cn(
            'flex w-full flex-col overflow-hidden bg-surface-inset/30',
            // Stacked under the card in the rail, capped so the card body it
            // belongs to never gets squeezed out of view above it.
            isPanel ? 'max-h-[45%] shrink-0' : 'md:w-96 h-full',
          )}
        >
          {/* Activity Header */}
          <div className="p-3.5 px-5 flex shrink-0 items-center justify-between border-b border-border/60 bg-surface/40">
            <h3 className="text-xs font-bold gap-2 flex items-center text-foreground">
              <MessageSquare className="size-3.5 text-primary" />
              <span>Activity</span>
            </h3>
            <div className="gap-1 flex items-center text-muted-foreground">
              <button
                type="button"
                className="p-1 rounded hover:bg-muted"
                title="Search activity"
              >
                <Search className="size-3.5" />
              </button>
              <button
                type="button"
                className="p-1 rounded gap-0.5 text-xs flex items-center hover:bg-muted"
              >
                <MessageSquare className="size-3.5" />
                <span className="font-mono text-[10px]">
                  {comments.data?.length ?? card.commentCount ?? 0}
                </span>
              </button>
              <button
                type="button"
                className="p-1 rounded hover:bg-muted"
                title="Filter activity"
              >
                <Filter className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Activity Stream Scrollable Area */}
          <div className="min-h-0 p-4 space-y-4 text-xs flex-1 overflow-y-auto">
            {comments.isLoading ? (
              <p className="py-4 text-center text-muted-foreground/70">
                Loading comments…
              </p>
            ) : (comments.data ?? []).length === 0 ? (
              <p className="py-4 text-center text-muted-foreground/70">
                No comments yet. Start the conversation below.
              </p>
            ) : null}

            {(comments.data ?? []).map((comment) => (
              <div
                key={comment.id}
                className="space-y-1.5 p-3 shadow-2xs rounded-xl border border-border/60 bg-surface"
              >
                <div className="flex items-center justify-between">
                  <div className="gap-2 flex items-center">
                    <UserAvatar
                      name={comment.author.displayName ?? comment.author.name}
                      seed={comment.author.id}
                      src={comment.author.avatarUrl ?? undefined}
                      size="xs"
                    />
                    <span className="font-semibold text-xs text-foreground">
                      {comment.author.displayName ?? comment.author.name}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {formatRelative(comment.createdAt)}
                  </span>
                </div>
                <p className="text-xs pl-6 whitespace-pre-wrap text-foreground">
                  {comment.content}
                </p>
              </div>
            ))}
          </div>

          {/* Comment Composer Footer */}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const content = commentDraft.trim();
              if (!content) return;
              // Only clear the draft once the comment was actually sent or
              // durably queued — a failed attempt (a real error, not just
              // being offline) leaves the typed text in place to retry.
              addComment.mutate(
                { content },
                { onSuccess: () => setCommentDraft('') },
              );
            }}
            className="p-3 space-y-2 shrink-0 border-t border-border/60 bg-surface/50"
          >
            <input
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              placeholder="Write a comment..."
              className="text-xs px-1 w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground/70"
            />
            <div className="pt-1 flex items-center justify-between">
              <div className="gap-1.5 flex items-center text-muted-foreground">
                <button
                  type="button"
                  className="p-1 rounded hover:bg-muted hover:text-foreground"
                  title="Add item"
                >
                  <Plus className="size-3.5" />
                </button>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-muted hover:text-accent-violet"
                  title="Brain AI"
                >
                  <Sparkles className="size-3.5 text-accent-violet" />
                </button>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-muted hover:text-foreground"
                  title="Mention"
                >
                  <AtSign className="size-3.5" />
                </button>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-muted hover:text-foreground"
                  title="Attachment"
                >
                  <Paperclip className="size-3.5" />
                </button>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-muted hover:text-foreground"
                  title="Emoji"
                >
                  <Smile className="size-3.5" />
                </button>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-muted hover:text-foreground"
                  title="Video note"
                >
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
