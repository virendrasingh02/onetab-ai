import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  assertContentAllowed,
  AppEvent,
  createWithUniqueSlug,
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
  docContentToText,
  formatTicketIdentifier,
  generateProjectIdentifier,
  isValidIdentifierPrefix,
  slugify,
} from '@org/utils';
import { PROJECT_SLUG_MAX_LENGTH } from '@org/validation';
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
  CreateTaskLabelInput,
  CreateTaskStateInput,
  CreateTeamInput,
  CreateWorkItemRelationInput,
  MoveTaskInput,
  ProjectIdentifierSettingsInput,
  ReorderTaskStatesInput,
  UpdateCalendarEventInput,
  UpdateCycleInput,
  UpdateDocumentInput,
  UpdateEpicInput,
  UpdateInitiativeInput,
  UpdateModuleInput,
  UpdateProjectInput,
  UpdateSavedViewInput,
  UpdateTaskCommentInput,
  UpdateTaskInput,
  UpdateTaskLabelInput,
  UpdateTaskStateInput,
  UpdateTeamInput,
} from '@org/validation';

/**
 * The six built-in statuses as a new workspace's workflow starts out. Names
 * here are the ones every menu shows until someone renames them.
 */
const DEFAULT_TASK_STATES: ReadonlyArray<{
  builtin: TaskStatus;
  name: string;
  color: string;
}> = [
  { builtin: TaskStatus.BACKLOG, name: 'Backlog', color: '#94a3b8' },
  { builtin: TaskStatus.TODO, name: 'Planned', color: '#3b82f6' },
  { builtin: TaskStatus.IN_PROGRESS, name: 'In Progress', color: '#f59e0b' },
  { builtin: TaskStatus.IN_REVIEW, name: 'In Review', color: '#8b5cf6' },
  { builtin: TaskStatus.DONE, name: 'Completed', color: '#10b981' },
  { builtin: TaskStatus.CANCELLED, name: 'Cancelled', color: '#64748b' },
];

const TASK_STATUS_VALUES = new Set<string>(Object.values(TaskStatus));

interface TaskStateRow {
  id: string;
  name: string;
  color: string;
  category: TaskStatus;
  builtin: TaskStatus | null;
  position: number;
}

/** Built-ins go out under their status name, so the enum still identifies them. */
function taskStateDto(row: TaskStateRow) {
  return {
    id: row.builtin ?? row.id,
    name: row.name,
    color: row.color,
    category: row.category,
    builtin: row.builtin !== null,
    position: row.position,
  };
}

/** Converts an optional ISO string from a DTO into a `Date` for Prisma. */
function at(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  return value === null ? null : new Date(value);
}

/** Gap left between neighbouring cards in a column. */
const ORDER_STRIDE = 1024;

/** What a history row records; anything beyond the three columns is metadata. */
type ActivityDetails = {
  fieldChanged?: string;
  oldValue?: string | null;
  newValue?: string | null;
} & Record<string, unknown>;

/** Task fields whose edits reach the history feed. */
const TRACKED_TASK_FIELDS = [
  'title',
  'description',
  'type',
  'startDate',
  'dueDate',
  'estimate',
  'timeSpent',
  'labels',
  'reporterId',
  'teamId',
  'epicId',
  'cycleId',
  'moduleId',
  'parentId',
] as const;

type TrackedTaskFields = Record<(typeof TRACKED_TASK_FIELDS)[number], unknown>;

function activityValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return JSON.stringify([...value].sort());
  return String(value);
}

/**
 * One history entry per field `input` actually changed. A description can run
 * to 10,000 characters, so its entry records that it changed, not the text.
 */
