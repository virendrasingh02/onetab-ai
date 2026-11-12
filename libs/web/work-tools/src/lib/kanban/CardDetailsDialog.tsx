import { useCurrentUser } from '@org/auth';
import {
  WorkspacePermission,
  type RelationType,
  type Task,
  type TaskChecklistItem,
  type WorkItemType,
} from '@org/types';
import { ShareToChatDialog } from '@org/web-chat';
import { useSaveForLater } from '@org/web-chat/bookmarks';
import { useWorkspacePermission } from '@org/web-workspace';
import { FiledFilesSection } from '@org/web-upload';
import {
  Button,
  confirm,
  Dialog,
  DialogContent,
  DialogTitle,
  Textarea,
  toast,
  useRightPanelStore,
} from '@org/ui';
import { cn } from '@org/utils';
import { AlertTriangle, CornerLeftUp } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  useAddTaskComment,
  useConvertTaskToDocument,
  useCurrentWorkspace,
  useRelationMutations,
  useTaskCommentMutations,
  useTaskComments,
  useTaskDetail,
  useTaskMutations,
  useTasks,
  useTeams,
  useWorkItemRelations,
} from '../use-work-tools.js';
import type { ActivityLookups } from './card-details/activity-feed.js';
import {
  parseAiList,
  useCardAi,
  type CardAiTask,
} from './card-details/card-ai.js';
import { CardActivity } from './card-details/CardActivity.js';
import { CardChecklist } from './card-details/CardChecklist.js';
import { CardCommentComposer } from './card-details/CardCommentComposer.js';
import { CardDescription } from './card-details/CardDescription.js';
import { CardHeader } from './card-details/CardHeader.js';
import { CardPropertiesPanel } from './card-details/CardPropertiesPanel.js';
import { CardRelations } from './card-details/CardRelations.js';
import { CardSubIssues } from './card-details/CardSubIssues.js';
import { useIsWideViewport } from './card-details/primitives.js';
import { useKanbanCardViewStore } from './kanban-card-view-store.js';
import type { KanbanRefPickerItem } from './KanbanRefPicker.js';
import type { KanbanTaskLinkOption } from './KanbanTaskLinkPicker.js';
import { StatusIcon } from './kanban-icons.js';
import { isBlockingView, relationsFor } from './relation-meta.js';
import type { BoardAction } from './server-board.js';
import type { BoardState, KanbanCard, KanbanList, Priority } from './types.js';

export interface CardDetailsDialogProps {
  workspaceId: string | undefined;
  /** The open project — the parent/relation task pickers scope to it. */
  projectId: string | undefined;
  board: BoardState;
  /** Open card, or null when the dialog is closed. */
  cardId: string | null;
  dispatch: (action: BoardAction) => void;
  /** Switches the open card, for following a sub-issue, link or parent. */
  onOpenCard: (cardId: string) => void;
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
  onOpenCard,
  onClose,
}: CardDetailsDialogProps) {
  const found = cardId ? findCard(board, cardId) : undefined;
  const mode = useKanbanCardViewStore((s) => s.mode);

  const cardSlot = useRightPanelStore((s) => s.slots.card);
  const openHosted = useRightPanelStore((s) => s.openHosted);
  const closeHosted = useRightPanelStore((s) => s.closeHosted);

  const inPanel = mode === 'panel';
  const isOpen = Boolean(found);

  /*
   * Claim the rail while a card is open in panel mode, and give it back on
   * close or on a switch to a dialog — otherwise the rail would outlive the
   * card and show an empty column. `onClose` goes with the claim so dismissing
   * the rail closes the card rather than orphaning it.
   */
  useEffect(() => {
    if (!isOpen || !inPanel) return;
    /* The card draws its own toolbar, so it needs no title from the rail. */
    openHosted('card', { title: '', onClose });
    return () => closeHosted('card');
  }, [isOpen, inPanel, onClose, openHosted, closeHosted]);

  if (!found) return null;

  const body = (height: string) => (
    <CardDetailsBody
      // A different card starts clean: its drafts belong to the one being left.
      key={found.card.id}
      workspaceId={workspaceId}
      projectId={projectId}
      board={board}
      card={found.card}
      listId={found.list.id}
      listTitle={found.list.title}
      dispatch={dispatch}
      onOpenCard={onOpenCard}
      onClose={onClose}
      stacked={inPanel}
      compact={inPanel}
      height={height}
    />
  );

  if (inPanel) {
    // Nothing to render until the shell has mounted its slot — one frame.
    return cardSlot ? createPortal(body('h-full'), cardSlot) : null;
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        hideCloseButton
        mobile="full"
        aria-describedby={undefined}
        className={cn(
          'p-0 shadow-2xl rounded-2xl border border-border bg-card text-card-foreground transition-all duration-200',
          mode === 'full'
            ? 'max-h-[96dvh] w-[98vw] max-w-none'
            : 'max-w-304 w-[94vw]',
        )}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement | null)?.focus();
        }}
        /* Escape backs out of the field being typed in, not the whole card. */
        onEscapeKeyDown={(event) => {
          if (
            (event.target as HTMLElement | null)?.matches('input, textarea')
          ) {
            event.preventDefault();
          }
        }}
      >
        {/*
         * `DialogContent` scrolls its children, which leaves `h-full` nothing to
         * resolve against, so the body states its height outright.
         */}
        {body(mode === 'full' ? 'h-[96dvh]' : 'h-[90dvh] max-sm:h-dvh')}
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------------------------------------- title --- */

