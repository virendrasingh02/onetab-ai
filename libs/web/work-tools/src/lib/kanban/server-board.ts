import {
  TaskStatus,
  type ProjectDetail,
  type Task,
  type TaskChecklistItem,
  type TaskWorkflowState,
  type WorkspaceMember,
} from '@org/types';
import type { CreateTaskInput, UpdateTaskInput } from '@org/validation';
import { useCallback, useMemo } from 'react';
import {
  useProjectMutations,
  useTaskMutations,
  useTasks,
} from '../use-work-tools.js';
import {
  DEFAULT_WORKFLOW_STATES,
  statePatch,
  stateIdOf,
  useWorkflowStates,
} from './task-states.js';
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
 * The column *set* is the workspace's workflow (`task-states.ts`): the six
 * built-ins plus any custom status, added and renamed in one place for every
 * board. Their left-to-right *order* is the project's `columnOrder`, so
 * dragging a column is an `updateProject`.
 */

/** Built-in names, for code with no workflow in reach. Prefer `useWorkflowStates`. */
export const STATUS_TITLES: Record<TaskStatus, string> = Object.fromEntries(
  DEFAULT_WORKFLOW_STATES.map((state) => [state.id, state.name]),
) as Record<TaskStatus, string>;

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
 * status added to the workflow after the project was last saved would
 * otherwise vanish from the board along with every task in it. Anything
 * missing is placed after the nearest earlier workflow state the order does
 * list (so a new "QA" lands beside In Review), and unknown ids are dropped.
 */
export function columnsFor(
  project: Pick<ProjectDetail, 'columnOrder'> | undefined,
  states: readonly TaskWorkflowState[] = DEFAULT_WORKFLOW_STATES,
): TaskWorkflowState[] {
  const byId = new Map(states.map((state) => [state.id, state]));
  const ordered: TaskWorkflowState[] = [];
  const seen = new Set<string>();
  for (const id of project?.columnOrder ?? []) {
    const state = byId.get(id);
    if (!state || seen.has(id)) continue;
    seen.add(id);
    ordered.push(state);
  }
  states.forEach((state, index) => {
    if (seen.has(state.id)) return;
    seen.add(state.id);
    let at = 0;
    for (let i = index - 1; i >= 0; i -= 1) {
      const anchor = ordered.indexOf(states[i]);
      if (anchor !== -1) {
        at = anchor + 1;
        break;
      }
    }
    ordered.splice(at, 0, state);
  });
  return ordered;
}

const isChecklistItem = (value: unknown): value is TaskChecklistItem =>
  !!value &&
  typeof value === 'object' &&
  typeof (value as TaskChecklistItem).id === 'string' &&
  typeof (value as TaskChecklistItem).text === 'string' &&
  typeof (value as TaskChecklistItem).done === 'boolean';

/** `Task.customFields.checklist`, tolerating anything malformed in the JSON. */
/** `Task.customFields.createdByAgent`, when a Studio agent made the task. */
export function createdByAgentOf(
  task: Pick<Task, 'customFields'>,
): KanbanCard['createdByAgent'] {
  const raw = task.customFields?.['createdByAgent'];
  if (!raw || typeof raw !== 'object') return undefined;
  const { name, workflowId, runId } = raw as Record<string, unknown>;
  if (typeof name !== 'string' || !name) return undefined;
  return {
    name,
    ...(typeof workflowId === 'string' ? { workflowId } : {}),
    ...(typeof runId === 'string' ? { runId } : {}),
  };
}

export function checklistOf(
  task: Pick<Task, 'customFields'>,
): TaskChecklistItem[] {
  const raw = task.customFields?.['checklist'];
  return Array.isArray(raw) ? raw.filter(isChecklistItem) : [];
}

/** A task's readable id, for views that draw tasks rather than cards. */
export function taskTicket(
  task: Pick<Task, 'identifier' | 'ticketNumber' | 'project'>,
): string {
  if (task.project?.ticketPrefix && task.ticketNumber !== null) {
    return `${task.project.ticketPrefix}-${task.ticketNumber}`;
  }
  return task.identifier || 'Task';
}

