import type { CoworkerPermissions } from './automation.js';

/**
 * The reusable AI Coworker framework's template catalog.
 *
 * A coworker is an `AIAgent` row with `type: 'coworker'`. A template is what
 * one starts from: identity, instructions, the platform tools it may read with
 * (`tools`), the writes it is granted (`permissions.allowActions` — the runtime
 * only ever offers writes listed there), and the other coworkers it may hand
 * work to (`configuration.collaborators`). Scheduler and Tracker are seeded
 * into every workspace; later coworkers (Researcher, Writer, Analyst…) are
 * added here as templates, not as new code paths.
 */
export type CoworkerTemplateKey = 'scheduler' | 'tracker';

export interface CoworkerTemplate {
  key: CoworkerTemplateKey;
  name: string;
  role: string;
  description: string;
  personality: string;
  welcomeMessage: string;
  systemPrompt: string;
  systemInstructions: string;
  /** Every tool name the coworker may be offered, reads and writes. */
  tools: readonly string[];
  permissions: CoworkerPermissions & Record<string, unknown>;
  capabilities: readonly string[];
  /** Template keys of the coworkers it may hand work to. */
  collaborators: readonly CoworkerTemplateKey[];
  /** Seeded into every workspace. */
  seedByDefault: boolean;
}

export const COWORKER_TEMPLATES: readonly CoworkerTemplate[] = [
  {
    key: 'scheduler',
    name: 'Scheduler',
    role: 'Scheduling & Coordination',
    description:
      'Helps the workspace schedule reminders, recurring work, deadlines, follow-ups, and scheduled workflows.',
    personality:
      'Organized, punctual, clear, and proactive. Helps track deadlines, meetings, and recurring work across the workspace.',
    welcomeMessage:
      'Hi! I am Scheduler, your AI coworker for reminders, deadlines, recurring work, and scheduled workflows. How can I help coordinate your schedule today?',
    systemPrompt:
      'You are Scheduler, an AI Coworker specialized in workspace scheduling, reminders, recurring work, deadlines, follow-ups, and scheduled workflows.',
    systemInstructions:
      'Coordinate scheduling, reminders, recurring work, and deadlines. Use available tools to create reminders, inspect tasks, follow up on assigned work, and report scheduled activity. Always verify timing and permissions with the user before committing scheduled workflows. When the request is about watching progress or catching overdue work over time, hand it to Tracker.',
    tools: [
      'create_reminder',
      'list_reminders',
      'find_tasks',
      'create_task',
      'update_task',
      'list_tasks',
      'list_meetings',
      'list_projects',
      'list_channels',
      'search_docs',
      'read_doc',
      'notify_user',
    ],
    permissions: {
      knowledgeAccess: true,
      allowActions: ['create_reminder', 'create_task', 'update_task', 'notify_user'],
      remindersAccess: true,
      calendarAccess: true,
      taskAccess: true,
    },
    capabilities: [
      'Create reminders',
      'Schedule tasks',
      'Run on recurring schedules',
      'Track deadlines',
      'Follow up on assigned work',
      'Report scheduled activity',
      'Hand monitoring work to Tracker',
    ],
    collaborators: ['tracker'],
    seedByDefault: true,
  },
  {
    key: 'tracker',
    name: 'Tracker',
    role: 'Monitoring & Tracking',
    description:
      'Monitors workspace activity, projects, tasks, metrics, and configured conditions and reports meaningful changes.',
    personality:
      'Vigilant, analytical, concise, and dependable. Watches for bottlenecks, overdue tasks, and milestone updates.',
    welcomeMessage:
      'Hello! I am Tracker, your AI coworker for monitoring workspace tasks, projects, metrics, and conditions. What would you like me to keep an eye on?',
    systemPrompt:
      'You are Tracker, an AI Coworker specialized in monitoring workspace activity, projects, tasks, metrics, events, and configured conditions.',
    systemInstructions:
      'Monitor workspace tasks, project status changes, and deadlines. Generate tracking summaries, detect meaningful changes or exceptions, and report them to the configured destination without unnecessary noise. Use create_monitor for anything to watch over time — monitors are checked automatically on their schedule. Hand reminders and time-based follow-ups to Scheduler.',
    tools: [
      'find_tasks',
      'list_tasks',
      'get_project_overview',
      'list_projects',
      'get_activity',
      'create_task',
      'update_task',
      'search_docs',
      'read_doc',
      'notify_user',
      'list_channels',
      'create_monitor',
      'list_monitors',
    ],
    permissions: {
      knowledgeAccess: true,
      allowActions: ['create_monitor', 'create_task', 'update_task', 'notify_user'],
      projectAccess: true,
      taskAccess: true,
      activityAccess: true,
    },
    capabilities: [
      'Monitor tasks',
      'Monitor projects',
      'Monitor status changes',
      'Detect overdue work',
      'Report exceptions',
      'Generate tracking summaries',
      'Hand reminders to Scheduler',
    ],
    collaborators: ['scheduler'],
    seedByDefault: true,
  },
];

export function getCoworkerTemplate(key: unknown): CoworkerTemplate | undefined {
  return COWORKER_TEMPLATES.find((t) => t.key === key);
}

/** The template key a coworker was created from (`configuration.coworkerType`). */
export function coworkerTemplateKey(configuration: unknown): CoworkerTemplateKey | undefined {
  if (!configuration || typeof configuration !== 'object') return undefined;
  const key = (configuration as Record<string, unknown>)['coworkerType'];
  return getCoworkerTemplate(key)?.key;
}

/**
 * The coworkers one may hand work to, by id. Explicit ids in
 * `configuration.collaborators` win; a coworker from a template falls back to
 * the template's collaborators, resolved against the workspace's coworkers.
 * A coworker can never hand work to itself.
 */
export function resolveCoworkerCollaborators(
  self: { id: string; configuration: unknown },
  workspaceCoworkers: ReadonlyArray<{ id: string; configuration: unknown }>,
): string[] {
  const config =
    self.configuration && typeof self.configuration === 'object'
      ? (self.configuration as Record<string, unknown>)
      : {};
  const explicit = config['collaborators'];
  let wanted: (c: { id: string; configuration: unknown }) => boolean;
  if (Array.isArray(explicit)) {
    const ids = new Set(explicit.filter((v): v is string => typeof v === 'string'));
    wanted = (c) => ids.has(c.id) || ids.has(coworkerTemplateKey(c.configuration) ?? '');
  } else {
    const template = getCoworkerTemplate(config['coworkerType']);
    if (!template) return [];
    const keys = new Set<string>(template.collaborators);
    wanted = (c) => keys.has(coworkerTemplateKey(c.configuration) ?? '');
  }
  return workspaceCoworkers.filter((c) => c.id !== self.id && wanted(c)).map((c) => c.id);
}
