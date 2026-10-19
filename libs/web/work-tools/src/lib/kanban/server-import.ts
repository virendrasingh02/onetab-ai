import { workToolsApi } from '@org/api-client';
import { TaskStatus, type ProjectDetail } from '@org/types';
import type { CreateTaskInput } from '@org/validation';
import type { Accent } from '@org/design-system';
import type { ImportedBoard, ImportedCard } from './import/board-ir.js';
import { exportBoard } from './import/normalize.js';
import { checklistOf, dayToIso, isoToDay, STATUS_TITLES } from './server-board.js';

/**
 * Where an import lands.
 *
 * Parsing produces the import IR — arbitrary column names, labels, checklists,
 * several assignees per card. This narrows that to what `POST /tasks` accepts
 * (labels → `labels` + the workspace catalogue, checklists →
 * `customFields.checklist`) and reports everything it had to leave behind, so the dialog can show it
 * before the user treats the import as complete.
 */

/* --------------------------------------------------------------- status --- */

/**
 * Column names, mapped onto the status set the server owns.
 *
 * Ordered most specific first: "in review" has to be tested before "in", and
 * "not started" before "started".
 */
const STATUS_PATTERNS: Array<[RegExp, TaskStatus]> = [
  [/^(icebox|idea|backlog|triage|inbox|new|reported|open)/i, TaskStatus.BACKLOG],
  [
    /^(to ?do|not ?started|planned|selected|ready|next|up next)/i,
    TaskStatus.TODO,
  ],
  [
    /^(in review|review|code review|qa|testing|verify)/i,
    TaskStatus.IN_REVIEW,
  ],
  [
    /^(in progress|doing|started|development|investigating|active|blocked|on hold|waiting)/i,
    TaskStatus.IN_PROGRESS,
  ],
  [
    /^(done|closed|resolved|complete|shipped|approved)/i,
    TaskStatus.DONE,
  ],
  [/^(cancell?ed|duplicate|wont ?fix|archived)/i, TaskStatus.CANCELLED],
];

/** The status an imported column becomes. Anything unrecognised is a to-do. */
export function statusForListName(name: string): TaskStatus {
  const trimmed = name.trim();
  for (const [pattern, status] of STATUS_PATTERNS) {
    if (pattern.test(trimmed)) return status;
  }
  return TaskStatus.TODO;
}

/* -------------------------------------------------------------- warnings --- */

function describeLosses(board: ImportedBoard): string[] {
  const warnings: string[] = [];

  const cards = board.lists.flatMap((list) => list.cards);

  const withComments = cards.filter((card) => card.comments.length > 0);
  if (withComments.length > 0) {
    warnings.push(
      `Comments on ${withComments.length} task${withComments.length === 1 ? '' : 's'} were not imported.`,
    );
  }

  const withAssignees = cards.filter((card) => card.memberIds.length > 0);
  if (withAssignees.length > 0) {
    warnings.push(
      `Assignees were left unset: the source names them by text, which does not identify a workspace member.`,
    );
  }

  // Columns the source had that do not exist here get folded into another one.
  const folded = new Map<string, TaskStatus>();
  for (const list of board.lists) {
    const status = statusForListName(list.title);
    if (list.title.toLowerCase() !== STATUS_TITLES[status].toLowerCase()) {
      folded.set(list.title, status);
    }
  }
  if (folded.size > 0) {
    const described = [...folded.entries()]
      .map(([title, status]) => `“${title}” → ${STATUS_TITLES[status]}`)
      .join(', ');
    warnings.push(`Columns were mapped onto the board's statuses: ${described}.`);
  }

  return warnings;
}

/* ---------------------------------------------------------------- import --- */

export interface ImportProgress {
  total: number;
  created: number;
  failed: number;
  warnings: string[];
}

export interface ImportTasksInput {
  workspaceId: string;
  projectId: string;
  board: ImportedBoard;
  members?: Array<{ id: string; name: string }>;
  onProgress?: (progress: ImportProgress) => void;
}

/** Hex for an imported label's accent — the catalogue stores `#rrggbb`. */
const ACCENT_HEX: Record<Accent, string> = {
  mint: '#10b981',
  violet: '#8b5cf6',
  blue: '#3b82f6',
  green: '#22c55e',
  amber: '#f59e0b',
  pink: '#ec4899',
  cyan: '#06b6d4',
  orange: '#f97316',
  indigo: '#6366f1',
  teal: '#14b8a6',
  rose: '#f43f5e',
};

function accentForHex(hex: string | undefined): Accent {
  const match = (Object.entries(ACCENT_HEX) as Array<[Accent, string]>).find(
    ([, value]) => value.toLowerCase() === hex?.toLowerCase(),
  );
  return match?.[0] ?? 'violet';
}

