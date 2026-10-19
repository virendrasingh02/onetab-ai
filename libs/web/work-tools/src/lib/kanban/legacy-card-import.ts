import { queryKeys, workToolsApi } from '@org/api-client';
import type { Task, TaskChecklistItem } from '@org/types';
import type { UpdateTaskInput } from '@org/validation';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { colorForLabelName } from './kanban-custom-store.js';
import { checklistOf, dayToIso } from './server-board.js';

/**
 * One-time move of the card fields the board used to keep in this browser.
 *
 * Before labels, start dates and checklists were task fields they lived in a
 * persisted zustand store (`onetab_kanban_custom_store`), keyed by task id. On
 * the first board load after the move, whatever this browser has for a task on
 * the board is written onto the task — but only into a field the task does not
 * already have, so a teammate's newer value is never overwritten — and then
 * dropped from local storage. Entries for tasks on other boards wait until
 * that board is opened.
 */

const LEGACY_KEY = 'onetab_kanban_custom_store';

interface LegacyCardProperties {
  labels?: unknown;
  startDate?: unknown;
  checklist?: unknown;
}

interface LegacyState {
  state?: {
    cardProperties?: Record<string, LegacyCardProperties>;
    labels?: Array<{ name?: unknown; color?: unknown }>;
  };
  version?: number;
}

const inFlight = new Set<string>();

function readLegacy(): LegacyState | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    return raw ? (JSON.parse(raw) as LegacyState) : null;
  } catch {
    return null;
  }
}

function writeLegacy(legacy: LegacyState): void {
  try {
    const remaining = legacy.state?.cardProperties ?? {};
    if (Object.keys(remaining).length === 0) localStorage.removeItem(LEGACY_KEY);
    else localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy));
  } catch {
    // Storage unavailable — the import simply runs again next time.
  }
}

const isDay = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

function patchFor(task: Task, local: LegacyCardProperties): UpdateTaskInput | null {
  const patch: UpdateTaskInput = {};

  const labels = Array.isArray(local.labels)
    ? local.labels.filter((l): l is string => typeof l === 'string' && !!l.trim())
    : [];
  if (labels.length > 0 && (task.labels ?? []).length === 0) {
    patch.labels = labels.map((l) => l.trim().slice(0, 50));
  }

  if (isDay(local.startDate) && !task.startDate) {
    patch.startDate = dayToIso(local.startDate);
  }

  const checklist = Array.isArray(local.checklist)
    ? checklistOf({ customFields: { checklist: local.checklist } })
    : [];
  if (checklist.length > 0 && checklistOf(task).length === 0) {
    patch.customFields = { checklist: checklist as TaskChecklistItem[] };
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

async function importLegacy(workspaceId: string, tasks: Task[]): Promise<boolean> {
  const legacy = readLegacy();
  const cardProperties = legacy?.state?.cardProperties;
  if (!legacy || !cardProperties) return false;

  const onBoard = tasks.filter((task) => task.id in cardProperties);
  if (onBoard.length === 0) return false;

  const localColors = new Map<string, string>();
  for (const label of legacy.state?.labels ?? []) {
    if (typeof label.name === 'string' && typeof label.color === 'string') {
      localColors.set(label.name, label.color);
    }
  }

  let changed = false;
  const labelNames = new Set<string>();

  for (const task of onBoard) {
    const patch = patchFor(task, cardProperties[task.id]);
    try {
      if (patch) {
        await workToolsApi.updateTask(workspaceId, task.id, patch);
        patch.labels?.forEach((name) => labelNames.add(name));
        changed = true;
      }
      delete cardProperties[task.id];
    } catch {
      // Left in place: retried on the next load of this board.
    }
  }

  // Give imported names a catalogue entry, in the colour this browser used.
  await Promise.all(
    [...labelNames].map((name) => {
      const color = localColors.get(name);
      return workToolsApi
        .createTaskLabel(workspaceId, {
          name,
          color: color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : colorForLabelName(name),
        })
        .catch(() => undefined);
    }),
  );

  writeLegacy(legacy);
  return changed;
}

export function useImportLegacyCardProperties(
  workspaceId: string | undefined,
  tasks: Task[] | undefined,
): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!workspaceId || !tasks || tasks.length === 0) return;
    if (inFlight.has(workspaceId)) return;
    inFlight.add(workspaceId);
    void importLegacy(workspaceId, tasks)
      .then((changed) => {
        if (changed) {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.workTools.all(workspaceId),
          });
        }
      })
      .finally(() => inFlight.delete(workspaceId));
  }, [workspaceId, tasks, queryClient]);
}
