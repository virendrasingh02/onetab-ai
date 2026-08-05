import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@org/api-auth';
import { CurrentUser } from '@org/api-common';
import { WorkToolsService } from './work-tools.service.js';
import { TaskStatus, TaskPriority, DocumentKind } from '@org/database';

@Controller('work-tools')
@UseGuards(JwtAuthGuard)
export class WorkToolsController {
  constructor(private readonly workToolsService: WorkToolsService) {}

  @Get('projects')
  getProjects(@Query('workspaceId') workspaceId: string) {
    return this.workToolsService.getProjects(workspaceId);
  }

  @Post('projects')
  createProject(
    @Body() body: { workspaceId: string; name: string; slug: string; description?: string; color?: string }
  ) {
    return this.workToolsService.createProject(body.workspaceId, body);
  }

  @Get('tasks')
  getTasks(@Query('workspaceId') workspaceId: string, @Query('projectId') projectId?: string) {
    return this.workToolsService.getTasks(workspaceId, projectId);
  }

  @Post('tasks')
  createTask(
    @Body() body: { workspaceId: string; title: string; description?: string; status?: TaskStatus; priority?: TaskPriority; projectId?: string; assigneeId?: string }
  ) {
    return this.workToolsService.createTask(body.workspaceId, body);
  }

  @Patch('tasks/:id/status')
  updateTaskStatus(
    @Param('id') id: string,
    @Body() body: { status: TaskStatus; orderIndex?: number }
  ) {
    return this.workToolsService.updateTaskStatus(id, body.status, body.orderIndex);
  }

  @Get('calendar')
  getCalendarEvents(@Query('workspaceId') workspaceId: string) {
    return this.workToolsService.getCalendarEvents(workspaceId);
  }

  @Post('calendar')
  createCalendarEvent(
    @CurrentUser('id') userId: string,
    @Body() body: { workspaceId: string; title: string; description?: string; location?: string; startAt: string; endAt: string; isAllDay?: boolean }
  ) {
    return this.workToolsService.createCalendarEvent(body.workspaceId, userId, {
      ...body,
      startAt: new Date(body.startAt),
      endAt: new Date(body.endAt),
    });
  }

  @Get('documents')
  getDocuments(@Query('workspaceId') workspaceId: string, @Query('kind') kind?: DocumentKind) {
    return this.workToolsService.getDocuments(workspaceId, kind);
  }

  @Post('documents')
  createDocument(
    @CurrentUser('id') userId: string,
    @Body() body: { workspaceId: string; title: string; content?: string; kind?: DocumentKind; parentId?: string }
  ) {
    return this.workToolsService.createDocument(body.workspaceId, userId, body);
  }

  @Patch('documents/:id')
  updateDocument(
    @Param('id') id: string,
    @Body() body: { title?: string; content?: string }
  ) {
    return this.workToolsService.updateDocument(id, body);
  }

  @Get('whiteboards')
  getWhiteboards(@Query('workspaceId') workspaceId: string) {
    return this.workToolsService.getWhiteboards(workspaceId);
  }

  @Post('whiteboards')
  createWhiteboard(
    @CurrentUser('id') userId: string,
    @Body() body: { workspaceId: string; name: string }
  ) {
    return this.workToolsService.createWhiteboard(body.workspaceId, userId, body.name);
  }

  @Patch('whiteboards/:id')
  updateWhiteboard(
    @Param('id') id: string,
    @Body() body: { canvasData: string }
  ) {
    return this.workToolsService.updateWhiteboard(id, body.canvasData);
  }
}
