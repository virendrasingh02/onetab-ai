import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PUBLIC_USER_SELECT } from '@org/api-common';
import { Prisma, PrismaService } from '@org/database';
import { TASK_STATUS_ORDER } from '@org/types';
import type { DocumentKind, TaskStatus } from '@org/types';
import type {
  CreateCalendarEventInput,
  CreateDocumentInput,
  CreateProjectInput,
  CreateTaskCommentInput,
  CreateTaskInput,
  CreateWhiteboardInput,
  MoveTaskInput,
  UpdateCalendarEventInput,
  UpdateDocumentInput,
  UpdateProjectInput,
  UpdateTaskInput,
  UpdateWhiteboardInput,
} from '@org/validation';

/** Converts an optional ISO string from a DTO into a `Date` for Prisma. */
function at(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  return value === null ? null : new Date(value);
}

/**
 * Gap left between neighbouring cards in a column.
 *
 * `moveTask` writes the position it is given verbatim — the server does not
 * shuffle siblings — and the schema only accepts non-negative integers, so
 * there are no fractional midpoints to fall back on. Spacing positions out
 * makes the common case, a drop between two cards, one write: the midpoint of
 * the gap. The column is only respaced once a gap has been used up.
 */
const ORDER_STRIDE = 1024;

/**
 * A ticket stem from a project's name: initials for a multi-word name, the
 * first three letters for a single-word one.
 *
 * Kept in step with the backfill in
 * `20260821060000_kanban_column_order_and_tickets`, which derives the same stem
 * in SQL for projects that predate ticket ids.
 */
export function ticketStemFrom(name: string): string {
  const words = name
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);

  if (words.length === 0) return 'PRJ';
  const stem =
    words.length === 1
      ? words[0].slice(0, 3)
      : words.slice(0, 4).map((word) => word[0]).join('');
  return stem.toUpperCase() || 'PRJ';
}

/**
 * Work-tools persistence.
 *
 * Every method takes `workspaceId` and every query filters on it — including
 * the ones addressing a row by its own id. The id alone is not proof of
 * access: it arrives from the caller, so a row is only reachable if it also
 * belongs to the workspace the guard already authorised.
 */
@Injectable()
export class WorkToolsService {
  constructor(private readonly prisma: PrismaService) {}

  // --- projects -------------------------------------------------------------

