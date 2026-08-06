import type { Accent } from '@org/design-system';

/**
 * The board is modelled the way Trello models it: an ordered array of lists,
 * each holding an ordered array of cards. Order *is* the data — there is no
 * separate `position` field to keep in sync, so a drag is a splice.
 */

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface BoardLabel {
  id: string;
  name: string;
  color: Accent;
}

export interface BoardMember {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface CardComment {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface KanbanCard {
  id: string;
  title: string;
  description: string;
  labelIds: string[];
  memberIds: string[];
  /** Local calendar day as `yyyy-mm-dd`; absent when the card has no deadline. */
  dueDate?: string;
  dueComplete: boolean;
  priority: Priority;
  checklist: ChecklistItem[];
  comments: CardComment[];
  createdAt: string;
}

export interface KanbanList {
  id: string;
  title: string;
  cards: KanbanCard[];
}

export interface BoardState {
  title: string;
  lists: KanbanList[];
  labels: BoardLabel[];
  members: BoardMember[];
  /** The viewer: comment author, and the target of the "assign me" shortcut. */
  currentMemberId: string;
}

/** How a list's cards get reordered by the list menu. */
export type SortKey = 'due' | 'priority' | 'title' | 'created';

/**
 * The flat task shape this library exported before the board grew lists.
 * Retained because it is part of the published surface; new code should use
 * {@link KanbanCard}.
 */
export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
  priority: Priority;
  assigneeName?: string;
  dueDate?: string;
}
