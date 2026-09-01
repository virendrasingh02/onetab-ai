import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AppEvent,
  PUBLIC_USER_SELECT,
  resolveTextMentions,
} from '@org/api-common';
import {
  CycleStatus,
  DocumentKind,
  IdentifierPrefixMode,
  IntakeSource,
  IntakeStatus,
  Prisma,
  PrismaService,
  ProjectHealth,
  ProjectStatus,
  RelationType,
  TaskPriority,
  TaskStatus,
  ViewType,
  WorkItemType,
} from '@org/database';
import { TASK_STATUS_ORDER } from '@org/types';
import {
  formatTicketIdentifier,
  generateProjectIdentifier,
  isValidIdentifierPrefix,
} from '@org/utils';
import type {
  ConvertIntakeRequestInput,
  CreateCalendarEventInput,
  CreateCycleInput,
  CreateDocumentInput,
  CreateEpicInput,
  CreateInitiativeInput,
  CreateIntakeRequestInput,
  CreateModuleInput,
  CreateProjectInput,
  CreateProjectUpdateInput,
  CreateSavedViewInput,
  CreateTaskCommentInput,
  CreateTaskInput,
  CreateTeamInput,
  CreateWhiteboardInput,
  CreateWorkItemRelationInput,
  MoveTaskInput,
  ProjectIdentifierSettingsInput,
  UpdateCalendarEventInput,
  UpdateCycleInput,
  UpdateDocumentInput,
  UpdateEpicInput,
  UpdateInitiativeInput,
  UpdateModuleInput,
  UpdateProjectInput,
  UpdateSavedViewInput,
  UpdateTaskInput,
  UpdateTeamInput,
  UpdateWhiteboardInput,
} from '@org/validation';

/** Converts an optional ISO string from a DTO into a `Date` for Prisma. */
function at(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  return value === null ? null : new Date(value);
}

/** Gap left between neighbouring cards in a column. */
const ORDER_STRIDE = 1024;

