import {
  TASK_STATUS_ORDER,
  TaskStatus,
  type ProjectDetail,
  type Task,
  type WorkspaceMember,
} from '@org/types';
import type { CreateTaskInput, UpdateTaskInput } from '@org/validation';
import { useCallback, useMemo } from 'react';
import {
  useProjectMutations,
  useTaskMutations,
  useTasks,
} from '../use-work-tools.js';
import type {
  BoardMember,
  BoardState,
  KanbanCard,
  KanbanList,
  Priority,
  SortKey,
} from './types.js';

/**
 * The board, over the tasks API.
 *
 * The column *set* comes from `TASK_STATUS_ORDER` rather than from data: the
 * server owns the status enum, so there is no action that can add, rename or
 * delete a column. Their left-to-right *order* is the project's `columnOrder`,
 * so dragging a column is an `updateProject`.
 */

export const STATUS_TITLES: Record<TaskStatus, string> = {
  BACKLOG: 'Backlog',
  TODO: 'Planned',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Completed',
  CANCELLED: 'Cancelled',
};

/** Columns where nothing is outstanding any more. */
const TERMINAL: ReadonlySet<TaskStatus> = new Set([
  TaskStatus.DONE,
  TaskStatus.CANCELLED,
]);

/* ---------------------------------------------------------------- dates --- */

/**
 * A stored timestamp as the calendar day the user picked.
 *
 * Read through *local* parts, not by slicing the ISO string: a due date sent as
 * local midnight is stored in UTC, so east of Greenwich the ISO prefix is the
 * previous day. {@link dayToIso} is the exact inverse.
 */
export function isoToDay(value: string | null): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** `yyyy-mm-dd` → local midnight, as the timestamp the API expects. */
export function dayToIso(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1).toISOString();
}

/* ------------------------------------------------------------ ordering --- */

/**
 * Gap left between neighbouring cards when a column is renumbered.
 *
 * `moveTask` takes a position and writes it verbatim — the server does not
 * shuffle siblings — and the schema only accepts non-negative integers, so
 * there are no fractional midpoints to fall back on. Spacing positions out
 * means the common case, dropping a card between two others, is one request:
 * the midpoint of the gap. {@link renumber} only runs once a gap is used up.
 */
const STRIDE = 1024;

/**
 * A position between two neighbours, or `undefined` when the gap is exhausted
 * and the column has to be renumbered first.
 */
function positionBetween(
  before: number | undefined,
  after: number | undefined,
): number | undefined {
  if (before === undefined && after === undefined) return STRIDE;
  if (before === undefined) {
    // Landing at the top: halve the gap down towards zero, which the schema's
    // `min(0)` makes the floor. Once the first card is already at 0 — or below
    // it, which `createTask` can produce — there is no room left above it.
    const first = after as number;
    return first >= 1 ? Math.floor(first / 2) : undefined;
  }
  if (after === undefined) return Math.max(before, 0) + STRIDE;

  const midpoint = Math.floor((before + after) / 2);
  return midpoint > before && midpoint < after ? midpoint : undefined;
}

/** Evenly spaced positions for a column, used when a gap has run out. */
function renumber(cards: KanbanCard[]): number[] {
  return cards.map((_, index) => (index + 1) * STRIDE);
}

/* ----------------------------------------------------------- projection --- */

/**
 * The columns a project draws, left to right.
 *
 * `columnOrder` is the project's, but it is not trusted to be complete: a
 * status added to the enum after the project was last saved would otherwise
 * vanish from the board along with every task in it. Anything missing is
 * appended in enum order, and anything unrecognised is dropped.
 */
export function columnsFor(project: ProjectDetail | undefined): TaskStatus[] {
  const known = new Set(TASK_STATUS_ORDER);
  const seen = new Set<TaskStatus>();
  const ordered: TaskStatus[] = [];

  for (const status of project?.columnOrder ?? []) {
    if (!known.has(status) || seen.has(status)) continue;
    seen.add(status);
    ordered.push(status);
  }
  for (const status of TASK_STATUS_ORDER) {
    if (!seen.has(status)) ordered.push(status);
  }
  return ordered;
}