function toCreateInput(
  card: ImportedCard,
  projectId: string,
  status: TaskStatus,
  memberMap: Map<string, string> | undefined,
  labelNames: Map<string, string>,
): CreateTaskInput {
  const description = card.description || '';
  const labels = [
    ...new Set(
      card.labelIds
        .map((id) => labelNames.get(id))
        .filter((name): name is string => !!name),
    ),
  ];

  let assigneeId: string | null = null;
  if (memberMap && card.memberIds && card.memberIds.length > 0) {
    for (const id of card.memberIds) {
      const match = memberMap.get(id.toLowerCase());
      if (match) {
        assigneeId = match;
        break;
      }
    }
  }

  return {
    title: card.title.slice(0, 200),
    description: description ? description.slice(0, 5000) : null,
    status,
    priority: card.priority,
    projectId,
    assigneeId,
    dueDate: card.dueDate ? dayToIso(card.dueDate) : null,
    ...(labels.length > 0 ? { labels } : {}),
    ...(card.checklist.length > 0
      ? {
          customFields: {
            checklist: card.checklist.map((item) => ({
              id: item.id,
              text: item.text.slice(0, 500),
              done: item.done,
            })),
          },
        }
      : {}),
  };
}

/**
 * Creates the imported cards as tasks on `projectId`.
 *
 * Cards in one column are created in reverse and one at a time: the server files
 * each new task at the top of its column, so working backwards through the
 * source order leaves the board reading the way the export did. Separate columns
 * do not contend for the same positions, so they run concurrently.
 */
export async function importTasksInto({
  workspaceId,
  projectId,
  board,
  members = [],
  onProgress,
}: ImportTasksInput): Promise<ImportProgress> {
  const progress: ImportProgress = {
    total: board.lists.reduce((count, list) => count + list.cards.length, 0),
    created: 0,
    failed: 0,
    warnings: describeLosses(board),
  };

  const memberMap = new Map<string, string>();
  for (const m of members) {
    memberMap.set(m.name.toLowerCase(), m.id);
    memberMap.set(m.id.toLowerCase(), m.id);
  }

  onProgress?.({ ...progress });

  // Label names, trimmed to what the catalogue accepts, each added once.
  const labelNames = new Map<string, string>();
  for (const label of board.labels) {
    const name = label.name.trim().slice(0, 50);
    if (name) labelNames.set(label.id, name);
  }
  const catalogue = new Map<string, string>();
  for (const label of board.labels) {
    const name = labelNames.get(label.id);
    if (name && !catalogue.has(name)) {
      catalogue.set(name, ACCENT_HEX[label.color] ?? '#64748b');
    }
  }
  await Promise.all(
    [...catalogue].map(([name, color]) =>
      workToolsApi
        .createTaskLabel(workspaceId, { name, color })
        .catch(() => undefined),
    ),
  );

  await Promise.all(
    board.lists.map(async (list) => {
      const status = statusForListName(list.title);

      for (const card of [...list.cards].reverse()) {
        try {
          await workToolsApi.createTask(
            workspaceId,
            toCreateInput(card, projectId, status, memberMap, labelNames),
          );
          progress.created += 1;
        } catch {
          progress.failed += 1;
        }
        onProgress?.({ ...progress });
      }
    }),
  );

  return progress;
}

/* ---------------------------------------------------------------- export --- */

/**
 * A project's tasks as a file the `onetab` importer can read back.
 *
 * Shaped as the import IR so export and import stay symmetrical; the fields the
 * IR has and tasks do not simply come back empty.
 */
export async function exportProjectBoard(
  workspaceId: string,
  project: ProjectDetail,
): Promise<string> {
  const [tasks, labels] = await Promise.all([
    workToolsApi.tasks(workspaceId, project.id),
    workToolsApi.taskLabels(workspaceId).catch(() => []),
  ]);
  const catalogue = new Map(labels.map((label) => [label.name, label.color]));
  const milestones = new Map(
    project.milestones.map((milestone) => [milestone.id, milestone.title]),
  );

  const byStatus = new Map<TaskStatus, ImportedCard[]>();
  for (const task of [...tasks].sort((a, b) => a.orderIndex - b.orderIndex)) {
    const cards = byStatus.get(task.status) ?? [];
    cards.push({
      id: task.id,
      title: task.title,
      description: task.description ?? '',
      labelIds: task.labels ?? [],
      memberIds: task.assigneeId ? [task.assigneeId] : [],
      milestone: task.milestoneId ? milestones.get(task.milestoneId) : undefined,
      dueDate: isoToDay(task.dueDate),
      dueComplete: task.status === TaskStatus.DONE,
      priority: task.priority,
      checklist: checklistOf(task),
      comments: [],
      createdAt: task.createdAt,
    });
    byStatus.set(task.status, cards);
  }

  const board: ImportedBoard = {
    title: project.name,
    lists: [...byStatus.entries()].map(([status, cards]) => ({
      id: status,
      title: STATUS_TITLES[status],
      cards,
    })),
    // Label ids in the file are the names themselves, so a re-import maps back.
    labels: [...new Set(tasks.flatMap((task) => task.labels ?? []))].map(
      (name) => ({ id: name, name, color: accentForHex(catalogue.get(name)) }),
    ),
    members: (tasks ?? [])
      .flatMap((task) => (task.assignee ? [task.assignee] : []))
      .filter(
        (user, index, all) =>
          all.findIndex((other) => other.id === user.id) === index,
      )
      .map((user) => ({
        id: user.id,
        name: user.displayName ?? user.name,
        avatarUrl: user.avatarUrl ?? undefined,
      })),
    currentMemberId: '',
  };

  return exportBoard(board);
}
