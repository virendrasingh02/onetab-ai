import { TaskStatus } from '@org/types';
import {
  ActionDropdownMenu,
  copyToClipboard,
  EntityContextMenu,
  entityUrl,
  type EntityAction,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  CalendarClock,
  CalendarPlus,
  CalendarX2,
  CircleDashed,
  CopyPlus,
  CornerUpRight,
  FileText,
  Flag,
  Link2,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import { parseDay } from './card-meta.js';
import { useKanbanCustomStore } from './kanban-custom-store.js';
import { CubeProjectIcon } from './kanban-icons.js';
import { KanbanLeadPicker } from './KanbanLeadPicker.js';
import { KanbanStatusPicker } from './KanbanStatusPicker.js';
import type { CardPatch } from './server-board.js';
import type { BoardMember, KanbanCard, KanbanList, Priority } from './types.js';
import type { DragHandlers } from './use-board-drag.js';

export interface KanbanCardTileProps {
  card: KanbanCard;
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
  onMoveToList: (toListId: TaskStatus) => void;
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
  nextMonday.setDate(today.getDate() + (((8 - today.getDay()) % 7) || 7));
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

function formatMonthYear(dateStr?: string): string | null {
  if (!dateStr) return null;
  const date = parseDay(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
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
  onMoveToList,
  onAssigneeChange,
  onAssigneesChange,
  onUpdate,
  currentUserId,
  onConvertToDoc,
}: KanbanCardTileProps) {
  const customStore = useKanbanCustomStore();
  const cardCustomProps = customStore.getCardProperties(card.id);
  const storeLabels = customStore.labels;

  const formattedDate = formatCardDate(card.dueDate);
  const currentStatus = (listId as TaskStatus) || TaskStatus.TODO;
  const currentLeadId = cardCustomProps.leadId ?? card.memberIds[0];
  const currentLabels = cardCustomProps.labels ?? [];
  const currentStartDate = cardCustomProps.startDate;
  const cardName = `“${card.title}”`;

  const setAssignees = (memberIds: string[]) => {
    customStore.setCardProperties(card.id, { leadId: memberIds[0] || undefined });
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
    { id: 'open', group: 'open', label: 'Open task', icon: Pencil, shortcut: 'O', run: onOpen },
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
        currentUserId && setAssignees([...new Set([currentUserId, ...card.memberIds])]),
    },
    {
      id: 'assign',
      group: 'assign',
      label: 'Assignees',
      icon: Users,
      hidden: !onAssigneesChange || members.length === 0,
      children: members.map(
        (member): EntityAction => ({
          id: `assign-${member.id}`,
          label: member.displayName ?? member.name,
          checked: card.memberIds.includes(member.id),
          run: () =>
            setAssignees(
              card.memberIds.includes(member.id)
                ? card.memberIds.filter((id) => id !== member.id)
                : [...card.memberIds, member.id],
            ),
        }),
      ),
    },
    {
      id: 'status',
      group: 'fields',
      label: 'Status',
      icon: CircleDashed,
      children: lists.map(
        (list): EntityAction => ({
          id: `status-${list.id}`,
          label: list.title,
          checked: list.id === listId,
          disabled: list.id === listId,
          run: () => onMoveToList(list.id as TaskStatus),
        }),
      ),
    },
    {
      id: 'priority',
      group: 'fields',
      label: 'Priority',
      icon: Flag,
      hidden: !onUpdate,
      children: PRIORITIES.map(
        (p): EntityAction => ({
          id: `priority-${p.value}`,
          label: p.label,
          checked: card.priority === p.value,
          run: () => onUpdate?.({ priority: p.value }),
        }),
      ),
    },
    {
      id: 'due',
      group: 'fields',
      label: 'Due date',
      icon: CalendarClock,
      hidden: !onUpdate,
      children: [
        ...dueDatePresets().map(
          (preset): EntityAction => ({
            id: `due-${preset.id}`,
            label: preset.label,
            hint: formatCardDate(preset.day)?.replace(/, \d{4}$/, ''),
            checked: card.dueDate === preset.day,
            run: () => onUpdate?.({ dueDate: preset.day }),
          }),
        ),
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
        .map(
          (list): EntityAction => ({
            id: `move-${list.id}`,
            label: list.title,
            run: () => onMoveToList(list.id as TaskStatus),
          }),
        ),
    },
    {
      id: 'duplicate',
      group: 'more',
      label: 'Duplicate task',
      icon: CopyPlus,
      shortcut: 'D',
      run: onCopy,
    },
    {
      id: 'copy-link',
      group: 'more',
      label: 'Copy task link',
      icon: Link2,
      shortcut: 'L',
      run: () =>
        copyToClipboard(entityUrl(`${window.location.pathname}?card=${card.id}`)),
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
        'group/card p-3 relative cursor-grab list-none rounded-xl border border-border/60 bg-card text-card-foreground',
        'shadow-xs transition-all duration-(--duration-fast)',
        'touch-manipulation select-none',
        'hover:border-border-strong hover:shadow-md hover:bg-surface-raised',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:outline-none',
        'has-[:focus-visible]:border-ring has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/30',
      )}
    >
      {/* Top Row: [Orange Cube] [Title]  ... [StatusIcon] [More] [Avatar] */}
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <CubeProjectIcon className="size-4 shrink-0" />
          <button
            type="button"
            onClick={onOpen}
            className="text-xs font-semibold leading-snug text-left text-foreground truncate hover:text-primary transition-colors cursor-pointer outline-none"
          >
            {card.title}
          </button>
        </div>

        {/* Every control here owns its own press, so none of them start a drag. */}
        <div data-no-drag className="flex items-center gap-1 shrink-0">
          {/* Status picker trigger */}
          <KanbanStatusPicker
            status={currentStatus}
            onStatusChange={onMoveToList}
            align="end"
          />

          {/* 3-dots more menu — the same actions as right-click */}
          <ActionDropdownMenu
            actions={buildActions}
            scope={`task:${card.id}`}
            entityType="task"
            entity={card}
            trigger={
              <button
                type="button"
                className="flex items-center justify-center size-6 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label={`Actions for ${cardName}`}
              >
                <MoreHorizontal className="size-3.5" />
              </button>
            }
          />

          {/* Assignee lead picker */}
          <KanbanLeadPicker
            selectedMemberIds={card.memberIds}
            currentMemberId={currentLeadId}
            members={members}
            multiple={true}
            onSelectMembers={setAssignees}
            onSelectMember={(memberId) => {
              customStore.setCardProperties(card.id, {
                leadId: memberId || undefined,
              });
              onAssigneeChange?.(memberId);
              onAssigneesChange?.(memberId ? [memberId] : []);
            }}
            align="end"
          />
        </div>
      </div>

      {/* Row 2: Dates (Start -> Target, or Single Target Date) */}
      {(currentStartDate || formattedDate) && (
        <div className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          {currentStartDate ? (
            <div className="flex items-center gap-1 text-[11px] font-medium text-foreground/80">
              <CalendarPlus className="size-3.5 text-muted-foreground shrink-0" />
              <span>{formatMonthYear(currentStartDate) || 'Start'}</span>
              <span className="text-muted-foreground text-[10px]">→</span>
              <CalendarX2 className="size-3.5 text-accent-rose shrink-0" />
              <span className="text-accent-rose font-medium">
                {formattedDate || 'Target'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-foreground/80">
              <CalendarX2 className="size-3.5 text-accent-rose shrink-0" />
              <span>{formattedDate}</span>
            </div>
          )}
        </div>
      )}

      {/* Labels row if any */}
      {currentLabels.length > 0 && (
        <div className="mt-2 flex items-center gap-1 flex-wrap">
          {currentLabels.map((lbl) => {
            const meta = storeLabels.find((l) => l.name === lbl);
            return (
              <span
                key={lbl}
                className="inline-flex items-center gap-1 px-1.5 py-0.2 text-[10px] font-medium rounded-md border"
                style={{
                  backgroundColor: meta ? `${meta.color}15` : '#8b5cf615',
                  borderColor: meta ? `${meta.color}35` : '#8b5cf635',
                  color: meta?.color || '#8b5cf6',
                }}
              >
                <span
                  className="size-1 rounded-full"
                  style={{ backgroundColor: meta?.color || '#8b5cf6' }}
                />
                <span>{lbl}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* Row 3: Ticket ID & Issues count */}
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground/75 font-medium">
        <span>{card.commentCount} issues</span>
        {/*
          The server's id, `${project.ticketPrefix}-${task.ticketNumber}`. The
          local store's copy is only a fallback for a task filed outside any
          project, which has no prefix to pair a number with.
        */}
        {card.ticketId ?? cardCustomProps.ticketId ? (
          <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-muted/70 text-muted-foreground font-semibold">
            {card.ticketId ?? cardCustomProps.ticketId}
          </span>
        ) : null}
      </div>
    </li>
    </EntityContextMenu>
  );
}
