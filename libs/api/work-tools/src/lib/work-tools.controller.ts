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
import type {
  CurrentUser as CurrentUserType,
  IntakeStatus,
  TaskStatus,
} from '@org/types';
import {
  convertIntakeRequestSchema,
  createCalendarEventSchema,
  createCycleSchema,
  createDocumentSchema,
  createEpicSchema,
  createInitiativeSchema,
  createIntakeRequestSchema,
  createModuleSchema,
  createProjectSchema,
  createProjectUpdateSchema,
  createSavedViewSchema,
  createTaskCommentSchema,
  createTaskSchema,
  createTeamSchema,
  createWhiteboardSchema,
  createWorkItemRelationSchema,
  moveTaskSchema,
  projectIdentifierSettingsSchema,
  updateCalendarEventSchema,
  updateCycleSchema,
  updateDocumentSchema,
  updateEpicSchema,
  updateInitiativeSchema,
  updateModuleSchema,
  updateProjectSchema,
  updateSavedViewSchema,
  updateTaskSchema,
  updateTeamSchema,
  updateWhiteboardSchema,
  type ConvertIntakeRequestInput,
  type CreateCalendarEventInput,
  type CreateCycleInput,
  type CreateDocumentInput,
  type CreateEpicInput,
  type CreateInitiativeInput,
  type CreateIntakeRequestInput,
  type CreateModuleInput,
  type CreateProjectInput,
  type CreateProjectUpdateInput,
  type CreateSavedViewInput,
  type CreateTaskCommentInput,
  type CreateTaskInput,
  type CreateTeamInput,
  type CreateWhiteboardInput,
  type CreateWorkItemRelationInput,
  type MoveTaskInput,
  type ProjectIdentifierSettingsInput,
  type UpdateCalendarEventInput,
  type UpdateCycleInput,
  type UpdateDocumentInput,
  type UpdateEpicInput,
  type UpdateInitiativeInput,
  type UpdateModuleInput,
  type UpdateProjectInput,
  type UpdateSavedViewInput,
  type UpdateTaskInput,
  type UpdateTeamInput,
  type UpdateWhiteboardInput,
} from '@org/validation';
import { WorkToolsService } from './work-tools.service.js';