export function taskToCard(
  task: Task,
  milestoneTitles: ReadonlyMap<string, string>,
  ticketPrefix?: string | null,
): KanbanCard {
  // `assigneeIds` is a first-class column now; the pre-column builds stashed it
  // in `customFields` and the migration moved it out.
  const memberIds =
    task.assigneeIds && task.assigneeIds.length > 0
      ? task.assigneeIds
      : task.assigneeId
        ? [task.assigneeId]
        : [];

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
    memberIds,
    milestone: task.milestoneId
      ? milestoneTitles.get(task.milestoneId)
      : undefined,
    commentCount: task._count.comments,
    subtasks: task.subItems?.length
      ? {
          done: task.subItems.filter((item) => item.status === TaskStatus.DONE)
            .length,
          total: task.subItems.length,
        }
      : undefined,
    dueDate: isoToDay(task.dueDate),
    dueComplete: TERMINAL.has(task.status),
    priority: task.priority,
    createdAt: task.createdAt,
    labels: task.labels ?? [],
    startDate: isoToDay(task.startDate ?? null),
    checklist: checklistOf(task),
    createdByAgent: createdByAgentOf(task),
  };
}

export function membersFrom(
  members: WorkspaceMember[] | undefined,
): BoardMember[] {
  return (members ?? []).map((member) => ({
    id: member.user.id,
    name: member.user.displayName ?? member.user.name,
    displayName: member.user.displayName,
    email: member.email,
    avatarUrl: member.user.avatarUrl ?? undefined,
    presence: member.user.presence,
    statusEmoji: member.user.statusEmoji,
    statusText: member.user.statusText,
    lastSeenAt: member.user.lastSeenAt,
  }));
}

export interface BuildBoardInput {
  project: ProjectDetail | undefined;
  /** The workspace workflow; the built-ins when omitted. */
  states?: readonly TaskWorkflowState[];
  tasks: Task[] | undefined;
  members: BoardMember[];
  currentUserId: string | undefined;
}