function CardTitle({
  title,
  canEdit,
  onSave,
}: {
  title: string;
  canEdit: boolean;
  onSave: (title: string) => void;
}) {
  const [draft, setDraft] = useState(title);
  useEffect(() => setDraft(title), [title]);

  // Read at unmount, so closing the card mid-edit still saves.
  const latest = useRef({ draft, title, onSave });
  latest.current = { draft, title, onSave };

  const commit = useCallback(() => {
    const current = latest.current;
    const next = current.draft.trim();
    if (next && next !== current.title) current.onSave(next);
  }, []);

  useEffect(() => commit, [commit]);

  return (
    <Textarea
      minRows={1}
      maxLength={200}
      value={draft}
      readOnly={!canEdit}
      aria-label="Task title"
      placeholder="Task title"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft.trim()) commit();
        else setDraft(title);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        }
        if (event.key === 'Escape') {
          setDraft(title);
          latest.current.draft = title;
          event.currentTarget.blur();
        }
      }}
      className="min-h-0 p-0 text-xl leading-7 font-semibold tracking-tight rounded-md border-0 bg-transparent text-foreground shadow-none focus-visible:ring-0"
    />
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
  onOpenCard: (cardId: string) => void;
  onClose: () => void;
  /** The rail has no room for a second column, whatever the viewport says. */
  stacked: boolean;
  compact: boolean;
  height: string;
}

