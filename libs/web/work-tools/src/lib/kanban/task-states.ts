import {
  TASK_STATUS_ORDER,
  TaskStatus,
  type Task,
  type TaskWorkflowState,
} from '@org/types';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useCurrentWorkspace, useTaskStates } from '../use-work-tools.js';

/**
 * The workspace's task workflow: every status menu, column, icon and label
 * reads from here, so a rename or a new status shows up the same everywhere.
 *
 * Built-in statuses use their `TaskStatus` name as id; custom ones use their
 * row id and sit under a `category`. A task's status is `stateId ?? status`.
 */

export const STATUS_CATEGORY_LABELS: Record<TaskStatus, string> = {
  BACKLOG: 'Backlog',
  TODO: 'Unstarted',
  IN_PROGRESS: 'Started',
  IN_REVIEW: 'In review',
  DONE: 'Completed',
  CANCELLED: 'Cancelled',
};

/** The built-ins as the server seeds them; also what renders before it answers. */
export const DEFAULT_WORKFLOW_STATES: readonly TaskWorkflowState[] = [
  { id: 'BACKLOG', name: 'Backlog', color: '#94a3b8' },
  { id: 'TODO', name: 'Planned', color: '#64748b' },
  { id: 'IN_PROGRESS', name: 'In Progress', color: '#eab308' },
  { id: 'IN_REVIEW', name: 'In Review', color: '#8b5cf6' },
  { id: 'DONE', name: 'Completed', color: '#3b82f6' },
  { id: 'CANCELLED', name: 'Cancelled', color: '#64748b' },
].map((state, index) => ({
  ...state,
  category: state.id as TaskStatus,
  builtin: true,
  position: (index + 1) * 1024,
}));

const DEFAULT_COLORS = new Map(
  DEFAULT_WORKFLOW_STATES.map((state) => [state.id, state.color]),
);

/** Colours offered when adding or editing a status. */
export const STATUS_COLORS = [
  '#94a3b8',
  '#64748b',
  '#eab308',
  '#f97316',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#3b82f6',
  '#10b981',
  '#ef4444',
] as const;

/**
 * The colour to paint a state's icon in, or undefined to keep the built-in
 * icon's theme colour (a built-in nobody recoloured).
 */
export function stateTint(
  state: TaskWorkflowState | undefined,
): string | undefined {
  if (!state) return undefined;
  if (
    state.builtin &&
    DEFAULT_COLORS.get(state.id) === state.color.toLowerCase()
  ) {
    return undefined;
  }
  return state.color;
}

/* --------------------------------------------- last-known workflow store --- */
//
// Icons and labels render in hundreds of places, many without a workspace in
// reach (tests, previews). They read the last workflow any screen fetched,
// falling back to the built-ins, instead of each running a query.

let snapshot: readonly TaskWorkflowState[] = DEFAULT_WORKFLOW_STATES;
const listeners = new Set<() => void>();

function publish(states: readonly TaskWorkflowState[]) {
  if (states === snapshot) return;
  snapshot = states;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => snapshot;

/** The last-known workflow, without fetching. For icons and labels. */
export function useKnownWorkflowStates(): readonly TaskWorkflowState[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Non-reactive lookup of a state by id in the last-known workflow. */
export function knownState(id: string | null | undefined) {
  return id ? snapshot.find((state) => state.id === id) : undefined;
}

/* ---------------------------------------------------------------- helpers --- */

/** The state id a task sits in. */
export function stateIdOf(task: Pick<Task, 'status' | 'stateId'>): string {
  return task.stateId || task.status;
}

const isBuiltinId = (id: string): id is TaskStatus =>
  (TASK_STATUS_ORDER as readonly string[]).includes(id);

/**
 * The fields a task write needs to land in `stateId`: the category as `status`
 * (so older code paths and filters still read a valid enum), plus the custom
 * id, or null to leave any custom state.
 */
export function statePatch(
  states: readonly TaskWorkflowState[],
  id: string,
): { status: TaskStatus; stateId: string | null } {
  if (isBuiltinId(id)) return { status: id, stateId: null };
  const state = states.find((s) => s.id === id) ?? knownState(id);
  return { status: state?.category ?? TaskStatus.TODO, stateId: id };
}

export interface WorkflowStates {
  states: readonly TaskWorkflowState[];
  isLoading: boolean;
  byId: (id: string | null | undefined) => TaskWorkflowState | undefined;
  /** The state's name, or the category's for an id this workspace does not know. */
  nameOf: (id: string | null | undefined) => string;
  categoryOf: (id: string | null | undefined) => TaskStatus;
  patchFor: (id: string) => { status: TaskStatus; stateId: string | null };
}

/** The current workspace's workflow, fetched and shared with every icon. */
export function useWorkflowStates(): WorkflowStates {
  const { workspaceId } = useCurrentWorkspace();
  const query = useTaskStates(workspaceId);
  const known = useKnownWorkflowStates();
  const states = query.data && query.data.length > 0 ? query.data : known;

  useEffect(() => {
    if (query.data && query.data.length > 0) publish(query.data);
  }, [query.data]);

  const index = useMemo(
    () => new Map(states.map((state) => [state.id, state])),
    [states],
  );
  const byId = useCallback(
    (id: string | null | undefined) => (id ? index.get(id) : undefined),
    [index],
  );
  const categoryOf = useCallback(
    (id: string | null | undefined): TaskStatus => {
      const state = id ? index.get(id) : undefined;
      if (state) return state.category;
      return id && isBuiltinId(id) ? id : TaskStatus.TODO;
    },
    [index],
  );
  const nameOf = useCallback(
    (id: string | null | undefined) =>
      (id ? index.get(id)?.name : undefined) ??
      DEFAULT_WORKFLOW_STATES.find((state) => state.id === categoryOf(id))
        ?.name ??
      'Status',
    [index, categoryOf],
  );
  const patchFor = useCallback(
    (id: string) => statePatch(states, id),
    [states],
  );

  return {
    states,
    isLoading: query.isLoading,
    byId,
    nameOf,
    categoryOf,
    patchFor,
  };
}
