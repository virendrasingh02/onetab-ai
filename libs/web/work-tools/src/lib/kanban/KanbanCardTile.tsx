import { TaskStatus } from '@org/types';
import {
  ActionDropdownMenu,
  copyToClipboard,
  EntityContextMenu,
  entityUrl,
  UserAvatar,
  UserAvatarGroup,
  type EntityAction,
} from '@org/ui';
import { cn } from '@org/utils';
import type { SaveForLaterTarget } from '@org/web-chat/bookmarks';
import {
  CalendarClock,
  CalendarDays,
  CalendarX2,
  CopyPlus,
  CornerUpRight,
  FileText,
  Flag,
  Link2,
  ListChecks,
  ListTree,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  RotateCw,
  Sparkles,
  Target,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import { useMemo } from 'react';
import {
  describeDue,
  parseDay,
  PRIORITY_META,
} from './card-meta.js';
import { useKanbanLabels } from './kanban-custom-store.js';
import {
  useKanbanDisplayStore,
  type CardProperties,
} from './kanban-display-store.js';
import { getStatusLabel, PriorityIcon, StatusIcon } from './kanban-icons.js';
import { KanbanLeadPicker } from './KanbanLeadPicker.js';
import { KanbanPriorityPicker } from './KanbanPriorityPicker.js';
import { KanbanStatusPicker } from './KanbanStatusPicker.js';
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

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'URGENT', label: 'Urgent' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
];

/** Semantic priority styles adhering to DESIGN.md §6.2 / theme.css */
const PRIORITY_STYLES: Record<Priority, string> = {
  URGENT:
    'border-destructive/25 bg-destructive/10 text-destructive-text hover:bg-destructive/15 font-medium',
  HIGH: 'border-warning/30 bg-warning/12 text-warning-text hover:bg-warning/20 font-medium',
  MEDIUM:
    'border-border bg-surface-raised text-foreground hover:bg-muted font-medium',
  LOW: 'border-border bg-surface-raised/60 text-muted-foreground hover:bg-muted font-normal',
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

/** Local calendar day, `yyyy-mm-dd` — the board's due-date format. */
function dayString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dueDatePresets(): { id: string; label: string; day: string }[] {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + ((8 - today.getDay()) % 7 || 7));
  const inTwoWeeks = new Date(today);
  inTwoWeeks.setDate(today.getDate() + 14);
  return [
    { id: 'today', label: 'Today', day: dayString(today) },
    { id: 'tomorrow', label: 'Tomorrow', day: dayString(tomorrow) },
    { id: 'next-week', label: 'Next week', day: dayString(nextMonday) },
    { id: 'two-weeks', label: 'In two weeks', day: dayString(inTwoWeeks) },
  ];
}

