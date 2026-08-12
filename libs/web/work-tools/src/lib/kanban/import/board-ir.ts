import type { Accent } from '@org/design-system';
import type { Priority } from '../types.js';

/**
 * The intermediate representation an import passes through.
 *
 * Exports from Trello, Jira, Asana and friends carry more than the tasks API
 * can store — colour-coded labels, per-card checklists, several assignees on
 * one card, arbitrary column names. Parsing has to read all of it before
 * anything can decide what survives, so the parsers build *this* shape, and
 * the sink ({@link ../server-import.js}) is what narrows it to `CreateTaskInput`
 * and reports the rest through the import's `warnings`.
 *
 * Deliberately separate from the live board's model: nothing here is persisted,
 * and the live board must never grow a field just because an exporter has one.
 */

export interface ImportedLabel {
  id: string;
  name: string;
  color: Accent;
}

export interface ImportedMember {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface ImportedChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface ImportedComment {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface ImportedCard {
  id: string;
  title: string;
  description: string;
  labelIds: string[];
  memberIds: string[];
  creatorId?: string;
  milestone?: string;
  initiative?: string;
  relations?: string[];
  issuesCount?: number;
  /** Local calendar day as `yyyy-mm-dd`; absent when the source gave no date. */
  dueDate?: string;
  dueComplete: boolean;
  priority: Priority;
  checklist: ImportedChecklistItem[];
  comments: ImportedComment[];
  createdAt: string;
}

export interface ImportedList {
  id: string;
  title: string;
  cards: ImportedCard[];
}

export interface ImportedBoard {
  title: string;
  lists: ImportedList[];
  labels: ImportedLabel[];
  members: ImportedMember[];
  /** The viewer, as the author of any comment the source did not attribute. */
  currentMemberId: string;
}

/* ------------------------------------------------------------------ ids --- */

let sequence = 0;

/** Collision-safe enough for a parse pass, and readable in devtools. */
export function createId(prefix: string): string {
  sequence += 1;
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${random}${sequence}`;
}