  async getProjects(workspaceId: string) {
    return this.prisma.project.findMany({
      where: { workspaceId },
      include: {
        milestones: { orderBy: { dueDate: 'asc' } },
        sprints: { orderBy: { startDate: 'asc' } },
        _count: { select: { tasks: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createProject(workspaceId: string, input: CreateProjectInput) {
    return this.prisma.project.create({
      data: {
        workspaceId,
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        ...(input.color ? { color: input.color } : {}),
        icon: input.icon ?? null,
        iconColor: input.iconColor ?? null,
        startDate: at(input.startDate) ?? null,
        targetDate: at(input.targetDate) ?? null,
        columnOrder: [...TASK_STATUS_ORDER],
        ticketPrefix: await this.freeTicketPrefix(
          workspaceId,
          ticketStemFrom(input.name),
        ),
      },
    });
  }

  /**
   * `stem`, or `stem` with a counter appended until the workspace has no
   * project using it.
   *
   * Two projects called "Web App" and "Website" both want `WEB`, and the ticket
   * id is only useful if it names one board — so the second becomes `WEB2`.
   */
  private async freeTicketPrefix(
    workspaceId: string,
    stem: string,
    exceptProjectId?: string,
  ): Promise<string> {
    const taken = new Set(
      (
        await this.prisma.project.findMany({
          where: {
            workspaceId,
            ticketPrefix: { startsWith: stem },
            ...(exceptProjectId ? { id: { not: exceptProjectId } } : {}),
          },
          select: { ticketPrefix: true },
        })
      ).flatMap((project) => (project.ticketPrefix ? [project.ticketPrefix] : [])),
    );

    if (!taken.has(stem)) return stem;
    for (let suffix = 2; ; suffix += 1) {
      const candidate = `${stem}${suffix}`;
      if (!taken.has(candidate)) return candidate;
    }
  }

  async updateProject(
    workspaceId: string,
    projectId: string,
    input: UpdateProjectInput,
  ) {
    await this.assertProject(workspaceId, projectId);

    if (input.ticketPrefix !== undefined) {
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
      // The column order arrives whole — it is a reorder of a fixed set, so
      // there is no partial write to merge.
      ...(input.columnOrder !== undefined
        ? { columnOrder: input.columnOrder }
        : {}),
      ...(input.ticketPrefix !== undefined
        ? { ticketPrefix: input.ticketPrefix }
        : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      // Each icon field is written only when the caller sent it, so changing
      // the colour alone does not clear the icon and vice versa.
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
      ...(input.iconColor !== undefined ? { iconColor: input.iconColor } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.startDate !== undefined
        ? { startDate: at(input.startDate) }
        : {}),
      ...(input.targetDate !== undefined
        ? { targetDate: at(input.targetDate) }
        : {}),
    };
    return this.prisma.project.update({ where: { id: projectId }, data });
  }

  async deleteProject(workspaceId: string, projectId: string): Promise<void> {
    await this.assertProject(workspaceId, projectId);
    await this.prisma.project.delete({ where: { id: projectId } });
  }

  // --- tasks ----------------------------------------------------------------

  async getTasks(workspaceId: string, projectId?: string, status?: TaskStatus) {
    return this.prisma.task.findMany({
      where: {
        workspaceId,
        ...(projectId ? { projectId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        assignee: { select: PUBLIC_USER_SELECT },
        project: {
          select: {
            id: true,
            name: true,
            slug: true,
            color: true,
            icon: true,
            iconColor: true,
          },
        },
        _count: { select: { comments: true } },
      },
      orderBy: [{ status: 'asc' }, { orderIndex: 'asc' }],
    });
  }

  async createTask(workspaceId: string, input: CreateTaskInput) {
    // A task may only be filed under a project in the same workspace.
    if (input.projectId) await this.assertProject(workspaceId, input.projectId);

    const status = input.status ?? 'TODO';
    const projectId = input.projectId ?? null;

    return this.prisma.$transaction(async (tx) => {
      /*
       * The next ticket number, taken by incrementing the project's counter
       * inside the transaction — two people adding a card at the same moment
       * are serialised by the row lock the update takes, so neither can read
       * the same number as the other. A task with no project has no prefix to
       * pair a number with, so it goes unnumbered.
       */
      const ticketNumber = projectId
        ? (
            await tx.project.update({
              where: { id: projectId },
              data: { ticketSeq: { increment: 1 } },
              select: { ticketSeq: true },
            })
          ).ticketSeq
        : null;

      const data: Prisma.TaskUncheckedCreateInput = {
        workspaceId,
        title: input.title,
        description: input.description ?? null,
        status,
        ...(input.priority ? { priority: input.priority } : {}),
        projectId,
        sprintId: input.sprintId ?? null,
        milestoneId: input.milestoneId ?? null,
        assigneeId: input.assigneeId ?? null,
        dueDate: at(input.dueDate) ?? null,
        ticketNumber,
        orderIndex: await this.topOfColumn(tx, workspaceId, projectId, status),
      };

      return tx.task.create({
        data,
        include: { assignee: { select: PUBLIC_USER_SELECT } },
      });
    });
  }

  /**
   * A position above every card in a column.
   *
   * The old rule was `first - 1`, which walked steadily negative and eventually
   * fell through the floor `moveTaskSchema` enforces — a card added enough
   * times could no longer be dropped back where it came from. Halving the gap
   * above the first card keeps every position non-negative; when that gap is
   * used up the column is respaced, which is the only case that touches rows
   * other than the new one.
   */
  private async topOfColumn(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    projectId: string | null,
    status: TaskStatus,
  ): Promise<number> {
    const where = { workspaceId, projectId, status };
    const first = await tx.task.findFirst({
      where,
      orderBy: { orderIndex: 'asc' },
      select: { orderIndex: true },
    });

    if (!first) return ORDER_STRIDE;
    if (first.orderIndex >= 2) return Math.floor(first.orderIndex / 2);

    const column = await tx.task.findMany({
      where,
      orderBy: { orderIndex: 'asc' },
      select: { id: true },
    });
    await Promise.all(
      column.map((task, at) =>
        tx.task.update({
          where: { id: task.id },
          data: { orderIndex: (at + 1) * ORDER_STRIDE },
        }),
      ),
    );
    return Math.floor(ORDER_STRIDE / 2);
  }

  async updateTask(
    workspaceId: string,
    taskId: string,
    input: UpdateTaskInput,
  ) {
    await this.assertTask(workspaceId, taskId);
    if (input.projectId) await this.assertProject(workspaceId, input.projectId);

    const data: Prisma.TaskUncheckedUpdateInput = {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
      ...(input.sprintId !== undefined ? { sprintId: input.sprintId } : {}),
      ...(input.milestoneId !== undefined
        ? { milestoneId: input.milestoneId }
        : {}),
      ...(input.assigneeId !== undefined
        ? { assigneeId: input.assigneeId }
        : {}),
      ...(input.dueDate !== undefined ? { dueDate: at(input.dueDate) } : {}),
      ...(input.orderIndex !== undefined
        ? { orderIndex: input.orderIndex }
        : {}),
    };

    return this.prisma.task.update({
      where: { id: taskId },
      data,
      include: { assignee: { select: PUBLIC_USER_SELECT } },
    });
  }

  /** Board drag-and-drop: new column, new position. */
  async moveTask(workspaceId: string, taskId: string, input: MoveTaskInput) {
    await this.assertTask(workspaceId, taskId);
    return this.prisma.task.update({
      where: { id: taskId },
      data: { status: input.status, orderIndex: input.orderIndex },
      include: { assignee: { select: PUBLIC_USER_SELECT } },
    });
  }

  async deleteTask(workspaceId: string, taskId: string): Promise<void> {
    await this.assertTask(workspaceId, taskId);
    await this.prisma.task.delete({ where: { id: taskId } });
  }

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
    await this.assertTask(workspaceId, taskId);
    return this.prisma.taskComment.create({
      data: { taskId, authorId, content: input.content },
      include: { author: { select: PUBLIC_USER_SELECT } },
    });
  }

  // --- calendar -------------------------------------------------------------

  async getCalendarEvents(workspaceId: string, from?: string, to?: string) {
    return this.prisma.calendarEvent.findMany({
      where: {
        workspaceId,
        // Overlap, not containment: an event that straddles the window edge
        // still belongs on the visible month.
        ...(from ? { endAt: { gte: new Date(from) } } : {}),
        ...(to ? { startAt: { lte: new Date(to) } } : {}),
      },
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
        ...(input.isAllDay !== undefined ? { isAllDay: input.isAllDay } : {}),
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
    await this.prisma.calendarEvent.delete({ where: { id: eventId } });
  }

  // --- documents ------------------------------------------------------------

  async getDocuments(workspaceId: string, kind?: DocumentKind) {
    return this.prisma.workDocument.findMany({
      where: { workspaceId, ...(kind ? { kind } : {}) },
      include: {
        author: { select: PUBLIC_USER_SELECT },
        children: { select: { id: true, title: true, kind: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getDocument(workspaceId: string, docId: string) {
    const doc = await this.prisma.workDocument.findFirst({
      where: { id: docId, workspaceId },
      include: {
        author: { select: PUBLIC_USER_SELECT },
        children: { select: { id: true, title: true, kind: true } },
      },
    });
    if (!doc) throw new NotFoundException('Document not found.');
    return doc;
  }

  async createDocument(
    workspaceId: string,
    authorId: string,
    input: CreateDocumentInput,
  ) {
    // Nesting under someone else's workspace would leak the tree across tenants.
    if (input.parentId) await this.assertDocument(workspaceId, input.parentId);

    return this.prisma.workDocument.create({
      data: {
        workspaceId,
        authorId,
        title: input.title,
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.kind ? { kind: input.kind } : {}),
        parentId: input.parentId ?? null,
      },
      include: { author: { select: PUBLIC_USER_SELECT } },
    });
  }

  async updateDocument(
    workspaceId: string,
    docId: string,
    input: UpdateDocumentInput,
  ) {
    await this.assertDocument(workspaceId, docId);
    if (input.parentId) {
      if (input.parentId === docId) {
        throw new NotFoundException('A document cannot be its own parent.');
      }
      await this.assertDocument(workspaceId, input.parentId);
    }

    return this.prisma.workDocument.update({
      where: { id: docId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
      },
      include: { author: { select: PUBLIC_USER_SELECT } },
    });
  }

  async deleteDocument(workspaceId: string, docId: string): Promise<void> {
    await this.assertDocument(workspaceId, docId);
    // Children have no cascade in the schema, so re-parent them to this
    // document's parent rather than leaving rows pointing at a deleted id.
    const doc = await this.prisma.workDocument.findUniqueOrThrow({
      where: { id: docId },
      select: { parentId: true },
    });
    await this.prisma.$transaction([
      this.prisma.workDocument.updateMany({
        where: { parentId: docId },
        data: { parentId: doc.parentId },
      }),
      this.prisma.workDocument.delete({ where: { id: docId } }),
    ]);
  }

  // --- whiteboards ----------------------------------------------------------

  async getWhiteboards(workspaceId: string) {
    return this.prisma.whiteboard.findMany({
      where: { workspaceId },
      include: { author: { select: PUBLIC_USER_SELECT } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getWhiteboard(workspaceId: string, whiteboardId: string) {
    const board = await this.prisma.whiteboard.findFirst({
      where: { id: whiteboardId, workspaceId },
      include: { author: { select: PUBLIC_USER_SELECT } },
    });
    if (!board) throw new NotFoundException('Whiteboard not found.');
    return board;
  }

  async createWhiteboard(
    workspaceId: string,
    authorId: string,
    input: CreateWhiteboardInput,
  ) {
    return this.prisma.whiteboard.create({
      data: { workspaceId, authorId, name: input.name },
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
        ...(input.canvasData !== undefined
          ? { canvasData: input.canvasData }
          : {}),
      },
      include: { author: { select: PUBLIC_USER_SELECT } },
    });
  }

  async deleteWhiteboard(
    workspaceId: string,
    whiteboardId: string,
  ): Promise<void> {
    await this.assertWhiteboard(workspaceId, whiteboardId);
    await this.prisma.whiteboard.delete({ where: { id: whiteboardId } });
  }

  // --- ownership checks -----------------------------------------------------
  //
  // 404 rather than 403 throughout: telling a caller that a row exists but is
  // someone else's is itself a disclosure, and matches WorkspaceRoleGuard.

  private async assertProject(workspaceId: string, projectId: string) {
    const found = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Project not found.');
  }

  private async assertTask(workspaceId: string, taskId: string) {
    const found = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Task not found.');
  }

  private async assertEvent(workspaceId: string, eventId: string) {
    const found = await this.prisma.calendarEvent.findFirst({
      where: { id: eventId, workspaceId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Event not found.');
  }

  private async assertDocument(workspaceId: string, docId: string) {
    const found = await this.prisma.workDocument.findFirst({
      where: { id: docId, workspaceId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Document not found.');
  }

  private async assertWhiteboard(workspaceId: string, whiteboardId: string) {
    const found = await this.prisma.whiteboard.findFirst({
      where: { id: whiteboardId, workspaceId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Whiteboard not found.');
  }
}
