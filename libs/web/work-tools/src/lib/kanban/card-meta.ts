import type { BadgeProps } from '@org/ui';
import type { BoardLabel, KanbanCard, Priority } from './types.js';

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

export interface BoardFilter {
  query: string;
  aiQuery?: string;
  status: string[];
  priorities: Priority[];
  labelIds: string[];
  leadIds: string[];
  memberIds: string[];
  creatorIds: string[];
  health: string[];
  due: DueFilter;
  milestones: string[];
  noInitiatives?: boolean;
  template?: string;
  specificProject?: string;
}

export const EMPTY_FILTER: BoardFilter = {
  query: '',
  aiQuery: '',
  status: [],
  priorities: [],
  labelIds: [],
  leadIds: [],
  memberIds: [],
  creatorIds: [],
  health: [],
  due: 'any',
  milestones: [],
  noInitiatives: false,
  template: '',
  specificProject: '',
};

export function isFilterActive(filter: BoardFilter): boolean {
  return (
    filter.query.trim() !== '' ||
    Boolean(filter.aiQuery?.trim()) ||
    filter.status.length > 0 ||
    filter.priorities.length > 0 ||
    filter.labelIds.length > 0 ||
    filter.leadIds.length > 0 ||
    filter.memberIds.length > 0 ||
    filter.creatorIds.length > 0 ||
    filter.health.length > 0 ||
    filter.due !== 'any' ||
    filter.milestones.length > 0 ||
    Boolean(filter.noInitiatives) ||
    Boolean(filter.template) ||
    Boolean(filter.specificProject)
  );
}

export function countActiveFilters(filter: BoardFilter): number {
  return (
    (filter.query.trim() ? 1 : 0) +
    (filter.aiQuery?.trim() ? 1 : 0) +
    filter.status.length +
    filter.priorities.length +
    filter.labelIds.length +
    filter.leadIds.length +
    filter.memberIds.length +
    filter.creatorIds.length +
    filter.health.length +
    (filter.due === 'any' ? 0 : 1) +
    filter.milestones.length +
    (filter.noInitiatives ? 1 : 0) +
    (filter.template ? 1 : 0) +
    (filter.specificProject ? 1 : 0)
  );
}

/** Filters are ANDed across facets and ORed within one. */
export function matchesFilter(
  card: KanbanCard,
  filter: BoardFilter,
  labels: BoardLabel[],
  listId?: string,
): boolean {
  const query = filter.query.trim().toLowerCase();
  if (query) {
    const labelNames = card.labelIds
      .map((id) => labels.find((label) => label.id === id)?.name ?? '')
      .join(' ');
    const haystack = `${card.title} ${card.description} ${labelNames}`.toLowerCase();
    if (!haystack.includes(query)) return false;
  }

  // AI Prompt Natural Language Filter
  if (filter.aiQuery?.trim()) {
    const aiText = filter.aiQuery.trim().toLowerCase();
    const fullContent = `${card.title} ${card.description} ${card.priority} ${card.health || ''} ${card.milestone || ''}`.toLowerCase();

    // Check key phrases
    if (aiText.includes('urgent') && card.priority !== 'URGENT') return false;
    if (aiText.includes('high') && card.priority !== 'HIGH') return false;
    if (aiText.includes('overdue') && (!card.dueDate || daysUntil(card.dueDate) >= 0 || card.dueComplete)) return false;
    if (aiText.includes('at risk') && card.health !== 'AT_RISK') return false;
    if (aiText.includes('on track') && card.health !== 'ON_TRACK') return false;

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
    filter.labelIds.length > 0 &&
    !filter.labelIds.some((id) => card.labelIds.includes(id))
  ) {
    return false;
  }

  if (
    filter.memberIds.length > 0 &&
    !filter.memberIds.some((id) => card.memberIds.includes(id))
  ) {
    return false;
  }

  if (filter.leadIds.length > 0 && card.leadId) {
    if (!filter.leadIds.includes(card.leadId)) return false;
  }

  if (filter.creatorIds.length > 0 && card.creatorId) {
    if (!filter.creatorIds.includes(card.creatorId)) return false;
  }

  if (filter.health.length > 0) {
    if (!card.health || !filter.health.includes(card.health)) return false;
  }

  if (filter.milestones.length > 0) {
    if (!card.milestone || !filter.milestones.includes(card.milestone)) return false;
  }

  if (filter.noInitiatives) {
    if (card.initiative) return false;
  }

  if (filter.template) {
    if (card.template !== filter.template) return false;
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

/* ------------------------------------------------------------ progress --- */

export function checklistProgress(card: KanbanCard): {
  done: number;
  total: number;
  complete: boolean;
} {
  const total = card.checklist.length;
  const done = card.checklist.filter((item) => item.done).length;
  return { done, total, complete: total > 0 && done === total };
}