@Injectable()
export class WorkToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  // --- teams ----------------------------------------------------------------

  async getTeams(workspaceId: string) {
    return this.prisma.team.findMany({
      where: { workspaceId },
      include: {
        _count: { select: { projects: true, tasks: true, cycles: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createTeam(workspaceId: string, input: CreateTeamInput) {
    const existing = await this.prisma.team.findFirst({
      where: { workspaceId, key: input.key },
    });
    if (existing) {
      throw new ConflictException(`Team key "${input.key}" already exists`);
    }
    return this.prisma.team.create({
      data: {
        workspaceId,
        name: input.name,
        key: input.key,
        description: input.description ?? null,
        color: input.color ?? '#3b82f6',
        icon: input.icon ?? null,
        iconColor: input.iconColor ?? null,
      },
    });
  }

  async updateTeam(
    workspaceId: string,
    teamId: string,
    input: UpdateTeamInput,
  ) {
    await this.assertTeam(workspaceId, teamId);
    return this.prisma.team.update({
      where: { id: teamId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.key !== undefined ? { key: input.key } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
        ...(input.iconColor !== undefined ? { iconColor: input.iconColor } : {}),
      },
    });
  }

  async deleteTeam(workspaceId: string, teamId: string): Promise<void> {
    await this.assertTeam(workspaceId, teamId);
    await this.prisma.team.delete({ where: { id: teamId } });
  }

  // --- initiatives ----------------------------------------------------------

  async getInitiatives(workspaceId: string) {
    return this.prisma.initiative.findMany({
      where: { workspaceId },
      include: {
        owner: { select: PUBLIC_USER_SELECT },
        projects: {
          include: {
            _count: { select: { tasks: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createInitiative(workspaceId: string, input: CreateInitiativeInput) {
    return this.prisma.initiative.create({
      data: {
        workspaceId,
        name: input.name,
        objective: input.objective ?? null,
        description: input.description ?? null,
        ownerId: input.ownerId ?? null,
        status: (input.status as ProjectStatus) ?? ProjectStatus.ACTIVE,
        health: (input.health as ProjectHealth) ?? ProjectHealth.HEALTHY,
        priority: (input.priority as TaskPriority) ?? TaskPriority.MEDIUM,
        targetDate: at(input.targetDate) ?? null,
        color: input.color ?? '#8b5cf6',
        icon: input.icon ?? null,
        iconColor: input.iconColor ?? null,
        ...(input.projectIds?.length
          ? {
              projects: {
                connect: input.projectIds.map((id) => ({ id })),
              },
            }
          : {}),
      },
      include: {
        owner: { select: PUBLIC_USER_SELECT },
        projects: true,
      },
    });
  }

  async updateInitiative(
    workspaceId: string,
    initiativeId: string,
    input: UpdateInitiativeInput,
  ) {
    await this.assertInitiative(workspaceId, initiativeId);
    return this.prisma.initiative.update({
      where: { id: initiativeId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.objective !== undefined ? { objective: input.objective } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
        ...(input.status !== undefined ? { status: input.status as ProjectStatus } : {}),
        ...(input.health !== undefined ? { health: input.health as ProjectHealth } : {}),
        ...(input.priority !== undefined ? { priority: input.priority as TaskPriority } : {}),
        ...(input.targetDate !== undefined ? { targetDate: at(input.targetDate) } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
        ...(input.iconColor !== undefined ? { iconColor: input.iconColor } : {}),
        ...(input.projectIds
          ? {
              projects: {
                set: input.projectIds.map((id) => ({ id })),
              },
            }
          : {}),
      },
      include: {
        owner: { select: PUBLIC_USER_SELECT },
        projects: true,
      },
    });
  }

  async deleteInitiative(workspaceId: string, initiativeId: string): Promise<void> {
    await this.assertInitiative(workspaceId, initiativeId);
    await this.prisma.initiative.delete({ where: { id: initiativeId } });
  }

  // --- projects -------------------------------------------------------------

  async getProjects(workspaceId: string, teamId?: string) {
    return this.prisma.project.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        ...(teamId ? { teamId } : {}),
      },
      include: {
        lead: { select: PUBLIC_USER_SELECT },
        team: true,
        milestones: { orderBy: { dueDate: 'asc' } },
        sprints: { orderBy: { startDate: 'asc' } },
        epics: { orderBy: { targetDate: 'asc' } },
        modules: {
          include: { lead: { select: PUBLIC_USER_SELECT } },
          orderBy: { targetDate: 'asc' },
        },
        cycles: { orderBy: { startDate: 'asc' } },
        _count: { select: { tasks: { where: { deletedAt: null } } } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getProject(workspaceId: string, projectId: string) {
    await this.assertProject(workspaceId, projectId);
    return this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: {
        lead: { select: PUBLIC_USER_SELECT },
        team: true,
        initiative: true,
        milestones: { orderBy: { dueDate: 'asc' } },
        sprints: { orderBy: { startDate: 'asc' } },
        epics: { orderBy: { targetDate: 'asc' } },
        modules: {
          include: { lead: { select: PUBLIC_USER_SELECT } },
          orderBy: { targetDate: 'asc' },
        },
        cycles: { orderBy: { startDate: 'asc' } },
        updates: {
          include: { author: { select: PUBLIC_USER_SELECT } },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { tasks: { where: { deletedAt: null } } } },
      },
    });
  }

  async createProject(
    workspaceId: string,
    input: CreateProjectInput,
    actorId?: string,
  ) {
    if (input.teamId) await this.assertTeam(workspaceId, input.teamId);
    if (input.leadId) await this.assertWorkspaceUser(workspaceId, input.leadId);
    if (input.initiativeId) await this.assertInitiative(workspaceId, input.initiativeId);

    // Existing prefixes in workspace for collision avoidance
    const existingPrefixes = (
      await this.prisma.project.findMany({
        where: { workspaceId },
        select: { ticketPrefix: true },
      })
    ).flatMap((p) => (p.ticketPrefix ? [p.ticketPrefix] : []));

    const finalPrefix = input.ticketPrefix
      ? input.ticketPrefix.toUpperCase()
      : generateProjectIdentifier(input.name, existingPrefixes);

    // Check clash
    const clash = await this.prisma.project.findFirst({
      where: { workspaceId, ticketPrefix: finalPrefix },
    });
    if (clash) {
      throw new ConflictException(
        `Ticket prefix "${finalPrefix}" is already in use by project "${clash.name}"`,
      );
    }

    const project = await this.prisma.project.create({
      data: {
        workspaceId,
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        color: input.color ?? '#3b82f6',
        icon: input.icon ?? null,
        iconColor: input.iconColor ?? null,
        teamId: input.teamId ?? null,
        leadId: input.leadId ?? null,
        initiativeId: input.initiativeId ?? null,
        startDate: at(input.startDate) ?? null,
        targetDate: at(input.targetDate) ?? null,
        columnOrder: [...TASK_STATUS_ORDER],
        ticketPrefix: finalPrefix,
        identifierPrefixMode:
          (input.identifierPrefixMode as IdentifierPrefixMode) ??
          IdentifierPrefixMode.AUTO,
      },
      include: {
        lead: { select: PUBLIC_USER_SELECT },
        team: true,
      },
    });

    this.events.emit(AppEvent.ProjectCreated, {
      workspaceId,
      actorId: actorId ?? null,
      projectId: project.id,
      name: project.name,
      leadId: project.leadId ?? null,
    });

    return project;
  }

  async updateProject(
    workspaceId: string,
    projectId: string,
    input: UpdateProjectInput,
  ) {
    const existing = await this.assertProject(workspaceId, projectId);
    if (input.teamId) await this.assertTeam(workspaceId, input.teamId);
    if (input.leadId) await this.assertWorkspaceUser(workspaceId, input.leadId);
    if (input.initiativeId) await this.assertInitiative(workspaceId, input.initiativeId);

    if (input.ticketPrefix !== undefined && input.ticketPrefix !== existing.ticketPrefix) {
      const clash = await this.prisma.project.findFirst({
        where: {
          workspaceId,
          ticketPrefix: input.ticketPrefix,
          id: { not: projectId },
        },
        select: { name: true },
      });
      if (clash) {
        throw new ConflictException(
          `“${clash.name}” already uses the ticket prefix ${input.ticketPrefix}`,
        );
      }
    }

    const data: Prisma.ProjectUncheckedUpdateInput = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.columnOrder !== undefined ? { columnOrder: input.columnOrder } : {}),
      ...(input.ticketPrefix !== undefined ? { ticketPrefix: input.ticketPrefix } : {}),
      ...(input.identifierPrefixMode !== undefined
        ? { identifierPrefixMode: input.identifierPrefixMode as IdentifierPrefixMode }
        : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
      ...(input.iconColor !== undefined ? { iconColor: input.iconColor } : {}),
      ...(input.status !== undefined ? { status: input.status as ProjectStatus } : {}),
      ...(input.health !== undefined ? { health: input.health as ProjectHealth } : {}),
      ...(input.healthScore !== undefined ? { healthScore: input.healthScore } : {}),
      ...(input.teamId !== undefined ? { teamId: input.teamId } : {}),
      ...(input.leadId !== undefined ? { leadId: input.leadId } : {}),
      ...(input.initiativeId !== undefined ? { initiativeId: input.initiativeId } : {}),
      ...(input.startDate !== undefined ? { startDate: at(input.startDate) } : {}),
      ...(input.targetDate !== undefined ? { targetDate: at(input.targetDate) } : {}),
    };

    return this.prisma.project.update({
      where: { id: projectId },
      data,
      include: {
        lead: { select: PUBLIC_USER_SELECT },
        team: true,
      },
    });
  }

  async updateIdentifierSettings(
    workspaceId: string,
    projectId: string,
    input: ProjectIdentifierSettingsInput,
    actorId?: string,
  ) {
    const project = await this.assertProject(workspaceId, projectId);

    let prefix = project.ticketPrefix;

    if (input.regenerate) {
      const existingPrefixes = (
        await this.prisma.project.findMany({
          where: { workspaceId, id: { not: projectId } },
          select: { ticketPrefix: true },
        })
      ).flatMap((p) => (p.ticketPrefix ? [p.ticketPrefix] : []));

      prefix = generateProjectIdentifier(project.name, existingPrefixes);
    } else if (input.ticketPrefix) {
      const upper = input.ticketPrefix.trim().toUpperCase();
      if (!isValidIdentifierPrefix(upper)) {
        throw new ConflictException('Invalid ticket prefix format');
      }

      const clash = await this.prisma.project.findFirst({
        where: { workspaceId, ticketPrefix: upper, id: { not: projectId } },
      });
      if (clash) {
        throw new ConflictException(`Prefix "${upper}" is already used by "${clash.name}"`);
      }
      prefix = upper;
    }

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ticketPrefix: prefix,
        ...(input.identifierPrefixMode
          ? { identifierPrefixMode: input.identifierPrefixMode as IdentifierPrefixMode }
          : {}),
      },
    });

    if (actorId && prefix !== project.ticketPrefix) {
      await this.logActivity(workspaceId, projectId, actorId, 'PREFIX_CHANGED', {
        oldPrefix: project.ticketPrefix,
        newPrefix: prefix,
      });
    }

    return {
      project: updated,
      preview: formatTicketIdentifier(prefix, updated.ticketSeq + 1),
    };
  }

  async deleteProject(workspaceId: string, projectId: string): Promise<void> {
    await this.assertProject(workspaceId, projectId);
    // Soft delete: the project and its still-live tasks are stamped with the
    // *same* timestamp, so restore can bring back exactly the set that this
    // delete removed and nothing a user deleted individually beforehand.
    const deletedAt = new Date();
    await this.prisma.$transaction([
      this.prisma.task.updateMany({
        where: { projectId, deletedAt: null },
        data: { deletedAt },
      }),
      this.prisma.project.update({
        where: { id: projectId },
        data: { deletedAt },
      }),
    ]);
  }

  // --- epics & modules & cycles ---------------------------------------------

  async getEpics(workspaceId: string, projectId: string) {
    await this.assertProject(workspaceId, projectId);
    const epics = await this.prisma.epic.findMany({
      where: { projectId, workspaceId },
      include: {
        tasks: {
          where: { deletedAt: null },
          select: { id: true, status: true, priority: true, title: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return epics.map((epic) => {
      const total = epic.tasks.length;
      const completed = epic.tasks.filter((t) => t.status === 'DONE').length;
      return {
        ...epic,
        _count: { workItems: total, completedWorkItems: completed },
      };
    });
  }

  async createEpic(workspaceId: string, input: CreateEpicInput) {
    await this.assertProject(workspaceId, input.projectId);
    return this.prisma.epic.create({
      data: {
        workspaceId,
        projectId: input.projectId,
        name: input.name,
        description: input.description ?? null,
        ownerId: input.ownerId ?? null,
        status: (input.status as ProjectStatus) ?? ProjectStatus.ACTIVE,
        priority: (input.priority as TaskPriority) ?? TaskPriority.MEDIUM,
        targetDate: at(input.targetDate) ?? null,
        color: input.color ?? '#8b5cf6',
      },
    });
  }

  async updateEpic(workspaceId: string, epicId: string, input: UpdateEpicInput) {
    const epic = await this.prisma.epic.findFirst({
      where: { id: epicId, workspaceId },
    });
    if (!epic) throw new NotFoundException('Epic not found');

    return this.prisma.epic.update({
      where: { id: epicId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
        ...(input.status !== undefined ? { status: input.status as ProjectStatus } : {}),
        ...(input.priority !== undefined ? { priority: input.priority as TaskPriority } : {}),
        ...(input.targetDate !== undefined ? { targetDate: at(input.targetDate) } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
      },
    });
  }

  async deleteEpic(workspaceId: string, epicId: string): Promise<void> {
    const epic = await this.prisma.epic.findFirst({
      where: { id: epicId, workspaceId },
    });
    if (!epic) throw new NotFoundException('Epic not found');
    await this.prisma.epic.delete({ where: { id: epicId } });
  }

  async getModules(workspaceId: string, projectId: string) {
    await this.assertProject(workspaceId, projectId);
    return this.prisma.module.findMany({
      where: { projectId, workspaceId },
      include: {
        lead: { select: PUBLIC_USER_SELECT },
        _count: { select: { tasks: true } },
      },
      orderBy: { targetDate: 'asc' },
    });
  }

  async createModule(workspaceId: string, input: CreateModuleInput) {
    await this.assertProject(workspaceId, input.projectId);
    return this.prisma.module.create({
      data: {
        workspaceId,
        projectId: input.projectId,
        name: input.name,
        description: input.description ?? null,
        leadId: input.leadId ?? null,
        startDate: at(input.startDate) ?? null,
        targetDate: at(input.targetDate) ?? null,
        status: (input.status as ProjectStatus) ?? ProjectStatus.ACTIVE,
        color: input.color ?? '#3b82f6',
      },
      include: {
        lead: { select: PUBLIC_USER_SELECT },
      },
    });
  }

  async updateModule(workspaceId: string, moduleId: string, input: UpdateModuleInput) {
    const mod = await this.prisma.module.findFirst({
      where: { id: moduleId, workspaceId },
    });
    if (!mod) throw new NotFoundException('Module not found');

    return this.prisma.module.update({
      where: { id: moduleId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.leadId !== undefined ? { leadId: input.leadId } : {}),
        ...(input.startDate !== undefined ? { startDate: at(input.startDate) } : {}),
        ...(input.targetDate !== undefined ? { targetDate: at(input.targetDate) } : {}),
        ...(input.status !== undefined ? { status: input.status as ProjectStatus } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
      },
      include: {
        lead: { select: PUBLIC_USER_SELECT },
      },
    });
  }

  async deleteModule(workspaceId: string, moduleId: string): Promise<void> {
    const mod = await this.prisma.module.findFirst({
      where: { id: moduleId, workspaceId },
    });
    if (!mod) throw new NotFoundException('Module not found');
    await this.prisma.module.delete({ where: { id: moduleId } });
  }

  async getCycles(workspaceId: string, projectId?: string, teamId?: string) {
    return this.prisma.cycle.findMany({
      where: {
        workspaceId,
        ...(projectId ? { projectId } : {}),
        ...(teamId ? { teamId } : {}),
      },
      include: {
        tasks: {
          select: { id: true, status: true, priority: true, title: true, estimate: true },
        },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  async createCycle(workspaceId: string, input: CreateCycleInput) {
    if (input.projectId) await this.assertProject(workspaceId, input.projectId);
    if (input.teamId) await this.assertTeam(workspaceId, input.teamId);

    return this.prisma.cycle.create({
      data: {
        workspaceId,
        projectId: input.projectId ?? null,
        teamId: input.teamId ?? null,
        name: input.name,
        description: input.description ?? null,
        goal: input.goal ?? null,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        status: (input.status as CycleStatus) ?? CycleStatus.DRAFT,
      },
    });
  }

  async updateCycle(workspaceId: string, cycleId: string, input: UpdateCycleInput) {
    const cycle = await this.prisma.cycle.findFirst({
      where: { id: cycleId, workspaceId },
    });
    if (!cycle) throw new NotFoundException('Cycle not found');

    return this.prisma.cycle.update({
      where: { id: cycleId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.goal !== undefined ? { goal: input.goal } : {}),
        ...(input.startDate !== undefined ? { startDate: new Date(input.startDate) } : {}),
        ...(input.endDate !== undefined ? { endDate: new Date(input.endDate) } : {}),
        ...(input.status !== undefined ? { status: input.status as CycleStatus } : {}),
      },
    });
  }

  async deleteCycle(workspaceId: string, cycleId: string): Promise<void> {
    const cycle = await this.prisma.cycle.findFirst({
      where: { id: cycleId, workspaceId },
    });
    if (!cycle) throw new NotFoundException('Cycle not found');
    await this.prisma.cycle.delete({ where: { id: cycleId } });
  }

  // --- tasks / universal work items -----------------------------------------

  async getTasks(
    workspaceId: string,
    projectId?: string,
    status?: TaskStatus,
    options?: {
      teamId?: string;
      cycleId?: string;
      epicId?: string;
      moduleId?: string;
      assigneeId?: string;
      search?: string;
    },
  ) {
    return this.prisma.task.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        ...(projectId ? { projectId } : {}),
        ...(status ? { status } : {}),
        ...(options?.teamId ? { teamId: options.teamId } : {}),
        ...(options?.cycleId ? { cycleId: options.cycleId } : {}),
        ...(options?.epicId ? { epicId: options.epicId } : {}),
        ...(options?.moduleId ? { moduleId: options.moduleId } : {}),
        ...(options?.assigneeId ? { assigneeId: options.assigneeId } : {}),
        ...(options?.search
          ? {
              OR: [
                { title: { contains: options.search, mode: 'insensitive' } },
                { identifier: { contains: options.search, mode: 'insensitive' } },
                { description: { contains: options.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        assignee: { select: PUBLIC_USER_SELECT },
        reporter: { select: PUBLIC_USER_SELECT },
        project: {
          select: {
            id: true,
            name: true,
            slug: true,
            color: true,
            icon: true,
            iconColor: true,
            ticketPrefix: true,
          },
        },
        epic: true,
        module: true,
        cycle: true,
        team: true,
        subItems: {
          where: { deletedAt: null },
          include: { assignee: { select: PUBLIC_USER_SELECT } },
        },
        sourceRelations: {
          include: { target: true },
        },
        targetRelations: {
          include: { source: true },
        },
        _count: { select: { comments: true } },
      },
      orderBy: [{ status: 'asc' }, { orderIndex: 'asc' }],
    });
  }

  async getTask(workspaceId: string, taskId: string) {
    await this.assertTask(workspaceId, taskId);
    return this.prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      include: {
        assignee: { select: PUBLIC_USER_SELECT },
        reporter: { select: PUBLIC_USER_SELECT },
        project: {
          select: {
            id: true,
            name: true,
            slug: true,
            color: true,
            icon: true,
            iconColor: true,
            ticketPrefix: true,
          },
        },
        epic: true,
        module: true,
        cycle: true,
        team: true,
        parent: {
          include: { assignee: { select: PUBLIC_USER_SELECT } },
        },
        subItems: {
          where: { deletedAt: null },
          include: { assignee: { select: PUBLIC_USER_SELECT } },
          orderBy: { orderIndex: 'asc' },
        },
        sourceRelations: {
          include: { target: true },
        },
        targetRelations: {
          include: { source: true },
        },
        comments: {
          include: { author: { select: PUBLIC_USER_SELECT } },
          orderBy: { createdAt: 'asc' },
        },
        activities: {
          include: { actor: { select: PUBLIC_USER_SELECT } },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { comments: true } },
      },
    });
  }

  /**
   * De-dupes an assignee list, primary first, dropping empties. `assigneeIds[0]`
   * is always the primary, and `Task.assigneeId` is kept in step with it.
   */
  private orderAssignees(
    ids: readonly (string | null | undefined)[],
    primary?: string | null,
  ): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const id of [primary, ...ids]) {
      if (id && !seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
    return out;
  }

  private sameStringSet(a: readonly string[], b: readonly string[]): boolean {
    if (a.length !== b.length) return false;
    const set = new Set(a);
    return b.every((v) => set.has(v));
  }

  async createTask(workspaceId: string, input: CreateTaskInput, actorId?: string) {
    await this.assertTaskLinks(workspaceId, input);

    const status = (input.status as TaskStatus) ?? TaskStatus.TODO;
    const projectId = input.projectId ?? null;

    const assigneeIds = this.orderAssignees(
      input.assigneeIds ?? (input.assigneeId ? [input.assigneeId] : []),
      input.assigneeId,
    );
    const primaryAssigneeId = assigneeIds[0] ?? null;
    // `assigneeIds` is its own column now — no longer stashed in customFields.
    const customFields =
      (input.customFields as Record<string, unknown>) ?? {};

    const task = await this.prisma.$transaction(async (tx) => {
      let ticketNumber: number | null = null;
      let identifier: string | null = null;

      if (projectId) {
        const proj = await tx.project.update({
          where: { id: projectId },
          data: { ticketSeq: { increment: 1 } },
          select: { ticketSeq: true, ticketPrefix: true },
        });
        ticketNumber = proj.ticketSeq;
        identifier = formatTicketIdentifier(proj.ticketPrefix, ticketNumber);
      }

      const data: Prisma.TaskUncheckedCreateInput = {
        workspaceId,
        title: input.title,
        description: input.description ?? null,
        status,
        priority: (input.priority as TaskPriority) ?? TaskPriority.MEDIUM,
        type: (input.type as WorkItemType) ?? WorkItemType.TASK,
        projectId,
        teamId: input.teamId ?? null,
        sprintId: input.sprintId ?? null,
        milestoneId: input.milestoneId ?? null,
        epicId: input.epicId ?? null,
        cycleId: input.cycleId ?? null,
        moduleId: input.moduleId ?? null,
        parentId: input.parentId ?? null,
        assigneeId: primaryAssigneeId,
        assigneeIds,
        reporterId: input.reporterId ?? actorId ?? null,
        startDate: at(input.startDate) ?? null,
        dueDate: at(input.dueDate) ?? null,
        estimate: input.estimate ?? null,
        labels: input.labels ?? [],
        customFields: customFields as Prisma.InputJsonValue,
        ticketNumber,
        identifier,
        orderIndex: await this.topOfColumn(tx, workspaceId, projectId, status),
      };

      const task = await tx.task.create({
        data,
        include: {
          assignee: { select: PUBLIC_USER_SELECT },
          reporter: { select: PUBLIC_USER_SELECT },
          project: true,
        },
      });

      if (actorId) {
        await tx.workItemActivity.create({
          data: {
            workspaceId,
            workItemId: task.id,
            actorId,
            action: 'CREATED',
            newValue: task.title,
          },
        });
      }

      return task;
    });

    // Emitted after the write commits, so a listener that reads the task back
    // always finds it. Fan-out (notification to the assignee, an activity-feed
    // row) happens in `DomainEventsListener`, not here.
    this.events.emit(AppEvent.TaskCreated, {
      workspaceId,
      actorId: actorId ?? null,
      taskId: task.id,
      title: task.title,
      identifier: task.identifier,
      projectId: task.projectId,
      assigneeId: task.assigneeId,
      assigneeIds: task.assigneeIds,
    });

    return task;
  }

  async updateTask(
    workspaceId: string,
    taskId: string,
    input: UpdateTaskInput,
    actorId?: string,
  ) {
    const existing = await this.assertTask(workspaceId, taskId);
    await this.assertTaskLinks(workspaceId, input);

    const nextAssigneeIds =
      input.assigneeIds !== undefined
        ? this.orderAssignees(input.assigneeIds, input.assigneeId)
        : input.assigneeId !== undefined
        ? this.orderAssignees(
            input.assigneeId ? [input.assigneeId] : [],
            input.assigneeId,
          )
        : undefined;
    const primaryAssigneeId =
      nextAssigneeIds !== undefined ? nextAssigneeIds[0] ?? null : undefined;

    const existingCustom =
      (existing.customFields as Record<string, unknown>) ?? {};
    const updatedCustomFields =
      input.customFields !== undefined
        ? {
            ...existingCustom,
            ...((input.customFields as Record<string, unknown>) ?? {}),
          }
        : undefined;

    const data: Prisma.TaskUncheckedUpdateInput = {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.type !== undefined ? { type: input.type as WorkItemType } : {}),
      ...(input.status !== undefined ? { status: input.status as TaskStatus } : {}),
      ...(input.priority !== undefined ? { priority: input.priority as TaskPriority } : {}),
      ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
      ...(input.teamId !== undefined ? { teamId: input.teamId } : {}),
      ...(input.sprintId !== undefined ? { sprintId: input.sprintId } : {}),
      ...(input.milestoneId !== undefined ? { milestoneId: input.milestoneId } : {}),
      ...(input.epicId !== undefined ? { epicId: input.epicId } : {}),
      ...(input.cycleId !== undefined ? { cycleId: input.cycleId } : {}),
      ...(input.moduleId !== undefined ? { moduleId: input.moduleId } : {}),
      ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
      ...(primaryAssigneeId !== undefined
        ? { assigneeId: primaryAssigneeId }
        : {}),
      ...(nextAssigneeIds !== undefined
        ? { assigneeIds: nextAssigneeIds }
        : {}),
      ...(input.reporterId !== undefined ? { reporterId: input.reporterId } : {}),
      ...(input.startDate !== undefined ? { startDate: at(input.startDate) } : {}),
      ...(input.dueDate !== undefined ? { dueDate: at(input.dueDate) } : {}),
      ...(input.completedAt !== undefined ? { completedAt: at(input.completedAt) } : {}),
      ...(input.estimate !== undefined ? { estimate: input.estimate } : {}),
      ...(input.timeSpent !== undefined ? { timeSpent: input.timeSpent } : {}),
      ...(input.labels !== undefined ? { labels: input.labels } : {}),
      ...(updatedCustomFields !== undefined
        ? { customFields: updatedCustomFields as Prisma.InputJsonValue }
        : {}),
      ...(input.orderIndex !== undefined ? { orderIndex: input.orderIndex } : {}),
    };

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data,
      include: {
        assignee: { select: PUBLIC_USER_SELECT },
        reporter: { select: PUBLIC_USER_SELECT },
        project: true,
      },
    });

    const assigneesChanged =
      nextAssigneeIds !== undefined &&
      !this.sameStringSet(nextAssigneeIds, existing.assigneeIds);

    if (actorId) {
      if (input.status && input.status !== existing.status) {
        await this.logActivity(workspaceId, taskId, actorId, 'STATUS_CHANGED', {
          oldValue: existing.status,
          newValue: input.status,
        });
      }
      if (input.priority && input.priority !== existing.priority) {
        await this.logActivity(workspaceId, taskId, actorId, 'PRIORITY_CHANGED', {
          oldValue: existing.priority,
          newValue: input.priority,
        });
      }
      if (assigneesChanged) {
        await this.logActivity(workspaceId, taskId, actorId, 'ASSIGNED', {
          oldValue: existing.assigneeIds.join(',') || null,
          newValue: (nextAssigneeIds as string[]).join(',') || null,
        });
      }
    }

    if (assigneesChanged) {
      const next = nextAssigneeIds as string[];
      const added = next.filter((id) => !existing.assigneeIds.includes(id));
      this.events.emit(AppEvent.TaskAssigned, {
        workspaceId,
        actorId: actorId ?? null,
        taskId: updated.id,
        title: updated.title,
        identifier: updated.identifier,
        assigneeId: updated.assigneeId,
        previousAssigneeId: existing.assigneeId,
        assigneeIds: updated.assigneeIds,
        addedAssigneeIds: added,
      });
    }

    const becameDone =
      input.status === TaskStatus.DONE && existing.status !== TaskStatus.DONE;
    if (becameDone) {
      this.events.emit(AppEvent.TaskCompleted, {
        workspaceId,
        actorId: actorId ?? null,
        taskId: updated.id,
        title: updated.title,
        identifier: updated.identifier,
        assigneeId: updated.assigneeId,
        assigneeIds: updated.assigneeIds,
      });
    }

    return updated;
  }

  async moveTask(
    workspaceId: string,
    taskId: string,
    input: MoveTaskInput,
    actorId?: string,
  ) {
    const existing = await this.assertTask(workspaceId, taskId);

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: input.status,
        orderIndex: input.orderIndex,
      },
    });

    if (actorId && input.status !== existing.status) {
      await this.logActivity(workspaceId, taskId, actorId, 'STATUS_CHANGED', {
        oldValue: existing.status,
        newValue: input.status,
      });
    }

    if (
      input.status === TaskStatus.DONE &&
      existing.status !== TaskStatus.DONE
    ) {
      this.events.emit(AppEvent.TaskCompleted, {
        workspaceId,
        actorId: actorId ?? null,
        taskId: updated.id,
        title: updated.title,
        identifier: updated.identifier,
        assigneeId: updated.assigneeId,
        assigneeIds: updated.assigneeIds,
      });
    }

    return updated;
  }

  async deleteTask(workspaceId: string, taskId: string, actorId?: string): Promise<void> {
    await this.assertTask(workspaceId, taskId);
    if (actorId) {
      await this.logActivity(workspaceId, taskId, actorId, 'DELETED');
    }
    await this.prisma.task.update({
      where: { id: taskId },
      data: { deletedAt: new Date() },
    });
  }

  // --- relations ------------------------------------------------------------

  async getRelations(workspaceId: string, taskId: string) {
    await this.assertTask(workspaceId, taskId);
    return this.prisma.workItemRelation.findMany({
      where: {
        workspaceId,
        OR: [{ sourceId: taskId }, { targetId: taskId }],
      },
      include: {
        source: { select: { id: true, title: true, status: true, identifier: true } },
        target: { select: { id: true, title: true, status: true, identifier: true } },
      },
    });
  }

  async addRelation(
    workspaceId: string,
    input: CreateWorkItemRelationInput,
    actorId?: string,
  ) {
    await this.assertTask(workspaceId, input.sourceId);
    await this.assertTask(workspaceId, input.targetId);

    const relation = await this.prisma.workItemRelation.create({
      data: {
        workspaceId,
        sourceId: input.sourceId,
        targetId: input.targetId,
        type: input.type as RelationType,
      },
      include: {
        source: true,
        target: true,
      },
    });

    if (actorId) {
      await this.logActivity(workspaceId, input.sourceId, actorId, 'RELATIONS_CHANGED', {
        relationType: input.type,
        targetId: input.targetId,
      });
    }

    return relation;
  }

  async deleteRelation(workspaceId: string, relationId: string): Promise<void> {
    const relation = await this.prisma.workItemRelation.findFirst({
      where: { id: relationId, workspaceId },
    });
    if (!relation) throw new NotFoundException('Relation not found');
    await this.prisma.workItemRelation.delete({ where: { id: relationId } });
  }

  // --- saved views ----------------------------------------------------------

  async getSavedViews(workspaceId: string, projectId?: string, teamId?: string) {
    return this.prisma.savedView.findMany({
      where: {
        workspaceId,
        ...(projectId ? { projectId } : {}),
        ...(teamId ? { teamId } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  async createSavedView(
    workspaceId: string,
    userId: string | null,
    input: CreateSavedViewInput,
  ) {
    return this.prisma.savedView.create({
      data: {
        workspaceId,
        userId,
        projectId: input.projectId ?? null,
        teamId: input.teamId ?? null,
        name: input.name,
        type: (input.type as ViewType) ?? ViewType.BOARD,
        filters: JSON.stringify(input.filters),
        sorting: input.sorting ? JSON.stringify(input.sorting) : '{}',
        grouping: input.grouping ? JSON.stringify(input.grouping) : '{}',
        visibleColumns: input.visibleColumns ?? [],
        isDefault: input.isDefault ?? false,
        isShared: input.isShared ?? true,
      },
    });
  }

  async updateSavedView(workspaceId: string, viewId: string, input: UpdateSavedViewInput) {
    const view = await this.prisma.savedView.findFirst({
      where: { id: viewId, workspaceId },
    });
    if (!view) throw new NotFoundException('Saved view not found');

    return this.prisma.savedView.update({
      where: { id: viewId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.type !== undefined ? { type: input.type as ViewType } : {}),
        ...(input.filters !== undefined ? { filters: JSON.stringify(input.filters) } : {}),
        ...(input.sorting !== undefined ? { sorting: JSON.stringify(input.sorting) } : {}),
        ...(input.grouping !== undefined ? { grouping: JSON.stringify(input.grouping) } : {}),
        ...(input.visibleColumns !== undefined ? { visibleColumns: input.visibleColumns } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
        ...(input.isShared !== undefined ? { isShared: input.isShared } : {}),
      },
    });
  }

  async deleteSavedView(workspaceId: string, viewId: string): Promise<void> {
    const view = await this.prisma.savedView.findFirst({
      where: { id: viewId, workspaceId },
    });
    if (!view) throw new NotFoundException('Saved view not found');
    await this.prisma.savedView.delete({ where: { id: viewId } });
  }

  // --- intake / triage ------------------------------------------------------

  async getIntakeRequests(workspaceId: string, status?: IntakeStatus) {
    return this.prisma.intakeRequest.findMany({
      where: {
        workspaceId,
        ...(status ? { status } : {}),
      },
      include: {
        project: { select: { id: true, name: true, slug: true } },
        team: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createIntakeRequest(workspaceId: string, input: CreateIntakeRequestInput) {
    return this.prisma.intakeRequest.create({
      data: {
        workspaceId,
        teamId: input.teamId ?? null,
        projectId: input.projectId ?? null,
        title: input.title,
        description: input.description ?? null,
        source: (input.source as IntakeSource) ?? IntakeSource.USER,
        requesterName: input.requesterName ?? null,
        requesterEmail: input.requesterEmail ?? null,
        priority: (input.priority as TaskPriority) ?? TaskPriority.MEDIUM,
        slaDueDate: at(input.slaDueDate) ?? null,
      },
    });
  }

  async convertIntakeRequest(
    workspaceId: string,
    intakeId: string,
    input: ConvertIntakeRequestInput,
    actorId?: string,
  ) {
    const intake = await this.prisma.intakeRequest.findFirst({
      where: { id: intakeId, workspaceId },
    });
    if (!intake) throw new NotFoundException('Intake request not found');

    const createdTask = await this.createTask(
      workspaceId,
      {
        projectId: input.projectId,
        title: input.title || intake.title,
        description: intake.description ?? undefined,
        type: input.type ?? WorkItemType.REQUEST,
        priority: input.priority ?? (intake.priority as TaskPriority),
        assigneeId: input.assigneeId,
        labels: input.labels ?? intake.suggestedLabels,
      },
      actorId,
    );

    await this.prisma.intakeRequest.update({
      where: { id: intakeId },
      data: {
        status: IntakeStatus.CONVERTED,
        convertedWorkItemId: createdTask.id,
      },
    });

    return createdTask;
  }

  async declineIntakeRequest(workspaceId: string, intakeId: string) {
    const intake = await this.prisma.intakeRequest.findFirst({
      where: { id: intakeId, workspaceId },
    });
    if (!intake) throw new NotFoundException('Intake request not found');

    return this.prisma.intakeRequest.update({
      where: { id: intakeId },
      data: { status: IntakeStatus.DECLINED },
    });
  }

  // --- project updates ------------------------------------------------------

  async getProjectUpdates(workspaceId: string, projectId: string) {
    await this.assertProject(workspaceId, projectId);
    return this.prisma.projectUpdate.findMany({
      where: { projectId },
      include: { author: { select: PUBLIC_USER_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createProjectUpdate(
    workspaceId: string,
    authorId: string,
    input: CreateProjectUpdateInput,
  ) {
    await this.assertProject(workspaceId, input.projectId);

    const update = await this.prisma.projectUpdate.create({
      data: {
        projectId: input.projectId,
        authorId,
        status: (input.status as ProjectHealth) ?? ProjectHealth.HEALTHY,
        title: input.title,
        body: input.body ?? null,
        completedSummary: input.completedSummary ?? null,
        inProgressSummary: input.inProgressSummary ?? null,
        blockersSummary: input.blockersSummary ?? null,
        nextStepsSummary: input.nextStepsSummary ?? null,
      },
      include: { author: { select: PUBLIC_USER_SELECT } },
    });

    // Update project health
    await this.prisma.project.update({
      where: { id: input.projectId },
      data: { health: (input.status as ProjectHealth) ?? ProjectHealth.HEALTHY },
    });

    return update;
  }

  // --- comments, calendar, documents, whiteboards --------------------------

  async getTaskComments(workspaceId: string, taskId: string) {
    await this.assertTask(workspaceId, taskId);
    return this.prisma.taskComment.findMany({
      where: { taskId },
      include: { author: { select: PUBLIC_USER_SELECT } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addTaskComment(
    workspaceId: string,
    taskId: string,
    authorId: string,
    input: CreateTaskCommentInput,
  ) {
    const task = await this.assertTask(workspaceId, taskId);
    const comment = await this.prisma.taskComment.create({
      data: {
        taskId,
        authorId,
        content: input.content,
      },
      include: { author: { select: PUBLIC_USER_SELECT } },
    });

    await this.logActivity(workspaceId, taskId, authorId, 'COMMENTED', {
      commentId: comment.id,
    });

    await this.notifyCommentMentions(workspaceId, task, authorId, input.content);

    return comment;
  }

  /**
   * Fans a task comment's `@mentions` out to the notification bus.
   * Best-effort: a resolution or emit failure must never fail the comment
   * write that triggered it.
   */
  private async notifyCommentMentions(
    workspaceId: string,
    task: { id: string; title: string; identifier: string | null },
    authorId: string,
    content: string,
  ): Promise<void> {
    try {
      if (!content.includes('@')) return;

      const members = await this.prisma.workspaceMember.findMany({
        where: { workspaceId, status: 'ACTIVE' },
        select: {
          user: { select: { id: true, name: true, displayName: true } },
        },
      });

      const mentionedUserIds = resolveTextMentions(
        content,
        members.map((m) => m.user),
      ).filter((id) => id !== authorId);
      if (mentionedUserIds.length === 0) return;

      this.events.emit(AppEvent.MentionCreated, {
        workspaceId,
        actorId: authorId,
        mentionedUserIds,
        contextType: 'task',
        contextId: task.id,
        contextLabel: task.identifier
          ? `${task.identifier} ${task.title}`
          : task.title,
        deepLink: `tasks/${task.id}`,
      });
    } catch {
      // Notification fan-out is never a correctness dependency of the comment.
    }
  }

  async deleteTaskComment(
    workspaceId: string,
    commentId: string,
  ): Promise<void> {
    const comment = await this.prisma.taskComment.findUnique({
      where: { id: commentId },
      select: { task: { select: { workspaceId: true } } },
    });
    if (!comment || comment.task.workspaceId !== workspaceId) {
      throw new NotFoundException('Comment not found');
    }
    await this.prisma.taskComment.delete({ where: { id: commentId } });
  }

  async getCalendarEvents(workspaceId: string) {
    return this.prisma.calendarEvent.findMany({
      where: { workspaceId, deletedAt: null },
      include: { organizer: { select: PUBLIC_USER_SELECT } },
      orderBy: { startAt: 'asc' },
    });
  }

  async createCalendarEvent(
    workspaceId: string,
    organizerId: string,
    input: CreateCalendarEventInput,
  ) {
    return this.prisma.calendarEvent.create({
      data: {
        workspaceId,
        organizerId,
        title: input.title,
        description: input.description ?? null,
        location: input.location ?? null,
        startAt: new Date(input.startAt),
        endAt: new Date(input.endAt),
        isAllDay: input.isAllDay ?? false,
      },
      include: { organizer: { select: PUBLIC_USER_SELECT } },
    });
  }

  async updateCalendarEvent(
    workspaceId: string,
    eventId: string,
    input: UpdateCalendarEventInput,
  ) {
    await this.assertEvent(workspaceId, eventId);
    return this.prisma.calendarEvent.update({
      where: { id: eventId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.location !== undefined ? { location: input.location } : {}),
        ...(input.startAt !== undefined ? { startAt: new Date(input.startAt) } : {}),
        ...(input.endAt !== undefined ? { endAt: new Date(input.endAt) } : {}),
        ...(input.isAllDay !== undefined ? { isAllDay: input.isAllDay } : {}),
      },
      include: { organizer: { select: PUBLIC_USER_SELECT } },
    });
  }

  async deleteCalendarEvent(workspaceId: string, eventId: string): Promise<void> {
    await this.assertEvent(workspaceId, eventId);
    await this.prisma.calendarEvent.update({
      where: { id: eventId },
      data: { deletedAt: new Date() },
    });
  }

  async getDocuments(workspaceId: string) {
    return this.prisma.workDocument.findMany({
      where: { workspaceId, deletedAt: null },
      include: {
        author: { select: PUBLIC_USER_SELECT },
        children: {
          where: { deletedAt: null },
          select: { id: true, title: true, kind: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getDocument(workspaceId: string, docId: string) {
    await this.assertDocument(workspaceId, docId);
    return this.prisma.workDocument.findUniqueOrThrow({
      where: { id: docId },
      include: {
        author: { select: PUBLIC_USER_SELECT },
        children: {
          where: { deletedAt: null },
          select: { id: true, title: true, kind: true },
        },
      },
    });
  }

  async createDocument(
    workspaceId: string,
    authorId: string,
    input: CreateDocumentInput,
  ) {
    if (input.parentId) await this.assertDocument(workspaceId, input.parentId);
    const doc = await this.prisma.workDocument.create({
      data: {
        workspaceId,
        authorId,
        title: input.title,
        content: input.content ?? '',
        kind: (input.kind as DocumentKind) ?? DocumentKind.DOC,
        parentId: input.parentId ?? null,
      },
      include: {
        author: { select: PUBLIC_USER_SELECT },
        children: { select: { id: true, title: true, kind: true } },
      },
    });

    this.events.emit(AppEvent.DocumentCreated, {
      workspaceId,
      actorId: authorId,
      documentId: doc.id,
      title: doc.title,
    });

    return doc;
  }

  async updateDocument(
    workspaceId: string,
    docId: string,
    input: UpdateDocumentInput,
  ) {
    await this.assertDocument(workspaceId, docId);
    if (input.parentId) await this.assertDocument(workspaceId, input.parentId);

    const doc = await this.prisma.workDocument.update({
      where: { id: docId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
      },
      include: {
        author: { select: PUBLIC_USER_SELECT },
        children: { select: { id: true, title: true, kind: true } },
      },
    });

    this.events.emit(AppEvent.DocumentUpdated, {
      workspaceId,
      actorId: doc.authorId,
      documentId: doc.id,
      title: doc.title,
      contentChanged: input.content !== undefined,
    });

    return doc;
  }

  async deleteDocument(workspaceId: string, docId: string): Promise<void> {
    await this.assertDocument(workspaceId, docId);
    // Child documents are re-parented implicitly by the read filter — a
    // restored parent brings its subtree back with it.
    await this.prisma.workDocument.update({
      where: { id: docId },
      data: { deletedAt: new Date() },
    });

    this.events.emit(AppEvent.DocumentDeleted, {
      workspaceId,
      actorId: null,
      documentId: docId,
    });
  }

  async getWhiteboards(workspaceId: string) {
    return this.prisma.whiteboard.findMany({
      where: { workspaceId, deletedAt: null },
      include: { author: { select: PUBLIC_USER_SELECT } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getWhiteboard(workspaceId: string, whiteboardId: string) {
    await this.assertWhiteboard(workspaceId, whiteboardId);
    return this.prisma.whiteboard.findUniqueOrThrow({
      where: { id: whiteboardId },
      include: { author: { select: PUBLIC_USER_SELECT } },
    });
  }

  async createWhiteboard(
    workspaceId: string,
    authorId: string,
    input: CreateWhiteboardInput,
  ) {
    return this.prisma.whiteboard.create({
      data: {
        workspaceId,
        authorId,
        name: input.name,
        canvasData: JSON.stringify({ nodes: [], edges: [] }),
      },
      include: { author: { select: PUBLIC_USER_SELECT } },
    });
  }

  async updateWhiteboard(
    workspaceId: string,
    whiteboardId: string,
    input: UpdateWhiteboardInput,
  ) {
    await this.assertWhiteboard(workspaceId, whiteboardId);
    return this.prisma.whiteboard.update({
      where: { id: whiteboardId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.canvasData !== undefined ? { canvasData: input.canvasData } : {}),
      },
      include: { author: { select: PUBLIC_USER_SELECT } },
    });
  }

  async deleteWhiteboard(workspaceId: string, whiteboardId: string): Promise<void> {
    await this.assertWhiteboard(workspaceId, whiteboardId);
    await this.prisma.whiteboard.update({
      where: { id: whiteboardId },
      data: { deletedAt: new Date() },
    });
  }

  // --- activity logging & helpers -------------------------------------------

  private async logActivity(
    workspaceId: string,
    workItemId: string,
    actorId: string,
    action: string,
    metadata: Record<string, unknown> = {},
  ) {
    try {
      await this.prisma.workItemActivity.create({
        data: {
          workspaceId,
          workItemId,
          actorId,
          action,
          metadata: JSON.stringify(metadata),
        },
      });
    } catch {
      // Activity logging is non-blocking
    }
  }

  private async topOfColumn(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    projectId: string | null,
    status: TaskStatus,
  ): Promise<number> {
    const first = await tx.task.findFirst({
      where: { workspaceId, projectId, status },
      orderBy: { orderIndex: 'asc' },
      select: { orderIndex: true },
    });

    if (!first) return ORDER_STRIDE;
    return Math.max(0, Math.floor(first.orderIndex / 2));
  }

  private async assertTeam(workspaceId: string, teamId: string) {
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, workspaceId },
    });
    if (!team) throw new NotFoundException('Team not found');
    return team;
  }

  private async assertInitiative(workspaceId: string, initiativeId: string) {
    const init = await this.prisma.initiative.findFirst({
      where: { id: initiativeId, workspaceId },
    });
    if (!init) throw new NotFoundException('Initiative not found');
    return init;
  }

  private async assertProject(workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId, deletedAt: null },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  private async assertTask(workspaceId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId, deletedAt: null },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  private async assertSprint(workspaceId: string, sprintId: string) {
    const sprint = await this.prisma.sprint.findFirst({
      where: { id: sprintId, project: { workspaceId } },
      select: { id: true },
    });
    if (!sprint) throw new NotFoundException('Sprint not found');
  }

  private async assertMilestone(workspaceId: string, milestoneId: string) {
    const milestone = await this.prisma.milestone.findFirst({
      where: { id: milestoneId, project: { workspaceId } },
      select: { id: true },
    });
    if (!milestone) throw new NotFoundException('Milestone not found');
  }

  private async assertEpicOwned(workspaceId: string, epicId: string) {
    const epic = await this.prisma.epic.findFirst({
      where: { id: epicId, workspaceId },
      select: { id: true },
    });
    if (!epic) throw new NotFoundException('Epic not found');
  }

  private async assertModuleOwned(workspaceId: string, moduleId: string) {
    const mod = await this.prisma.module.findFirst({
      where: { id: moduleId, workspaceId },
      select: { id: true },
    });
    if (!mod) throw new NotFoundException('Module not found');
  }

  private async assertCycleOwned(workspaceId: string, cycleId: string) {
    const cycle = await this.prisma.cycle.findFirst({
      where: { id: cycleId, workspaceId },
      select: { id: true },
    });
    if (!cycle) throw new NotFoundException('Cycle not found');
  }

  /**
   * Confirms a user id belongs to this workspace before it is written onto a
   * row as an assignee, reporter, lead or owner. Without this a member of one
   * workspace can attach any platform user id — or any sibling workspace's
   * sprint / milestone / epic — to a task, which is a cross-tenant write
   * (audit S1). 404, not 403, so it cannot be used to probe which ids exist.
   */
  private async assertWorkspaceUser(workspaceId: string, userId: string) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
      select: { id: true },
    });
    if (!member) throw new NotFoundException('User is not a member of this workspace');
  }

  /** Validates every foreign key a task create/update can carry. */
  private async assertTaskLinks(
    workspaceId: string,
    input: {
      projectId?: string | null;
      teamId?: string | null;
      sprintId?: string | null;
      milestoneId?: string | null;
      epicId?: string | null;
      cycleId?: string | null;
      moduleId?: string | null;
      parentId?: string | null;
      assigneeId?: string | null;
      assigneeIds?: string[];
      reporterId?: string | null;
    },
  ) {
    if (input.projectId) await this.assertProject(workspaceId, input.projectId);
    if (input.teamId) await this.assertTeam(workspaceId, input.teamId);
    if (input.sprintId) await this.assertSprint(workspaceId, input.sprintId);
    if (input.milestoneId) await this.assertMilestone(workspaceId, input.milestoneId);
    if (input.epicId) await this.assertEpicOwned(workspaceId, input.epicId);
    if (input.cycleId) await this.assertCycleOwned(workspaceId, input.cycleId);
    if (input.moduleId) await this.assertModuleOwned(workspaceId, input.moduleId);
    if (input.parentId) await this.assertTask(workspaceId, input.parentId);
    if (input.assigneeId) await this.assertWorkspaceUser(workspaceId, input.assigneeId);
    for (const id of new Set(input.assigneeIds ?? [])) {
      if (id) await this.assertWorkspaceUser(workspaceId, id);
    }
    if (input.reporterId) await this.assertWorkspaceUser(workspaceId, input.reporterId);
  }

  private async assertEvent(workspaceId: string, eventId: string) {
    const event = await this.prisma.calendarEvent.findFirst({
      where: { id: eventId, workspaceId, deletedAt: null },
    });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  private async assertDocument(workspaceId: string, docId: string) {
    const doc = await this.prisma.workDocument.findFirst({
      where: { id: docId, workspaceId, deletedAt: null },
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  private async assertWhiteboard(workspaceId: string, whiteboardId: string) {
    const board = await this.prisma.whiteboard.findFirst({
      where: { id: whiteboardId, workspaceId, deletedAt: null },
    });
    if (!board) throw new NotFoundException('Whiteboard not found');
    return board;
  }

  // --- soft delete plumbing ----------------------------------------------
  //
  // The `assert*` helpers only ever see live rows; restore is the one path
  // that looks *for* a `deletedAt`.

  async restoreProject(workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId, deletedAt: { not: null } },
      select: { deletedAt: true },
    });
    if (!project?.deletedAt) {
      throw new NotFoundException('No deleted project with that id.');
    }
    // Bring back only the tasks this project's delete took down with it —
    // matched by the shared timestamp — not ones deleted individually earlier.
    await this.prisma.$transaction([
      this.prisma.task.updateMany({
        where: { projectId, deletedAt: project.deletedAt },
        data: { deletedAt: null },
      }),
      this.prisma.project.update({
        where: { id: projectId },
        data: { deletedAt: null },
      }),
    ]);
    return this.getProject(workspaceId, projectId);
  }

  async restoreTask(workspaceId: string, taskId: string) {
    const { count } = await this.prisma.task.updateMany({
      where: { id: taskId, workspaceId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    if (count === 0) throw new NotFoundException('No deleted task with that id.');
    return this.getTask(workspaceId, taskId);
  }

  async restoreDocument(workspaceId: string, docId: string) {
    const { count } = await this.prisma.workDocument.updateMany({
      where: { id: docId, workspaceId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    if (count === 0) {
      throw new NotFoundException('No deleted document with that id.');
    }
    return this.getDocument(workspaceId, docId);
  }

  async restoreWhiteboard(workspaceId: string, whiteboardId: string) {
    const { count } = await this.prisma.whiteboard.updateMany({
      where: { id: whiteboardId, workspaceId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    if (count === 0) {
      throw new NotFoundException('No deleted whiteboard with that id.');
    }
    return this.getWhiteboard(workspaceId, whiteboardId);
  }

  async restoreCalendarEvent(workspaceId: string, eventId: string) {
    const { count } = await this.prisma.calendarEvent.updateMany({
      where: { id: eventId, workspaceId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    if (count === 0) throw new NotFoundException('No deleted event with that id.');
    return this.prisma.calendarEvent.findUniqueOrThrow({
      where: { id: eventId },
      include: { organizer: { select: PUBLIC_USER_SELECT } },
    });
  }

  /** The workspace's recycle bin — everything soft-deleted, newest first. */
  async listDeleted(workspaceId: string) {
    const [projects, tasks, documents, whiteboards, events] = await Promise.all([
      this.prisma.project.findMany({
        where: { workspaceId, deletedAt: { not: null } },
        select: { id: true, name: true, deletedAt: true },
        orderBy: { deletedAt: 'desc' },
      }),
      this.prisma.task.findMany({
        where: { workspaceId, deletedAt: { not: null } },
        select: { id: true, title: true, identifier: true, deletedAt: true },
        orderBy: { deletedAt: 'desc' },
      }),
      this.prisma.workDocument.findMany({
        where: { workspaceId, deletedAt: { not: null } },
        select: { id: true, title: true, deletedAt: true },
        orderBy: { deletedAt: 'desc' },
      }),
      this.prisma.whiteboard.findMany({
        where: { workspaceId, deletedAt: { not: null } },
        select: { id: true, name: true, deletedAt: true },
        orderBy: { deletedAt: 'desc' },
      }),
      this.prisma.calendarEvent.findMany({
        where: { workspaceId, deletedAt: { not: null } },
        select: { id: true, title: true, deletedAt: true },
        orderBy: { deletedAt: 'desc' },
      }),
    ]);
    return { projects, tasks, documents, whiteboards, events };
  }
}
