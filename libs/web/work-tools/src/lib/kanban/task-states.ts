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

/**
 * The one status palette. Every status icon, column, picker, chart and
 * timeline bar paints from these (or from a colour the workspace picked), and
 * they are theme-fixed: a workspace theme never recolours a status.
 *
 * Grey → blue → amber → violet → green reads as progress at a glance.
 */
export const STATUS_CATEGORY_COLORS: Record<TaskStatus, string> = {
  BACKLOG: '#94a3b8',
  TODO: '#3b82f6',
  IN_PROGRESS: '#f59e0b',
  IN_REVIEW: '#8b5cf6',
  DONE: '#10b981',
  CANCELLED: '#64748b',
};

/**
 * What the server seeded before the palette above. A built-in still carrying
 * its old seed colour was never recoloured by anyone, so it takes the new one.
 */
const LEGACY_SEED_COLORS: Partial<Record<TaskStatus, string>> = {
  TODO: '#64748b',
  IN_PROGRESS: '#eab308',
  DONE: '#3b82f6',
};

/** The built-ins as the server seeds them; also what renders before it answers. */
export const DEFAULT_WORKFLOW_STATES: readonly TaskWorkflowState[] = [
  { id: 'BACKLOG', name: 'Backlog' },
  { id: 'TODO', name: 'Planned' },
  { id: 'IN_PROGRESS', name: 'In Progress' },
  { id: 'IN_REVIEW', name: 'In Review' },
  { id: 'DONE', name: 'Completed' },
  { id: 'CANCELLED', name: 'Cancelled' },
].map((state, index) => ({
  ...state,
  color: STATUS_CATEGORY_COLORS[state.id as TaskStatus],
  category: state.id as TaskStatus,
  builtin: true,
  position: (index + 1) * 1024,
}));

/** Colours offered when adding or editing a status. */
export const STATUS_COLORS = [
  '#94a3b8',
  '#64748b',
  '#f59e0b',
  '#f97316',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#3b82f6',
  '#10b981',
  '#ef4444',
] as const;

/** Swaps an untouched legacy seed colour for the current palette's. */
function normalizeState(state: TaskWorkflowState): TaskWorkflowState {
  if (!state.builtin) return state;
  const legacy = LEGACY_SEED_COLORS[state.category];
  return legacy && state.color.toLowerCase() === legacy
    ? { ...state, color: STATUS_CATEGORY_COLORS[state.category] }
    : state;
}

/** The colour a status paints in: its own, else its category's. */
export function statusColor(
  id: string | null | undefined,
  states: readonly TaskWorkflowState[] = snapshot,
): string {
  const state = id ? states.find((item) => item.id === id) : undefined;
  if (state?.color) return state.color;
  return (
    STATUS_CATEGORY_COLORS[(state?.category ?? id) as TaskStatus] ??
    STATUS_CATEGORY_COLORS.TODO
  );
}

/** The colour to paint a state's icon in. */
export function stateTint(
  state: TaskWorkflowState | undefined,
): string | undefined {
  return state?.color;
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
  const fetched = useMemo(
    () =>
      query.data && query.data.length > 0
        ? query.data.map(normalizeState)
        : undefined,
    [query.data],
  );
  const states = fetched ?? known;

  useEffect(() => {
    if (fetched) publish(fetched);
  }, [fetched]);

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
