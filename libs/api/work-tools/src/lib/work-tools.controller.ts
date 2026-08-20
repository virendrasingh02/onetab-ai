import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import {
  CurrentUser,
  RequireWorkspacePermissions,
  WorkspaceId,
  zodBody,
} from '@org/api-common';
import { WorkspacePermission } from '@org/types';
import type { DocumentKind, TaskStatus } from '@org/types';
import {
  createCalendarEventSchema,
  createDocumentSchema,
  createProjectSchema,
  createTaskCommentSchema,
  createTaskSchema,
  createWhiteboardSchema,
  moveTaskSchema,
  updateCalendarEventSchema,
  updateDocumentSchema,
  updateProjectSchema,
  updateTaskSchema,
  updateWhiteboardSchema,
  type CreateCalendarEventInput,
  type CreateDocumentInput,
  type CreateProjectInput,
  type CreateTaskCommentInput,
  type CreateTaskInput,
  type CreateWhiteboardInput,
  type MoveTaskInput,
  type UpdateCalendarEventInput,
  type UpdateDocumentInput,
  type UpdateProjectInput,
  type UpdateTaskInput,
  type UpdateWhiteboardInput,
} from '@org/validation';
import { WorkToolsService } from './work-tools.service.js';

/**
 * Projects, tasks, calendar, docs and whiteboards for one workspace.
 *
 * The workspace is a path parameter guarded by `WorkspaceRoleGuard`, not a
 * query string the caller picks. An earlier revision read `?workspaceId=` under
 * `JwtAuthGuard` alone, which let any signed-in account read and write every
 * other tenant's tasks and documents.
 */
