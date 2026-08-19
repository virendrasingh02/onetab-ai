import { TaskStatus } from '@org/types';
import {
  Badge,
  Button,
  DatePicker,
  Dialog,
  DialogContent,
  DialogTitle,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  SkeletonList,
  Textarea,
  UserAvatar,
} from '@org/ui';
import { cn, formatRelative } from '@org/utils';
import {
  AlertTriangle,
  AlignLeft,
  AtSign,
  Calendar,
  CalendarDays,
  CalendarPlus,
  CalendarX2,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock,
  Contact,
  Copy,
  CornerUpRight,
  Eye,
  FileCode,
  FileVideo,
  Filter,
  Flame,
  GitBranch,
  Hash,
  Heart,
  HelpCircle,
  Image as ImageIcon,
  Layers,
  Link2,
  ListCheck,
  Maximize2,
  MessageSquare,
  Minimize2,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Play,
  Plus,
  Search,
  Send,
  Share2,
  Smile,
  Sparkles,
  Star,
  Tag,
  ThumbsUp,
  Timer,
  Trash2,
  Users,
  Video,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import { useAddTaskComment, useTaskComments } from '../use-work-tools.js';
import { parseDay } from './card-meta.js';
import { useKanbanCustomStore } from './kanban-custom-store.js';
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

export function CardDetailsDialog({
  workspaceId,
  board,
  cardId,
  dispatch,
  onClose,
}: CardDetailsDialogProps) {
  const found = cardId ? findCard(board, cardId) : undefined;
  const [isFullscreen, setIsFullscreen] = useState(false);

  return (
    <Dialog
      open={Boolean(found)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className={cn(
          'p-0 overflow-hidden flex flex-col bg-card text-card-foreground transition-all duration-200 border border-border shadow-2xl rounded-2xl',
          isFullscreen
            ? 'w-[98vw] h-[96vh] max-w-none'
            : 'w-[94vw] max-w-6xl h-[90vh]',
        )}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement | null)?.focus();
        }}
      >
        {found ? (
          <CardDetailsBody
            workspaceId={workspaceId}
            board={board}
            card={found.card}
            listId={found.list.id}
            listTitle={found.list.title}
            dispatch={dispatch}
            onClose={onClose}
            isFullscreen={isFullscreen}
            onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
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
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
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
  isFullscreen,
  onToggleFullscreen,
}: CardDetailsBodyProps) {
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState(card.description);
  const [commentDraft, setCommentDraft] = useState('');
  const [isStarred, setIsStarred] = useState(false);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [isFieldsOpen, setIsFieldsOpen] = useState(true);

  // Checklists mock state
  const [checklists, setChecklists] = useState([
    { id: '1', text: "Complete checklist item 'Again this'.", done: false },
    { id: '2', text: "Complete checklist item 'sdfbdfbdfb'.", done: true },
    { id: '3', text: "Complete checklist item 'dfbdfbdf'.", done: false },
    { id: '4', text: 'Work on subtask and finalize assets.', done: false },
  ]);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [isAddingChecklist, setIsAddingChecklist] = useState(false);

  const comments = useTaskComments(workspaceId, card.id);
  const addComment = useAddTaskComment(workspaceId, card.id);

  // Custom Kanban Store
  const customStore = useKanbanCustomStore();
  const cardCustomProps = customStore.getCardProperties(card.id);
  const storeLabels = customStore.labels;

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

  const handleGenerateWithAI = () => {
    setDescriptionDraft(
      (prev) =>
        `${prev ? prev + '\n\n' : ''}### Overview\nThis task focuses on executing the end-to-end design flow for the application.\n\n### Acceptance Criteria\n- [ ] Clean and cohesive visual hierarchy\n- [ ] Fully responsive on mobile and desktop\n- [ ] Integrated status indicators and activity feed`,
    );
    setEditingDescription(true);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-card text-card-foreground">
      {/* ---------------- 1. TOP TOOLBAR / HEADER ---------------- */}
      <header className="h-13 px-4 sm:px-6 border-b border-border/70 bg-surface/50 backdrop-blur-sm flex items-center justify-between gap-4 shrink-0">
        {/* Left: Breadcrumbs & Meta Badges */}
        <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <span className="flex items-center gap-1 font-bold text-foreground">
              <CubeProjectIcon className="size-3.5 text-amber-500" />
              <span>{board.title}</span>
            </span>
            <span>/</span>
            <span className="font-semibold text-primary">{listTitle}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-muted font-mono font-medium">
              +1
            </span>
          </div>

          <div className="h-4 w-px bg-border/80 mx-1 hidden sm:block" />

          {/* Type Badge & Counter Metrics */}
          <div className="flex items-center gap-2 text-xs">
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/80 border border-border/60 text-foreground text-[11px] font-medium">
              <CheckSquare className="size-3 text-primary" />
              <span>Task</span>
              <ChevronDown className="size-3 text-muted-foreground ml-0.5" />
            </div>

            <div className="hidden lg:flex items-center gap-2.5 text-muted-foreground text-[11px]">
              <span className="flex items-center gap-1 hover:text-foreground cursor-pointer" title="Subtasks">
                <GitBranch className="size-3" />
                <span>3</span>
              </span>
              <span className="flex items-center gap-1 hover:text-foreground cursor-pointer" title="Completed checklists">
                <Check className="size-3 text-emerald-500" />
                <span>2</span>
              </span>
              <span className="flex items-center gap-1 hover:text-foreground cursor-pointer" title="Comments">
                <MessageSquare className="size-3" />
                <span>{card.commentCount || 3}</span>
              </span>
              <span className="flex items-center gap-1 hover:text-foreground cursor-pointer" title="Dependencies">
                <Link2 className="size-3" />
                <span>1</span>
              </span>
              <span className="flex items-center gap-1 hover:text-foreground cursor-pointer" title="Mentions">
                <AtSign className="size-3" />
                <span>9</span>
              </span>
              {currentLead && (
                <span className="flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold text-[10px]">
                  <span className="size-3.5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[8px] font-bold">
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
          <span className="text-[11px] text-muted-foreground hidden md:inline-block mr-2">
            Created {formatDateShort(card.createdAt) || 'Sep 8, 2023'}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateWithAI}
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
            className={cn('size-7', isStarred ? 'text-amber-500' : 'text-muted-foreground')}
            title="Star task"
          >
            <Star className={cn('size-3.5', isStarred && 'fill-current')} />
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleFullscreen}
            className="size-7 text-muted-foreground hover:text-foreground"
            title={isFullscreen ? 'Exit full screen' : 'Full screen'}
          >
            {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="size-7 text-muted-foreground hover:text-foreground"
            title="Close modal"
          >
            <X className="size-4" />
          </Button>
        </div>
      </header>

      {/* ---------------- 2. MAIN 2-COLUMN LAYOUT ---------------- */}
      <div className="flex min-h-0 flex-1 overflow-hidden divide-x divide-border/60">
        {/* LEFT COLUMN: Title, AI Banner, Properties, Description, Checklists */}
        <div className="flex-1 min-w-0 overflow-y-auto p-6 md:p-8 space-y-6">
          {/* Large Editable Title */}
          <div>
            <DialogTitle className="sr-only">{card.title}</DialogTitle>
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
              className="h-6 text-[11px] bg-surface text-accent-violet border-accent-violet/40 hover:bg-accent-violet-soft font-semibold px-2.5 shrink-0"
            >
              Generate
            </Button>
          </div>

          {/* Structured 2-Column Properties Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3.5 py-3 border-y border-border/50 text-xs">
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
                    <Check className="size-3 text-emerald-500" />
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
                currentMemberId={currentLeadId}
                members={board.members}
                onSelectMember={handleLeadChange}
                trigger={
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border border-border/70 hover:bg-accent/50 transition-colors cursor-pointer"
                  >
                    {currentLead ? (
                      <>
                        <UserAvatar
                          name={currentLead.name}
                          seed={currentLead.id}
                          src={currentLead.avatarUrl}
                          size="xs"
                          className="size-4.5 text-[9px] font-bold"
                        />
                        <span className="font-medium text-foreground">{currentLead.name}</span>
                      </>
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
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 font-medium"
                    >
                      <CalendarX2 className="size-3 text-rose-500" />
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
          <div className="flex items-center gap-2 p-2.5 rounded-xl border border-amber-500/25 bg-amber-500/5 text-xs text-foreground">
            <AlertTriangle className="size-3.5 text-amber-500 shrink-0" />
            <span className="font-semibold text-amber-600 dark:text-amber-400">Blocked by</span>
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
        <div className="w-full md:w-96 flex flex-col h-full bg-surface-inset/30 overflow-hidden">
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
                <span className="text-[10px] font-mono">{card.commentCount || 2}</span>
              </button>
              <button type="button" className="p-1 rounded hover:bg-muted" title="Filter activity">
                <Filter className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Activity Stream Scrollable Area */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 text-xs">
            {/* Comment Item 1 */}
            <div className="space-y-1.5 p-3 rounded-xl bg-surface border border-border/60 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="size-5 rounded-full bg-rose-500 text-white font-bold flex items-center justify-center text-[9px]">
                    VS
                  </span>
                  <span className="font-semibold text-foreground text-xs">virendra singh</span>
                </div>
                <span className="text-[10px] text-muted-foreground">Jul 16 2024 at 6:49 pm</span>
              </div>
              <p className="text-xs text-foreground pl-7">Hello there</p>
              <div className="flex items-center gap-3 pt-1 pl-7 text-muted-foreground">
                <button type="button" className="hover:text-foreground flex items-center gap-1 text-[11px]">
                  <ThumbsUp className="size-3" />
                </button>
                <button type="button" className="hover:text-foreground flex items-center gap-1 text-[11px]">
                  <Smile className="size-3" />
                </button>
                <button type="button" className="hover:text-foreground text-[11px] font-medium ml-auto">
                  Reply
                </button>
              </div>
            </div>

            {/* Comment Item 2 with Video / Screen Recording Attachment */}
            <div className="space-y-2 p-3 rounded-xl bg-surface border border-border/60 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="size-5 rounded-full bg-rose-500 text-white font-bold flex items-center justify-center text-[9px]">
                    VS
                  </span>
                  <span className="font-semibold text-foreground text-xs">virendra singh</span>
                </div>
                <span className="text-[10px] text-muted-foreground">Jan 10 2025 at 11:26 am</span>
              </div>

              {/* Embedded Video Card matching screenshot */}
              <div className="rounded-xl border border-border overflow-hidden bg-neutral-900 text-white">
                <div className="p-2 px-3 bg-neutral-800/90 border-b border-neutral-700 flex items-center gap-2 text-[11px] font-medium text-neutral-200">
                  <FileVideo className="size-3.5 text-primary" />
                  <span className="truncate">screen-recording-2024-06-18-16:13</span>
                </div>

                <div className="relative aspect-video flex items-center justify-center bg-black/60 group">
                  {isPlayingVideo ? (
                    <div className="text-center p-4">
                      <p className="text-xs font-medium text-white mb-2">Playing video stream...</p>
                      <Button size="sm" variant="outline" onClick={() => setIsPlayingVideo(false)} className="h-6 text-xs">
                        Pause
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="absolute inset-0 bg-neutral-950/40 flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => setIsPlayingVideo(true)}
                          className="size-10 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 flex items-center justify-center text-white transition-transform group-hover:scale-110 shadow-lg"
                        >
                          <Play className="size-5 fill-current ml-0.5" />
                        </button>
                      </div>
                      <div className="absolute bottom-2 inset-x-2 flex items-center justify-between text-[10px] text-neutral-300 bg-neutral-950/70 backdrop-blur-sm px-2 py-1 rounded-md">
                        <div className="flex items-center gap-2">
                          <Play className="size-2.5 fill-current" />
                          <span>00:00 / 00:05</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono">
                          <span>1x</span>
                          <Maximize2 className="size-2.5" />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1 text-muted-foreground">
                <button type="button" className="hover:text-foreground flex items-center gap-1 text-[11px]">
                  <ThumbsUp className="size-3" />
                </button>
                <button type="button" className="hover:text-foreground flex items-center gap-1 text-[11px]">
                  <Smile className="size-3" />
                </button>
                <button type="button" className="hover:text-foreground text-[11px] font-medium ml-auto">
                  Reply
                </button>
              </div>
            </div>

            {/* System Audit Log Entry */}
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground/80 py-1">
              <span className="size-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
              <span>You removed the due date of 2/23/24</span>
              <span className="text-[10px] text-muted-foreground/60 ml-auto">Sep 12 2025</span>
            </div>

            {/* Dynamic fetched comments */}
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
