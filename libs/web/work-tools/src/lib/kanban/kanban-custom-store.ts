import type { TaskChecklistItem, TaskLabel } from '@org/types';
import { useCallback, useMemo } from 'react';
import {
  useCurrentWorkspace,
  useTaskLabelMutations,
  useTaskLabels,
} from '../use-work-tools.js';

/**
 * Board vocabulary: the status and priority menus, and the workspace's label
 * catalogue.
 *
 * This used to be a zustand store persisted to localStorage, holding labels,
 * teams, start dates, checklists and stars per card — so none of it reached a
 * teammate, or even another browser. Every per-card field now lives on the task
 * itself (`labels`, `startDate`, `customFields.checklist`, see `server-board`),
 * the label catalogue is the server's `TaskLabel` table, and teams are `Team`
 * rows. What is left here is the fixed status/priority vocabulary — both are
 * enums on the server, so they are constants, not settings.
 */

export interface CustomStatusItem {
  id: string;
  label: string;
  /** The digit that picks it while the status menu is open. */
  key: string;
  color?: string;
}

export interface CustomPriorityItem {
  id: string;
  label: string;
  key: string;
  color?: string;
}

export interface CustomLabelItem {
  id: string;
  name: string;
  color: string;
}

export type ChecklistItem = TaskChecklistItem;

export const KANBAN_STATUSES: readonly CustomStatusItem[] = [
  { id: 'BACKLOG', label: 'Backlog', key: '1', color: '#f59e0b' },
  { id: 'TODO', label: 'Planned', key: '2', color: '#94a3b8' },
  { id: 'IN_PROGRESS', label: 'In Progress', key: '3', color: '#eab308' },
  { id: 'IN_REVIEW', label: 'In Review', key: '4', color: '#8b5cf6' },
  { id: 'DONE', label: 'Completed', key: '5', color: '#3b82f6' },
  { id: 'CANCELLED', label: 'Canceled', key: '6', color: '#64748b' },
];

export const KANBAN_PRIORITIES: readonly CustomPriorityItem[] = [
  { id: 'NO_PRIORITY', label: 'No priority', key: '0', color: '#94a3b8' },
  { id: 'URGENT', label: 'Urgent', key: '1', color: '#ef4444' },
  { id: 'HIGH', label: 'High', key: '2', color: '#f97316' },
  { id: 'MEDIUM', label: 'Medium', key: '3', color: '#eab308' },
  { id: 'LOW', label: 'Low', key: '4', color: '#3b82f6' },
];

export const LABEL_COLORS = [
  '#8b5cf6',
  '#3b82f6',
  '#10b981',
  '#ef4444',
  '#f59e0b',
  '#06b6d4',
  '#ec4899',
  '#64748b',
] as const;

/** Stable colour for a name, so a label created inline is always painted the same. */
export function colorForLabelName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return LABEL_COLORS[Math.abs(hash) % LABEL_COLORS.length];
}

const NO_LABELS: TaskLabel[] = [];

/**
 * The current workspace's label catalogue, plus inline creation (the label
 * picker's "Create …"). A task may carry a name the catalogue no longer has —
 * imported, or tagged before the catalogue existed — so `colorOf` falls back to
 * the name's stable colour rather than dropping it.
 */
export function useKanbanLabels() {
  const { workspaceId } = useCurrentWorkspace();
  const query = useTaskLabels(workspaceId);
  const { create } = useTaskLabelMutations(workspaceId);
  const labels = query.data ?? NO_LABELS;

  const byName = useMemo(
    () => new Map(labels.map((label) => [label.name, label])),
    [labels],
  );

  const colorOf = useCallback(
    (name: string) => byName.get(name)?.color ?? colorForLabelName(name),
    [byName],
  );

  const createLabel = useCallback(
    (name: string, color = colorForLabelName(name)) =>
      create.mutateAsync({ name, color }),
    [create],
  );

  return { labels, colorOf, createLabel, isLoading: query.isLoading };
}