@Controller({ path: 'workspaces/:workspaceId/work-tools', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class WorkToolsController {
  constructor(private readonly workTools: WorkToolsService) {}

  // --- projects -------------------------------------------------------------

  @Get('projects')
  getProjects(@WorkspaceId() workspaceId: string) {
    return this.workTools.getProjects(workspaceId);
  }

  @Post('projects')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  createProject(
    @WorkspaceId() workspaceId: string,
    @Body(zodBody(createProjectSchema)) body: CreateProjectInput,
  ) {
    return this.workTools.createProject(workspaceId, body);
  }

  @Patch('projects/:projectId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  updateProject(
    @WorkspaceId() workspaceId: string,
    @Param('projectId') projectId: string,
    @Body(zodBody(updateProjectSchema)) body: UpdateProjectInput,
  ) {
    return this.workTools.updateProject(workspaceId, projectId, body);
  }

  @Delete('projects/:projectId')
  @RequireWorkspacePermissions(WorkspacePermission.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteProject(
    @WorkspaceId() workspaceId: string,
    @Param('projectId') projectId: string,
  ): Promise<void> {
    return this.workTools.deleteProject(workspaceId, projectId);
  }

  // --- tasks ----------------------------------------------------------------

  @Get('tasks')
  getTasks(
    @WorkspaceId() workspaceId: string,
    @Query('projectId') projectId?: string,
    @Query('status') status?: TaskStatus,
  ) {
    return this.workTools.getTasks(workspaceId, projectId, status);
  }

  @Post('tasks')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  createTask(
    @WorkspaceId() workspaceId: string,
    @Body(zodBody(createTaskSchema)) body: CreateTaskInput,
  ) {
    return this.workTools.createTask(workspaceId, body);
  }

  @Patch('tasks/:taskId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  updateTask(
    @WorkspaceId() workspaceId: string,
    @Param('taskId') taskId: string,
    @Body(zodBody(updateTaskSchema)) body: UpdateTaskInput,
  ) {
    return this.workTools.updateTask(workspaceId, taskId, body);
  }

  /** Board drag-and-drop. Narrower than PATCH so a drop cannot edit content. */
  @Patch('tasks/:taskId/move')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  moveTask(
    @WorkspaceId() workspaceId: string,
    @Param('taskId') taskId: string,
    @Body(zodBody(moveTaskSchema)) body: MoveTaskInput,
  ) {
    return this.workTools.moveTask(workspaceId, taskId, body);
  }

  @Delete('tasks/:taskId')
  @RequireWorkspacePermissions(WorkspacePermission.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTask(
    @WorkspaceId() workspaceId: string,
    @Param('taskId') taskId: string,
  ): Promise<void> {
    return this.workTools.deleteTask(workspaceId, taskId);
  }

  @Get('tasks/:taskId/comments')
  getTaskComments(
    @WorkspaceId() workspaceId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.workTools.getTaskComments(workspaceId, taskId);
  }

  @Post('tasks/:taskId/comments')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  addTaskComment(
    @WorkspaceId() workspaceId: string,
    @Param('taskId') taskId: string,
    @CurrentUser('id') userId: string,
    @Body(zodBody(createTaskCommentSchema)) body: CreateTaskCommentInput,
  ) {
    return this.workTools.addTaskComment(workspaceId, taskId, userId, body);
  }

  // --- calendar -------------------------------------------------------------

  @Get('calendar')
  getCalendarEvents(
    @WorkspaceId() workspaceId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.workTools.getCalendarEvents(workspaceId, from, to);
  }

  @Post('calendar')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  createCalendarEvent(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body(zodBody(createCalendarEventSchema)) body: CreateCalendarEventInput,
  ) {
    return this.workTools.createCalendarEvent(workspaceId, userId, body);
  }

  @Patch('calendar/:eventId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  updateCalendarEvent(
    @WorkspaceId() workspaceId: string,
    @Param('eventId') eventId: string,
    @Body(zodBody(updateCalendarEventSchema)) body: UpdateCalendarEventInput,
  ) {
    return this.workTools.updateCalendarEvent(workspaceId, eventId, body);
  }

  @Delete('calendar/:eventId')
  @RequireWorkspacePermissions(WorkspacePermission.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCalendarEvent(
    @WorkspaceId() workspaceId: string,
    @Param('eventId') eventId: string,
  ): Promise<void> {
    return this.workTools.deleteCalendarEvent(workspaceId, eventId);
  }

  // --- documents ------------------------------------------------------------

  @Get('documents')
  getDocuments(
    @WorkspaceId() workspaceId: string,
    @Query('kind') kind?: DocumentKind,
  ) {
    return this.workTools.getDocuments(workspaceId, kind);
  }

  @Get('documents/:docId')
  getDocument(
    @WorkspaceId() workspaceId: string,
    @Param('docId') docId: string,
  ) {
    return this.workTools.getDocument(workspaceId, docId);
  }

  @Post('documents')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  createDocument(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body(zodBody(createDocumentSchema)) body: CreateDocumentInput,
  ) {
    return this.workTools.createDocument(workspaceId, userId, body);
  }

  @Patch('documents/:docId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  updateDocument(
    @WorkspaceId() workspaceId: string,
    @Param('docId') docId: string,
    @Body(zodBody(updateDocumentSchema)) body: UpdateDocumentInput,
  ) {
    return this.workTools.updateDocument(workspaceId, docId, body);
  }

  @Delete('documents/:docId')
  @RequireWorkspacePermissions(WorkspacePermission.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteDocument(
    @WorkspaceId() workspaceId: string,
    @Param('docId') docId: string,
  ): Promise<void> {
    return this.workTools.deleteDocument(workspaceId, docId);
  }

  // --- whiteboards ----------------------------------------------------------

  @Get('whiteboards')
  getWhiteboards(@WorkspaceId() workspaceId: string) {
    return this.workTools.getWhiteboards(workspaceId);
  }

  @Get('whiteboards/:whiteboardId')
  getWhiteboard(
    @WorkspaceId() workspaceId: string,
    @Param('whiteboardId') whiteboardId: string,
  ) {
    return this.workTools.getWhiteboard(workspaceId, whiteboardId);
  }

  @Post('whiteboards')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  createWhiteboard(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body(zodBody(createWhiteboardSchema)) body: CreateWhiteboardInput,
  ) {
    return this.workTools.createWhiteboard(workspaceId, userId, body);
  }

  @Patch('whiteboards/:whiteboardId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  updateWhiteboard(
    @WorkspaceId() workspaceId: string,
    @Param('whiteboardId') whiteboardId: string,
    @Body(zodBody(updateWhiteboardSchema)) body: UpdateWhiteboardInput,
  ) {
    return this.workTools.updateWhiteboard(workspaceId, whiteboardId, body);
  }

  @Delete('whiteboards/:whiteboardId')
  @RequireWorkspacePermissions(WorkspacePermission.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteWhiteboard(
    @WorkspaceId() workspaceId: string,
    @Param('whiteboardId') whiteboardId: string,
  ): Promise<void> {
    return this.workTools.deleteWhiteboard(workspaceId, whiteboardId);
  }
}
