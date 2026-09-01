import type { TaskStatus } from '@org/types';

/**
 * The board's view of the tasks API.
 *
 * Columns are the `TaskStatus` values — the server owns the column set, so a
 * list has no identity of its own beyond its status and cannot be renamed or
 * deleted. It *can* be reordered: the left-to-right order is the project's
 * `columnOrder`, so dragging a column rewrites that array. Order *within* a
 * column is `Task.orderIndex`, which is why a card drag is a `moveTask` and not
 * a splice.
 *
 * Everything here is something the API can store. Exports from other trackers
 * carry more (labels, checklists, several assignees per card); that lives in
 * the import IR instead — see `import/board-ir.ts`.
 */

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface BoardMember {
  /** The user's id, as `Task.assigneeId` refers to them. */
  id: string;
  name: string;
  displayName?: string | null;
  email?: string | null;
  avatarUrl?: string;
}

export interface KanbanCard {
  /** The task id. */
  id: string;
  /**
   * The card's human-readable id, `${project.ticketPrefix}-${task.ticketNumber}`
   * — `WEB-42`. Absent only for a task filed outside any project, which has no
   * prefix to pair a number with.
   */
  ticketId?: string;
  identifier?: string | null;
  ticketNumber?: number | null;
  type?: string;
  title: string;
  description: string;
  /**
   * The assignee, as a list.
   *
   * A task has at most one assignee, but the tile draws an avatar stack and the
   * filter matches on membership, so the single id is carried as a one-or-zero
   * element array rather than special-cased at every read site.
   */
  memberIds: string[];
  /** Milestone title, resolved from `Task.milestoneId`. */
  milestone?: string;
  /** From `Task._count.comments`; the thread itself is fetched per card. */
  commentCount: number;
  /** Local calendar day as `yyyy-mm-dd`; absent when the task has no deadline. */
  dueDate?: string;
  /** True once the task reaches a terminal column — nothing is due any more. */
  dueComplete: boolean;
  priority: Priority;
  createdAt: string;
}

export interface KanbanList {
  /** The `TaskStatus` this column collects. */
  id: TaskStatus;
  title: string;
  cards: KanbanCard[];
}

export interface BoardState {
  /** The project's name. */
  title: string;
  lists: KanbanList[];
  members: BoardMember[];
  /** The viewer: the target of the "assign me" shortcut, and comment author. */
  currentMemberId: string;
}

/** How a column's cards get reordered by the list menu. */
export type SortKey = 'due' | 'priority' | 'title' | 'created';
