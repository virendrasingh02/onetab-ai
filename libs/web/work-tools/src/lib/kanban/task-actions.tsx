import { WorkspacePermission } from '@org/types';
import {
  confirm,
  copyToClipboard,
  entityUrl,
  type EntityAction,
} from '@org/ui';
import { useCurrentUser } from '@org/auth';
import {
  useSaveForLater,
  type SaveForLaterTarget,
} from '@org/web-chat/bookmarks';
import { useWorkspacePermission } from '@org/web-workspace';
import {
  CalendarClock,
  CalendarX2,
  CopyPlus,
  CornerUpRight,
  FileText,
  Flag,
  Link2,
  Pencil,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { parseDay } from './card-meta.js';
import { StatusIcon } from './kanban-icons.js';
import type { BoardAction, CardPatch } from './server-board.js';
import type { BoardMember, KanbanCard, KanbanList, Priority } from './types.js';
import { useConvertTaskToDocument } from '../use-work-tools.js';

/**
 * One task's actions — open, assign, status, priority, due date, move,
 * duplicate, save, copy link, convert to doc, delete — shared by the board
 * card, the list row and the timeline row, through their "⋯" menu, right-click
 * and the Menu key. A task offers the same things whichever view it is in.
 */

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

/** `Aug 6, 2026` for a `yyyy-mm-dd` day. */
export function formatCardDate(dateStr?: string): string | null {
  if (!dateStr) return null;
  const date = parseDay(dateStr);
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  return `${month} ${date.getDate()}, ${date.getFullYear()}`;
}

export interface TaskActionsInput {
  card: KanbanCard;
  members: BoardMember[];
  lists: Array<Pick<KanbanList, 'id' | 'title'>>;
  /** The status (column) the task sits in. */
  listId: string;
  onOpen: () => void;
  onCopy: () => void;
  onDelete: () => void;
  canDelete?: boolean;
  onMoveToList: (toListId: string) => void;
  onAssigneesChange?: (memberIds: string[]) => void;
  onUpdate?: (patch: CardPatch) => void;
  currentUserId?: string;
  onConvertToDoc?: () => unknown;
  saveAction?: (target: SaveForLaterTarget, group?: string) => EntityAction;
}

export function buildTaskActions({
  card,
  members,
  lists,
  listId,
  onOpen,
  onCopy,
  onDelete,
  canDelete = true,
  onMoveToList,
  onAssigneesChange,
  onUpdate,
  currentUserId,
  onConvertToDoc,
  saveAction,
}: TaskActionsInput): EntityAction[] {
  const href = `${window.location.pathname}?card=${card.id}`;
  return [
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
        onAssigneesChange?.([...new Set([currentUserId, ...card.memberIds])]),
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
          onAssigneesChange?.(
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
      icon: () => <StatusIcon status={listId} className="size-4" />,
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
              href,
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
      run: () => copyToClipboard(entityUrl(href)),
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
}

/** Asks first, then removes the task. */
export function confirmDeleteTask(
  card: Pick<KanbanCard, 'id' | 'title'>,
  dispatch: (action: BoardAction) => void,
) {
  void confirm({
    title: `Delete “${card.title}”?`,
    description: "The task and its details are removed. This can't be undone.",
    confirmLabel: 'Delete task',
    destructive: true,
  }).then((ok) => {
    if (ok) dispatch({ type: 'card/remove', cardId: card.id });
  });
}

/**
 * The same actions for a view that works off the board's `dispatch` — the list
 * and the timeline — wired exactly as the board card wires them.
 */
export function useBoardTaskActions({
  workspaceId,
  lists,
  members,
  dispatch,
  onOpen,
}: {
  workspaceId?: string;
  lists: Array<Pick<KanbanList, 'id' | 'title'>>;
  members: BoardMember[];
  dispatch: (action: BoardAction) => void;
  onOpen: (card: KanbanCard, listId: string) => void;
}) {
  const { saveAction } = useSaveForLater();
  const canDelete = useWorkspacePermission().can(WorkspacePermission.DELETE);
  const currentUser = useCurrentUser();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const navigate = useNavigate();
  const convert = useConvertTaskToDocument(
    workspaceId,
    workspaceSlug
      ? (docId) => navigate(`/w/${workspaceSlug}/docs/${docId}`)
      : undefined,
  );

  return useCallback(
    (card: KanbanCard, listId: string): EntityAction[] =>
      buildTaskActions({
        card,
        members,
        lists,
        listId,
        saveAction,
        canDelete,
        currentUserId: currentUser?.id,
        onOpen: () => onOpen(card, listId),
        onCopy: () => dispatch({ type: 'card/copy', cardId: card.id }),
        onDelete: () => confirmDeleteTask(card, dispatch),
        onMoveToList: (toListId) =>
          dispatch({
            type: 'card/move',
            cardId: card.id,
            toListId,
            toIndex: Number.MAX_SAFE_INTEGER,
          }),
        onAssigneesChange: (memberIds) =>
          dispatch({
            type: 'card/update',
            cardId: card.id,
            patch: { memberIds },
          }),
        onUpdate: (patch) =>
          dispatch({ type: 'card/update', cardId: card.id, patch }),
        onConvertToDoc: workspaceId ? () => convert(card) : undefined,
      }),
    [
      members,
      lists,
      saveAction,
      canDelete,
      currentUser?.id,
      onOpen,
      dispatch,
      workspaceId,
      convert,
    ],
  );
}
