import type { PublicUser, TaskComment, WorkItemActivity } from '@org/types';
import { KANBAN_PRIORITIES, KANBAN_STATUSES } from '../kanban-custom-store.js';
import { knownState } from '../task-states.js';
import { formatMinutes } from '../relation-meta.js';

/** Resolves the ids a history row stores into the names people recognise. */
export interface ActivityLookups {
  memberName: (id: string) => string | undefined;
  /** A team, epic, module or cycle, by the field that points at it. */
  refName: (field: string, id: string) => string | undefined;
  taskName: (id: string) => string | undefined;
}

const REF_FIELD_NOUN: Record<string, string> = {
  teamId: 'team',
  epicId: 'epic',
  moduleId: 'module',
  cycleId: 'cycle',
};

function statusLabel(value: string | null): string {
  // History rows store state ids; the workflow names custom ones.
  return (
    knownState(value)?.name ??
    KANBAN_STATUSES.find((s) => s.id === value)?.label ??
    (value ? 'a removed status' : 'none')
  );
}

function priorityLabel(value: string | null): string {
  return (
    KANBAN_PRIORITIES.find((p) => p.id === value)?.label ?? value ?? 'none'
  );
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function parseList(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * The old and new value of a row. Older rows kept them inside `metadata`, which
 * was itself stored as a JSON string, rather than in the columns.
 */
function valuesOf(activity: WorkItemActivity): {
  oldValue: string | null;
  newValue: string | null;
} {
  let metadata: Record<string, unknown> = {};
  if (typeof activity.metadata === 'string') {
    try {
      metadata = JSON.parse(activity.metadata) as Record<string, unknown>;
    } catch {
      metadata = {};
    }
  } else if (activity.metadata) {
    metadata = activity.metadata;
  }
  const text = (value: unknown) =>
    typeof value === 'string' && value ? value : null;
  return {
    oldValue: activity.oldValue ?? text(metadata['oldValue']),
    newValue: activity.newValue ?? text(metadata['newValue']),
  };
}

function describeAssignees(
  oldValue: string | null,
  newValue: string | null,
  lookups: ActivityLookups,
): string {
  const before = oldValue?.split(',').filter(Boolean) ?? [];
  const after = newValue?.split(',').filter(Boolean) ?? [];
  const name = (id: string) => lookups.memberName(id) ?? 'someone';
  const added = after.filter((id) => !before.includes(id)).map(name);
  const removed = before.filter((id) => !after.includes(id)).map(name);
  const parts = [
    added.length > 0 ? `assigned ${joinNames(added)}` : '',
    removed.length > 0 ? `unassigned ${joinNames(removed)}` : '',
  ].filter(Boolean);
  return parts.join(' and ') || 'changed the assignees';
}

function describeLabels(
  oldValue: string | null,
  newValue: string | null,
): string {
  const before = parseList(oldValue);
  const after = parseList(newValue);
  const added = after.filter((label) => !before.includes(label));
  const removed = before.filter((label) => !after.includes(label));
  const tags = (names: string[]) =>
    `the ${names.length === 1 ? 'tag' : 'tags'} ${joinNames(names)}`;
  const parts = [
    added.length > 0 ? `added ${tags(added)}` : '',
    removed.length > 0 ? `removed ${tags(removed)}` : '',
  ].filter(Boolean);
  return parts.join(' and ') || 'changed the tags';
}

function describeTime(
  oldValue: string | null,
  newValue: string | null,
): string {
  const before = Number(oldValue ?? 0);
  const after = Number(newValue ?? 0);
  if (after <= 0) return 'cleared the logged time';
  if (after > before) return `logged ${formatMinutes(after - before)}`;
  return `changed the logged time to ${formatMinutes(after)}`;
}

function describeField(
  field: string,
  oldValue: string | null,
  newValue: string | null,
  lookups: ActivityLookups,
): string {
  const noun = REF_FIELD_NOUN[field];
  if (noun) {
    if (!newValue) return `removed the ${noun}`;
    const name = lookups.refName(field, newValue);
    return name ? `set the ${noun} to ${name}` : `changed the ${noun}`;
  }

  switch (field) {
    case 'title':
      return `renamed this to “${newValue ?? ''}”`;
    case 'description':
      return 'updated the description';
    case 'type':
      return `changed the type to ${(newValue ?? 'task').toLowerCase()}`;
    case 'startDate':
      return newValue
        ? `set the start date to ${shortDate(newValue)}`
        : 'cleared the start date';
    case 'dueDate':
      return newValue
        ? `set the due date to ${shortDate(newValue)}`
        : 'cleared the due date';
    case 'estimate':
      return newValue
        ? `set the estimate to ${newValue} pts`
        : 'cleared the estimate';
    case 'timeSpent':
      return describeTime(oldValue, newValue);
    case 'labels':
      return describeLabels(oldValue, newValue);
    case 'reporterId': {
      if (!newValue) return 'removed the reporter';
      const reporter = lookups.memberName(newValue);
      return reporter
        ? `set the reporter to ${reporter}`
        : 'changed the reporter';
    }
    case 'parentId': {
      if (!newValue) return 'removed the parent';
      const parent = lookups.taskName(newValue);
      return parent ? `moved this under ${parent}` : 'changed the parent';
    }
    default:
      return `updated ${field}`;
  }
}

/**
 * One history row as the sentence after the actor's name, or `null` for a row
 * the feed doesn't show. Comments are their own entries, so `COMMENTED` is one.
 */
export function describeActivity(
  activity: WorkItemActivity,
  lookups: ActivityLookups,
): string | null {
  const { oldValue, newValue } = valuesOf(activity);

  switch (activity.action) {
    case 'CREATED':
      return 'created this task';
    case 'STATUS_CHANGED':
      return `moved this from ${statusLabel(oldValue)} to ${statusLabel(newValue)}`;
    case 'PRIORITY_CHANGED':
      return `changed the priority from ${priorityLabel(oldValue)} to ${priorityLabel(newValue)}`;
    case 'ASSIGNED':
      return describeAssignees(oldValue, newValue, lookups);
    case 'RELATIONS_CHANGED':
      if (newValue) return `linked ${newValue}`;
      if (oldValue) return `removed the link to ${oldValue}`;
      return 'changed the linked tasks';
    case 'FIELD_CHANGED':
      return activity.fieldChanged
        ? describeField(activity.fieldChanged, oldValue, newValue, lookups)
        : null;
    default:
      return null;
  }
}

export type ActivityFilter = 'all' | 'comments' | 'history';

export type TimelineEntry =
  | { kind: 'comment'; id: string; at: string; comment: TaskComment }
  | {
      kind: 'history';
      id: string;
      at: string;
      actor: PublicUser | null;
      text: string;
    };

/** Comments and history as one thread, oldest first, so the newest sits by the composer. */
export function buildTimeline(
  comments: readonly TaskComment[],
  activities: readonly WorkItemActivity[],
  lookups: ActivityLookups,
  filter: ActivityFilter,
  query: string,
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  if (filter !== 'history') {
    for (const comment of comments) {
      entries.push({
        kind: 'comment',
        id: comment.id,
        at: comment.createdAt,
        comment,
      });
    }
  }

  if (filter !== 'comments') {
    for (const activity of activities) {
      const text = describeActivity(activity, lookups);
      if (text) {
        entries.push({
          kind: 'history',
          id: activity.id,
          at: activity.createdAt,
          actor: activity.actor ?? null,
          text,
        });
      }
    }
  }

  const needle = query.trim().toLowerCase();
  const matches = (entry: TimelineEntry) => {
    if (!needle) return true;
    const author =
      entry.kind === 'comment' ? entry.comment.author : entry.actor;
    const body = entry.kind === 'comment' ? entry.comment.content : entry.text;
    const name = author?.displayName ?? author?.name ?? '';
    return `${name} ${body}`.toLowerCase().includes(needle);
  };

  return entries.filter(matches).sort((a, b) => a.at.localeCompare(b.at));
}
