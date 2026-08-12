import type { TaskStatus } from '@org/types';
import type { BadgeProps } from '@org/ui';
import type { KanbanCard, Priority } from './types.js';

/* --------------------------------------------------------------- dates --- */

const DAY_MONTH = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
});

/**
 * `yyyy-mm-dd` → a *local* midnight. `new Date('2026-08-06')` parses as UTC,
 * which renders as the previous day west of Greenwich.
 */
export function parseDay(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

/** Today as `yyyy-mm-dd` in the viewer's timezone. */
export function todayISO(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Whole days from today to `value`; negative once the date has passed. */
export function daysUntil(value: string): number {
  const target = parseDay(value);
  const today = parseDay(todayISO());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export type DueTone = 'complete' | 'overdue' | 'today' | 'soon' | 'later';

export interface DueBadge {
  label: string;
  tone: DueTone;
  /** Long form for `title`/`aria-label`, e.g. "Due 6 Aug — overdue". */
  hint: string;
}

export function describeDue(card: KanbanCard): DueBadge | undefined {
  if (!card.dueDate) return undefined;

  const absolute = DAY_MONTH.format(parseDay(card.dueDate));
  const days = daysUntil(card.dueDate);

  if (card.dueComplete) {
    return {
      label: absolute,
      tone: 'complete',
      hint: `Due ${absolute} — complete`,
    };
  }
  if (days < 0) {
    return {
      label: absolute,
      tone: 'overdue',
      hint: `Due ${absolute} — overdue`,
    };
  }
  if (days === 0)
    return { label: 'Today', tone: 'today', hint: `Due today, ${absolute}` };
  if (days === 1) {
    return {
      label: 'Tomorrow',
      tone: 'soon',
      hint: `Due tomorrow, ${absolute}`,
    };
  }
  return {
    label: absolute,
    tone: days <= 7 ? 'soon' : 'later',
    hint: `Due ${absolute}`,
  };
}

/**
 * Accent tokens rather than the status ones: `warning-foreground` is a near-black
 * meant to sit on a *solid* warning fill, so on these soft tints it disappears in
 * the dark theme. The accent pairs are defined per theme for exactly this use.
 */
export const DUE_TONE_CLASSES: Record<DueTone, string> = {
  complete: 'border-accent-green/25 bg-accent-green-soft text-accent-green',
  overdue: 'border-accent-rose/30 bg-accent-rose-soft text-accent-rose',
  today: 'border-accent-orange/30 bg-accent-orange-soft text-accent-orange',
  soon: 'border-accent-amber/30 bg-accent-amber-soft text-accent-amber',
  later: 'border-transparent bg-muted text-muted-foreground',
};

/* ------------------------------------------------------------ priority --- */

export const PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export const PRIORITY_META: Record<
  Priority,
  { label: string; variant: BadgeProps['variant']; dot: string }
> = {
  LOW: { label: 'Low', variant: 'neutral', dot: 'bg-muted-foreground/50' },
  MEDIUM: { label: 'Medium', variant: 'info', dot: 'bg-info' },
  HIGH: { label: 'High', variant: 'warning', dot: 'bg-warning' },
  URGENT: { label: 'Urgent', variant: 'destructive', dot: 'bg-destructive' },
};

/* ------------------------------------------------------------- filters --- */

export type DueFilter = 'any' | 'overdue' | 'today' | 'week' | 'none';

/**
 * The board filter.
 *
 * Every facet here is a property the API actually stores, so a filtered board
 * and the tasks behind it always agree. Facets the local board once offered —
 * labels, lead, creator, health, initiatives, templates — are gone with the
 * fields they read.
 */
export interface BoardFilter {
  query: string;
  aiQuery?: string;
  /** Status columns to keep. Empty means all of them. */
  status: TaskStatus[];
  priorities: Priority[];
  /** Assignee ids. */
  memberIds: string[];
  due: DueFilter;
  /** Milestone titles, as the card carries them. */
  milestones: string[];
}

export const EMPTY_FILTER: BoardFilter = {
  query: '',
  aiQuery: '',
  status: [],
  priorities: [],
  memberIds: [],
  due: 'any',
  milestones: [],
};

export function isFilterActive(filter: BoardFilter): boolean {
  return countActiveFilters(filter) > 0;
}

export function countActiveFilters(filter: BoardFilter): number {
  return (
    (filter.query.trim() ? 1 : 0) +
    (filter.aiQuery?.trim() ? 1 : 0) +
    filter.status.length +
    filter.priorities.length +
    filter.memberIds.length +
    (filter.due === 'any' ? 0 : 1) +
    filter.milestones.length
  );
}

/** Filters are ANDed across facets and ORed within one. */
export function matchesFilter(
  card: KanbanCard,
  filter: BoardFilter,
  listId?: TaskStatus,
): boolean {
  const query = filter.query.trim().toLowerCase();
  if (query) {
    const haystack = `${card.title} ${card.description}`.toLowerCase();
    if (!haystack.includes(query)) return false;
  }

  // AI Prompt Natural Language Filter
  if (filter.aiQuery?.trim()) {
    const aiText = filter.aiQuery.trim().toLowerCase();
    const fullContent = `${card.title} ${card.description} ${card.priority} ${card.milestone || ''}`.toLowerCase();

    // Check key phrases
    if (aiText.includes('urgent') && card.priority !== 'URGENT') return false;
    if (aiText.includes('high') && card.priority !== 'HIGH') return false;
    if (aiText.includes('overdue') && (!card.dueDate || daysUntil(card.dueDate) >= 0 || card.dueComplete)) return false;

    // General fallback token match
    const tokens = aiText.split(/\s+/).filter((t) => !['show', 'me', 'all', 'tasks', 'projects', 'with', 'the', 'and', 'for', 'in'].includes(t));
    if (tokens.length > 0) {
      const matchesAnyToken = tokens.some((t) => fullContent.includes(t));
      if (!matchesAnyToken) return false;
    }
  }

  if (filter.status.length > 0 && listId) {
    if (!filter.status.includes(listId)) return false;
  }

  if (filter.priorities.length > 0) {
    if (!filter.priorities.includes(card.priority)) return false;
  }

  if (
    filter.memberIds.length > 0 &&
    !filter.memberIds.some((id) => card.memberIds.includes(id))
  ) {
    return false;
  }

  if (filter.milestones.length > 0) {
    if (!card.milestone || !filter.milestones.includes(card.milestone)) return false;
  }

  switch (filter.due) {
    case 'overdue':
      return Boolean(
        card.dueDate && !card.dueComplete && daysUntil(card.dueDate) < 0,
      );
    case 'today':
      return Boolean(
        card.dueDate && !card.dueComplete && daysUntil(card.dueDate) === 0,
      );
    case 'week':
      if (!card.dueDate) return false;
      return daysUntil(card.dueDate) <= 7;
    case 'none':
      return !card.dueDate;
    default:
      return true;
  }
}