/** Groups tasks into the status columns, in the order the board draws them. */
export function buildBoard({
  project,
  states = DEFAULT_WORKFLOW_STATES,
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

  const columns = columnsFor(project, states);
  const byState = new Map<string, Task[]>(
    columns.map((state) => [state.id, []]),
  );
  for (const task of tasks ?? []) {
    // A custom state this workspace no longer has falls back to its category.
    (byState.get(stateIdOf(task)) ?? byState.get(task.status))?.push(task);
  }

  const lists: KanbanList[] = columns.map((state) => ({
    id: state.id,
    category: state.category,
    title: state.name,
    cards: (byState.get(state.id) ?? [])
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
 * Labels, the start date and the checklist ride on `card/update` — they are
 * task fields (`labels`, `startDate`, `customFields.checklist`).
 * Comments are their own resource — the card dialog fetches and posts them
 * directly.
 */
export type BoardAction =
  | {
      type: 'card/add';
      listId: string;
      title: string;
      edge?: 'top' | 'bottom';
    }
  /** A column dragged to a new place in the row; `toIndex` is over all columns. */
  | { type: 'list/move'; listId: string; toIndex: number }
  | { type: 'card/update'; cardId: string; patch: CardPatch }
  | { type: 'card/remove'; cardId: string }
  | { type: 'card/copy'; cardId: string }
  | { type: 'card/move'; cardId: string; toListId: string; toIndex: number }
  | { type: 'card/toggleMember'; cardId: string; memberId: string }
  | { type: 'list/sort'; listId: string; by: SortKey }
  | { type: 'list/clear'; listId: string }
  | { type: 'list/moveAll'; fromListId: string; toListId: string };

/** The card fields that map onto a task the server will accept. */
export interface CardPatch {
  title?: string;
  description?: string;
  priority?: Priority;
  /** `yyyy-mm-dd`, or `null` to clear the deadline. */
  dueDate?: string | null;
  memberIds?: string[];
  labels?: string[];
  /** `yyyy-mm-dd`, or `null` to clear it. */
  startDate?: string | null;
  checklist?: TaskChecklistItem[];
}

const PRIORITY_RANK: Record<Priority, number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

export function compareBy(key: SortKey) {
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
    input.assigneeIds = patch.memberIds;
    input.assigneeId = patch.memberIds[0] ?? null;
  }
  if (patch.labels !== undefined) input.labels = patch.labels;
  if (patch.startDate !== undefined) {
    input.startDate = patch.startDate ? dayToIso(patch.startDate) : null;
  }
  // The server merges `customFields` key by key, so this leaves the rest alone.
  if (patch.checklist !== undefined) {
    input.customFields = { checklist: patch.checklist };
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
  const mutations = useTaskMutations(workspaceId);
  const projectMutations = useProjectMutations(workspaceId);
  const { states } = useWorkflowStates();

  const board = useMemo(
    () =>
      buildBoard({
        project,
        states,
        tasks: tasks.data,
        members,
        currentUserId,
      }),
    [project, states, tasks.data, members, currentUserId],
  );

  /** Where each task currently sits — the fields the cards deliberately drop. */
  const placement = useMemo(() => {
    const map = new Map<string, { stateId: string; orderIndex: number }>();
    for (const task of tasks.data ?? []) {
      map.set(task.id, {
        stateId: stateIdOf(task),
        orderIndex: task.orderIndex,
      });
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

      const listOf = (stateId: string) =>
        board.lists.find((list) => list.id === stateId);

      /**
       * Writes `cards` into `status` in the given order, touching only the
       * cards that are not already in the right column at the right position.
       */
      const applyOrder = (stateId: string, cards: KanbanCard[]): void => {
        const indices = renumber(cards);
        const target = statePatch(states, stateId);
        void Promise.all(
          cards.flatMap((card, at) => {
            const now = placement.get(card.id);
            if (now?.stateId === stateId && now.orderIndex === indices[at]) {
              return [];
            }
            return mutations.move.mutateAsync({
              taskId: card.id,
              input: { ...target, orderIndex: indices[at] },
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
            ...statePatch(states, action.listId),
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
                // `task` is null when the create was queued for offline replay
                // (no id exists yet to reorder) — it lands in the column's
                // default position once the queue applies it.
                !task || orderIndex === undefined
                  ? undefined
                  : mutations.move.mutateAsync({
                      taskId: task.id,
                      input: { ...statePatch(states, action.listId), orderIndex },
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
            ...statePatch(states, found.list.id),
            priority: found.card.priority,
            projectId: projectId ?? null,
            assigneeId: found.card.memberIds[0] ?? null,
            assigneeIds: found.card.memberIds,
            dueDate: found.card.dueDate ? dayToIso(found.card.dueDate) : null,
            startDate: found.card.startDate
              ? dayToIso(found.card.startDate)
              : null,
            labels: found.card.labels,
            ...(found.card.checklist.length > 0
              ? { customFields: { checklist: found.card.checklist } }
              : {}),
          });
          return;
        }

        case 'card/move': {
          const found = findCard(action.cardId);
          if (!found) return;

          const target = listOf(action.toListId);
          if (!target) {
            // A status created a moment ago (from a status menu) has no column
            // on this render yet. The server reads the category from the
            // state itself, so move the card to the top of it now.
            mutations.move.mutate({
              taskId: action.cardId,
              input: { ...statePatch(states, action.toListId), orderIndex: 0 },
            });
            return;
          }

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
              input: { ...statePatch(states, action.toListId), orderIndex },
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
          const nextMemberIds = found.card.memberIds.includes(action.memberId)
            ? found.card.memberIds.filter((id) => id !== action.memberId)
            : [...found.card.memberIds, action.memberId];
          mutations.update.mutate({
            taskId: action.cardId,
            input: {
              assigneeIds: nextMemberIds,
              assigneeId: nextMemberIds[0] ?? null,
            },
          });
          return;
        }

        case 'list/sort': {
          const column = listOf(action.listId);
          if (!column || column.cards.length < 2) return;
          applyOrder(
            action.listId,
            [...column.cards].sort(compareBy(action.by)),
          );
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
    [board.lists, mutations, placement, projectId, projectMutations, states],
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
