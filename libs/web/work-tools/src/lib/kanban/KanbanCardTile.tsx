import { TaskStatus } from '@org/types';
import {
  ActionDropdownMenu,
  EntityContextMenu,
  UserAvatar,
  UserAvatarGroup,
  type EntityAction,
} from '@org/ui';
import { cn } from '@org/utils';
import type { SaveForLaterTarget } from '@org/web-chat/bookmarks';
import {
  CalendarClock,
  CalendarDays,
  Link2,
  ListChecks,
  ListTree,
  MessageSquare,
  MoreHorizontal,
  Sparkles,
  Target,
} from 'lucide-react';
import { useMemo } from 'react';
import { describeDue, PRIORITY_META } from './card-meta.js';
import { useKanbanLabels } from './kanban-custom-store.js';
import {
  useKanbanDisplayStore,
  type CardProperties,
} from './kanban-display-store.js';
import {
  getStatusLabel,
  PriorityIcon,
  StatusIcon,
  UnassignedLeadIcon,
} from './kanban-icons.js';
import { KanbanLeadPicker } from './KanbanLeadPicker.js';
import { KanbanPriorityPicker } from './KanbanPriorityPicker.js';
import { KanbanStatusPicker } from './KanbanStatusPicker.js';
import { buildTaskActions, formatCardDate } from './task-actions.js';
import type { CardPatch } from './server-board.js';
import type { BoardMember, KanbanCard, KanbanList, Priority } from './types.js';
import type { DragHandlers } from './use-board-drag.js';

export interface KanbanCardTileProps {
  card: KanbanCard;
  /** The "Save for later" menu entry (the column owns the bookmarks query). */
  saveAction?: (target: SaveForLaterTarget, group?: string) => EntityAction;
  members: BoardMember[];
  lists: Array<Pick<KanbanList, 'id' | 'title'>>;
  listId: TaskStatus | string;
  /**
   * True once this card has been picked up. The tile leaves the layout — the
   * ghost under the pointer is standing in for it — and the gap it opens is
   * held by the column's placeholder instead.
   */
  dragging: boolean;
  /** Press and key handlers from the board's drag engine. */
  drag: DragHandlers;
  onOpen: () => void;
  onCopy: () => void;
  onDelete: () => void;
  /** False hides "Delete task": the API would refuse it. */
  canDelete?: boolean;
  onMoveToList: (toListId: string) => void;
  onAssigneeChange?: (memberId: string | null) => void;
  onAssigneesChange?: (memberIds: string[]) => void;
  /** Field edits (priority, due date, assignees) from the card's action menu. */
  onUpdate?: (patch: CardPatch) => void;
  /** The signed-in user, for "Assign to me". */
  currentUserId?: string;
  /** Creates a document from the task and resolves once it exists. */
  onConvertToDoc?: () => Promise<unknown>;
}

/**
 * Priority pills stay neutral — the coloured icon carries the priority, the
 * same icon every other view shows. Only Urgent is tinted, so it stands out.
 */
const PRIORITY_STYLES: Record<Priority, string> = {
  URGENT:
    'border-destructive/25 bg-destructive/10 text-destructive-text hover:bg-destructive/15',
  HIGH: 'border-border bg-surface-raised text-foreground hover:bg-muted',
  MEDIUM: 'border-border bg-surface-raised text-foreground hover:bg-muted',
  LOW: 'border-border bg-surface-raised text-muted-foreground hover:bg-muted',
};

/** Semantic due date tone styles adhering to DESIGN.md §6.2 */
const DUE_TONE_STYLES: Record<string, string> = {
  complete: 'border-success/25 bg-success/10 text-success-text',
  overdue:
    'border-destructive/25 bg-destructive/10 text-destructive-text font-medium',
  today: 'border-warning/30 bg-warning/12 text-warning-text font-medium',
  soon: 'border-warning/30 bg-warning/12 text-warning-text',
  later: 'border-border bg-surface-raised text-muted-foreground',
};

/**
 * Base badge pill adhering to DESIGN.md §3 (rounded-sm for tags/chips)
 * and §6.2 (soft appearance, text-[11px], theme-fixed).
 */
const PILL_BASE =
  'theme-fixed h-5.5 px-1.5 py-0.5 inline-flex items-center gap-1 rounded-sm border text-[11px] font-medium tracking-tight whitespace-nowrap transition-colors select-none [&_svg]:pointer-events-none';

