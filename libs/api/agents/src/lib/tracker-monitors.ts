import type { TrackerMonitor, TrackerMonitorType } from '@org/types';

/**
 * Tracker monitors — pure helpers shared by the `create_monitor` tool, the
 * coworkers API and the sweep that actually checks them
 * (`TrackerMonitorSweepService`). A monitor lives in its coworker's
 * `configuration.monitors`; this file decides what a monitor means and when it
 * is due, the sweep does the reading and reporting.
 */

export const MONITOR_TYPES: readonly TrackerMonitorType[] = [
  'task',
  'project',
  'metric',
  'event',
  'deadline',
  'status',
];

/** What a monitor's condition is checked as. */
export type MonitorCheck =
  | 'overdue'
  | 'due_soon'
  | 'completed'
  | 'changed'
  | 'project_progress'
  | 'unsupported';

/** Targets that mean "the whole workspace" rather than one project. */
const WHOLE_WORKSPACE = /^(\*|all|all tasks|all projects|everything|workspace|the workspace|my tasks|tasks|projects)?$/i;

export function isWholeWorkspaceTarget(target: string | null | undefined): boolean {
  return WHOLE_WORKSPACE.test((target ?? '').trim());
}

/**
 * Reads a monitor's free-text condition as one deterministic check. The
 * wording comes from people and models ("becomes overdue", "anything past its
 * deadline", "when tasks are finished"), so this matches on meaning words, and
 * says `unsupported` rather than guessing — an unsupported monitor is shown as
 * such instead of silently never firing.
 */
export function classifyMonitor(monitor: Pick<TrackerMonitor, 'type' | 'condition'>): MonitorCheck {
  const text = `${monitor.condition ?? ''}`.toLowerCase();
  if (/overdue|past due|\blate\b|missed|deadline passed|behind schedule/.test(text)) return 'overdue';
  if (/due soon|upcoming|approaching|due (today|tomorrow)|about to be due|nearing/.test(text)) return 'due_soon';
  if (/complete|completed|done|finish|closed|resolved/.test(text)) return 'completed';
  if (/progress|health|at risk|off track|summary|report|milestone/.test(text)) return 'project_progress';
  if (/status|change|update|moved|assign/.test(text)) return 'changed';
  switch (monitor.type) {
    case 'deadline':
      return 'overdue';
    case 'project':
      return 'project_progress';
    case 'status':
    case 'task':
      return 'changed';
    default:
      return 'unsupported';
  }
}

const FREQUENCY_MINUTES: Record<string, number> = {
  realtime: 5,
  continuous: 5,
  hourly: 60,
  daily: 1_440,
  weekly: 10_080,
};

/** Minutes between checks: an explicit interval wins, then the frequency word. */
export function monitorIntervalMinutes(monitor: Pick<TrackerMonitor, 'frequency' | 'intervalMinutes'>): number {
  if (typeof monitor.intervalMinutes === 'number' && monitor.intervalMinutes >= 5) {
    return Math.min(monitor.intervalMinutes, 10_080);
  }
  const word = (monitor.frequency ?? '').toLowerCase().trim();
  return FREQUENCY_MINUTES[word] ?? 60;
}

/** Whether an enabled monitor should be checked at `now`. */
export function isMonitorDue(monitor: TrackerMonitor, now: Date): boolean {
  if (!monitor.enabled) return false;
  if (!monitor.lastCheckedAt) return true;
  const last = Date.parse(monitor.lastCheckedAt);
  if (Number.isNaN(last)) return true;
  // A little slack so a 5-minute sweep does not skip a 5-minute monitor.
  return now.getTime() - last >= monitorIntervalMinutes(monitor) * 60_000 - 30_000;
}

export interface MonitorInput {
  name?: string | null;
  type?: string | null;
  target?: string | null;
  condition?: string | null;
  frequency?: string | null;
  intervalMinutes?: number | null;
  destinations?: unknown;
  enabled?: boolean | null;
}

/**
 * One well-formed monitor from loose input. `lastCheckedAt` starts empty so
 * the first sweep reports everything already matching (e.g. every task that is
 * overdue now), and later sweeps only what is new.
 */
export function buildTrackerMonitor(
  input: MonitorInput,
  ids: { workspaceId: string; coworkerId: string; createdBy: string | null },
  now = new Date(),
): TrackerMonitor {
  const type = (MONITOR_TYPES as readonly string[]).includes(String(input.type))
    ? (input.type as TrackerMonitorType)
    : 'task';
  const target = (input.target ?? '').trim() || 'All tasks';
  const condition = (input.condition ?? '').trim() || 'becomes overdue';
  const destinations = Array.isArray(input.destinations)
    ? input.destinations.filter((d): d is string => typeof d === 'string' && d.trim().length > 0).map((d) => d.trim())
    : typeof input.destinations === 'string' && input.destinations.trim()
      ? [input.destinations.trim()]
      : [];
  return {
    id: `mon-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    workspaceId: ids.workspaceId,
    coworkerId: ids.coworkerId,
    name: (input.name ?? '').trim() || `${target} — ${condition}`.slice(0, 120),
    type,
    target,
    condition,
    frequency: (input.frequency ?? '').trim() || 'hourly',
    ...(typeof input.intervalMinutes === 'number' ? { intervalMinutes: input.intervalMinutes } : {}),
    destinations: destinations.length ? destinations : ['me'],
    enabled: input.enabled ?? true,
    lastCheckedAt: null,
    lastTriggeredAt: null,
    lastResult: null,
    lastError: null,
    createdBy: ids.createdBy,
    createdAt: now.toISOString(),
  };
}

/** Where a monitor's findings go. */
export interface MonitorDestinations {
  /** The person who set it up. */
  owner: boolean;
  /** Each task's assignees, about their own tasks. */
  assignees: boolean;
  /** Channel names (without `#`) or ids to post a summary into. */
  channels: string[];
}

export function parseMonitorDestinations(destinations: readonly string[] | undefined): MonitorDestinations {
  const out: MonitorDestinations = { owner: false, assignees: false, channels: [] };
  for (const raw of destinations ?? []) {
    const d = raw.trim();
    const lower = d.toLowerCase();
    if (!d) continue;
    if (d.startsWith('#')) out.channels.push(d.slice(1));
    else if (/^(assignees?|team|owners|the team|everyone assigned)$/.test(lower)) out.assignees = true;
    else if (/^channel:/.test(lower)) out.channels.push(d.slice('channel:'.length));
    else out.owner = true;
  }
  if (!out.owner && !out.assignees && out.channels.length === 0) out.owner = true;
  return out;
}

/** "3 days" / "5 hours" since a due date. */
export function describeLateness(due: Date, now: Date): string {
  const hours = Math.max(0, Math.floor((now.getTime() - due.getTime()) / 3_600_000));
  if (hours < 1) return 'just now';
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}
