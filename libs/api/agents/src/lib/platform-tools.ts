import type { EventEmitter2 } from '@nestjs/event-emitter';
import { AppEvent, currentAgentRun, type AiAgentMessageEvent } from '@org/api-common';
import type { PrismaService } from '@org/database';
import type { IntegrationsService } from '@org/api-integrations';
import type { IntegrationMessage } from '@org/types';
import { startOfZonedDay, zonedParts } from '@org/utils';
import { docContentToText, markdownToDocContent } from './doc-markdown.js';

/**
 * The platform's own data as agent tools: tasks, projects, meetings and the
 * calendar, activity, docs, email and in-app notifications.
 *
 * Every tool acts for the agent's owner (`actingUserId`) and sees only what
 * that person could see in the app: their meetings, docs that are shared or
 * theirs, channels they belong to, their connected accounts. Results are
 * compact JSON with a workspace-relative `link` per item, so a report can cite
 * its sources and the Studio can show them.
 */

export interface PlatformToolContext {
  workspaceId: string;
  actingUserId: string | null;
  /** The zone "today" is read in. Falls back to the acting user's profile zone. */
  timezone?: string | null;
}

export interface PlatformToolDeps {
  prisma: PrismaService;
  integrations?: IntegrationsService;
  events?: EventEmitter2;
  /** Creates a doc through `WorkToolsService`, so it is announced like one made in the app. */
  createDocument?: (
    workspaceId: string,
    authorId: string,
    input: { title: string; content: string; parentId: string | null; kind: 'DOC' | 'WIKI' },
  ) => Promise<{ id: string; title: string }>;
  /** Creates a task through `WorkToolsService`, so it gets an identifier and events. */
  createTask?: (
    workspaceId: string,
    input: Record<string, unknown>,
    actorId: string,
  ) => Promise<{ id: string; identifier: string | null; title: string; projectId: string | null }>;
  updateTask?: (
    workspaceId: string,
    taskId: string,
    input: Record<string, unknown>,
    actorId: string,
  ) => Promise<{ id: string; identifier: string | null; title: string; status: string }>;
}

export interface PlatformToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  /** Parameters the model may leave out. Everything else is required. */
  optional?: string[];
  handler: (params: any, ctx: PlatformToolContext) => Promise<unknown>;
}

/* ----------------------------------------------------------------- time -- */

type RangeName =
  | 'today'
  | 'yesterday'
  | 'tomorrow'
  | 'this_week'
  | 'last_7_days'
  | 'next_7_days'
  | 'this_month'
  | 'last_30_days';

const RANGES: readonly RangeName[] = [
  'today',
  'yesterday',
  'tomorrow',
  'this_week',
  'last_7_days',
  'next_7_days',
  'this_month',
  'last_30_days',
];

const DAY = 86_400_000;

export function resolveRange(range: string | undefined, timeZone: string, now = new Date()): { from: Date; to: Date; label: string } {
  const name = (RANGES as readonly string[]).includes(range ?? '') ? (range as RangeName) : 'today';
  const today = startOfZonedDay(now, timeZone);
  switch (name) {
    case 'yesterday':
      return { from: new Date(today.getTime() - DAY), to: today, label: 'yesterday' };
    case 'tomorrow':
      return { from: new Date(today.getTime() + DAY), to: new Date(today.getTime() + 2 * DAY), label: 'tomorrow' };
    case 'this_week': {
      const weekday = zonedParts(now, timeZone).weekday;
      const monday = new Date(today.getTime() - ((weekday + 6) % 7) * DAY);
      return { from: monday, to: new Date(monday.getTime() + 7 * DAY), label: 'this week' };
    }
    case 'last_7_days':
      return { from: new Date(today.getTime() - 6 * DAY), to: new Date(today.getTime() + DAY), label: 'the last 7 days' };
    case 'next_7_days':
      return { from: today, to: new Date(today.getTime() + 7 * DAY), label: 'the next 7 days' };
    case 'this_month': {
      const p = zonedParts(now, timeZone);
      const first = new Date(today.getTime() - (p.day - 1) * DAY);
      return { from: first, to: new Date(today.getTime() + DAY), label: 'this month' };
    }
    case 'last_30_days':
      return { from: new Date(today.getTime() - 29 * DAY), to: new Date(today.getTime() + DAY), label: 'the last 30 days' };
    default:
      return { from: today, to: new Date(today.getTime() + DAY), label: 'today' };
  }
}

/** A range name or an ISO date/datetime, as the instant it starts. */
function sinceInstant(value: unknown, timeZone: string): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  if ((RANGES as readonly string[]).includes(value)) return resolveRange(value, timeZone).from;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isoDay(date: Date | null | undefined): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

function clamp(value: unknown, fallback: number, max: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : fallback;
}

function truthy(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null || value === '') return fallback;
  return value === true || value === 'true' || value === 1;
}

