import { Injectable } from '@nestjs/common';
import {
  PrismaService,
  TaskStatus,
  TaskPriority,
  DocumentKind,
} from '@org/database';

@Injectable()
export class WorkToolsService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Projects -------------------------------------------------------------
  async getProjects(workspaceId: string) {
    return this.prisma.project.findMany({
      where: { workspaceId },
      include: { tasks: true, milestones: true, sprints: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createProject(workspaceId: string, data: { name: string; slug: string; description?: string; color?: string }) {
    return this.prisma.project.create({
      data: { workspaceId, ...data },
    });
  }

  // --- Tasks & Kanban --------------------------------------------------------
  async getTasks(workspaceId: string, projectId?: string) {
    return this.prisma.task.findMany({
      where: { workspaceId, ...(projectId ? { projectId } : {}) },
      include: { assignee: { select: { id: true, name: true, email: true, avatarUrl: true } }, project: true, comments: true },
      orderBy: { orderIndex: 'asc' },
    });
  }

  async createTask(workspaceId: string, data: { title: string; description?: string; status?: TaskStatus; priority?: TaskPriority; projectId?: string; assigneeId?: string }) {
    return this.prisma.task.create({
      data: { workspaceId, ...data },
    });
  }

  async updateTaskStatus(taskId: string, status: TaskStatus, orderIndex?: number) {
    return this.prisma.task.update({
      where: { id: taskId },
      data: { status, ...(orderIndex !== undefined ? { orderIndex } : {}) },
    });
  }

  // --- Calendar & Events -----------------------------------------------------
  async getCalendarEvents(workspaceId: string) {
    return this.prisma.calendarEvent.findMany({
      where: { workspaceId },
      include: { organizer: { select: { id: true, name: true, email: true } } },
      orderBy: { startAt: 'asc' },
    });
  }

  async createCalendarEvent(workspaceId: string, organizerId: string, data: { title: string; description?: string; location?: string; startAt: Date; endAt: Date; isAllDay?: boolean }) {
    return this.prisma.calendarEvent.create({
      data: { workspaceId, organizerId, ...data },
    });
  }

  // --- Documents & Wiki ------------------------------------------------------
  async getDocuments(workspaceId: string, kind?: DocumentKind) {
    return this.prisma.workDocument.findMany({
      where: { workspaceId, ...(kind ? { kind } : {}) },
      include: { author: { select: { id: true, name: true } }, children: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createDocument(workspaceId: string, authorId: string, data: { title: string; content?: string; kind?: DocumentKind; parentId?: string }) {
    return this.prisma.workDocument.create({
      data: { workspaceId, authorId, ...data },
    });
  }

  async updateDocument(docId: string, data: { title?: string; content?: string }) {
    return this.prisma.workDocument.update({
      where: { id: docId },
      data,
    });
  }

  // --- Whiteboard ------------------------------------------------------------
  async getWhiteboards(workspaceId: string) {
    return this.prisma.whiteboard.findMany({
      where: { workspaceId },
      include: { author: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createWhiteboard(workspaceId: string, authorId: string, name: string) {
    return this.prisma.whiteboard.create({
      data: { workspaceId, authorId, name },
    });
  }

  async updateWhiteboard(whiteboardId: string, canvasData: string) {
    return this.prisma.whiteboard.update({
      where: { id: whiteboardId },
      data: { canvasData },
    });
  }
}
