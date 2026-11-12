import { TaskStatus } from '@org/types';
import {
  ActionDropdownMenu,
  copyToClipboard,
  EntityContextMenu,
  entityUrl,
  type EntityAction,
} from '@org/ui';
import { cn } from '@org/utils';
import type { SaveForLaterTarget } from '@org/web-chat/bookmarks';
import {
  CalendarClock,
  CalendarX2,
  CircleDashed,
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
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  describeDue,
  DUE_TONE_CLASSES,
  parseDay,
  PRIORITY_META,
} from './card-meta.js';
import { useKanbanLabels } from './kanban-custom-store.js';
import {
  useKanbanDisplayStore,
  type CardProperties,
} from './kanban-display-store.js';
import { PriorityIcon } from './kanban-icons.js';
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
  const suffix =
    day === 1 || day === 21 || day === 31
      ? 'st'
      : day === 2 || day === 22
        ? 'nd'
        : day === 3 || day === 23
          ? 'rd'
          : 'th';
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const year = date.getFullYear();
  return `${month} ${day}${suffix}, ${year}`;
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

  const setAssignees = (memberIds: string[]) => {
    onAssigneeChange?.(memberIds[0] ?? null);
    onAssigneesChange?.(memberIds);
  };

  /*
   * The card's actions, shared by its "⋯" menu, right-click and the Menu key.
   * Everything routes through the board's own dispatch (optimistic, rolled
   * back by the query layer on failure), so the menu can't disagree with a
   * drag or the details dialog.
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
      icon: CircleDashed,
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
      // The column confirms before dispatching the delete.
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
      // A touch-hold on a card starts a drag; touch uses the ⋯ button instead.
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
          'group/card p-2.5 relative cursor-grab list-none rounded-lg border border-border/60 bg-card text-card-foreground',
          'shadow-xs transition-all duration-(--duration-fast)',
          'touch-manipulation select-none',
          'hover:border-border-strong hover:shadow-sm',
          'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:outline-none',
          'has-[:focus-visible]:border-ring has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/30',
        )}
      >
        {/* Every control here owns its own press, so none of them start a drag. */}
        <div
          data-no-drag
          className={cn(
            'right-1.5 top-1.5 gap-0.5 absolute z-10 flex items-center rounded-md bg-card',
            // Always there on touch, where there is no hover to reveal it.
            'sm:opacity-0 sm:group-hover/card:opacity-100 sm:group-focus-within/card:opacity-100 transition-opacity',
            'sm:group-has-[[data-state=open]]/card:opacity-100',
          )}
        >
          <KanbanStatusPicker
            status={currentStatus}
            onStatusChange={onMoveToList}
            align="end"
          />

          {/* The same actions as right-click */}
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

        {/*
        The server's id, `${project.ticketPrefix}-${task.ticketNumber}`, falling
        back to the task's own `identifier` for a task filed outside any project.
      */}
        {show.ticketId && ticket ? (
          <p className="mb-1 font-medium font-mono text-[10px] text-muted-foreground">
            {ticket}
          </p>
        ) : null}

        <button
          type="button"
          onClick={onOpen}
          className="font-medium leading-snug line-clamp-2 block w-full cursor-pointer text-left text-[13px] wrap-anywhere text-foreground transition-colors outline-none hover:text-primary"
        >
          {card.title}
        </button>

        {show.labels && card.labels.length > 0 ? (
          <div className="mt-2 gap-1 flex flex-wrap items-center">
            {card.labels.map((lbl) => {
              const color = colorOf(lbl);
              return (
                <span
                  key={lbl}
                  className="gap-1 px-1.5 font-medium inline-flex items-center rounded-md border py-px text-[10px]"
                  style={{
                    backgroundColor: `${color}15`,
                    borderColor: `${color}35`,
                    color,
                  }}
                >
                  <span
                    className="size-1 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span>{lbl}</span>
                </span>
              );
            })}
          </div>
        ) : null}

        {/* Facts on the left, the people on the right. */}
        <div className="mt-2.5 min-h-6 gap-2 flex items-center justify-between">
          <div className="min-w-0 gap-x-2 gap-y-1 flex flex-wrap items-center text-[11px] text-muted-foreground tabular-nums">
            {show.priority ? (
              <span data-no-drag className="flex">
                <KanbanPriorityPicker
                  priority={card.priority}
                  onPriorityChange={(priority) =>
                    onUpdate?.({ priority: priority as Priority })
                  }
                  align="start"
                  trigger={
                    <button
                      type="button"
                      aria-label={`Priority: ${PRIORITY_META[card.priority].label}`}
                      title={`${PRIORITY_META[card.priority].label} priority`}
                      className="size-5 rounded flex cursor-pointer items-center justify-center transition-colors hover:bg-muted"
                    >
                      <PriorityIcon
                        priority={card.priority}
                        className="size-3.5"
                      />
                    </button>
                  }
                />
              </span>
            ) : null}

            {show.dueDate && due ? (
              <span
                title={
                  card.startDate
                    ? `Starts ${formatCardDate(card.startDate)}. ${due.hint}`
                    : due.hint
                }
                className={cn(
                  'gap-1 rounded px-1.5 font-medium inline-flex items-center border py-px',
                  DUE_TONE_CLASSES[due.tone],
                )}
              >
                <CalendarClock className="size-3" />
                {due.label}
              </span>
            ) : null}

            {show.progress && card.checklist.length > 0 ? (
              <span
                title="Checklist"
                className="gap-1 inline-flex items-center"
              >
                <ListChecks className="size-3.5" />
                {checklistDone}/{card.checklist.length}
              </span>
            ) : null}

            {show.progress && card.subtasks ? (
              <span
                title="Sub-items"
                className="gap-1 inline-flex items-center"
              >
                <ListTree className="size-3.5" />
                {card.subtasks.done}/{card.subtasks.total}
              </span>
            ) : null}

            {show.comments && card.commentCount > 0 ? (
              <span
                title={`${card.commentCount} comment${card.commentCount === 1 ? '' : 's'}`}
                className="gap-1 inline-flex items-center"
              >
                <MessageSquare className="size-3.5" />
                {card.commentCount}
              </span>
            ) : null}
          </div>

          {show.assignee ? (
            <div data-no-drag className="shrink-0">
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
                align="end"
              />
            </div>
          ) : null}
        </div>
      </li>
    </EntityContextMenu>
  );
}
