import { workToolsApi } from '@org/api-client';
import { TaskStatus, type ProjectDetail } from '@org/types';
import type { CreateTaskInput } from '@org/validation';
import type { ImportedBoard, ImportedCard } from './import/board-ir.js';
import { exportBoard } from './import/normalize.js';
import { dayToIso, isoToDay, STATUS_TITLES } from './server-board.js';

/**
 * Where an import lands.
 *
 * Parsing produces the import IR — arbitrary column names, labels, checklists,
 * several assignees per card. This narrows that to what `POST /tasks` accepts
 * and reports everything it had to leave behind, so the dialog can show it
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

  if (board.labels.length > 0) {
    warnings.push(
      `${board.labels.length} label${board.labels.length === 1 ? '' : 's'} were not imported — tasks do not carry labels.`,
    );
  }

  const withChecklists = cards.filter((card) => card.checklist.length > 0);
  if (withChecklists.length > 0) {
    warnings.push(
      `Checklists on ${withChecklists.length} task${withChecklists.length === 1 ? '' : 's'} were not imported.`,
    );
  }

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
  onProgress?: (progress: ImportProgress) => void;
}

function toCreateInput(
  card: ImportedCard,
  projectId: string,
  status: TaskStatus,
): CreateTaskInput {
  return {
    title: card.title.slice(0, 200),
    description: card.description ? card.description.slice(0, 5000) : null,
    status,
    priority: card.priority,
    projectId,
    dueDate: card.dueDate ? dayToIso(card.dueDate) : null,
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
  onProgress,
}: ImportTasksInput): Promise<ImportProgress> {
  const progress: ImportProgress = {
    total: board.lists.reduce((count, list) => count + list.cards.length, 0),
    created: 0,
    failed: 0,
    warnings: describeLosses(board),
  };

  onProgress?.({ ...progress });

  await Promise.all(
    board.lists.map(async (list) => {
      const status = statusForListName(list.title);

      for (const card of [...list.cards].reverse()) {
        try {
          await workToolsApi.createTask(
            workspaceId,
            toCreateInput(card, projectId, status),
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
  const tasks = await workToolsApi.tasks(workspaceId, project.id);
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
      labelIds: [],
      memberIds: task.assigneeId ? [task.assigneeId] : [],
      milestone: task.milestoneId ? milestones.get(task.milestoneId) : undefined,
      dueDate: isoToDay(task.dueDate),
      dueComplete: task.status === TaskStatus.DONE,
      priority: task.priority,
      checklist: [],
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
    labels: [],
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