@Controller({ path: 'workspaces/:workspaceId/work-tools', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class WorkToolsController {
  constructor(private readonly workTools: WorkToolsService) {}

  // --- teams ----------------------------------------------------------------

  @Get('teams')
  getTeams(@WorkspaceId() workspaceId: string) {
    return this.workTools.getTeams(workspaceId);
  }

  @Post('teams')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  createTeam(
    @WorkspaceId() workspaceId: string,
    @Body(zodBody(createTeamSchema)) body: CreateTeamInput,
  ) {
    return this.workTools.createTeam(workspaceId, body);
  }

  @Patch('teams/:teamId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  updateTeam(
    @WorkspaceId() workspaceId: string,
    @Param('teamId') teamId: string,
    @Body(zodBody(updateTeamSchema)) body: UpdateTeamInput,
  ) {
    return this.workTools.updateTeam(workspaceId, teamId, body);
  }

  @Delete('teams/:teamId')
  @RequireWorkspacePermissions(WorkspacePermission.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTeam(
    @WorkspaceId() workspaceId: string,
    @Param('teamId') teamId: string,
  ) {
    return this.workTools.deleteTeam(workspaceId, teamId);
  }

  // --- initiatives ----------------------------------------------------------

  @Get('initiatives')
  getInitiatives(@WorkspaceId() workspaceId: string) {
    return this.workTools.getInitiatives(workspaceId);
  }

  @Post('initiatives')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  createInitiative(
    @WorkspaceId() workspaceId: string,
    @Body(zodBody(createInitiativeSchema)) body: CreateInitiativeInput,
  ) {
    return this.workTools.createInitiative(workspaceId, body);
  }

  @Patch('initiatives/:initiativeId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  updateInitiative(
    @WorkspaceId() workspaceId: string,
    @Param('initiativeId') initiativeId: string,
    @Body(zodBody(updateInitiativeSchema)) body: UpdateInitiativeInput,
  ) {
    return this.workTools.updateInitiative(workspaceId, initiativeId, body);
  }

  @Delete('initiatives/:initiativeId')
  @RequireWorkspacePermissions(WorkspacePermission.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteInitiative(
    @WorkspaceId() workspaceId: string,
    @Param('initiativeId') initiativeId: string,
  ) {
    return this.workTools.deleteInitiative(workspaceId, initiativeId);
  }

  // --- projects -------------------------------------------------------------

  @Get('projects')
  getProjects(
    @WorkspaceId() workspaceId: string,
    @Query('teamId') teamId?: string,
  ) {
    return this.workTools.getProjects(workspaceId, teamId);
  }

  @Get('projects/:projectId')
  getProject(
    @WorkspaceId() workspaceId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.workTools.getProject(workspaceId, projectId);
  }

  @Post('projects')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  createProject(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: CurrentUserType,
    @Body(zodBody(createProjectSchema)) body: CreateProjectInput,
  ) {
    return this.workTools.createProject(workspaceId, body, user.id);
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

  @Patch('projects/:projectId/identifier-settings')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  updateIdentifierSettings(
    @WorkspaceId() workspaceId: string,
    @Param('projectId') projectId: string,
    @CurrentUser() user: CurrentUserType,
    @Body(zodBody(projectIdentifierSettingsSchema))
    body: ProjectIdentifierSettingsInput,
  ) {
    return this.workTools.updateIdentifierSettings(
      workspaceId,
      projectId,
      body,
      user.id,
    );
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

  // --- epics, modules, cycles -----------------------------------------------

  @Get('projects/:projectId/epics')
  getEpics(
    @WorkspaceId() workspaceId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.workTools.getEpics(workspaceId, projectId);
  }

  @Post('epics')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  createEpic(
    @WorkspaceId() workspaceId: string,
    @Body(zodBody(createEpicSchema)) body: CreateEpicInput,
  ) {
    return this.workTools.createEpic(workspaceId, body);
  }

  @Patch('epics/:epicId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  updateEpic(
    @WorkspaceId() workspaceId: string,
    @Param('epicId') epicId: string,
    @Body(zodBody(updateEpicSchema)) body: UpdateEpicInput,
  ) {
    return this.workTools.updateEpic(workspaceId, epicId, body);
  }

  @Delete('epics/:epicId')
  @RequireWorkspacePermissions(WorkspacePermission.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteEpic(
    @WorkspaceId() workspaceId: string,
    @Param('epicId') epicId: string,
  ) {
    return this.workTools.deleteEpic(workspaceId, epicId);
  }

  @Get('projects/:projectId/modules')
  getModules(
    @WorkspaceId() workspaceId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.workTools.getModules(workspaceId, projectId);
  }

  @Post('modules')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  createModule(
    @WorkspaceId() workspaceId: string,
    @Body(zodBody(createModuleSchema)) body: CreateModuleInput,
  ) {
    return this.workTools.createModule(workspaceId, body);
  }

  @Patch('modules/:moduleId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  updateModule(
    @WorkspaceId() workspaceId: string,
    @Param('moduleId') moduleId: string,
    @Body(zodBody(updateModuleSchema)) body: UpdateModuleInput,
  ) {
    return this.workTools.updateModule(workspaceId, moduleId, body);
  }

  @Delete('modules/:moduleId')
  @RequireWorkspacePermissions(WorkspacePermission.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteModule(
    @WorkspaceId() workspaceId: string,
    @Param('moduleId') moduleId: string,
  ) {
    return this.workTools.deleteModule(workspaceId, moduleId);
  }

  @Get('cycles')
  getCycles(
    @WorkspaceId() workspaceId: string,
    @Query('projectId') projectId?: string,
    @Query('teamId') teamId?: string,
  ) {
    return this.workTools.getCycles(workspaceId, projectId, teamId);
  }

  @Post('cycles')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  createCycle(
    @WorkspaceId() workspaceId: string,
    @Body(zodBody(createCycleSchema)) body: CreateCycleInput,
  ) {
    return this.workTools.createCycle(workspaceId, body);
  }

  @Patch('cycles/:cycleId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  updateCycle(
    @WorkspaceId() workspaceId: string,
    @Param('cycleId') cycleId: string,
    @Body(zodBody(updateCycleSchema)) body: UpdateCycleInput,
  ) {
    return this.workTools.updateCycle(workspaceId, cycleId, body);
  }

  @Delete('cycles/:cycleId')
  @RequireWorkspacePermissions(WorkspacePermission.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCycle(
    @WorkspaceId() workspaceId: string,
    @Param('cycleId') cycleId: string,
  ) {
    return this.workTools.deleteCycle(workspaceId, cycleId);
  }

  // --- tasks / universal work items -----------------------------------------

  @Get('tasks')
  getTasks(
    @WorkspaceId() workspaceId: string,
    @Query('projectId') projectId?: string,
    @Query('status') status?: TaskStatus,
    @Query('teamId') teamId?: string,
    @Query('cycleId') cycleId?: string,
    @Query('epicId') epicId?: string,
    @Query('moduleId') moduleId?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('search') search?: string,
  ) {
    return this.workTools.getTasks(workspaceId, projectId, status, {
      teamId,
      cycleId,
      epicId,
      moduleId,
      assigneeId,
      search,
    });
  }

  @Get('tasks/:taskId')
  getTask(
    @WorkspaceId() workspaceId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.workTools.getTask(workspaceId, taskId);
  }

  @Post('tasks')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  createTask(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: CurrentUserType,
    @Body(zodBody(createTaskSchema)) body: CreateTaskInput,
  ) {
    return this.workTools.createTask(workspaceId, body, user.id);
  }

  @Patch('tasks/:taskId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  updateTask(
    @WorkspaceId() workspaceId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: CurrentUserType,
    @Body(zodBody(updateTaskSchema)) body: UpdateTaskInput,
  ) {
    return this.workTools.updateTask(workspaceId, taskId, body, user.id);
  }

  @Patch('tasks/:taskId/move')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  moveTask(
    @WorkspaceId() workspaceId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: CurrentUserType,
    @Body(zodBody(moveTaskSchema)) body: MoveTaskInput,
  ) {
    return this.workTools.moveTask(workspaceId, taskId, body, user.id);
  }

  @Delete('tasks/:taskId')
  @RequireWorkspacePermissions(WorkspacePermission.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTask(
    @WorkspaceId() workspaceId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: CurrentUserType,
  ): Promise<void> {
    return this.workTools.deleteTask(workspaceId, taskId, user.id);
  }

  // --- relations ------------------------------------------------------------

  @Get('tasks/:taskId/relations')
  getRelations(
    @WorkspaceId() workspaceId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.workTools.getRelations(workspaceId, taskId);
  }

  @Post('relations')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  addRelation(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: CurrentUserType,
    @Body(zodBody(createWorkItemRelationSchema))
    body: CreateWorkItemRelationInput,
  ) {
    return this.workTools.addRelation(workspaceId, body, user.id);
  }

  @Delete('relations/:relationId')
  @RequireWorkspacePermissions(WorkspacePermission.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteRelation(
    @WorkspaceId() workspaceId: string,
    @Param('relationId') relationId: string,
  ) {
    return this.workTools.deleteRelation(workspaceId, relationId);
  }

  // --- saved views ----------------------------------------------------------

  @Get('views')
  getSavedViews(
    @WorkspaceId() workspaceId: string,
    @Query('projectId') projectId?: string,
    @Query('teamId') teamId?: string,
  ) {
    return this.workTools.getSavedViews(workspaceId, projectId, teamId);
  }

  @Post('views')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  createSavedView(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: CurrentUserType,
    @Body(zodBody(createSavedViewSchema)) body: CreateSavedViewInput,
  ) {
    return this.workTools.createSavedView(workspaceId, user.id, body);
  }

  @Patch('views/:viewId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  updateSavedView(
    @WorkspaceId() workspaceId: string,
    @Param('viewId') viewId: string,
    @Body(zodBody(updateSavedViewSchema)) body: UpdateSavedViewInput,
  ) {
    return this.workTools.updateSavedView(workspaceId, viewId, body);
  }

  @Delete('views/:viewId')
  @RequireWorkspacePermissions(WorkspacePermission.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSavedView(
    @WorkspaceId() workspaceId: string,
    @Param('viewId') viewId: string,
  ) {
    return this.workTools.deleteSavedView(workspaceId, viewId);
  }

  // --- intake / triage ------------------------------------------------------

  @Get('intake')
  getIntakeRequests(
    @WorkspaceId() workspaceId: string,
    @Query('status') status?: IntakeStatus,
  ) {
    return this.workTools.getIntakeRequests(workspaceId, status);
  }

  @Post('intake')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  createIntakeRequest(
    @WorkspaceId() workspaceId: string,
    @Body(zodBody(createIntakeRequestSchema)) body: CreateIntakeRequestInput,
  ) {
    return this.workTools.createIntakeRequest(workspaceId, body);
  }

  @Post('intake/:intakeId/convert')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  convertIntakeRequest(
    @WorkspaceId() workspaceId: string,
    @Param('intakeId') intakeId: string,
    @CurrentUser() user: CurrentUserType,
    @Body(zodBody(convertIntakeRequestSchema)) body: ConvertIntakeRequestInput,
  ) {
    return this.workTools.convertIntakeRequest(
      workspaceId,
      intakeId,
      body,
      user.id,
    );
  }

  @Patch('intake/:intakeId/decline')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  declineIntakeRequest(
    @WorkspaceId() workspaceId: string,
    @Param('intakeId') intakeId: string,
  ) {
    return this.workTools.declineIntakeRequest(workspaceId, intakeId);
  }

  // --- project updates ------------------------------------------------------

  @Get('projects/:projectId/updates')
  getProjectUpdates(
    @WorkspaceId() workspaceId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.workTools.getProjectUpdates(workspaceId, projectId);
  }

  @Post('projects/:projectId/updates')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  createProjectUpdate(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: CurrentUserType,
    @Body(zodBody(createProjectUpdateSchema)) body: CreateProjectUpdateInput,
  ) {
    return this.workTools.createProjectUpdate(workspaceId, user.id, body);
  }

  // --- comments -------------------------------------------------------------

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
    @CurrentUser() user: CurrentUserType,
    @Body(zodBody(createTaskCommentSchema)) body: CreateTaskCommentInput,
  ) {
    return this.workTools.addTaskComment(workspaceId, taskId, user.id, body);
  }

  @Delete('tasks/:taskId/comments/:commentId')
  @RequireWorkspacePermissions(WorkspacePermission.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTaskComment(
    @WorkspaceId() workspaceId: string,
    @Param('commentId') commentId: string,
  ): Promise<void> {
    return this.workTools.deleteTaskComment(workspaceId, commentId);
  }

  // --- calendar -------------------------------------------------------------

  @Get('calendar/events')
  getCalendarEvents(@WorkspaceId() workspaceId: string) {
    return this.workTools.getCalendarEvents(workspaceId);
  }

  @Post('calendar/events')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  createCalendarEvent(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: CurrentUserType,
    @Body(zodBody(createCalendarEventSchema)) body: CreateCalendarEventInput,
  ) {
    return this.workTools.createCalendarEvent(workspaceId, user.id, body);
  }

  @Patch('calendar/events/:eventId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  updateCalendarEvent(
    @WorkspaceId() workspaceId: string,
    @Param('eventId') eventId: string,
    @Body(zodBody(updateCalendarEventSchema)) body: UpdateCalendarEventInput,
  ) {
    return this.workTools.updateCalendarEvent(workspaceId, eventId, body);
  }

  @Delete('calendar/events/:eventId')
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
  getDocuments(@WorkspaceId() workspaceId: string) {
    return this.workTools.getDocuments(workspaceId);
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
    @CurrentUser() user: CurrentUserType,
    @Body(zodBody(createDocumentSchema)) body: CreateDocumentInput,
  ) {
    return this.workTools.createDocument(workspaceId, user.id, body);
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
    @CurrentUser() user: CurrentUserType,
    @Body(zodBody(createWhiteboardSchema)) body: CreateWhiteboardInput,
  ) {
    return this.workTools.createWhiteboard(workspaceId, user.id, body);
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