function taskFieldChanges(
  before: TrackedTaskFields,
  after: TrackedTaskFields,
  input: UpdateTaskInput,
): ActivityDetails[] {
  return TRACKED_TASK_FIELDS.flatMap((field): ActivityDetails[] => {
    if (input[field] === undefined) return [];
    const oldValue = activityValue(before[field]);
    const newValue = activityValue(after[field]);
    if (oldValue === newValue) return [];
    return field === 'description'
      ? [{ fieldChanged: field }]
      : [{ fieldChanged: field, oldValue, newValue }];
  });
}

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
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
        ...(input.iconColor !== undefined
          ? { iconColor: input.iconColor }
          : {}),
      },
    });
  }

  async deleteTeam(workspaceId: string, teamId: string): Promise<void> {
    await this.assertTeam(workspaceId, teamId);
    await this.prisma.team.delete({ where: { id: teamId } });
  }

  // --- task labels ----------------------------------------------------------
  //
  // `Task.labels` stores label *names*, so the catalogue is the source of each
  // name's colour, and a rename or delete here is written through to every task
  // in the workspace that carries it — otherwise a card would keep a label that
  // no longer exists, or lose its colour on a rename.

  async getTaskLabels(workspaceId: string) {
    return this.prisma.taskLabel.findMany({
      where: { workspaceId },
      orderBy: { name: 'asc' },
    });
  }

  /** Idempotent by name: tagging a card with a new label creates it once. */
  async createTaskLabel(workspaceId: string, input: CreateTaskLabelInput) {
    assertContentAllowed(input.name);
    return this.prisma.taskLabel.upsert({
      where: { workspaceId_name: { workspaceId, name: input.name } },
      create: {
        workspaceId,
        name: input.name,
        ...(input.color ? { color: input.color } : {}),
      },
      update: {},
    });
  }

  async updateTaskLabel(
    workspaceId: string,
    labelId: string,
    input: UpdateTaskLabelInput,
  ) {
    const label = await this.assertTaskLabel(workspaceId, labelId);
    const renamed = input.name !== undefined && input.name !== label.name;
    if (renamed) {
      const clash = await this.prisma.taskLabel.findUnique({
        where: {
          workspaceId_name: { workspaceId, name: input.name as string },
        },
      });
      if (clash) {
        throw new ConflictException(
          `A label named "${input.name}" already exists`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.taskLabel.update({
        where: { id: labelId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.color !== undefined ? { color: input.color } : {}),
        },
      });
      if (renamed) {
        await tx.$executeRaw`
          UPDATE "tasks"
          SET "labels" = array_replace("labels", ${label.name}, ${input.name as string})
          WHERE "workspaceId" = ${workspaceId} AND ${label.name} = ANY("labels")`;
      }
      return updated;
    });
  }

  async deleteTaskLabel(workspaceId: string, labelId: string): Promise<void> {
    const label = await this.assertTaskLabel(workspaceId, labelId);
    await this.prisma.$transaction([
      this.prisma.$executeRaw`
        UPDATE "tasks"
        SET "labels" = array_remove("labels", ${label.name})
        WHERE "workspaceId" = ${workspaceId} AND ${label.name} = ANY("labels")`,
      this.prisma.taskLabel.delete({ where: { id: labelId } }),
    ]);
  }

  // --- task workflow states -------------------------------------------------
  //
  // `Task.status` stays the enum and always holds the state's category, so the
  // completion stamp, "open work" queries, automations and analytics read it
  // unchanged. `Task.stateId` only names a custom state; null means the
  // built-in one for the category. Built-ins are rows too, seeded on first
  // read, so they can be renamed, recoloured and reordered, never deleted.

  async getTaskStates(workspaceId: string) {
    await this.ensureDefaultTaskStates(workspaceId);
    const rows = await this.prisma.taskWorkflowState.findMany({
      where: { workspaceId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(taskStateDto);
  }

  async createTaskState(workspaceId: string, input: CreateTaskStateInput) {
    assertContentAllowed(input.name);
    await this.ensureDefaultTaskStates(workspaceId);
    await this.assertTaskStateNameFree(workspaceId, input.name);
    const siblings = await this.prisma.taskWorkflowState.findMany({
      where: { workspaceId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, category: true },
    });
    const row = await this.prisma.taskWorkflowState.create({
      data: {
        workspaceId,
        name: input.name,
        category: input.category as TaskStatus,
        ...(input.color ? { color: input.color } : {}),
      },
    });
    // Lands after the last state of its category, so "QA" added under In
    // review sits next to In Review rather than at the far right.
    let insertAt = siblings.length;
    for (let i = siblings.length - 1; i >= 0; i -= 1) {
      if (siblings[i].category === input.category) {
        insertAt = i + 1;
        break;
      }
    }
    const ids = siblings.map((sibling) => sibling.id);
    ids.splice(insertAt, 0, row.id);
    await this.writeTaskStateOrder(ids);
    return taskStateDto({ ...row, position: (insertAt + 1) * ORDER_STRIDE });
  }

  async updateTaskState(
    workspaceId: string,
    stateId: string,
    input: UpdateTaskStateInput,
  ) {
    const row = await this.assertTaskState(workspaceId, stateId);
    if (input.name !== undefined && input.name !== row.name) {
      assertContentAllowed(input.name);
      await this.assertTaskStateNameFree(workspaceId, input.name, row.id);
    }
    const updated = await this.prisma.taskWorkflowState.update({
      where: { id: row.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
      },
    });
    return taskStateDto(updated);
  }

  async reorderTaskStates(workspaceId: string, input: ReorderTaskStatesInput) {
    await this.ensureDefaultTaskStates(workspaceId);
    const rows = await this.prisma.taskWorkflowState.findMany({
      where: { workspaceId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    const byClientId = new Map(rows.map((r) => [r.builtin ?? r.id, r.id]));
    const listed = input.ids
      .map((id) => byClientId.get(id))
      .filter((id): id is string => !!id);
    const listedSet = new Set(listed);
    // Anything the caller left out keeps its relative place, after the rest.
    const order = [
      ...listed,
      ...rows.map((r) => r.id).filter((id) => !listedSet.has(id)),
    ];
    await this.writeTaskStateOrder(order);
    return this.getTaskStates(workspaceId);
  }

  async deleteTaskState(workspaceId: string, stateId: string): Promise<void> {
    const row = await this.assertTaskState(workspaceId, stateId);
    if (row.builtin) {
      throw new BadRequestException(
        'Built-in statuses can be renamed but not deleted',
      );
    }
    // Its tasks fall back to the built-in status of the same category (the FK
    // nulls `stateId`); board column orders drop the id.
    await this.prisma.$transaction([
      this.prisma.$executeRaw`
        UPDATE "projects"
        SET "columnOrder" = array_remove("columnOrder", ${row.id})
        WHERE "workspaceId" = ${workspaceId} AND ${row.id} = ANY("columnOrder")`,
      this.prisma.taskWorkflowState.delete({ where: { id: row.id } }),
    ]);
  }

  private async ensureDefaultTaskStates(workspaceId: string) {
    const seeded = await this.prisma.taskWorkflowState.count({
      where: { workspaceId, builtin: { not: null } },
    });
    if (seeded >= DEFAULT_TASK_STATES.length) return;
    await this.prisma.taskWorkflowState.createMany({
      data: DEFAULT_TASK_STATES.map((state, index) => ({
        workspaceId,
        name: state.name,
        color: state.color,
        category: state.builtin,
        builtin: state.builtin,
        position: (index + 1) * ORDER_STRIDE,
      })),
      skipDuplicates: true,
    });
  }

  private async writeTaskStateOrder(ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.taskWorkflowState.update({
          where: { id },
          data: { position: (index + 1) * ORDER_STRIDE },
        }),
      ),
    );
  }

  /** A state by the id clients use: a status name for built-ins, else the row id. */
  private async assertTaskState(workspaceId: string, stateId: string) {
    const isBuiltin = TASK_STATUS_VALUES.has(stateId);
    if (isBuiltin) await this.ensureDefaultTaskStates(workspaceId);
    const row = await this.prisma.taskWorkflowState.findFirst({
      where: isBuiltin
        ? { workspaceId, builtin: stateId as TaskStatus }
        : { workspaceId, id: stateId },
    });
    if (!row) throw new NotFoundException('Status not found');
    return row;
  }

  private async assertTaskStateNameFree(
    workspaceId: string,
    name: string,
    exceptId?: string,
  ) {
    const clash = await this.prisma.taskWorkflowState.findFirst({
      where: {
        workspaceId,
        name: { equals: name, mode: 'insensitive' },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException(`A status named "${name}" already exists`);
    }
  }

  /**
   * The `status`/`stateId` pair a task write should store.
   *
   * `stateId` wins when sent: a built-in id (`DONE`) is that status with no
   * custom state, a custom id stores its category as `status`. A bare `status`
   * clears the custom state, unless it repeats the task's current category, so
   * a patch that only echoes the status does not knock a task out of "QA".
   */
  private async resolveTaskState(
    workspaceId: string,
    input: { status?: string; stateId?: string | null },
    existing?: { status: string; stateId: string | null },
  ): Promise<{ status?: TaskStatus; stateId?: string | null }> {
    const { status, stateId } = input;
    if (stateId) {
      if (TASK_STATUS_VALUES.has(stateId)) {
        return { status: stateId as TaskStatus, stateId: null };
      }
      const row = await this.prisma.taskWorkflowState.findFirst({
        where: { id: stateId, workspaceId, builtin: null },
        select: { id: true, category: true },
      });
      if (!row) throw new NotFoundException('Status not found');
      return { status: row.category, stateId: row.id };
    }
    if (status === undefined) {
      return stateId === null ? { stateId: null } : {};
    }
    if (stateId === undefined && existing && existing.status === status) {
      return { status: status as TaskStatus };
    }
    return { status: status as TaskStatus, stateId: null };
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
        ...(input.objective !== undefined
          ? { objective: input.objective }
          : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
        ...(input.status !== undefined
          ? { status: input.status as ProjectStatus }
          : {}),
        ...(input.health !== undefined
          ? { health: input.health as ProjectHealth }
          : {}),
        ...(input.priority !== undefined
          ? { priority: input.priority as TaskPriority }
          : {}),
        ...(input.targetDate !== undefined
          ? { targetDate: at(input.targetDate) }
          : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
        ...(input.iconColor !== undefined
          ? { iconColor: input.iconColor }
          : {}),
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

  async deleteInitiative(
    workspaceId: string,
    initiativeId: string,
  ): Promise<void> {
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
    assertContentAllowed(input.name, input.description);
    if (input.teamId) await this.assertTeam(workspaceId, input.teamId);
    if (input.leadId) await this.assertWorkspaceUser(workspaceId, input.leadId);
    if (input.initiativeId)
      await this.assertInitiative(workspaceId, input.initiativeId);

    // A prefix the user chose is theirs to fix; a generated one just retries.
    const chosenPrefix = input.ticketPrefix?.toUpperCase();
    if (chosenPrefix) {
      const clash = await this.prisma.project.findFirst({
        where: { workspaceId, ticketPrefix: chosenPrefix },
      });
      if (clash) {
        throw new ConflictException(
          `Ticket prefix "${chosenPrefix}" is already in use by project "${clash.name}"`,
        );
      }
    }

    const derivedSlug = slugify(input.name);
    const project = await createWithUniqueSlug({
      base: input.slug ?? (derivedSlug.length >= 2 ? derivedSlug : 'project'),
      maxLength: PROJECT_SLUG_MAX_LENGTH,
      retryOnFields: chosenPrefix ? [] : ['ticketPrefix'],
      // Soft-deleted projects count: they keep their slug and prefix to restore.
      findTaken: async (prefix) =>
        (
          await this.prisma.project.findMany({
            where: { workspaceId, slug: { startsWith: prefix } },
            select: { slug: true },
          })
        ).map((p) => p.slug),
      create: async (slug) => {
        const ticketPrefix =
          chosenPrefix ??
          generateProjectIdentifier(
            input.name,
            (
              await this.prisma.project.findMany({
                where: { workspaceId },
                select: { ticketPrefix: true },
              })
            ).flatMap((p) => (p.ticketPrefix ? [p.ticketPrefix] : [])),
          );
        return this.prisma.project.create({
          data: {
            workspaceId,
            name: input.name,
            slug,
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
            ticketPrefix,
            identifierPrefixMode:
              (input.identifierPrefixMode as IdentifierPrefixMode) ??
              IdentifierPrefixMode.AUTO,
          },
          include: {
            lead: { select: PUBLIC_USER_SELECT },
            team: true,
          },
        });
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
    assertContentAllowed(input.name, input.description);
    const existing = await this.assertProject(workspaceId, projectId);
    if (input.teamId) await this.assertTeam(workspaceId, input.teamId);
    if (input.leadId) await this.assertWorkspaceUser(workspaceId, input.leadId);
    if (input.initiativeId)
      await this.assertInitiative(workspaceId, input.initiativeId);

    if (
      input.ticketPrefix !== undefined &&
      input.ticketPrefix !== existing.ticketPrefix
    ) {
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
      ...(input.columnOrder !== undefined
        ? { columnOrder: input.columnOrder }
        : {}),
      ...(input.ticketPrefix !== undefined
        ? { ticketPrefix: input.ticketPrefix }
        : {}),
      ...(input.identifierPrefixMode !== undefined
        ? {
            identifierPrefixMode:
              input.identifierPrefixMode as IdentifierPrefixMode,
          }
        : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
      ...(input.iconColor !== undefined ? { iconColor: input.iconColor } : {}),
      ...(input.status !== undefined
        ? { status: input.status as ProjectStatus }
        : {}),
      ...(input.health !== undefined
        ? { health: input.health as ProjectHealth }
        : {}),
      ...(input.healthScore !== undefined
        ? { healthScore: input.healthScore }
        : {}),
      ...(input.teamId !== undefined ? { teamId: input.teamId } : {}),
      ...(input.leadId !== undefined ? { leadId: input.leadId } : {}),
      ...(input.initiativeId !== undefined
        ? { initiativeId: input.initiativeId }
        : {}),
      ...(input.startDate !== undefined
        ? { startDate: at(input.startDate) }
        : {}),
      ...(input.targetDate !== undefined
        ? { targetDate: at(input.targetDate) }
        : {}),
    };

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data,
      include: {
        lead: { select: PUBLIC_USER_SELECT },
        team: true,
      },
    });

    // Was declared and listened for (realtime, agent triggers) but never
    // emitted. `statusChanged` lets "when a project changes status" agents
    // ignore renames and colour changes.
    this.events.emit(AppEvent.ProjectUpdated, {
      workspaceId,
      actorId: null,
      projectId,
      name: updated.name,
      status: updated.status,
      previousStatus: existing.status,
      health: updated.health,
      previousHealth: existing.health,
      statusChanged:
        updated.status !== existing.status ||
        updated.health !== existing.health,
      changes: input,
    });

    return updated;
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
        throw new ConflictException(
          `Prefix "${upper}" is already used by "${clash.name}"`,
        );
      }
      prefix = upper;
    }

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ticketPrefix: prefix,
        ...(input.identifierPrefixMode
          ? {
              identifierPrefixMode:
                input.identifierPrefixMode as IdentifierPrefixMode,
            }
          : {}),
      },
    });

    if (actorId && prefix !== project.ticketPrefix) {
      await this.logActivity(
        workspaceId,
        projectId,
        actorId,
        'PREFIX_CHANGED',
        {
          oldPrefix: project.ticketPrefix,
          newPrefix: prefix,
        },
      );
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

  async updateEpic(
    workspaceId: string,
    epicId: string,
    input: UpdateEpicInput,
  ) {
    const epic = await this.prisma.epic.findFirst({
      where: { id: epicId, workspaceId },
    });
    if (!epic) throw new NotFoundException('Epic not found');

    return this.prisma.epic.update({
      where: { id: epicId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
        ...(input.status !== undefined
          ? { status: input.status as ProjectStatus }
          : {}),
        ...(input.priority !== undefined
          ? { priority: input.priority as TaskPriority }
          : {}),
        ...(input.targetDate !== undefined
          ? { targetDate: at(input.targetDate) }
          : {}),
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

  async updateModule(
    workspaceId: string,
    moduleId: string,
    input: UpdateModuleInput,
  ) {
    const mod = await this.prisma.module.findFirst({
      where: { id: moduleId, workspaceId },
    });
    if (!mod) throw new NotFoundException('Module not found');

    return this.prisma.module.update({
      where: { id: moduleId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.leadId !== undefined ? { leadId: input.leadId } : {}),
        ...(input.startDate !== undefined
          ? { startDate: at(input.startDate) }
          : {}),
        ...(input.targetDate !== undefined
          ? { targetDate: at(input.targetDate) }
          : {}),
        ...(input.status !== undefined
          ? { status: input.status as ProjectStatus }
          : {}),
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
          select: {
            id: true,
            status: true,
            priority: true,
            title: true,
            estimate: true,
          },
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

  async updateCycle(
    workspaceId: string,
    cycleId: string,
    input: UpdateCycleInput,
  ) {
    const cycle = await this.prisma.cycle.findFirst({
      where: { id: cycleId, workspaceId },
    });
    if (!cycle) throw new NotFoundException('Cycle not found');

    return this.prisma.cycle.update({
      where: { id: cycleId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.goal !== undefined ? { goal: input.goal } : {}),
        ...(input.startDate !== undefined
          ? { startDate: new Date(input.startDate) }
          : {}),
        ...(input.endDate !== undefined
          ? { endDate: new Date(input.endDate) }
          : {}),
        ...(input.status !== undefined
          ? { status: input.status as CycleStatus }
          : {}),
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
      limit?: number;
      offset?: number;
      cursor?: string;
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
                {
                  identifier: { contains: options.search, mode: 'insensitive' },
                },
                {
                  description: {
                    contains: options.search,
                    mode: 'insensitive',
                  },
                },
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
      // A project board draws every task it has. With a flat cap of 100, and
      // rows ordered by status, the later columns silently came up short.
      take: projectId
        ? Math.min(options?.limit ? Number(options.limit) : 2000, 2000)
        : Math.min(options?.limit ? Number(options.limit) : 100, 250),
      ...(options?.offset ? { skip: Number(options.offset) } : {}),
      ...(options?.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
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
          // `orderIndex` is the board column's order, where new tasks go on top.
          orderBy: { createdAt: 'asc' },
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
        meeting: {
          select: { id: true, title: true, startAt: true, status: true },
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

  async createTask(
    workspaceId: string,
    input: CreateTaskInput,
    actorId?: string,
  ) {
    assertContentAllowed(input.title, input.description);
    await this.assertTaskLinks(workspaceId, input);

    const resolved = await this.resolveTaskState(workspaceId, input);
    const status = resolved.status ?? TaskStatus.TODO;
    const projectId = input.projectId ?? null;

    const assigneeIds = this.orderAssignees(
      input.assigneeIds ?? (input.assigneeId ? [input.assigneeId] : []),
      input.assigneeId,
    );
    const primaryAssigneeId = assigneeIds[0] ?? null;
    // `assigneeIds` is its own column now — no longer stashed in customFields.
    const customFields = (input.customFields as Record<string, unknown>) ?? {};

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
        stateId: resolved.stateId ?? null,
        ...(status === TaskStatus.DONE ? { completedAt: new Date() } : {}),
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
        meetingId: input.meetingId ?? null,
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
    assertContentAllowed(input.title, input.description);
    const existing = await this.assertTask(workspaceId, taskId);
    await this.assertTaskLinks(workspaceId, input);
    const resolved = await this.resolveTaskState(workspaceId, input, existing);
    const nextStatus = resolved.status;

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
      nextAssigneeIds !== undefined ? (nextAssigneeIds[0] ?? null) : undefined;

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
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.type !== undefined ? { type: input.type as WorkItemType } : {}),
      ...(nextStatus !== undefined ? { status: nextStatus } : {}),
      ...(resolved.stateId !== undefined ? { stateId: resolved.stateId } : {}),
      ...(input.priority !== undefined
        ? { priority: input.priority as TaskPriority }
        : {}),
      ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
      ...(input.teamId !== undefined ? { teamId: input.teamId } : {}),
      ...(input.sprintId !== undefined ? { sprintId: input.sprintId } : {}),
      ...(input.milestoneId !== undefined
        ? { milestoneId: input.milestoneId }
        : {}),
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
      ...(input.reporterId !== undefined
        ? { reporterId: input.reporterId }
        : {}),
      ...(input.startDate !== undefined
        ? { startDate: at(input.startDate) }
        : {}),
      ...(input.dueDate !== undefined ? { dueDate: at(input.dueDate) } : {}),
      ...(input.completedAt !== undefined
        ? { completedAt: at(input.completedAt) }
        : nextStatus !== undefined
          ? this.completionStamp(existing.status, nextStatus)
          : {}),
      ...(input.estimate !== undefined ? { estimate: input.estimate } : {}),
      ...(input.timeSpent !== undefined ? { timeSpent: input.timeSpent } : {}),
      ...(input.labels !== undefined ? { labels: input.labels } : {}),
      ...(updatedCustomFields !== undefined
        ? { customFields: updatedCustomFields as Prisma.InputJsonValue }
        : {}),
      ...(input.orderIndex !== undefined
        ? { orderIndex: input.orderIndex }
        : {}),
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
      // Logged as state ids, so the feed can name a custom status.
      const oldState = existing.stateId ?? existing.status;
      const newState = updated.stateId ?? updated.status;
      if (oldState !== newState) {
        await this.logActivity(workspaceId, taskId, actorId, 'STATUS_CHANGED', {
          oldValue: oldState,
          newValue: newState,
        });
      }
      if (input.priority && input.priority !== existing.priority) {
        await this.logActivity(
          workspaceId,
          taskId,
          actorId,
          'PRIORITY_CHANGED',
          {
            oldValue: existing.priority,
            newValue: input.priority,
          },
        );
      }
      if (assigneesChanged) {
        await this.logActivity(workspaceId, taskId, actorId, 'ASSIGNED', {
          oldValue: existing.assigneeIds.join(',') || null,
          newValue: (nextAssigneeIds as string[]).join(',') || null,
        });
      }
      for (const change of taskFieldChanges(existing, updated, input)) {
        await this.logActivity(
          workspaceId,
          taskId,
          actorId,
          'FIELD_CHANGED',
          change,
        );
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
      nextStatus === TaskStatus.DONE && existing.status !== TaskStatus.DONE;
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

    this.events.emit(AppEvent.TaskUpdated, {
      workspaceId,
      actorId: actorId ?? null,
      taskId: updated.id,
      changes: input,
    });

    return updated;
  }

  /**
   * `completedAt` follows the status: set when a task becomes DONE, cleared
   * when it is reopened. Only callers that sent it explicitly used to set it,
   * so the board's "Done" column and every "completed today" query read null.
   */
  private completionStamp(
    from: string,
    to: string | undefined,
  ): { completedAt?: Date | null } {
    if (!to || to === from) return {};
    if (to === TaskStatus.DONE) return { completedAt: new Date() };
    if (from === TaskStatus.DONE) return { completedAt: null };
    return {};
  }

  async moveTask(
    workspaceId: string,
    taskId: string,
    input: MoveTaskInput,
    actorId?: string,
  ) {
    const existing = await this.assertTask(workspaceId, taskId);
    const resolved = await this.resolveTaskState(workspaceId, input, existing);
    const status = resolved.status ?? (input.status as TaskStatus);

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status,
        ...(resolved.stateId !== undefined
          ? { stateId: resolved.stateId }
          : {}),
        orderIndex: input.orderIndex,
        ...this.completionStamp(existing.status, status),
      },
    });

    const oldState = existing.stateId ?? existing.status;
    const newState = updated.stateId ?? updated.status;
    if (actorId && oldState !== newState) {
      await this.logActivity(workspaceId, taskId, actorId, 'STATUS_CHANGED', {
        oldValue: oldState,
        newValue: newState,
      });
    }

    if (status === TaskStatus.DONE && existing.status !== TaskStatus.DONE) {
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

    this.events.emit(AppEvent.TaskMoved, {
      workspaceId,
      actorId: actorId ?? null,
      taskId: updated.id,
      toStatus: status,
      newOrder: input.orderIndex,
    });

    return updated;
  }

  async deleteTask(
    workspaceId: string,
    taskId: string,
    actorId?: string,
  ): Promise<void> {
    await this.assertTask(workspaceId, taskId);
    if (actorId) {
      await this.logActivity(workspaceId, taskId, actorId, 'DELETED');
    }
    await this.prisma.task.update({
      where: { id: taskId },
      data: { deletedAt: new Date() },
    });

    this.events.emit(AppEvent.TaskDeleted, {
      workspaceId,
      actorId: actorId ?? null,
      taskId,
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
        source: {
          select: { id: true, title: true, status: true, identifier: true },
        },
        target: {
          select: { id: true, title: true, status: true, identifier: true },
        },
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
      await this.logActivity(
        workspaceId,
        input.sourceId,
        actorId,
        'RELATIONS_CHANGED',
        {
          relationType: input.type,
          targetId: input.targetId,
          newValue: relation.target.identifier ?? relation.target.title,
        },
      );
    }

    return relation;
  }

  async deleteRelation(
    workspaceId: string,
    relationId: string,
    actorId?: string,
  ): Promise<void> {
    const relation = await this.prisma.workItemRelation.findFirst({
      where: { id: relationId, workspaceId },
      include: { target: { select: { identifier: true, title: true } } },
    });
    if (!relation) throw new NotFoundException('Relation not found');
    await this.prisma.workItemRelation.delete({ where: { id: relationId } });

    if (actorId) {
      await this.logActivity(
        workspaceId,
        relation.sourceId,
        actorId,
        'RELATIONS_CHANGED',
        {
          relationType: relation.type,
          targetId: relation.targetId,
          oldValue: relation.target.identifier ?? relation.target.title,
        },
      );
    }
  }

  // --- saved views ----------------------------------------------------------

  async getSavedViews(
    workspaceId: string,
    projectId?: string,
    teamId?: string,
  ) {
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

  async updateSavedView(
    workspaceId: string,
    viewId: string,
    input: UpdateSavedViewInput,
  ) {
    const view = await this.prisma.savedView.findFirst({
      where: { id: viewId, workspaceId },
    });
    if (!view) throw new NotFoundException('Saved view not found');

    return this.prisma.savedView.update({
      where: { id: viewId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.type !== undefined ? { type: input.type as ViewType } : {}),
        ...(input.filters !== undefined
          ? { filters: JSON.stringify(input.filters) }
          : {}),
        ...(input.sorting !== undefined
          ? { sorting: JSON.stringify(input.sorting) }
          : {}),
        ...(input.grouping !== undefined
          ? { grouping: JSON.stringify(input.grouping) }
          : {}),
        ...(input.visibleColumns !== undefined
          ? { visibleColumns: input.visibleColumns }
          : {}),
        ...(input.isDefault !== undefined
          ? { isDefault: input.isDefault }
          : {}),
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

  async createIntakeRequest(
    workspaceId: string,
    input: CreateIntakeRequestInput,
  ) {
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
    assertContentAllowed(JSON.stringify(input));
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
      data: {
        health: (input.status as ProjectHealth) ?? ProjectHealth.HEALTHY,
      },
    });

    return update;
  }

  // --- comments, calendar, documents --------------------------

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
    assertContentAllowed(input.content);
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

    this.events.emit(AppEvent.TaskCommentCreated, {
      workspaceId,
      actorId: authorId,
      taskId,
      commentId: comment.id,
      body: input.content,
    });

    await this.notifyCommentMentions(
      workspaceId,
      task,
      authorId,
      input.content,
    );

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
    previousContent = '',
  ): Promise<void> {
    try {
      if (!content.includes('@')) return;

      const members = await this.prisma.workspaceMember.findMany({
        where: { workspaceId, status: 'ACTIVE' },
        select: {
          user: { select: { id: true, name: true, displayName: true } },
        },
      });

      const users = members.map((m) => m.user);
      const alreadyMentioned = resolveTextMentions(previousContent, users);
      const mentionedUserIds = resolveTextMentions(content, users).filter(
        (id) => id !== authorId && !alreadyMentioned.includes(id),
      );
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
        deepLink: `projects?taskId=${task.id}`,
      });
    } catch {
      // Notification fan-out is never a correctness dependency of the comment.
    }
  }

  /** Only the author can reword a comment: it speaks in their name. */
  async updateTaskComment(
    workspaceId: string,
    taskId: string,
    commentId: string,
    userId: string,
    input: UpdateTaskCommentInput,
  ) {
    assertContentAllowed(input.content);
    const task = await this.assertTask(workspaceId, taskId);
    const existing = await this.prisma.taskComment.findFirst({
      where: { id: commentId, taskId },
    });
    if (!existing) throw new NotFoundException('Comment not found');
    if (existing.authorId !== userId) {
      throw new ForbiddenException('Only the author can edit this comment');
    }

    const comment = await this.prisma.taskComment.update({
      where: { id: commentId },
      data: { content: input.content },
      include: { author: { select: PUBLIC_USER_SELECT } },
    });

    this.events.emit(AppEvent.TaskCommentChanged, {
      workspaceId,
      actorId: userId,
      taskId,
      commentId,
    });

    await this.notifyCommentMentions(
      workspaceId,
      task,
      userId,
      input.content,
      existing.content,
    );

    return comment;
  }

  /** The author can always remove their own comment; others need `canModerate`. */
  async deleteTaskComment(
    workspaceId: string,
    commentId: string,
    userId: string,
    canModerate: boolean,
  ): Promise<void> {
    const comment = await this.prisma.taskComment.findUnique({
      where: { id: commentId },
      select: {
        authorId: true,
        taskId: true,
        task: { select: { workspaceId: true } },
      },
    });
    if (!comment || comment.task.workspaceId !== workspaceId) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.authorId !== userId && !canModerate) {
      throw new ForbiddenException('You can only delete your own comments');
    }
    await this.prisma.taskComment.delete({ where: { id: commentId } });

    this.events.emit(AppEvent.TaskCommentChanged, {
      workspaceId,
      actorId: userId,
      taskId: comment.taskId,
      commentId,
    });
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
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.location !== undefined ? { location: input.location } : {}),
        ...(input.startAt !== undefined
          ? { startAt: new Date(input.startAt) }
          : {}),
        ...(input.endAt !== undefined ? { endAt: new Date(input.endAt) } : {}),
        ...(input.isAllDay !== undefined ? { isAllDay: input.isAllDay } : {}),
      },
      include: { organizer: { select: PUBLIC_USER_SELECT } },
    });
  }

  async deleteCalendarEvent(
    workspaceId: string,
    eventId: string,
  ): Promise<void> {
    await this.assertEvent(workspaceId, eventId);
    await this.prisma.calendarEvent.update({
      where: { id: eventId },
      data: { deletedAt: new Date() },
    });
  }

  async getDocuments(
    workspaceId: string,
    options?: { limit?: number; offset?: number },
  ) {
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
      take: Math.min(options?.limit ? Number(options.limit) : 100, 250),
      ...(options?.offset ? { skip: Number(options.offset) } : {}),
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
    assertContentAllowed(input.title, docContentToText(input.content ?? ''));
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
    assertContentAllowed(input.title, docContentToText(input.content ?? ''));
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

  // --- activity logging & helpers -------------------------------------------

  private async logActivity(
    workspaceId: string,
    workItemId: string,
    actorId: string,
    action: string,
    details: ActivityDetails = {},
  ) {
    const { fieldChanged, oldValue, newValue, ...metadata } = details;
    try {
      await this.prisma.workItemActivity.create({
        data: {
          workspaceId,
          workItemId,
          actorId,
          action,
          fieldChanged: fieldChanged ?? null,
          oldValue: oldValue ?? null,
          newValue: newValue ?? null,
          metadata: metadata as Prisma.InputJsonValue,
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

  private async assertTaskLabel(workspaceId: string, labelId: string) {
    const label = await this.prisma.taskLabel.findFirst({
      where: { id: labelId, workspaceId },
    });
    if (!label) throw new NotFoundException('Label not found');
    return label;
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

  private async assertMeetingOwned(workspaceId: string, meetingId: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');
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
    if (!member)
      throw new NotFoundException('User is not a member of this workspace');
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
      meetingId?: string | null;
      assigneeId?: string | null;
      assigneeIds?: string[];
      reporterId?: string | null;
    },
  ) {
    if (input.projectId) await this.assertProject(workspaceId, input.projectId);
    if (input.teamId) await this.assertTeam(workspaceId, input.teamId);
    if (input.sprintId) await this.assertSprint(workspaceId, input.sprintId);
    if (input.milestoneId)
      await this.assertMilestone(workspaceId, input.milestoneId);
    if (input.epicId) await this.assertEpicOwned(workspaceId, input.epicId);
    if (input.cycleId) await this.assertCycleOwned(workspaceId, input.cycleId);
    if (input.moduleId)
      await this.assertModuleOwned(workspaceId, input.moduleId);
    if (input.parentId) await this.assertTask(workspaceId, input.parentId);
    if (input.meetingId)
      await this.assertMeetingOwned(workspaceId, input.meetingId);
    if (input.assigneeId)
      await this.assertWorkspaceUser(workspaceId, input.assigneeId);
    for (const id of new Set(input.assigneeIds ?? [])) {
      if (id) await this.assertWorkspaceUser(workspaceId, id);
    }
    if (input.reporterId)
      await this.assertWorkspaceUser(workspaceId, input.reporterId);
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
    if (count === 0)
      throw new NotFoundException('No deleted task with that id.');
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

  async restoreCalendarEvent(workspaceId: string, eventId: string) {
    const { count } = await this.prisma.calendarEvent.updateMany({
      where: { id: eventId, workspaceId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    if (count === 0)
      throw new NotFoundException('No deleted event with that id.');
    return this.prisma.calendarEvent.findUniqueOrThrow({
      where: { id: eventId },
      include: { organizer: { select: PUBLIC_USER_SELECT } },
    });
  }

  /** The workspace's recycle bin — everything soft-deleted, newest first. */
  async listDeleted(workspaceId: string) {
    const [projects, tasks, documents, events] = await Promise.all([
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
      this.prisma.calendarEvent.findMany({
        where: { workspaceId, deletedAt: { not: null } },
        select: { id: true, title: true, deletedAt: true },
        orderBy: { deletedAt: 'desc' },
      }),
    ]);
    return { projects, tasks, documents, events };
  }
}