function formatCardDate(dateStr?: string): string | null {
  if (!dateStr) return null;
  const date = parseDay(dateStr);
  const day = date.getDate();
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const year = date.getFullYear();
  return `${month} ${day}, ${year}`;
}

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

  /*
   * The card's actions, shared by its "⋯" menu, right-click and the Menu key.
   */
  const buildActions = (): EntityAction[] => [
    {
      id: 'open',
      group: 'open',
      label: 'Open task',
      icon: Pencil,
      shortcut: 'O',
      run: onOpen,
    },
    {
      id: 'assign-me',
      group: 'assign',
      label: 'Assign to me',
      icon: UserCheck,
      shortcut: 'I',
      hidden: !currentUserId || !onAssigneesChange,
      disabled: currentUserId ? card.memberIds.includes(currentUserId) : true,
      disabledReason: 'Already assigned to you',
      run: () =>
        currentUserId &&
        setAssignees([...new Set([currentUserId, ...card.memberIds])]),
    },
    {
      id: 'assign',
      group: 'assign',
      label: 'Assignees',
      icon: Users,
      hidden: !onAssigneesChange || members.length === 0,
      children: members.map((member): EntityAction => ({
        id: `assign-${member.id}`,
        label: member.displayName ?? member.name,
        checked: card.memberIds.includes(member.id),
        run: () =>
          setAssignees(
            card.memberIds.includes(member.id)
              ? card.memberIds.filter((id) => id !== member.id)
              : [...card.memberIds, member.id],
          ),
      })),
    },
    {
      id: 'status',
      group: 'fields',
      label: 'Status',
      icon: StatusIcon
        ? () => <StatusIcon status={currentStatus} className="size-4" />
        : Pencil,
      children: lists.map((list): EntityAction => ({
        id: `status-${list.id}`,
        label: list.title,
        checked: list.id === listId,
        disabled: list.id === listId,
        run: () => onMoveToList(list.id),
      })),
    },
    {
      id: 'priority',
      group: 'fields',
      label: 'Priority',
      icon: Flag,
      hidden: !onUpdate,
      children: PRIORITIES.map((p): EntityAction => ({
        id: `priority-${p.value}`,
        label: p.label,
        checked: card.priority === p.value,
        run: () => onUpdate?.({ priority: p.value }),
      })),
    },
    {
      id: 'due',
      group: 'fields',
      label: 'Due date',
      icon: CalendarClock,
      hidden: !onUpdate,
      children: [
        ...dueDatePresets().map((preset): EntityAction => ({
          id: `due-${preset.id}`,
          label: preset.label,
          hint: formatCardDate(preset.day)?.replace(/, \d{4}$/, ''),
          checked: card.dueDate === preset.day,
          run: () => onUpdate?.({ dueDate: preset.day }),
        })),
        {
          id: 'due-clear',
          group: 'clear',
          label: 'Remove due date',
          icon: CalendarX2,
          hidden: !card.dueDate,
          run: () => onUpdate?.({ dueDate: null }),
        },
      ],
    },
    {
      id: 'move',
      group: 'fields',
      label: 'Move to column',
      icon: CornerUpRight,
      children: lists
        .filter((list) => list.id !== listId)
        .map((list): EntityAction => ({
          id: `move-${list.id}`,
          label: list.title,
          run: () => onMoveToList(list.id),
        })),
    },
    {
      id: 'duplicate',
      group: 'more',
      label: 'Duplicate task',
      icon: CopyPlus,
      shortcut: 'D',
      run: onCopy,
    },
    ...(saveAction
      ? [
          saveAction(
            {
              type: 'task',
              id: card.id,
              title: card.ticketId
                ? `${card.ticketId} ${card.title}`
                : card.title,
              snippet: card.description,
              href: `${window.location.pathname}?card=${card.id}`,
            },
            'more',
          ),
        ]
      : []),
    {
      id: 'copy-link',
      group: 'more',
      label: 'Copy task link',
      icon: Link2,
      shortcut: 'L',
      run: () =>
        copyToClipboard(
          entityUrl(`${window.location.pathname}?card=${card.id}`),
        ),
    },
    {
      id: 'convert-doc',
      group: 'more',
      label: 'Convert to document',
      icon: FileText,
      hidden: !onConvertToDoc,
      run: onConvertToDoc,
    },
    {
      id: 'delete',
      group: 'danger',
      label: 'Delete task…',
      icon: Trash2,
      shortcut: 'Del',
      destructive: true,
      hidden: !canDelete,
      run: onDelete,
    },
  ];

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
        onKeyDown={drag.onKeyDown}
        className={cn(
          'group/card p-3 relative cursor-grab list-none rounded-lg border border-border bg-card text-card-foreground',
          'shadow-xs transition-all duration-(--duration-fast)',
          'touch-manipulation select-none',
          'hover:border-border-strong hover:shadow-sm hover:-translate-y-0.5',
          'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:outline-none',
          'has-[:focus-visible]:border-ring has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/30',
        )}
      >
        {/* Top line: status/type indicator + ticket key, quick actions on hover */}
        <div className="flex items-center justify-between gap-1.5 min-w-0 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0 pr-2">
            <span className="shrink-0 flex items-center">
              <StatusIcon
                status={currentStatus}
                showTooltip={false}
                className="size-3.5"
              />
            </span>
            {(show.ticketId ?? true) && ticket ? (
              <span className="font-mono text-xs font-medium text-muted-foreground tracking-tight select-all hover:text-foreground transition-colors">
                {ticket}
              </span>
            ) : null}
          </div>

          <div
            data-no-drag
            className={cn(
              'gap-0.5 flex items-center shrink-0 rounded-md',
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

        {/* Card Title */}
        <button
          type="button"
          onClick={onOpen}
          className="font-medium leading-snug line-clamp-2 block w-full cursor-pointer text-left text-sm wrap-anywhere text-foreground transition-colors outline-none hover:text-primary mb-2"
        >
          {card.title}
        </button>

        {/* Metadata Badges / Pills: unified design system badge bar */}
        <div className="gap-1.5 flex flex-wrap items-center">
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
                      'border-border bg-surface-raised hover:bg-muted text-foreground cursor-pointer',
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
                    <span>{PRIORITY_META[card.priority]?.label ?? card.priority}</span>
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

          {/* Assignee Avatar Pill / Group */}
          {(show.assignee ?? true) && (
            <div data-no-drag className="shrink-0 flex items-center">
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
                      className="p-0.5 flex cursor-pointer items-center justify-center rounded-full hover:ring-2 hover:ring-primary/40 transition-all"
                      aria-label="Change assignee"
                    >
                      <UserAvatarGroup users={assignedMembers} size="xs" />
                    </button>
                  ) : assignedMembers.length === 1 ? (
                    <button
                      type="button"
                      className="p-0.5 flex cursor-pointer items-center justify-center rounded-full hover:ring-2 hover:ring-primary/40 transition-all"
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
                      className={cn(
                        PILL_BASE,
                        'border-dashed border-border bg-surface-raised/40 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer',
                      )}
                      aria-label="Assign someone"
                    >
                      <Users className="size-3 shrink-0 text-muted-foreground" />
                      <span className="text-[10px]">Assign</span>
                    </button>
                  )
                }
              />
            </div>
          )}

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

          {/* Cycle / Sprint Pill */}
          {card.cycle ? (
            <span
              className={cn(
                PILL_BASE,
                'border-brand/25 bg-brand/10 text-brand-text font-medium',
              )}
              title={`Cycle: ${card.cycle}`}
            >
              <RotateCw className="size-3 shrink-0 text-brand-text" />
              <span>{card.cycle}</span>
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
              <span className="font-mono font-bold text-[11px] leading-none text-muted-foreground">
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
                      className="size-1.5 rounded-full shrink-0"
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
      </li>
    </EntityContextMenu>
  );
}
