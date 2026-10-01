import { Injectable, Logger, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import {
  AppEvent,
  type AiAgentMessageEvent,
  type CoworkerMonitorTriggeredEvent,
} from '@org/api-common';
import { PrismaService, type Prisma } from '@org/database';
import type { TrackerMonitor } from '@org/types';
import { AgentOutputDeliveryService } from './agent-output-delivery.service.js';
import {
  classifyMonitor,
  describeLateness,
  isMonitorDue,
  isWholeWorkspaceTarget,
  monitorIntervalMinutes,
  parseMonitorDestinations,
  type MonitorCheck,
} from './tracker-monitors.js';

const OPEN_STATUSES = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW'] as const;
/** Items one finding lists before "and N more". */
const LIST_LIMIT = 10;
/** Rows one check reads at most. */
const READ_LIMIT = 50;

interface MonitorCoworker {
  id: string;
  workspaceId: string;
  name: string;
  type: string;
  creatorId: string | null;
  matrixUserId: string | null;
  configuration: unknown;
}

interface Scope {
  projectId: string | null;
  label: string;
}

interface FoundTask {
  id: string;
  title: string;
  identifier: string | null;
  status: string;
  dueDate: Date | null;
  projectId: string | null;
  assigneeId: string | null;
  assigneeIds: string[];
  project: { name: string } | null;
}

interface Finding {
  check: MonitorCheck;
  title: string;
  lines: string[];
  count: number;
  tasks: FoundTask[];
  deepLink: string;
}

type MonitorPatch = Partial<Pick<TrackerMonitor, 'lastCheckedAt' | 'lastTriggeredAt' | 'lastResult' | 'lastError'>>;

function readMonitors(configuration: unknown): TrackerMonitor[] {
  if (!configuration || typeof configuration !== 'object') return [];
  const list = (configuration as Record<string, unknown>)['monitors'];
  return Array.isArray(list) ? (list as TrackerMonitor[]).filter((m) => m && typeof m.id === 'string') : [];
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/**
 * Checks Tracker monitors on their schedule and reports what they find.
 *
 * Monitors used to be stored and never read — "Tracker is watching" was not
 * true. Each due monitor is now read as one deterministic check
 * (`classifyMonitor`) over the real task and project tables, scoped to its
 * workspace and, when it names one, a project. What it finds goes where the
 * monitor says: the person who set it up, each task's assignees about their own
 * tasks, or a channel (posted as the coworker, with the owner's right to post
 * there). Every check that finds something is written to the coworker's
 * activity log and raised as `coworker.monitor.triggered`, so workflows can
 * act on it. The first check reports everything already matching; later
 * checks only what is new since the previous one.
 */
@Injectable()
export class TrackerMonitorSweepService {
  private readonly logger = new Logger(TrackerMonitorSweepService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly delivery: AgentOutputDeliveryService,
    @Optional() private readonly events?: EventEmitter2,
  ) {}

  @Cron('0 */5 * * * *', { name: 'tracker-monitor-sweep' })
  async sweep(now = new Date()): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let checked = 0;
    try {
      const coworkers = await this.prisma.aIAgent.findMany({
        where: { type: 'coworker', isActive: true },
        select: {
          id: true,
          workspaceId: true,
          name: true,
          type: true,
          creatorId: true,
          matrixUserId: true,
          configuration: true,
        },
      });
      for (const coworker of coworkers) {
        const due = readMonitors(coworker.configuration).filter((m) => isMonitorDue(m, now));
        if (due.length === 0) continue;
        const patches = new Map<string, MonitorPatch>();
        for (const monitor of due) {
          patches.set(monitor.id, await this.checkMonitor(coworker, monitor, now));
          checked++;
        }
        await this.saveState(coworker.id, patches);
      }
    } catch (error) {
      this.logger.warn(`Tracker monitor sweep failed: ${String(error)}`);
    } finally {
      this.running = false;
    }
    return checked;
  }

  /** "Check now" from the coworker's profile: one monitor, out of schedule. */
  async checkNow(workspaceId: string, coworkerId: string, monitorId: string): Promise<TrackerMonitor | null> {
    const coworker = await this.prisma.aIAgent.findFirst({
      where: { id: coworkerId, workspaceId, type: 'coworker' },
      select: { id: true, workspaceId: true, name: true, type: true, creatorId: true, matrixUserId: true, configuration: true },
    });
    const monitor = coworker ? readMonitors(coworker.configuration).find((m) => m.id === monitorId) : undefined;
    if (!coworker || !monitor) return null;
    const patch = await this.checkMonitor(coworker, monitor, new Date());
    await this.saveState(coworker.id, new Map([[monitor.id, patch]]));
    return { ...monitor, ...patch };
  }

  /** Checks one monitor now and reports any finding. Never throws. */
  async checkMonitor(coworker: MonitorCoworker, monitor: TrackerMonitor, now: Date): Promise<MonitorPatch> {
    const checkedAt = now.toISOString();
    try {
      const ownerId = monitor.createdBy ?? coworker.creatorId;
      if (!ownerId || !(await this.isActiveMember(coworker.workspaceId, ownerId))) {
        return { lastCheckedAt: checkedAt, lastError: 'The person who set up this monitor is no longer in the workspace.' };
      }
      const check = classifyMonitor(monitor);
      if (check === 'unsupported') {
        return {
          lastCheckedAt: checkedAt,
          lastError: `Tracker can't check “${monitor.condition}” automatically. Use overdue, due soon, completed, status changes or a progress summary.`,
        };
      }
      const scope = await this.resolveScope(coworker.workspaceId, monitor);
      if ('error' in scope) return { lastCheckedAt: checkedAt, lastError: scope.error };

      const since = monitor.lastCheckedAt ? new Date(monitor.lastCheckedAt) : null;
      const timezone = await this.timezoneOf(ownerId);
      const finding = await this.evaluate(check, coworker.workspaceId, scope, since, now, monitor, timezone);
      if (finding.count === 0) {
        return {
          lastCheckedAt: checkedAt,
          lastError: null,
          lastResult: { count: 0, summary: `Nothing to report in ${scope.label}.` },
        };
      }

      const delivered = await this.report(coworker, monitor, ownerId, finding);
      await this.recordActivity(coworker, monitor, finding, delivered);
      const triggered: CoworkerMonitorTriggeredEvent = {
        workspaceId: coworker.workspaceId,
        coworkerId: coworker.id,
        coworkerName: coworker.name,
        monitorId: monitor.id,
        monitorName: monitor.name ?? monitor.target,
        check,
        count: finding.count,
        summary: finding.title,
        projectId: scope.projectId,
        taskIds: finding.tasks.slice(0, READ_LIMIT).map((t) => t.id),
        ownerId,
      };
      this.events?.emit(AppEvent.CoworkerMonitorTriggered, triggered);
      return {
        lastCheckedAt: checkedAt,
        lastTriggeredAt: checkedAt,
        lastError: null,
        lastResult: { count: finding.count, summary: finding.title },
      };
    } catch (error) {
      this.logger.warn(`Monitor ${monitor.id} on ${coworker.name} failed: ${String(error)}`);
      return { lastCheckedAt: checkedAt, lastError: 'The last check failed; Tracker will try again.' };
    }
  }

  private async isActiveMember(workspaceId: string, userId: string): Promise<boolean> {
    const count = await this.prisma.workspaceMember.count({
      where: { workspaceId, userId, status: 'ACTIVE' },
    });
    return count > 0;
  }

  private async timezoneOf(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
    return user?.timezone || 'UTC';
  }

  /** The project a monitor names, or the whole workspace. */
  private async resolveScope(workspaceId: string, monitor: TrackerMonitor): Promise<Scope | { error: string }> {
    const target = (monitor.target ?? '').trim();
    if (isWholeWorkspaceTarget(target)) return { projectId: null, label: 'the workspace' };
    const select = { id: true, name: true } as const;
    const base = { workspaceId, deletedAt: null };
    const project =
      (await this.prisma.project.findFirst({
        where: { ...base, OR: [{ id: target }, { slug: target }, { name: { equals: target, mode: 'insensitive' } }] },
        select,
      })) ??
      (await this.prisma.project.findFirst({
        where: { ...base, name: { contains: target, mode: 'insensitive' } },
        select,
        orderBy: { updatedAt: 'desc' },
      }));
    if (!project) {
      return { error: `No project matches “${target}”. Set the target to a project name or “All tasks”.` };
    }
    return { projectId: project.id, label: project.name };
  }

  private taskScope(workspaceId: string, scope: Scope): Prisma.TaskWhereInput {
    return scope.projectId
      ? { workspaceId, deletedAt: null, projectId: scope.projectId }
      : {
          workspaceId,
          deletedAt: null,
          OR: [{ projectId: null }, { project: { is: { deletedAt: null } } }],
        };
  }

  private async evaluate(
    check: MonitorCheck,
    workspaceId: string,
    scope: Scope,
    since: Date | null,
    now: Date,
    monitor: TrackerMonitor,
    timezone: string,
  ): Promise<Finding> {
    if (check === 'project_progress') return this.projectProgress(workspaceId, scope, since, now);

    const where = this.taskScope(workspaceId, scope);
    // First check: everything already matching (or, for "what happened",
    // the last interval). Later checks: only what is new since the last one.
    const windowStart = since ?? new Date(now.getTime() - monitorIntervalMinutes(monitor) * 60_000);
    const dayMs = 86_400_000;
    let filter: Prisma.TaskWhereInput;
    let orderBy: Prisma.TaskOrderByWithRelationInput;
    switch (check) {
      case 'overdue':
        filter = {
          status: { in: [...OPEN_STATUSES] },
          dueDate: since ? { gte: since, lt: now } : { lt: now },
        };
        orderBy = { dueDate: 'asc' };
        break;
      case 'due_soon':
        filter = {
          status: { in: [...OPEN_STATUSES] },
          dueDate: {
            gt: since ? new Date(Math.max(now.getTime(), since.getTime() + dayMs)) : now,
            lte: new Date(now.getTime() + dayMs),
          },
        };
        orderBy = { dueDate: 'asc' };
        break;
      case 'completed':
        filter = { status: 'DONE', completedAt: { gt: windowStart, lte: now } };
        orderBy = { completedAt: 'desc' };
        break;
      default:
        filter = { updatedAt: { gt: windowStart, lte: now }, createdAt: { lte: windowStart } };
        orderBy = { updatedAt: 'desc' };
    }

    const tasks: FoundTask[] = await this.prisma.task.findMany({
      where: { AND: [where, filter] },
      select: {
        id: true,
        title: true,
        identifier: true,
        status: true,
        dueDate: true,
        projectId: true,
        assigneeId: true,
        assigneeIds: true,
        project: { select: { name: true } },
      },
      orderBy,
      take: READ_LIMIT,
    });

    const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: timezone });
    const fmtTime = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
    });
    const label = (t: FoundTask) =>
      `${t.identifier ? `${t.identifier} ` : ''}${t.title}${!scope.projectId && t.project ? ` (${t.project.name})` : ''}`;
    const detail = (t: FoundTask): string => {
      switch (check) {
        case 'overdue':
          return t.dueDate ? `due ${fmt.format(t.dueDate)}, ${describeLateness(t.dueDate, now)} overdue` : 'overdue';
        case 'due_soon':
          return t.dueDate ? `due ${fmtTime.format(t.dueDate)}` : 'due soon';
        case 'completed':
          return 'completed';
        default:
          return `now ${t.status.replace(/_/g, ' ').toLowerCase()}`;
      }
    };
    const noun =
      check === 'overdue'
        ? 'overdue task'
        : check === 'due_soon'
          ? 'task due in the next 24 hours'
          : check === 'completed'
            ? 'completed task'
            : 'updated task';
    const count = tasks.length;
    const title =
      check === 'due_soon'
        ? `${count === 1 ? '1 task is' : `${count} tasks are`} due in the next 24 hours in ${scope.label}`
        : `${plural(count, noun)} in ${scope.label}`;
    return {
      check,
      title,
      count,
      tasks,
      lines: tasks.map((t) => `${label(t)} — ${detail(t)}`),
      deepLink:
        count === 1 ? `tasks?taskId=${tasks[0].id}` : scope.projectId ? `tasks/${scope.projectId}` : 'tasks',
    };
  }

  /** Progress per project; reported when something in it moved (or on the first check). */
  private async projectProgress(workspaceId: string, scope: Scope, since: Date | null, now: Date): Promise<Finding> {
    const projects = await this.prisma.project.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        ...(scope.projectId ? { id: scope.projectId } : { status: { in: ['ACTIVE', 'PLANNING'] } }),
        ...(since ? { tasks: { some: { deletedAt: null, updatedAt: { gt: since } } } } : {}),
      },
      select: { id: true, name: true, health: true },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });
    const lines: string[] = [];
    for (const project of projects) {
      const [total, done, overdue] = await Promise.all([
        this.prisma.task.count({ where: { projectId: project.id, deletedAt: null, status: { not: 'CANCELLED' } } }),
        this.prisma.task.count({ where: { projectId: project.id, deletedAt: null, status: 'DONE' } }),
        this.prisma.task.count({
          where: { projectId: project.id, deletedAt: null, status: { in: [...OPEN_STATUSES] }, dueDate: { lt: now } },
        }),
      ]);
      const pct = total ? Math.round((done / total) * 100) : 0;
      const health = project.health !== 'HEALTHY' ? `, ${project.health.replace(/_/g, ' ').toLowerCase()}` : '';
      lines.push(`${project.name} — ${done}/${total} done (${pct}%)${overdue ? `, ${overdue} overdue` : ''}${health}`);
    }
    return {
      check: 'project_progress',
      title:
        projects.length === 1
          ? `Progress update: ${projects[0].name}`
          : `Progress update for ${plural(projects.length, 'project')}`,
      count: projects.length,
      tasks: [],
      lines,
      deepLink: projects.length === 1 ? `tasks/${projects[0].id}` : 'projects',
    };
  }

  private bodyOf(lines: string[]): string {
    const shown = lines.slice(0, LIST_LIMIT).map((l) => `• ${l}`);
    if (lines.length > LIST_LIMIT) shown.push(`…and ${lines.length - LIST_LIMIT} more`);
    return shown.join('\n');
  }

  /** Sends a finding everywhere the monitor points. Returns one note per destination. */
  private async report(
    coworker: MonitorCoworker,
    monitor: TrackerMonitor,
    ownerId: string,
    finding: Finding,
  ): Promise<string[]> {
    const where = parseMonitorDestinations(monitor.destinations);
    const notes: string[] = [];
    const notify = async (recipientId: string, title: string, lines: string[], deepLink: string) => {
      const event: AiAgentMessageEvent = {
        workspaceId: coworker.workspaceId,
        recipientId,
        agentName: coworker.name,
        title: title.slice(0, 200),
        body: this.bodyOf(lines),
        runId: null,
        deepLink,
        bodyAsIs: true,
      };
      await this.events?.emitAsync(AppEvent.AiAgentMessage, event);
    };

    if (where.owner) {
      await notify(ownerId, `${coworker.name}: ${finding.title}`, finding.lines, finding.deepLink);
      notes.push('owner notified');
    }

    if (where.assignees && finding.tasks.length) {
      const byPerson = new Map<string, FoundTask[]>();
      for (const task of finding.tasks) {
        for (const id of new Set([...task.assigneeIds, ...(task.assigneeId ? [task.assigneeId] : [])])) {
          if (where.owner && id === ownerId) continue;
          byPerson.set(id, [...(byPerson.get(id) ?? []), task]);
        }
      }
      const active = new Set(
        (
          await this.prisma.workspaceMember.findMany({
            where: { workspaceId: coworker.workspaceId, userId: { in: [...byPerson.keys()] }, status: 'ACTIVE' },
            select: { userId: true },
          })
        ).map((m) => m.userId),
      );
      let told = 0;
      for (const [personId, tasks] of byPerson) {
        if (!active.has(personId)) continue;
        const own = finding.lines.filter((_, i) => tasks.includes(finding.tasks[i]));
        const title =
          finding.check === 'overdue'
            ? `${coworker.name}: you have ${plural(tasks.length, 'overdue task')}`
            : `${coworker.name}: ${plural(tasks.length, 'of your tasks')} — ${monitor.condition}`;
        await notify(personId, title, own, tasks.length === 1 ? `tasks?taskId=${tasks[0].id}` : finding.deepLink);
        told++;
      }
      notes.push(`${plural(told, 'assignee')} notified`);
    }

    for (const ref of where.channels) {
      const channel = await this.prisma.channel.findFirst({
        where: {
          workspaceId: coworker.workspaceId,
          isArchived: false,
          OR: [{ id: ref }, { slug: ref.toLowerCase() }, { name: { equals: ref, mode: 'insensitive' } }],
        },
        select: { id: true, name: true },
      });
      if (!channel) {
        notes.push(`#${ref}: no such channel`);
        continue;
      }
      try {
        notes.push(
          await this.delivery.postText(
            coworker,
            channel.id,
            `**${finding.title}**\n\n${this.bodyOf(finding.lines)}`,
            ownerId,
          ),
        );
      } catch (error) {
        notes.push(`#${channel.name}: failed — ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return notes;
  }

  /** The coworker's activity log — what it checked, found and told whom. */
  private async recordActivity(
    coworker: MonitorCoworker,
    monitor: TrackerMonitor,
    finding: Finding,
    delivered: string[],
  ): Promise<void> {
    try {
      await this.prisma.agentExecutionLog.create({
        data: {
          agentId: coworker.id,
          status: 'SUCCESS',
          promptText: `Monitor “${monitor.name ?? monitor.target}” — checked ${monitor.condition}`,
          outputResult: [finding.title, this.bodyOf(finding.lines), delivered.length ? `Sent: ${delivered.join('; ')}` : '']
            .filter(Boolean)
            .join('\n\n'),
          toolCalls: JSON.stringify([
            { name: 'monitor_check', status: 'success', input: { monitorId: monitor.id, check: finding.check } },
          ]),
        },
      });
      await this.prisma.aIAgent.update({ where: { id: coworker.id }, data: { lastActiveAt: new Date() } });
    } catch (error) {
      this.logger.warn(`Could not log monitor activity for ${coworker.id}: ${String(error)}`);
    }
  }

  /** Merges check results into the latest stored monitors (they may have been edited meanwhile). */
  private async saveState(coworkerId: string, patches: Map<string, MonitorPatch>): Promise<void> {
    const fresh = await this.prisma.aIAgent.findUnique({ where: { id: coworkerId }, select: { configuration: true } });
    if (!fresh) return;
    const config = (fresh.configuration ?? {}) as Record<string, unknown>;
    const monitors = readMonitors(config).map((m) => (patches.has(m.id) ? { ...m, ...patches.get(m.id) } : m));
    await this.prisma.aIAgent.update({
      where: { id: coworkerId },
      data: { configuration: { ...config, monitors } as unknown as Prisma.InputJsonValue },
    });
  }
}