export function taskToCard(
  task: Task,
  milestoneTitles: ReadonlyMap<string, string>,
  ticketPrefix?: string | null,
): KanbanCard {
  return {
    id: task.id,
    ticketId:
      ticketPrefix && task.ticketNumber !== null
        ? `${ticketPrefix}-${task.ticketNumber}`
        : undefined,
    identifier: task.identifier,
    ticketNumber: task.ticketNumber,
    type: task.type,
    title: task.title,
    description: task.description ?? '',
    memberIds: task.assigneeId ? [task.assigneeId] : [],
    milestone: task.milestoneId
      ? milestoneTitles.get(task.milestoneId)
      : undefined,
    commentCount: task._count.comments,
    dueDate: isoToDay(task.dueDate),
    dueComplete: TERMINAL.has(task.status),
    priority: task.priority,
    createdAt: task.createdAt,
  };
}

export function membersFrom(
  members: WorkspaceMember[] | undefined,
): BoardMember[] {
  return (members ?? []).map((member) => ({
    id: member.user.id,
    name: member.user.displayName ?? member.user.name,
    avatarUrl: member.user.avatarUrl ?? undefined,
  }));
}

export interface BuildBoardInput {
  project: ProjectDetail | undefined;
  tasks: Task[] | undefined;
  members: BoardMember[];
  currentUserId: string | undefined;
}

/** Groups tasks into the status columns, in the order the board draws them. */
export function buildBoard({
  project,
  tasks,
  members,
  currentUserId,
}: BuildBoardInput): BoardState {
  const milestoneTitles = new Map(
    (project?.milestones ?? []).map((milestone) => [
      milestone.id,
      milestone.title,
    ]),
  );

  const byStatus = new Map<TaskStatus, Task[]>(
    TASK_STATUS_ORDER.map((status) => [status, []]),
  );
  for (const task of tasks ?? []) {
    byStatus.get(task.status)?.push(task);
  }

  const lists: KanbanList[] = columnsFor(project).map((status) => ({
    id: status,
    title: STATUS_TITLES[status],
    cards: (byStatus.get(status) ?? [])
      .slice()
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((task) => taskToCard(task, milestoneTitles, project?.ticketPrefix)),
  }));

  return {
    title: project?.name ?? 'Tasks',
    lists,
    members,
    currentMemberId: currentUserId ?? '',
  };
}

/* -------------------------------------------------------------- actions --- */

/**
 * What the board can ask of the server.
 *
 * A narrower set than the local reducer had: there is no `list/add`,
 * `list/rename` or `list/remove` because the columns are the `TaskStatus` enum,
 * and no label or checklist actions because the API has nowhere to keep them.
 * Comments are their own resource — the card dialog fetches and posts them
 * directly.
 */
export type BoardAction =
  | { type: 'card/add'; listId: TaskStatus; title: string; edge?: 'top' | 'bottom' }
  /** A column dragged to a new place in the row; `toIndex` is over all columns. */
  | { type: 'list/move'; listId: TaskStatus; toIndex: number }
  | { type: 'card/update'; cardId: string; patch: CardPatch }
  | { type: 'card/remove'; cardId: string }
  | { type: 'card/copy'; cardId: string }
  | { type: 'card/move'; cardId: string; toListId: TaskStatus; toIndex: number }
  | { type: 'card/toggleMember'; cardId: string; memberId: string }
  | { type: 'list/sort'; listId: TaskStatus; by: SortKey }
  | { type: 'list/clear'; listId: TaskStatus }
  | { type: 'list/moveAll'; fromListId: TaskStatus; toListId: TaskStatus };

/** The card fields that map onto a task the server will accept. */
export interface CardPatch {
  title?: string;
  description?: string;
  priority?: Priority;
  /** `yyyy-mm-dd`, or `null` to clear the deadline. */
  dueDate?: string | null;
  memberIds?: string[];
}

const PRIORITY_RANK: Record<Priority, number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