/** Empty-string params (an unfilled `{{params.projectId}}`) mean "not given". */
function given(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

const OPEN_STATUSES = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW'] as const;
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

function actingUser(ctx: PlatformToolContext): string {
  if (!ctx.actingUserId) {
    throw new Error('This tool acts for the agent’s owner, but the agent has no owner on record.');
  }
  return ctx.actingUserId;
}

async function zoneFor(prisma: PrismaService, ctx: PlatformToolContext): Promise<string> {
  if (ctx.timezone) return ctx.timezone;
  if (!ctx.actingUserId) return 'UTC';
  const user = await prisma.user.findUnique({ where: { id: ctx.actingUserId }, select: { timezone: true } });
  return user?.timezone || 'UTC';
}

function personName(user: { name: string; displayName?: string | null } | null | undefined): string | null {
  return user ? user.displayName || user.name : null;
}

/* ---------------------------------------------------------------- tools -- */

const TASK_SELECT = {
  id: true,
  identifier: true,
  title: true,
  status: true,
  priority: true,
  dueDate: true,
  completedAt: true,
  updatedAt: true,
  timeSpent: true,
  labels: true,
  projectId: true,
  project: { select: { name: true } },
  assignee: { select: { name: true, displayName: true } },
  sourceRelations: {
    where: { type: 'BLOCKED_BY' as const },
    select: { target: { select: { identifier: true, title: true, status: true } } },
  },
  targetRelations: {
    where: { type: 'BLOCKS' as const },
    select: { source: { select: { identifier: true, title: true, status: true } } },
  },
};

type TaskRow = {
  id: string;
  identifier: string | null;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  completedAt: Date | null;
  updatedAt: Date;
  timeSpent: number | null;
  labels: string[];
  projectId: string | null;
  project: { name: string } | null;
  assignee: { name: string; displayName: string | null } | null;
  sourceRelations: Array<{ target: { identifier: string | null; title: string; status: string } }>;
  targetRelations: Array<{ source: { identifier: string | null; title: string; status: string } }>;
};

function taskView(t: TaskRow, now = new Date()) {
  const open = (OPEN_STATUSES as readonly string[]).includes(t.status);
  const blockers = [
    ...t.sourceRelations.map((r) => r.target),
    ...t.targetRelations.map((r) => r.source),
  ].filter((b) => b.status !== 'DONE' && b.status !== 'CANCELLED');
  const labelledBlocked = t.labels.some((l) => /block/i.test(l));
  return {
    id: t.id,
    identifier: t.identifier,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: isoDay(t.dueDate),
    overdue: open && !!t.dueDate && t.dueDate.getTime() < now.getTime(),
    completedAt: t.completedAt?.toISOString() ?? null,
    updatedAt: t.updatedAt.toISOString(),
    project: t.project?.name ?? null,
    assignee: personName(t.assignee),
    timeSpentMinutes: t.timeSpent ?? null,
    labels: t.labels,
    blocked: open && (blockers.length > 0 || labelledBlocked),
    blockedBy: blockers.map((b) => ({ identifier: b.identifier, title: b.title, status: b.status })),
    link: `tasks?taskId=${t.id}`,
  };
}

export function buildPlatformTools(deps: PlatformToolDeps): PlatformToolDefinition[] {
  const { prisma } = deps;

  const assertMember = async (workspaceId: string, userId: string) => {
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!member) throw new Error('The agent’s owner is no longer an active member of this workspace.');
  };

  const findTasks: PlatformToolDefinition = {
    name: 'find_tasks',
    description:
      'Find tasks with filters: whose they are, open/done, overdue, due soon, completed or updated since a time, by project or priority. Returns each task with status, due date, project, assignee, time spent and what blocks it.',
    parameters: {
      assignee: { type: 'string', description: '"me" (default) for the owner’s tasks, or "anyone".' },
      status: { type: 'string', enum: ['open', 'done', 'all'], description: 'Default "open".' },
      overdue: { type: 'boolean', description: 'Only open tasks past their due date.' },
      dueWithinDays: { type: 'number', description: 'Only tasks due within this many days.' },
      completedSince: { type: 'string', description: 'today, yesterday, this_week, last_7_days… or an ISO date.' },
      updatedSince: { type: 'string', description: 'today, this_week… or an ISO date.' },
      projectId: { type: 'string' },
      priority: { type: 'string', enum: [...PRIORITIES] },
      taskId: { type: 'string', description: 'Fetch one task by id.' },
      limit: { type: 'number', description: 'Default 30, at most 100.' },
    },
    optional: ['assignee', 'status', 'overdue', 'dueWithinDays', 'completedSince', 'updatedSince', 'projectId', 'priority', 'taskId', 'limit'],
    handler: async (p: Record<string, unknown>, ctx) => {
      const tz = await zoneFor(prisma, ctx);
      const now = new Date();
      const me = ctx.actingUserId;
      const status = p['status'] === 'done' || p['status'] === 'all' ? (p['status'] as string) : 'open';
      const mine = (given(p['assignee']) ?? 'me') === 'me';
      const and: Record<string, unknown>[] = [{ workspaceId: ctx.workspaceId, deletedAt: null }];
      const taskId = given(p['taskId']);
      if (taskId) and.push({ id: taskId });
      if (mine && me && !taskId) and.push({ OR: [{ assigneeId: me }, { assigneeIds: { has: me } }] });
      if (status === 'open') and.push({ status: { in: [...OPEN_STATUSES] } });
      if (status === 'done') and.push({ status: 'DONE' });
      if (truthy(p['overdue'], false)) and.push({ dueDate: { lt: now }, status: { in: [...OPEN_STATUSES] } });
      if (p['dueWithinDays'] !== undefined && p['dueWithinDays'] !== '') {
        const days = clamp(p['dueWithinDays'], 7, 365);
        and.push({ dueDate: { gte: startOfZonedDay(now, tz), lt: new Date(startOfZonedDay(now, tz).getTime() + (days + 1) * DAY) } });
      }
      const completedSince = sinceInstant(p['completedSince'], tz);
      if (completedSince) and.push({ completedAt: { gte: completedSince } });
      const updatedSince = sinceInstant(p['updatedSince'], tz);
      if (updatedSince) and.push({ updatedAt: { gte: updatedSince } });
      const projectId = given(p['projectId']);
      if (projectId) and.push({ projectId });
      const priority = given(p['priority'])?.toUpperCase();
      if (priority && (PRIORITIES as readonly string[]).includes(priority)) and.push({ priority });

      const limit = clamp(p['limit'], 30, 100);
      const rows = (await prisma.task.findMany({
        where: { AND: and } as never,
        select: TASK_SELECT,
        orderBy: [{ priority: 'desc' }, { dueDate: { sort: 'asc', nulls: 'last' } }, { updatedAt: 'desc' }],
        take: limit,
      })) as unknown as TaskRow[];
      const tasks = rows.map((row) => taskView(row, now));
      return {
        count: tasks.length,
        truncated: tasks.length === limit,
        filter: {
          whose: mine ? 'the owner’s tasks' : 'anyone’s tasks',
          status,
          ...(completedSince ? { completedSince: completedSince.toISOString() } : {}),
          ...(updatedSince ? { updatedSince: updatedSince.toISOString() } : {}),
        },
        totalTimeSpentMinutes: tasks.reduce((sum, t) => sum + (t.timeSpentMinutes ?? 0), 0),
        tasks,
      };
    },
  };

  const listMeetings: PlatformToolDefinition = {
    name: 'list_meetings',
    description:
      'Meetings the owner organises or attends in a time range (or one meeting by id), with agenda, notes, decisions and action items, plus calendar events without a meeting.',
    parameters: {
      range: { type: 'string', enum: [...RANGES], description: 'Default "today".' },
      meetingId: { type: 'string' },
      includeNotes: { type: 'boolean', description: 'Include notes and decisions. Default true.' },
    },
    optional: ['range', 'meetingId', 'includeNotes'],
    handler: async (p: Record<string, unknown>, ctx) => {
      const me = actingUser(ctx);
      const tz = await zoneFor(prisma, ctx);
      const window = resolveRange(given(p['range']) ?? 'today', tz);
      const includeNotes = truthy(p['includeNotes'], true);
      const meetingId = given(p['meetingId']);
      const visible = { OR: [{ organizerId: me }, { participants: { some: { userId: me } } }] };
      const meetings = await prisma.meeting.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          deletedAt: null,
          ...visible,
          ...(meetingId ? { id: meetingId } : { startAt: { gte: window.from, lt: window.to } }),
        },
        orderBy: { startAt: 'asc' },
        take: 30,
        select: {
          id: true,
          title: true,
          description: true,
          agenda: true,
          location: true,
          status: true,
          startAt: true,
          endAt: true,
          endedAt: true,
          project: { select: { name: true } },
          organizer: { select: { name: true, displayName: true } },
          participants: { select: { rsvp: true, user: { select: { name: true, displayName: true } } } },
          ...(includeNotes
            ? {
                notes: { orderBy: { createdAt: 'asc' as const }, take: 30, select: { body: true, author: { select: { name: true, displayName: true } } } },
                decisions: { orderBy: { createdAt: 'asc' as const }, take: 30, select: { text: true } },
              }
            : {}),
          actionItems: {
            where: { deletedAt: null },
            take: 30,
            select: { identifier: true, title: true, status: true, dueDate: true, assignee: { select: { name: true, displayName: true } } },
          },
        },
      });
      const calendar = meetingId
        ? []
        : await prisma.calendarEvent.findMany({
            where: { workspaceId: ctx.workspaceId, organizerId: me, deletedAt: null, meeting: null, startAt: { gte: window.from, lt: window.to } },
            orderBy: { startAt: 'asc' },
            take: 30,
            select: { id: true, title: true, description: true, location: true, startAt: true, endAt: true, isAllDay: true },
          });
      return {
        range: meetingId ? 'one meeting' : window.label,
        timezone: tz,
        count: meetings.length,
        meetings: meetings.map((m: any) => ({
          id: m.id,
          title: m.title,
          status: m.status,
          startAt: m.startAt.toISOString(),
          endAt: m.endAt.toISOString(),
          project: m.project?.name ?? null,
          organizer: personName(m.organizer),
          attendees: m.participants.map((x: any) => `${personName(x.user)} (${String(x.rsvp).toLowerCase()})`),
          agenda: m.agenda?.slice(0, 2_000) ?? null,
          description: m.description?.slice(0, 1_000) ?? null,
          ...(includeNotes
            ? {
                notes: (m.notes ?? []).map((n: any) => `${personName(n.author)}: ${String(n.body).slice(0, 1_500)}`),
                decisions: (m.decisions ?? []).map((d: any) => d.text),
              }
            : {}),
          actionItems: m.actionItems.map((t: any) => ({
            identifier: t.identifier,
            title: t.title,
            status: t.status,
            dueDate: isoDay(t.dueDate),
            owner: personName(t.assignee),
          })),
          link: `meetings?meetingId=${m.id}`,
        })),
        calendarEvents: calendar.map((e) => ({
          title: e.title,
          startAt: e.startAt.toISOString(),
          endAt: e.endAt.toISOString(),
          allDay: e.isAllDay,
          location: e.location,
        })),
      };
    },
  };

  const getActivity: PlatformToolDefinition = {
    name: 'get_activity',
    description:
      'What changed in a time range: task field changes (status, assignee, due date…) and workspace events (tasks created or completed, docs created, meetings ended). Mine only by default, or one project.',
    parameters: {
      range: { type: 'string', enum: [...RANGES], description: 'Default "today".' },
      projectId: { type: 'string' },
      mine: { type: 'boolean', description: 'Only changes by or to the owner. Default true.' },
    },
    optional: ['range', 'projectId', 'mine'],
    handler: async (p: Record<string, unknown>, ctx) => {
      const tz = await zoneFor(prisma, ctx);
      const window = resolveRange(given(p['range']) ?? 'today', tz);
      const projectId = given(p['projectId']);
      const me = ctx.actingUserId;
      const mine = truthy(p['mine'], !projectId) && !!me;
      const changes = await prisma.workItemActivity.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          createdAt: { gte: window.from, lt: window.to },
          ...(projectId ? { workItem: { projectId } } : {}),
          ...(mine ? { OR: [{ actorId: me! }, { workItem: { assigneeIds: { has: me! } } }] } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          action: true,
          fieldChanged: true,
          oldValue: true,
          newValue: true,
          createdAt: true,
          actor: { select: { name: true, displayName: true } },
          workItem: { select: { id: true, identifier: true, title: true } },
        },
      });
      const events = await prisma.recentActivity.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          kind: { not: 'MESSAGE' },
          occurredAt: { gte: window.from, lt: window.to },
          ...(mine ? { userId: me! } : {}),
        },
        orderBy: { occurredAt: 'desc' },
        take: 50,
        select: { kind: true, summary: true, resourceType: true, resourceId: true, occurredAt: true, user: { select: { name: true, displayName: true } } },
      });
      return {
        range: window.label,
        timezone: tz,
        changeCount: changes.length,
        changes: changes.map((c) => ({
          at: c.createdAt.toISOString(),
          by: personName(c.actor),
          task: c.workItem.identifier ? `${c.workItem.identifier} ${c.workItem.title}` : c.workItem.title,
          action: c.action,
          ...(c.fieldChanged ? { field: c.fieldChanged, from: c.oldValue, to: c.newValue } : {}),
          link: `tasks?taskId=${c.workItem.id}`,
        })),
        events: events.map((e) => ({
          at: e.occurredAt.toISOString(),
          kind: e.kind,
          by: personName(e.user),
          summary: e.summary,
          ...(e.resourceType === 'task' && e.resourceId ? { link: `tasks?taskId=${e.resourceId}` } : {}),
          ...(e.resourceType === 'document' && e.resourceId ? { link: `docs/${e.resourceId}` } : {}),
        })),
      };
    },
  };

  const projectOverview: PlatformToolDefinition = {
    name: 'get_project_overview',
    description:
      'A project’s status, health, deadlines, task counts, blocked tasks (with what blocks them), overdue and due-soon work, who holds open work, the latest status update and upcoming meetings. With no project, summarises every active project.',
    parameters: {
      projectId: { type: 'string' },
      projectName: { type: 'string', description: 'Used when no id is known.' },
    },
    optional: ['projectId', 'projectName'],
    handler: async (p: Record<string, unknown>, ctx) => {
      const now = new Date();
      const projectId = given(p['projectId']);
      const projectName = given(p['projectName']);
      const project = projectId || projectName
        ? await prisma.project.findFirst({
            where: {
              workspaceId: ctx.workspaceId,
              deletedAt: null,
              ...(projectId ? { id: projectId } : { name: { contains: projectName!, mode: 'insensitive' } }),
            },
            select: {
              id: true, name: true, description: true, status: true, health: true, healthScore: true,
              startDate: true, targetDate: true, lead: { select: { name: true, displayName: true } },
            },
          })
        : null;
      if ((projectId || projectName) && !project) {
        throw new Error(`No project matching “${projectId ?? projectName}” in this workspace.`);
      }

      if (!project) {
        const projects = await prisma.project.findMany({
          where: { workspaceId: ctx.workspaceId, deletedAt: null, status: { in: ['PLANNING', 'ACTIVE', 'ON_HOLD'] } },
          orderBy: [{ targetDate: { sort: 'asc', nulls: 'last' } }],
          take: 12,
          select: { id: true, name: true, status: true, health: true, targetDate: true },
        });
        const summaries = await Promise.all(
          projects.map(async (pr) => {
            const [open, done, overdue] = await Promise.all([
              prisma.task.count({ where: { projectId: pr.id, deletedAt: null, status: { in: [...OPEN_STATUSES] } } }),
              prisma.task.count({ where: { projectId: pr.id, deletedAt: null, status: 'DONE' } }),
              prisma.task.count({ where: { projectId: pr.id, deletedAt: null, status: { in: [...OPEN_STATUSES] }, dueDate: { lt: now } } }),
            ]);
            return {
              id: pr.id,
              name: pr.name,
              status: pr.status,
              health: pr.health,
              targetDate: isoDay(pr.targetDate),
              openTasks: open,
              doneTasks: done,
              overdueTasks: overdue,
              link: `tasks/${pr.id}`,
            };
          }),
        );
        return { scope: 'all active projects', count: summaries.length, projects: summaries };
      }

      const tasks = (await prisma.task.findMany({
        where: { projectId: project.id, deletedAt: null },
        select: TASK_SELECT,
        orderBy: [{ priority: 'desc' }, { dueDate: { sort: 'asc', nulls: 'last' } }],
        take: 400,
      })) as unknown as TaskRow[];
      const views = tasks.map((t) => taskView(t, now));
      const counts: Record<string, number> = {};
      for (const t of views) counts[t.status] = (counts[t.status] ?? 0) + 1;
      const open = views.filter((t) => (OPEN_STATUSES as readonly string[]).includes(t.status));
      const weekAhead = now.getTime() + 7 * DAY;
      const load: Record<string, number> = {};
      for (const t of open) {
        const who = t.assignee ?? 'Unassigned';
        load[who] = (load[who] ?? 0) + 1;
      }
      const [update, meetings] = await Promise.all([
        prisma.projectUpdate.findFirst({
          where: { projectId: project.id },
          orderBy: { createdAt: 'desc' },
          select: { title: true, status: true, blockersSummary: true, nextStepsSummary: true, createdAt: true },
        }),
        prisma.meeting.findMany({
          where: { projectId: project.id, deletedAt: null, startAt: { gte: now } },
          orderBy: { startAt: 'asc' },
          take: 5,
          select: { id: true, title: true, startAt: true },
        }),
      ]);
      const total = views.length;
      return {
        project: {
          id: project.id,
          name: project.name,
          description: project.description?.slice(0, 1_000) ?? null,
          status: project.status,
          health: project.health,
          healthScore: project.healthScore,
          startDate: isoDay(project.startDate),
          targetDate: isoDay(project.targetDate),
          daysToTarget: project.targetDate ? Math.ceil((project.targetDate.getTime() - now.getTime()) / DAY) : null,
          lead: personName(project.lead),
          link: `tasks/${project.id}`,
        },
        taskCounts: { total, ...counts },
        percentDone: total ? Math.round(((counts['DONE'] ?? 0) / total) * 100) : 0,
        blocked: open.filter((t) => t.blocked).slice(0, 20),
        overdue: open.filter((t) => t.overdue).slice(0, 20),
        dueThisWeek: open
          .filter((t) => !t.overdue && t.dueDate && new Date(t.dueDate).getTime() <= weekAhead)
          .slice(0, 15),
        recentlyCompleted: views
          .filter((t) => t.status === 'DONE' && t.completedAt && Date.parse(t.completedAt) >= now.getTime() - 7 * DAY)
          .slice(0, 10)
          .map((t) => ({ identifier: t.identifier, title: t.title, completedAt: t.completedAt })),
        openWorkByPerson: load,
        latestUpdate: update
          ? {
              title: update.title,
              health: update.status,
              blockers: update.blockersSummary,
              nextSteps: update.nextStepsSummary,
              at: update.createdAt.toISOString(),
            }
          : null,
        upcomingMeetings: meetings.map((m) => ({ title: m.title, startAt: m.startAt.toISOString(), link: `meetings?meetingId=${m.id}` })),
      };
    },
  };

  const readDoc: PlatformToolDefinition = {
    name: 'read_doc',
    description: 'Read one doc by id, or the best title match. Only docs shared with the workspace or written by the owner.',
    parameters: { docId: { type: 'string' }, title: { type: 'string' } },
    optional: ['docId', 'title'],
    handler: async (p: Record<string, unknown>, ctx) => {
      const docId = given(p['docId']);
      const title = given(p['title']);
      if (!docId && !title) throw new Error('Give a docId or a title to read.');
      const doc = await prisma.workDocument.findFirst({
        where: {
          workspaceId: ctx.workspaceId,
          deletedAt: null,
          OR: [{ isPublic: true }, ...(ctx.actingUserId ? [{ authorId: ctx.actingUserId }] : [])],
          ...(docId ? { id: docId } : { title: { contains: title!, mode: 'insensitive' } }),
        },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, title: true, content: true, updatedAt: true, author: { select: { name: true, displayName: true } } },
      });
      if (!doc) throw new Error(`No doc ${docId ? `with id ${docId}` : `titled like “${title}”`} that the owner can read.`);
      const limit = 15_000;
      const text = docContentToText(doc.content);
      return {
        id: doc.id,
        title: doc.title,
        author: personName(doc.author),
        updatedAt: doc.updatedAt.toISOString(),
        content: text.slice(0, limit),
        truncated: text.length > limit,
        link: `docs/${doc.id}`,
      };
    },
  };

  const searchDocs: PlatformToolDefinition = {
    name: 'search_docs',
    description: 'Search workspace docs by words in the title or body. Only docs shared with the workspace or written by the owner.',
    parameters: { query: { type: 'string' } },
    handler: async (p: { query?: string }, ctx) => {
      const query = given(p.query);
      if (!query) return { count: 0, docs: [] };
      const docs = await prisma.workDocument.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          deletedAt: null,
          AND: [
            { OR: [{ isPublic: true }, ...(ctx.actingUserId ? [{ authorId: ctx.actingUserId }] : [])] },
            { OR: [{ title: { contains: query, mode: 'insensitive' } }, { content: { contains: query, mode: 'insensitive' } }] },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take: 6,
        select: { id: true, title: true, content: true, updatedAt: true },
      });
      return {
        count: docs.length,
        docs: docs.map((d) => ({
          id: d.id,
          title: d.title,
          excerpt: docContentToText(d.content).slice(0, 1_200),
          updatedAt: d.updatedAt.toISOString(),
          link: `docs/${d.id}`,
        })),
      };
    },
  };

  /**
   * The Docs screen files pages under a root "folder" document, and opens only
   * pages — a root-level doc shows as an empty folder. So an agent's doc goes
   * into a folder: the one named, or a shared "AI agent docs" one.
   */
  const docFolder = async (workspaceId: string, me: string, name: string) => {
    const existing = await prisma.workDocument.findFirst({
      where: { workspaceId, parentId: null, deletedAt: null, title: { equals: name, mode: 'insensitive' } },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (existing) return existing.id;
    const folder = deps.createDocument
      ? await deps.createDocument(workspaceId, me, { title: name, content: '', parentId: null, kind: 'WIKI' })
      : await prisma.workDocument.create({ data: { workspaceId, authorId: me, title: name, content: '', kind: 'WIKI' }, select: { id: true, title: true } });
    return folder.id;
  };

  const createDoc: PlatformToolDefinition = {
    name: 'create_doc',
    description: 'Create a doc from a title and Markdown content (headings, lists, tables). Filed in the “AI agent docs” folder unless another folder is named.',
    parameters: { title: { type: 'string' }, content: { type: 'string' }, folder: { type: 'string', description: 'Folder name' } },
    optional: ['content', 'folder'],
    handler: async (p: Record<string, unknown>, ctx) => {
      const me = actingUser(ctx);
      await assertMember(ctx.workspaceId, me);
      const title = given(p['title'])?.split('\n')[0]?.slice(0, 250);
      if (!title) throw new Error('A doc needs a title.');
      const markdown = typeof p['content'] === 'string' ? p['content'] : p['content'] == null ? '' : JSON.stringify(p['content'], null, 2);
      const parentId = await docFolder(ctx.workspaceId, me, given(p['folder'])?.slice(0, 120) || 'AI agent docs');
      const input = { title, content: markdownToDocContent(markdown), parentId, kind: 'DOC' as const };
      const doc = deps.createDocument
        ? await deps.createDocument(ctx.workspaceId, me, input)
        : await prisma.workDocument.create({ data: { workspaceId: ctx.workspaceId, authorId: me, ...input }, select: { id: true, title: true } });
      return { created: true, id: doc.id, title: doc.title, link: `docs/${doc.id}` };
    },
  };

  const createTask: PlatformToolDefinition = {
    name: 'create_task',
    description: 'Create a task. Optionally in a project, with a priority, a due date (YYYY-MM-DD) and assigned to the owner.',
    parameters: {
      title: { type: 'string' },
      description: { type: 'string' },
      projectId: { type: 'string' },
      priority: { type: 'string', enum: [...PRIORITIES] },
      dueDate: { type: 'string', description: 'YYYY-MM-DD' },
      assignToMe: { type: 'boolean' },
    },
    optional: ['description', 'projectId', 'priority', 'dueDate', 'assignToMe'],
    handler: async (p: Record<string, unknown>, ctx) => {
      const me = actingUser(ctx);
      await assertMember(ctx.workspaceId, me);
      const created = await createOneTask(p, ctx.workspaceId, me);
      return { created: true, task: created };
    },
  };

  const createOneTask = async (p: Record<string, unknown>, workspaceId: string, me: string) => {
    const title = given(p['title'])?.split('\n')[0]?.slice(0, 250);
    if (!title) throw new Error('A task needs a title.');
    const projectId = given(p['projectId']);
    if (projectId) {
      const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId, deletedAt: null }, select: { id: true } });
      if (!project) throw new Error(`Project '${projectId}' does not exist in this workspace.`);
    }
    const priority = given(p['priority'])?.toUpperCase();
    const due = given(p['dueDate']);
    const dueDate = due && /^\d{4}-\d{2}-\d{2}/.test(due) && !Number.isNaN(Date.parse(due)) ? new Date(due).toISOString() : undefined;
    const run = currentAgentRun();
    const input: Record<string, unknown> = {
      title,
      ...(given(p['description']) ? { description: String(p['description']).slice(0, 10_000) } : {}),
      ...(projectId ? { projectId } : {}),
      ...(priority && (PRIORITIES as readonly string[]).includes(priority) ? { priority } : {}),
      ...(dueDate ? { dueDate } : {}),
      ...(truthy(p['assignToMe'], false) ? { assigneeId: me, assigneeIds: [me] } : {}),
      ...(run && !run.test
        ? { customFields: { createdByAgent: { name: run.agentName, workflowId: run.workflowId, runId: run.runId } } }
        : {}),
    };
    if (deps.createTask) {
      const task = await deps.createTask(workspaceId, input, me);
      return { id: task.id, identifier: task.identifier, title: task.title, link: `tasks?taskId=${task.id}` };
    }
    const task = await prisma.task.create({
      data: {
        workspaceId,
        title,
        description: (input['description'] as string | undefined) ?? null,
        projectId: projectId ?? null,
        reporterId: me,
        status: 'TODO',
        priority: (input['priority'] as never) ?? 'MEDIUM',
        ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
        ...(input['assigneeId'] ? { assigneeId: me, assigneeIds: [me] } : {}),
        ...(input['customFields'] ? { customFields: input['customFields'] as never } : {}),
      },
      select: { id: true, identifier: true, title: true },
    });
    return { ...task, link: `tasks?taskId=${task.id}` };
  };

  const createTasks: PlatformToolDefinition = {
    name: 'create_tasks',
    description:
      'Create several tasks at once from a list: a JSON array of {title, description?, priority?, dueDate?} (or a JSON string of one, or markdown "- " lines). Skips titles that already exist as open tasks.',
    parameters: {
      tasks: { type: 'array', items: { type: 'object' }, description: 'The tasks to create.' },
      projectId: { type: 'string' },
      assignToMe: { type: 'boolean' },
    },
    optional: ['projectId', 'assignToMe'],
    handler: async (p: Record<string, unknown>, ctx) => {
      const me = actingUser(ctx);
      await assertMember(ctx.workspaceId, me);
      const items = parseTaskList(p['tasks']).slice(0, 25);
      if (items.length === 0) return { created: 0, skipped: 0, tasks: [], note: 'There were no tasks in the list.' };
      const existing = await prisma.task.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          deletedAt: null,
          status: { in: [...OPEN_STATUSES] },
          title: { in: items.map((i) => i.title), mode: 'insensitive' },
        },
        select: { title: true },
      });
      const taken = new Set(existing.map((e) => e.title.toLowerCase()));
      const created: unknown[] = [];
      const skipped: string[] = [];
      for (const item of items) {
        if (taken.has(item.title.toLowerCase())) {
          skipped.push(item.title);
          continue;
        }
        taken.add(item.title.toLowerCase());
        created.push(
          await createOneTask(
            { ...item, projectId: p['projectId'], assignToMe: p['assignToMe'] },
            ctx.workspaceId,
            me,
          ),
        );
      }
      return { created: created.length, skipped: skipped.length, skippedTitles: skipped, tasks: created };
    },
  };

  const updateTask: PlatformToolDefinition = {
    name: 'update_task',
    description: 'Change a task’s status, priority or due date (YYYY-MM-DD).',
    parameters: {
      taskId: { type: 'string' },
      status: { type: 'string', enum: [...OPEN_STATUSES, 'DONE', 'CANCELLED'] },
      priority: { type: 'string', enum: [...PRIORITIES] },
      dueDate: { type: 'string' },
    },
    optional: ['status', 'priority', 'dueDate'],
    handler: async (p: Record<string, unknown>, ctx) => {
      const me = actingUser(ctx);
      await assertMember(ctx.workspaceId, me);
      const taskId = given(p['taskId']);
      if (!taskId) throw new Error('taskId is required.');
      const input: Record<string, unknown> = {};
      const status = given(p['status'])?.toUpperCase();
      if (status) input['status'] = status;
      const priority = given(p['priority'])?.toUpperCase();
      if (priority && (PRIORITIES as readonly string[]).includes(priority)) input['priority'] = priority;
      const due = given(p['dueDate']);
      if (due && !Number.isNaN(Date.parse(due))) input['dueDate'] = new Date(due).toISOString();
      if (Object.keys(input).length === 0) throw new Error('Nothing to change: give a status, priority or dueDate.');
      if (!deps.updateTask) throw new Error('Task updates are not available here.');
      const task = await deps.updateTask(ctx.workspaceId, taskId, input, me);
      return { updated: true, task: { id: task.id, identifier: task.identifier, title: task.title, status: task.status, link: `tasks?taskId=${task.id}` } };
    },
  };

  const notifyUser: PlatformToolDefinition = {
    name: 'notify_user',
    description: 'Send the agent’s owner an in-app notification with a short title and body.',
    parameters: { title: { type: 'string' }, body: { type: 'string' } },
    optional: ['body'],
    handler: async (p: Record<string, unknown>, ctx) => {
      const me = actingUser(ctx);
      const title = given(p['title'])?.slice(0, 200);
      if (!title) throw new Error('A notification needs a title.');
      if (!deps.events) throw new Error('Notifications are not available here.');
      const run = currentAgentRun();
      const event: AiAgentMessageEvent = {
        workspaceId: ctx.workspaceId,
        recipientId: me,
        agentName: run?.agentName ?? 'AI agent',
        title,
        body: given(p['body'])?.slice(0, 2_000) ?? null,
        runId: run?.runId ?? null,
      };
      // Awaited, so "sent" means the notification row exists.
      await deps.events.emitAsync(AppEvent.AiAgentMessage, event);
      return { delivered: true, to: 'the agent’s owner', title };
    },
  };

  const searchEmail: PlatformToolDefinition = {
    name: 'search_email',
    description:
      'Search the owner’s connected Gmail with Gmail search syntax (e.g. "is:unread newer_than:1d"). Returns sender, subject, date and a snippet for each message.',
    parameters: {
      query: { type: 'string', description: 'Gmail search, e.g. is:unread newer_than:1d' },
      maxResults: { type: 'number', description: 'Default 15, at most 25.' },
    },
    optional: ['maxResults'],
    handler: async (p: Record<string, unknown>, ctx) => {
      const me = actingUser(ctx);
      if (!deps.integrations) throw new Error('Email is not available here.');
      const gmail = await prisma.externalIntegration.findFirst({
        where: {
          provider: 'GMAIL',
          OR: [
            { workspaceId: ctx.workspaceId, scopeType: { not: 'USER' } },
            { scopeType: 'USER', userId: me },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, status: true },
      });
      if (!gmail) {
        throw new Error('Gmail isn’t connected. Connect Gmail in Integrations, then run the agent again.');
      }
      if (gmail.status !== 'CONNECTED') {
        throw new Error(`The Gmail connection is ${String(gmail.status).toLowerCase()}. Reconnect Gmail in Integrations to continue.`);
      }
      const result = (await deps.integrations.getMessages(gmail.id, me, ctx.workspaceId, {
        query: given(p['query']) ?? 'is:unread newer_than:1d',
        maxResults: clamp(p['maxResults'], 15, 25),
      })) as { messages?: IntegrationMessage[] };
      const messages = (result.messages ?? []).map((m) => ({
        id: m.id,
        threadId: m.threadId ?? null,
        from: m.from?.name ? `${m.from.name} <${m.from.email}>` : (m.from?.email ?? null),
        subject: m.subject,
        date: m.date,
        snippet: (m.snippet ?? m.bodyText ?? '').slice(0, 400),
        unread: !m.isRead,
        labels: m.labels,
      }));
      return { count: messages.length, messages };
    },
  };

  const createReminder: PlatformToolDefinition = {
    name: 'create_reminder',
    description:
      'Schedule a reminder in the workspace. Reminders notify the user or channel at the requested time.',
    parameters: {
      snippet: { type: 'string', description: 'What to remind the user about (the reminder text).' },
      remindAt: {
        type: 'string',
        description: 'ISO-8601 date string or timestamp for when the reminder should fire.',
      },
      roomId: {
        type: 'string',
        description: 'Optional Matrix room ID or channel ID where the reminder should be sent.',
      },
    },
    optional: ['roomId'],
    handler: async (p: Record<string, unknown>, ctx) => {
      const me = ctx.actingUserId;
      if (!me) throw new Error('No acting user context for reminder.');
      const snippet = given(p['snippet']);
      if (!snippet) throw new Error('Snippet is required.');
      let remindAtDate = new Date(String(p['remindAt']));
      if (isNaN(remindAtDate.getTime())) {
        remindAtDate = new Date(Date.now() + 60 * 60_000);
      }
      const roomId = typeof p['roomId'] === 'string' && p['roomId'] ? p['roomId'] : `workspace-${ctx.workspaceId}`;
      const reminder = await prisma.messageReminder.create({
        data: {
          workspaceId: ctx.workspaceId,
          userId: me,
          roomId,
          eventId: `remind-${Date.now()}`,
          deepLink: `/w/${ctx.workspaceId}/schedule`,
          snippet: snippet.slice(0, 280),
          remindAt: remindAtDate,
        },
      });
      return {
        id: reminder.id,
        snippet: reminder.snippet,
        remindAt: reminder.remindAt.toISOString(),
        link: reminder.deepLink,
        status: 'scheduled',
      };
    },
  };

  const listReminders: PlatformToolDefinition = {
    name: 'list_reminders',
    description: 'List pending scheduled reminders for the workspace and acting user.',
    parameters: {
      limit: { type: 'number', description: 'Max reminders to return (default 10).' },
    },
    optional: ['limit'],
    handler: async (p: Record<string, unknown>, ctx) => {
      const me = ctx.actingUserId;
      const limit = typeof p['limit'] === 'number' ? Math.min(p['limit'], 50) : 10;
      const rows = await prisma.messageReminder.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          ...(me ? { userId: me } : {}),
          firedAt: null,
        },
        orderBy: { remindAt: 'asc' },
        take: limit,
      });
      return {
        count: rows.length,
        reminders: rows.map((r) => ({
          id: r.id,
          snippet: r.snippet,
          remindAt: r.remindAt.toISOString(),
          roomId: r.roomId,
        })),
      };
    },
  };

  const createMonitor: PlatformToolDefinition = {
    name: 'create_monitor',
    description:
      'Configure a Tracker monitor to watch workspace tasks, projects, metrics, or status changes and report exceptions.',
    parameters: {
      targetType: {
        type: 'string',
        enum: ['task', 'project', 'metric', 'event', 'deadline', 'status'],
        description: 'What kind of resource or condition to monitor.',
      },
      target: {
        type: 'string',
        description: 'The target name, project name, or identifier being monitored.',
      },
      condition: {
        type: 'string',
        description: 'The condition to watch for, e.g. "status changes", "becomes overdue", "milestone reached".',
      },
      destination: {
        type: 'string',
        description: 'Where to report changes, e.g. a channel name, #channel, or "me".',
      },
      frequency: {
        type: 'string',
        description: 'Monitoring frequency, e.g. "realtime", "hourly", "daily".',
      },
    },
    optional: ['target', 'destination', 'frequency'],
    handler: async (p: Record<string, unknown>, ctx) => {
      const targetType = String(p['targetType'] || 'task');
      const target = String(p['target'] || 'All tasks');
      const condition = String(p['condition'] || 'status changes');
      const destination = typeof p['destination'] === 'string' ? p['destination'] : '#general';
      const frequency = typeof p['frequency'] === 'string' ? p['frequency'] : 'realtime';

      const tracker = await prisma.aIAgent.findFirst({
        where: { workspaceId: ctx.workspaceId, type: 'coworker', name: 'Tracker' },
      });

      const monitorId = `mon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const monitorRecord = {
        id: monitorId,
        workspaceId: ctx.workspaceId,
        coworkerId: tracker?.id ?? 'tracker',
        type: targetType,
        target,
        condition,
        frequency,
        destinations: [destination],
        enabled: true,
        lastCheckedAt: new Date().toISOString(),
        lastTriggeredAt: null,
        createdBy: ctx.actingUserId,
        createdAt: new Date().toISOString(),
      };

      if (tracker) {
        const config = (tracker.configuration ?? {}) as Record<string, unknown>;
        const monitors = Array.isArray(config['monitors']) ? [...(config['monitors'] as unknown[])] : [];
        monitors.push(monitorRecord);
        await prisma.aIAgent.update({
          where: { id: tracker.id },
          data: { configuration: { ...config, monitors } as any },
        });
      }

      return {
        success: true,
        monitor: monitorRecord,
        message: `Tracker monitor configured for ${target} on condition "${condition}". Reports will be sent to ${destination}.`,
      };
    },
  };

  const listMonitors: PlatformToolDefinition = {
    name: 'list_monitors',
    description: 'List active Tracker monitors configured in this workspace.',
    parameters: {
      targetType: {
        type: 'string',
        description: 'Optional filter by targetType (task, project, metric, etc.)',
      },
    },
    optional: ['targetType'],
    handler: async (p: Record<string, unknown>, ctx) => {
      const tracker = await prisma.aIAgent.findFirst({
        where: { workspaceId: ctx.workspaceId, type: 'coworker', name: 'Tracker' },
        select: { configuration: true },
      });
      const config = (tracker?.configuration ?? {}) as Record<string, unknown>;
      let monitors = Array.isArray(config['monitors']) ? (config['monitors'] as Record<string, unknown>[]) : [];
      if (typeof p['targetType'] === 'string' && p['targetType']) {
        monitors = monitors.filter((m) => m['type'] === p['targetType']);
      }
      return {
        count: monitors.length,
        monitors,
      };
    },
  };

  return [
    findTasks,
    listMeetings,
    getActivity,
    projectOverview,
    readDoc,
    searchDocs,
    createDoc,
    createTask,
    createTasks,
    updateTask,
    notifyUser,
    searchEmail,
    createReminder,
    listReminders,
    createMonitor,
    listMonitors,
  ];
}

/** A task list the way models write one: JSON array, JSON text, or markdown bullets. */
export function parseTaskList(value: unknown): Array<{ title: string; description?: string; priority?: string; dueDate?: string }> {
  let raw: unknown = value;
  if (typeof raw === 'string') {
    const text = raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
    try {
      raw = JSON.parse(text);
    } catch {
      raw = text
        .split('\n')
        .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s+(?:\[[ x]\]\s*)?/i, '').trim())
        .filter((line) => line.length > 2)
        .map((title) => ({ title }));
    }
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && Array.isArray((raw as { tasks?: unknown }).tasks)) {
    raw = (raw as { tasks: unknown[] }).tasks;
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === 'string') return { title: item.trim() };
      if (!item || typeof item !== 'object') return null;
      const o = item as Record<string, unknown>;
      const title = typeof o['title'] === 'string' ? o['title'].trim() : '';
      return {
        title,
        ...(typeof o['description'] === 'string' && o['description'] ? { description: o['description'] } : {}),
        ...(typeof o['priority'] === 'string' ? { priority: o['priority'] } : {}),
        ...(typeof o['dueDate'] === 'string' && o['dueDate'] !== 'null' ? { dueDate: o['dueDate'] } : {}),
      };
    })
    .filter((item): item is { title: string } => !!item && item.title.length > 0);
}