function CardDetailsBody({
  workspaceId,
  projectId,
  board,
  card,
  listId,
  listTitle,
  dispatch,
  onOpenCard,
  onClose,
  stacked,
  compact,
  height,
}: CardDetailsBodyProps) {
  const currentUser = useCurrentUser();
  const navigate = useNavigate();
  const { slug: workspaceSlug } = useCurrentWorkspace();
  const { can } = useWorkspacePermission();
  const canEdit = can(WorkspacePermission.UPDATE);
  const canCreate = can(WorkspacePermission.CREATE);
  const canDelete = can(WorkspacePermission.DELETE);

  const isWide = useIsWideViewport();
  const singleColumn = stacked || !isWide;

  const comments = useTaskComments(workspaceId, card.id);
  const addComment = useAddTaskComment(workspaceId, card.id);
  const commentMutations = useTaskCommentMutations(workspaceId, card.id);

  /*
   * Team/Estimate/time/Parent/sub-issues/history all live on
   * the real `Task`, not the board's narrower `KanbanCard` projection — so the
   * card fetches its own full detail, the same way it fetches comments.
   */
  const taskDetail = useTaskDetail(workspaceId, card.id);
  const detail = taskDetail.data;
  const taskMutations = useTaskMutations(workspaceId);
  const teamsQuery = useTeams(workspaceId);
  // Shares its query key (and cache) with the board's own `useTasks` call.
  const projectTasksQuery = useTasks(workspaceId, projectId);
  const relationsQuery = useWorkItemRelations(workspaceId, card.id);
  const relationMutations = useRelationMutations(workspaceId);

  const relations = relationsFor(relationsQuery.data, card.id);
  const activeBlockers = relations.filter(
    (view) =>
      isBlockingView(view) &&
      view.otherTask.status !== 'DONE' &&
      view.otherTask.status !== 'CANCELLED',
  );

  const subIssues = detail?.subItems ?? [];
  const linkableTasks: KanbanTaskLinkOption[] = useMemo(
    () =>
      (projectTasksQuery.data ?? []).map((t) => ({
        id: t.id,
        title: t.title,
        identifier: t.identifier,
        status: t.status,
      })),
    [projectTasksQuery.data],
  );
  // A parent can't be one of this card's own descendants, or the card itself.
  const parentExcludeIds = [card.id, ...subIssues.map((s) => s.id)];

  const teamItems: KanbanRefPickerItem[] = useMemo(
    () =>
      (teamsQuery.data ?? []).map((t) => ({
        id: t.id,
        label: t.name,
        color: t.color,
      })),
    [teamsQuery.data],
  );

  const lookups: ActivityLookups = useMemo(() => {
    const refs: Record<string, KanbanRefPickerItem[]> = {
      teamId: teamItems,
    };
    return {
      memberName: (id) => {
        const member = board.members.find((m) => m.id === id);
        return member ? (member.displayName ?? member.name) : undefined;
      },
      refName: (field, id) => refs[field]?.find((i) => i.id === id)?.label,
      taskName: (id) => {
        const task = linkableTasks.find((t) => t.id === id);
        return task ? (task.identifier ?? task.title) : undefined;
      },
    };
  }, [board.members, teamItems, linkableTasks]);

  const updateCard = (patch: Parameters<typeof patchAction>[1]) =>
    dispatch(patchAction(card.id, patch));
  const updateTask = (
    input: Parameters<typeof taskMutations.update.mutate>[0]['input'],
  ) => taskMutations.update.mutate({ taskId: card.id, input });

  /* The card is a layer over the page, so it steps aside for the new one. */
  const leaveTo = (path: string) => {
    onClose();
    navigate(path);
  };

  /* A link can point at a task from another project, which this board lacks. */
  const canOpen = (taskId: string) => Boolean(findCard(board, taskId));

  const handleToggleLabel = (label: string) =>
    updateCard({
      labels: card.labels.includes(label)
        ? card.labels.filter((l) => l !== label)
        : [...card.labels, label],
    });

  const setChecklist = (checklist: TaskChecklistItem[]) =>
    updateCard({ checklist });

  const handleToggleSubIssue = (task: Task) =>
    taskMutations.update.mutate({
      taskId: task.id,
      input: { status: task.status === 'DONE' ? 'TODO' : 'DONE' },
    });

  const handleAddSubIssue = (title: string) =>
    taskMutations.create.mutate({
      title,
      parentId: card.id,
      projectId: projectId ?? null,
    });

  const handleAddRelation = (
    target: KanbanTaskLinkOption,
    type: RelationType,
  ) =>
    relationMutations.addRelation.mutate({
      sourceId: card.id,
      targetId: target.id,
      type,
    });

  const handleDelete = () => {
    void confirm({
      title: `Delete “${card.title}”?`,
      description:
        'The task moves to the trash, along with its comments and files.',
      confirmLabel: 'Delete task',
      destructive: true,
    }).then((ok) => {
      if (!ok) return;
      dispatch({ type: 'card/remove', cardId: card.id });
      onClose();
    });
  };

  /* The star is the viewer's own "Save for later", the Saved page's bookmark. */
  const { isSaved, toggleSaved } = useSaveForLater();
  const toggleStarred = () =>
    toggleSaved({
      type: 'task',
      id: card.id,
      title: card.ticketId ? `${card.ticketId} ${card.title}` : card.title,
      snippet: card.description,
      href: `${window.location.pathname}?card=${card.id}`,
    });

  /* ------------------------------------------------------------- Brain² --- */

  const [aiDescription, setAiDescription] = useState<string | null>(null);
  const [aiComment, setAiComment] = useState<string | null>(null);
  const clearAiDescription = useCallback(() => setAiDescription(null), []);
  const clearAiComment = useCallback(() => setAiComment(null), []);

  const ai = useCardAi(workspaceId, {
    title: card.title,
    status: listTitle,
    description: card.description,
    comments: (comments.data ?? []).map(
      (c) => `${c.author.displayName ?? c.author.name}: ${c.content}`,
    ),
  });

  const convertToDoc = useConvertTaskToDocument(workspaceId, (docId) =>
    navigate(`/w/${workspaceSlug}/docs/${docId}`),
  );

  const createSubIssues = async (titles: string[]) => {
    const ok = await confirm({
      title: `Create ${titles.length} sub-issues?`,
      description: titles.join(' · '),
      confirmLabel: 'Create sub-issues',
    });
    if (!ok) return;
    // One at a time, so they keep the order Brain² listed them in.
    for (const title of titles) {
      await taskMutations.create.mutateAsync({
        title,
        parentId: card.id,
        projectId: projectId ?? null,
      });
    }
  };

  const runAi = (task: CardAiTask) => {
    if (ai.isPending) return;
    ai.mutate(task, {
      onSuccess: (content) => {
        if (task === 'description') setAiDescription(content);
        if (task === 'summary') setAiComment(content);
        if (task !== 'checklist' && task !== 'subIssues') return;

        const items = parseAiList(content);
        if (items.length === 0) {
          toast.error('Brain² did not come back with a list. Try again.');
        } else if (task === 'subIssues') {
          void createSubIssues(items);
        } else {
          const stamp = Date.now();
          setChecklist([
            ...card.checklist,
            ...items.map((text, index) => ({
              id: `${stamp}-${index}`,
              text,
              done: false,
            })),
          ]);
          toast.success(`Added ${items.length} action items`);
        }
      },
    });
  };

  /* ------------------------------------------------------------- render --- */

  const identifier =
    card.identifier ?? `TASK-${card.ticketNumber ?? card.id.slice(0, 4)}`;
  const agent = card.createdByAgent;
  const workflowId = agent?.workflowId;

  const [isShareOpen, setIsShareOpen] = useState(false);

  const properties = (
    <CardPropertiesPanel
      card={card}
      detail={detail}
      statusId={listId}
      statusTitle={listTitle}
      members={board.members}
      teamItems={teamItems}
      linkableTasks={linkableTasks}
      parentExcludeIds={parentExcludeIds}
      canEdit={canEdit}
      onStatusChange={(status: string) =>
        dispatch({
          type: 'card/move',
          cardId: card.id,
          toListId: status,
          toIndex: Number.MAX_SAFE_INTEGER,
        })
      }
      onPriorityChange={(priority: Priority) => updateCard({ priority })}
      onAssigneesChange={(memberIds) => updateCard({ memberIds })}
      onStartDateChange={(startDate) => updateCard({ startDate })}
      onDueDateChange={(dueDate) => updateCard({ dueDate })}
      onToggleLabel={handleToggleLabel}
      onReporterChange={(reporterId) => updateTask({ reporterId })}
      onTimeChange={(timeSpent) => updateTask({ timeSpent })}
      onEstimateChange={(estimate) => updateTask({ estimate })}
      onTeamChange={(teamId) => updateTask({ teamId })}
      onParentChange={(parentId) => updateTask({ parentId })}
      onManageTeams={() => leaveTo(`/w/${workspaceSlug}/settings/kanban-tasks`)}
      onOpenParent={
        detail?.parentId && canOpen(detail.parentId)
          ? () => detail.parentId && onOpenCard(detail.parentId)
          : undefined
      }
      onOpenMeeting={(meetingId) =>
        leaveTo(`/w/${workspaceSlug}/meetings?meeting=${meetingId}`)
      }
    />
  );

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden bg-card text-card-foreground',
        height,
      )}
    >
      <CardHeader
        projectName={board.title}
        identifier={identifier}
        type={detail?.type ?? card.type}
        agent={
          agent
            ? {
                name: agent.name,
                onOpen: workflowId
                  ? () =>
                      navigate(`/w/${workspaceSlug}/ai/planned/${workflowId}`)
                  : undefined,
              }
            : undefined
        }
        link={`${window.location.origin}${window.location.pathname}?card=${card.id}`}
        compact={singleColumn}
        onShare={() => setIsShareOpen(true)}
        canEdit={canEdit}
        canCreate={canCreate}
        canDelete={canDelete}
        hasDescription={Boolean(card.description)}
        hasComments={(comments.data ?? []).length > 0}
        aiBusy={ai.isPending}
        isSaved={isSaved('task', card.id)}
        onToggleSaved={toggleStarred}
        onTypeChange={(type: WorkItemType) => updateTask({ type })}
        onRunAi={runAi}
        onConvertToDoc={() => {
          convertToDoc(card).catch(() =>
            toast.error('Could not create the document'),
          );
        }}
        onDuplicate={() => dispatch({ type: 'card/copy', cardId: card.id })}
        onDelete={handleDelete}
        onClose={onClose}
      />

      <div className="min-h-0 flex flex-1">
        {/* The composer is sticky, so this column is its own scroll area. */}
        <div className="min-w-0 flex-1 overflow-y-auto">
          <div
            className={cn(
              'max-w-3xl gap-6 pt-5 mx-auto flex min-h-full flex-col',
              compact ? 'px-4' : 'px-6 sm:px-8',
            )}
          >
            <div className="space-y-2">
              {detail?.parent ? (
                <button
                  type="button"
                  disabled={!canOpen(detail.parent.id)}
                  onClick={() => detail.parent && onOpenCard(detail.parent.id)}
                  className="gap-1 text-xs flex max-w-full items-center text-muted-foreground enabled:hover:text-foreground enabled:hover:underline"
                >
                  <CornerLeftUp className="size-3 shrink-0" aria-hidden />
                  <span className="truncate">
                    Sub-issue of{' '}
                    {detail.parent.identifier
                      ? `${detail.parent.identifier} `
                      : ''}
                    {detail.parent.title}
                  </span>
                </button>
              ) : null}

              {/* `DialogTitle` reads Radix's dialog context, so it only exists
                  in the two dialog modes; in the rail there is no dialog to
                  label and a plain heading is the accessible equivalent. */}
              {stacked ? (
                <h2 className="sr-only">{card.title}</h2>
              ) : (
                <DialogTitle className="sr-only">{card.title}</DialogTitle>
              )}
              <CardTitle
                title={card.title}
                canEdit={canEdit}
                onSave={(title) => updateCard({ title })}
              />
            </div>

            {activeBlockers.length > 0 ? (
              <div className="gap-2 px-3 py-2 text-xs flex flex-wrap items-center rounded-lg border border-accent-amber/25 bg-accent-amber-soft">
                <AlertTriangle
                  className="size-3.5 shrink-0 text-accent-amber"
                  aria-hidden
                />
                <span className="font-semibold text-accent-amber">
                  Blocked by
                </span>
                {activeBlockers.map((view) => (
                  <button
                    key={view.id}
                    type="button"
                    disabled={!canOpen(view.otherTask.id)}
                    onClick={() => onOpenCard(view.otherTask.id)}
                    className="max-w-48 gap-1.5 px-2 py-0.5 font-medium inline-flex items-center rounded-md border border-border/80 bg-surface text-foreground enabled:hover:bg-accent/60"
                  >
                    <StatusIcon
                      status={view.otherTask.status}
                      className="size-3 shrink-0"
                      showTooltip={false}
                    />
                    <span className="truncate">
                      {view.otherTask.identifier ?? view.otherTask.title}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            {taskDetail.isError ? (
              <div className="gap-2 px-3 py-2 text-xs flex items-center justify-between rounded-lg border border-border text-muted-foreground">
                <span>Some details of this task didn't load.</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void taskDetail.refetch()}
                >
                  Retry
                </Button>
              </div>
            ) : null}

            {singleColumn ? (
              <div className="px-3 py-2 rounded-lg border border-border/60">
                {properties}
              </div>
            ) : null}

            <CardDescription
              description={card.description}
              canEdit={canEdit}
              aiBusy={ai.isPending}
              aiDraft={aiDescription}
              onAiDraftTaken={clearAiDescription}
              onWriteWithAi={() => runAi('description')}
              onSave={(description) => updateCard({ description })}
            />

            <CardChecklist
              items={card.checklist}
              canEdit={canEdit}
              aiBusy={ai.isPending}
              onChange={setChecklist}
              onSuggest={() => runAi('checklist')}
            />

            <CardSubIssues
              subIssues={subIssues}
              canCreate={canCreate}
              canEdit={canEdit}
              aiBusy={ai.isPending}
              canOpen={canOpen}
              onOpen={onOpenCard}
              onToggleDone={handleToggleSubIssue}
              onUnlink={(taskId) =>
                taskMutations.update.mutate({
                  taskId,
                  input: { parentId: null },
                })
              }
              onAdd={handleAddSubIssue}
              onBreakDown={() => runAi('subIssues')}
            />

            <CardRelations
              cardId={card.id}
              relations={relations}
              linkableTasks={linkableTasks}
              canLink={canCreate}
              canOpen={canOpen}
              onOpen={onOpenCard}
              onAdd={handleAddRelation}
              onRemove={(relationId) =>
                relationMutations.removeRelation.mutate(relationId)
              }
            />

            {/* Real Upload rows filed against this issue; they also surface in
                the workspace Files hub. */}
            <FiledFilesSection
              workspaceId={workspaceId}
              workspaceSlug={workspaceSlug}
              currentUserId={currentUser?.id}
              target={{ type: 'ISSUE', id: card.id }}
              uploadLabel="Attach files to this issue"
              emptyDescription="Attach a file to keep it with this issue."
              onNavigateSource={(href) => navigate(href)}
            />

            <div className="pt-5 flex-1 border-t border-border/60">
              <CardActivity
                comments={comments.data ?? []}
                activities={detail?.activities ?? []}
                loading={comments.isLoading || taskDetail.isLoading}
                lookups={lookups}
                members={board.members}
                currentUserId={currentUser?.id}
                canComment={canCreate}
                canModerate={canDelete}
                savingComment={commentMutations.update.isPending}
                onEditComment={(commentId, content, onSaved) =>
                  commentMutations.update.mutate(
                    { commentId, content },
                    { onSuccess: onSaved },
                  )
                }
                onDeleteComment={(commentId) =>
                  commentMutations.remove.mutate(commentId)
                }
              />
            </div>

            <div className="bottom-0 -mx-1 px-1 pt-1 pb-4 sticky z-10 bg-card">
              <CardCommentComposer
                workspaceId={workspaceId}
                cardId={card.id}
                members={board.members}
                canComment={canCreate}
                sending={addComment.isPending}
                prefill={aiComment}
                onPrefillTaken={clearAiComment}
                onSend={(content, onSent) =>
                  addComment.mutate({ content }, { onSuccess: onSent })
                }
              />
            </div>
          </div>
        </div>

        {singleColumn ? null : (
          <aside
            aria-label="Task properties"
            className="w-88 px-5 py-5 shrink-0 overflow-y-auto border-l border-border/60 bg-surface-inset/30"
          >
            {properties}
          </aside>
        )}
      </div>

      <ShareToChatDialog
        target={
          isShareOpen
            ? {
                noun: 'task',
                title: `${identifier} · ${card.title}`,
                url: `${window.location.pathname}?card=${card.id}`,
              }
            : null
        }
        onOpenChange={setIsShareOpen}
      />
    </div>
  );
}

function patchAction(
  cardId: string,
  patch: Extract<BoardAction, { type: 'card/update' }>['patch'],
): BoardAction {
  return { type: 'card/update', cardId, patch };
}