export function KanbanCardTile({
  card,
  members,
  lists,
  listId,
  dragging,
  drag,
  onOpen,
  onCopy,
  onDelete,
  canDelete = true,
  onMoveToList,
  onAssigneeChange,
  onAssigneesChange,
  onUpdate,
  currentUserId,
  onConvertToDoc,
  saveAction,
}: KanbanCardTileProps) {
  const { colorOf } = useKanbanLabels();
  const show: CardProperties = useKanbanDisplayStore((state) => state.card);

  const due = describeDue(card);
  const checklistDone = card.checklist.filter((item) => item.done).length;
  const ticket = card.ticketId ?? card.identifier;
  const currentStatus: string = listId || TaskStatus.TODO;
  // The lead is the primary assignee — `assigneeIds[0]` on the task.
  const currentLeadId = card.memberIds[0];
  const cardName = `“${card.title}”`;

  const assignedMembers = useMemo(() => {
    const memberMap = new Map(members.map((m) => [m.id, m]));
    return card.memberIds
      .map((id) => memberMap.get(id))
      .filter((m): m is BoardMember => Boolean(m));
  }, [members, card.memberIds]);

  const setAssignees = (memberIds: string[]) => {
    onAssigneeChange?.(memberIds[0] ?? null);
    onAssigneesChange?.(memberIds);
  };

  /* The card's actions, shared by its "⋯" menu, right-click and the Menu key. */
  const buildActions = (): EntityAction[] =>
    buildTaskActions({
      card,
      members,
      lists,
      listId: currentStatus,
      onOpen,
      onCopy,
      onDelete,
      canDelete,
      onMoveToList,
      onAssigneesChange: onAssigneesChange ? setAssignees : undefined,
      onUpdate,
      currentUserId,
      onConvertToDoc,
      saveAction,
    });

  return (
    <EntityContextMenu
      actions={buildActions}
      scope={`task:${card.id}`}
      entityType="task"
      entity={card}
      label={cardName}
      longPress={false}
      disabled={dragging}
    >
      <li
        data-kanban-card={card.id}
        hidden={dragging}
        tabIndex={0}
        aria-roledescription="Draggable card"
        aria-describedby="kanban-drag-help"
        aria-keyshortcuts="Space"
        onPointerDown={drag.onPointerDown}
        onKeyDown={(event) => {
          // Enter opens the card; Space still picks it up to move it.
          if (event.key === 'Enter' && event.target === event.currentTarget) {
            event.preventDefault();
            onOpen();
            return;
          }
          drag.onKeyDown(event);
        }}
        onClick={(event) => {
          // The whole card opens it — except its own controls (pickers, the
          // ⋯ menu) and anything portalled out of it, whose clicks still
          // bubble here through React. A click that ended a drag never
          // arrives: the drag engine swallows it.
          const target = event.target as HTMLElement;
          if (!event.currentTarget.contains(target)) return;
          if (target.closest('[data-no-drag], button, a, input, textarea'))
            return;
          onOpen();
        }}
        className={cn(
          'group/card p-3 relative cursor-pointer list-none rounded-lg border border-border bg-card text-card-foreground active:cursor-grabbing',
          'shadow-xs transition-[border-color,box-shadow] duration-(--duration-fast)',
          'touch-manipulation select-none',
          'hover:border-border-strong hover:shadow-sm',
          'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:outline-none',
          'has-[:focus-visible]:border-ring has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/30',
        )}
      >
        {/* Top line: status/type indicator + ticket key, quick actions on hover */}
        <div className="gap-1.5 min-w-0 mb-1.5 flex items-center justify-between">
          <div className="gap-1.5 min-w-0 pr-2 flex items-center">
            <span className="flex shrink-0 items-center">
              <StatusIcon
                status={currentStatus}
                showTooltip={false}
                className="size-3.5"
              />
            </span>
            {(show.ticketId ?? true) && ticket ? (
              <span className="text-xs font-medium tracking-tight font-mono text-muted-foreground transition-colors select-all hover:text-foreground">
                {ticket}
              </span>
            ) : null}
          </div>

          <div
            data-no-drag
            className={cn(
              'gap-0.5 flex shrink-0 items-center rounded-md',
              'sm:opacity-0 sm:group-hover/card:opacity-100 sm:group-focus-within/card:opacity-100 transition-opacity',
              'sm:group-has-[[data-state=open]]/card:opacity-100',
            )}
          >
            <ActionDropdownMenu
              actions={buildActions}
              scope={`task:${card.id}`}
              entityType="task"
              entity={card}
              trigger={
                <button
                  type="button"
                  className="size-6 flex cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={`Actions for ${cardName}`}
                >
                  <MoreHorizontal className="size-3.5" />
                </button>
              }
            />
          </div>
        </div>

        {/* Card title — the whole card is the click target. */}
        <p className="font-medium leading-snug text-sm mb-2.5 line-clamp-2 wrap-anywhere text-foreground">
          {card.title}
        </p>

        {/* Footer: properties on the left, who owns it on the right. */}
        <div className="gap-2 flex items-end justify-between">
          <div className="gap-1.5 min-w-0 flex flex-1 flex-wrap items-center">
            {/* Status Pill (interactive status changer) */}
            {(show.status ?? true) && (
              <div data-no-drag className="shrink-0">
                <KanbanStatusPicker
                  status={currentStatus}
                  onStatusChange={onMoveToList}
                  align="start"
                  trigger={
                    <button
                      type="button"
                      className={cn(
                        PILL_BASE,
                        'cursor-pointer border-border bg-surface-raised text-foreground hover:bg-muted',
                      )}
                      aria-label={`Status: ${getStatusLabel(currentStatus)}`}
                    >
                      <StatusIcon
                        status={currentStatus}
                        showTooltip={false}
                        className="size-3 shrink-0"
                      />
                      <span>{getStatusLabel(currentStatus)}</span>
                    </button>
                  }
                />
              </div>
            )}

            {/* Priority Pill (interactive priority changer) */}
            {(show.priority ?? true) && (
              <div data-no-drag className="shrink-0">
                <KanbanPriorityPicker
                  priority={card.priority}
                  onPriorityChange={(priority) =>
                    onUpdate?.({ priority: priority as Priority })
                  }
                  align="start"
                  trigger={
                    <button
                      type="button"
                      className={cn(
                        PILL_BASE,
                        PRIORITY_STYLES[card.priority] ??
                          'border-border bg-surface-raised text-foreground hover:bg-muted',
                        'cursor-pointer',
                      )}
                      aria-label={`Priority: ${PRIORITY_META[card.priority]?.label ?? card.priority}`}
                    >
                      <PriorityIcon
                        priority={card.priority}
                        className="size-3 shrink-0"
                      />
                      <span>
                        {PRIORITY_META[card.priority]?.label ?? card.priority}
                      </span>
                    </button>
                  }
                />
              </div>
            )}

            {/* Start Date Pill */}
            {card.startDate ? (
              <span
                className={cn(
                  PILL_BASE,
                  'border-border bg-surface-raised text-muted-foreground',
                )}
                title={`Starts ${formatCardDate(card.startDate)}`}
              >
                <CalendarDays className="size-3 shrink-0 text-muted-foreground" />
                <span>
                  {formatCardDate(card.startDate)?.replace(/, \d{4}$/, '') ??
                    'Start date'}
                </span>
              </span>
            ) : null}

            {/* Due Date Pill */}
            {(show.dueDate ?? true) && due ? (
              <span
                className={cn(
                  PILL_BASE,
                  DUE_TONE_STYLES[due.tone] ??
                    'border-border bg-surface-raised text-foreground',
                )}
                title={
                  card.startDate
                    ? `Starts ${formatCardDate(card.startDate)}. ${due.hint}`
                    : due.hint
                }
              >
                <CalendarClock className="size-3 shrink-0" />
                <span>{due.label}</span>
              </span>
            ) : null}

            {/* Milestone Pill */}
            {card.milestone ? (
              <span
                className={cn(
                  PILL_BASE,
                  'border-border bg-surface-raised text-foreground',
                )}
                title={`Milestone: ${card.milestone}`}
              >
                <Target className="size-3 shrink-0 text-muted-foreground" />
                <span>{card.milestone}</span>
              </span>
            ) : null}

            {/* Estimate Points Pill */}
            {(show.estimate ?? true) &&
            card.estimate !== null &&
            card.estimate !== undefined ? (
              <span
                className={cn(
                  PILL_BASE,
                  'border-border bg-surface-raised text-foreground',
                )}
                title={`Estimate: ${card.estimate} points`}
              >
                <span className="font-bold font-mono text-[11px] leading-none text-muted-foreground">
                  Δ
                </span>
                <span>{card.estimate}</span>
              </span>
            ) : null}

            {/* Checklist Pill */}
            {(show.progress ?? true) && card.checklist.length > 0 ? (
              <span
                className={cn(
                  PILL_BASE,
                  'border-border bg-surface-raised text-muted-foreground',
                )}
                title="Checklist"
              >
                <ListChecks className="size-3 shrink-0" />
                <span>
                  {checklistDone}/{card.checklist.length}
                </span>
              </span>
            ) : null}

            {/* Subtasks Pill */}
            {(show.progress ?? true) && card.subtasks ? (
              <span
                className={cn(
                  PILL_BASE,
                  'border-border bg-surface-raised text-muted-foreground',
                )}
                title="Sub-items"
              >
                <ListTree className="size-3 shrink-0" />
                <span>
                  {card.subtasks.done}/{card.subtasks.total}
                </span>
              </span>
            ) : null}

            {/* Relation Links Pill */}
            {card.relationCount && card.relationCount > 0 ? (
              <span
                className={cn(
                  PILL_BASE,
                  'border-border bg-surface-raised text-muted-foreground',
                )}
                title={`${card.relationCount} linked relation${card.relationCount === 1 ? '' : 's'}`}
              >
                <Link2 className="size-3 shrink-0" />
                <span>{card.relationCount}</span>
              </span>
            ) : null}

            {/* Labels Pills */}
            {(show.labels ?? true) && card.labels.length > 0
              ? card.labels.map((lbl) => {
                  const color = colorOf(lbl);
                  return (
                    <span
                      key={lbl}
                      className={cn(PILL_BASE)}
                      style={{
                        backgroundColor: `${color}15`,
                        borderColor: `${color}35`,
                        color,
                      }}
                    >
                      <span
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span>{lbl}</span>
                    </span>
                  );
                })
              : null}

            {/* Comments Pill */}
            {(show.comments ?? true) && card.commentCount > 0 ? (
              <span
                className={cn(
                  PILL_BASE,
                  'border-border bg-surface-raised text-muted-foreground',
                )}
                title={`${card.commentCount} comment${card.commentCount === 1 ? '' : 's'}`}
              >
                <MessageSquare className="size-3 shrink-0" />
                <span>{card.commentCount}</span>
              </span>
            ) : null}

            {/* AI Created Indicator */}
            {card.createdByAgent ? (
              <span
                className={cn(
                  PILL_BASE,
                  'border-info/25 bg-info/10 text-info-text',
                )}
                title={`Created by AI agent: ${card.createdByAgent.name}`}
              >
                <Sparkles className="size-3 shrink-0 text-info-text" />
                <span>{card.createdByAgent.name}</span>
              </span>
            ) : null}
          </div>

          {/* Assignee Avatar Pill / Group */}
          {(show.assignee ?? true) && (
            <div data-no-drag className="flex shrink-0 items-center">
              <KanbanLeadPicker
                selectedMemberIds={card.memberIds}
                currentMemberId={currentLeadId}
                members={members}
                multiple={true}
                onSelectMembers={setAssignees}
                onSelectMember={(memberId) => {
                  onAssigneeChange?.(memberId);
                  onAssigneesChange?.(memberId ? [memberId] : []);
                }}
                align="start"
                trigger={
                  assignedMembers.length > 1 ? (
                    <button
                      type="button"
                      className="p-0.5 flex cursor-pointer items-center justify-center rounded-full transition-all hover:ring-2 hover:ring-primary/40"
                      aria-label="Change assignee"
                    >
                      <UserAvatarGroup users={assignedMembers} size="xs" />
                    </button>
                  ) : assignedMembers.length === 1 ? (
                    <button
                      type="button"
                      className="p-0.5 flex cursor-pointer items-center justify-center rounded-full transition-all hover:ring-2 hover:ring-primary/40"
                      aria-label="Change assignee"
                    >
                      <UserAvatar
                        name={
                          assignedMembers[0].displayName ??
                          assignedMembers[0].name
                        }
                        seed={assignedMembers[0].id}
                        src={assignedMembers[0].avatarUrl}
                        presence={assignedMembers[0].presence}
                        statusEmoji={assignedMembers[0].statusEmoji}
                        statusText={assignedMembers[0].statusText}
                        size="xs"
                        className="size-5 font-bold text-[9px] ring-1 ring-border"
                      />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="size-6 flex cursor-pointer items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="Assign someone"
                      title="Assign"
                    >
                      <UnassignedLeadIcon className="size-4.5" />
                    </button>
                  )
                }
              />
            </div>
          )}
        </div>
      </li>
    </EntityContextMenu>
  );
}