function compareBy(key: SortKey) {
  return (a: KanbanCard, b: KanbanCard): number => {
    switch (key) {
      case 'due':
        // Undated cards sink to the bottom rather than sorting as epoch zero.
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      case 'priority':
        return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      case 'title':
        return a.title.localeCompare(b.title);
      case 'created':
        return b.createdAt.localeCompare(a.createdAt);
      default:
        return 0;
    }
  };
}

function patchToInput(patch: CardPatch): UpdateTaskInput {
  const input: UpdateTaskInput = {};
  if (patch.title !== undefined) input.title = patch.title;
  if (patch.description !== undefined) input.description = patch.description;
  if (patch.priority !== undefined) input.priority = patch.priority;
  if (patch.dueDate !== undefined) {
    input.dueDate = patch.dueDate ? dayToIso(patch.dueDate) : null;
  }
  if (patch.memberIds !== undefined) {
    // One assignee per task: the first id wins, an empty list unassigns.
    input.assigneeId = patch.memberIds[0] ?? null;
  }
  return input;
}

/* ----------------------------------------------------------------- hook --- */

export interface ServerBoard {
  board: BoardState;
  /** Raw tasks, for callers that need `orderIndex` or the untranslated task. */
  tasks: Task[];
  isLoading: boolean;
  isError: boolean;
  dispatch: (action: BoardAction) => void;
  /** True while any board mutation is in flight. */
  isMutating: boolean;
}

export interface UseServerBoardInput {
  workspaceId: string | undefined;
  project: ProjectDetail | undefined;
  members: BoardMember[];
  currentUserId: string | undefined;
}

/**
 * Board state, read from the API and written back through it.
 *
 * Takes the same `dispatch(action)` shape the local reducer did, so the column,
 * tile and dialog components are unchanged by the move to the server. What was
 * a pure state transition is now one or more requests: an action that only
 * touches the dragged card is a single `moveTask`, and the batch actions (sort,
 * clear, move-all) fan out over the column and settle on one invalidation.
 */
export function useServerBoard({
  workspaceId,
  project,
  members,
  currentUserId,
}: UseServerBoardInput): ServerBoard {
  const projectId = project?.id;
  const tasks = useTasks(workspaceId, projectId);
  const mutations = useTaskMutations(workspaceId, projectId);
  const projectMutations = useProjectMutations(workspaceId);

  const board = useMemo(
    () =>
      buildBoard({
        project,
        tasks: tasks.data,
        members,
        currentUserId,
      }),
    [project, tasks.data, members, currentUserId],
  );

  /** Where each task currently sits — the fields the cards deliberately drop. */
  const placement = useMemo(() => {
    const map = new Map<string, { status: TaskStatus; orderIndex: number }>();
    for (const task of tasks.data ?? []) {
      map.set(task.id, { status: task.status, orderIndex: task.orderIndex });
    }
    return map;
  }, [tasks.data]);

  const dispatch = useCallback(
    (action: BoardAction) => {
      const findCard = (cardId: string) => {
        for (const list of board.lists) {
          const index = list.cards.findIndex((card) => card.id === cardId);
          if (index !== -1) {
            return { list, card: list.cards[index], index };
          }
        }
        return undefined;
      };

      const listOf = (status: TaskStatus) =>
        board.lists.find((list) => list.id === status);

      /**
       * Writes `cards` into `status` in the given order, touching only the
       * cards that are not already in the right column at the right position.
       */
      const applyOrder = (status: TaskStatus, cards: KanbanCard[]): void => {
        const indices = renumber(cards);
        void Promise.all(
          cards.flatMap((card, at) => {
            const now = placement.get(card.id);
            if (now?.status === status && now.orderIndex === indices[at]) {
              return [];
            }
            return mutations.move.mutateAsync({
              taskId: card.id,
              input: { status, orderIndex: indices[at] },
            });
          }),
          // Each move rolls itself back on failure; the batch only needs to not
          // surface as an unhandled rejection.
        ).catch(() => undefined);
      };

      const positionOf = (card: KanbanCard | undefined) =>
        card ? placement.get(card.id)?.orderIndex : undefined;

      switch (action.type) {
        case 'card/add': {
          const input: CreateTaskInput = {
            title: action.title,
            status: action.listId,
            projectId: projectId ?? null,
          };
          // The server files new tasks at the top of their column, which is
          // what `edge: 'top'` asks for; a bottom insert needs a second hop.
          if (action.edge === 'bottom') {
            const column = listOf(action.listId);
            const orderIndex = positionBetween(
              positionOf(column?.cards.at(-1)),
              undefined,
            );
            mutations.create
              .mutateAsync(input)
              .then((task) =>
                orderIndex === undefined
                  ? undefined
                  : mutations.move.mutateAsync({
                      taskId: task.id,
                      input: { status: action.listId, orderIndex },
                    }),
              )
              .catch(() => undefined);
          } else {
            mutations.create.mutate(input);
          }
          return;
        }

        case 'list/move': {
          if (!projectId) return;

          const order = board.lists.map((list) => list.id);
          const from = order.indexOf(action.listId);
          if (from === -1) return;

          const rest = order.filter((status) => status !== action.listId);
          const at = Math.min(Math.max(action.toIndex, 0), rest.length);
          rest.splice(at, 0, action.listId);
          if (rest.every((status, index) => status === order[index])) return;

          projectMutations.update.mutate({
            projectId,
            input: { columnOrder: rest },
          });
          return;
        }

        case 'card/update':
          mutations.update.mutate({
            taskId: action.cardId,
            input: patchToInput(action.patch),
          });
          return;

        case 'card/remove':
          mutations.remove.mutate(action.cardId);
          return;

        case 'card/copy': {
          const found = findCard(action.cardId);
          if (!found) return;
          mutations.create.mutate({
            title: `${found.card.title} (copy)`,
            description: found.card.description || null,
            status: found.list.id,
            priority: found.card.priority,
            projectId: projectId ?? null,
            assigneeId: found.card.memberIds[0] ?? null,
            dueDate: found.card.dueDate ? dayToIso(found.card.dueDate) : null,
          });
          return;
        }

        case 'card/move': {
          const found = findCard(action.cardId);
          if (!found) return;

          const target = listOf(action.toListId);
          if (!target) return;

          const remaining = target.cards.filter(
            (card) => card.id !== action.cardId,
          );
          const at = Math.min(Math.max(action.toIndex, 0), remaining.length);
          const orderIndex = positionBetween(
            positionOf(remaining[at - 1]),
            positionOf(remaining[at]),
          );

          if (orderIndex !== undefined) {
            mutations.move.mutate({
              taskId: action.cardId,
              input: { status: action.toListId, orderIndex },
            });
            return;
          }

          // The gap between the neighbours is used up: rewrite the column with
          // the card in place and fresh spacing.
          const arranged = [...remaining];
          arranged.splice(at, 0, found.card);
          applyOrder(action.toListId, arranged);
          return;
        }

        case 'card/toggleMember': {
          const found = findCard(action.cardId);
          if (!found) return;
          const assigned = found.card.memberIds.includes(action.memberId);
          mutations.update.mutate({
            taskId: action.cardId,
            input: { assigneeId: assigned ? null : action.memberId },
          });
          return;
        }

        case 'list/sort': {
          const column = listOf(action.listId);
          if (!column || column.cards.length < 2) return;
          applyOrder(action.listId, [...column.cards].sort(compareBy(action.by)));
          return;
        }

        case 'list/clear': {
          const column = listOf(action.listId);
          if (!column || column.cards.length === 0) return;
          void Promise.all(
            column.cards.map((card) => mutations.remove.mutateAsync(card.id)),
          ).catch(() => undefined);
          return;
        }

        case 'list/moveAll': {
          const source = listOf(action.fromListId);
          const target = listOf(action.toListId);
          if (!source || !target || source.cards.length === 0) return;
          applyOrder(action.toListId, [...target.cards, ...source.cards]);
          return;
        }

        default:
          return;
      }
    },
    [board.lists, mutations, placement, projectId, projectMutations],
  );

  return {
    board,
    tasks: tasks.data ?? [],
    isLoading: tasks.isLoading,
    isError: tasks.isError,
    dispatch,
    isMutating:
      mutations.create.isPending ||
      mutations.update.isPending ||
      mutations.move.isPending ||
      mutations.remove.isPending,
  };
}
