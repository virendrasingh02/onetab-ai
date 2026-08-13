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
  UseGuards,
} from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import { CurrentUser, WorkspaceId } from '@org/api-common';
import { AgentsService } from './agents.service.js';

/**
 * A workspace's own agents.
 *
 * The workspace is a guarded path parameter rather than `?workspaceId=` under
 * `JwtAuthGuard` alone: the previous shape let any signed-in account list
 * another tenant's agents (system prompts included), create agents in their
 * workspace, and execute them.
 */
@Controller({ path: 'workspaces/:workspaceId/agents', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  getAgents(@WorkspaceId() workspaceId: string) {
    return this.agentsService.getAgents(workspaceId);
  }

  /**
   * Workspace-wide telemetry.
   *
   * Declared before `:agentId/logs` is irrelevant — the paths differ in depth —
   * but it must stay above any future single-segment `:agentId` route, which
   * would otherwise swallow `/logs`.
   */
  @Get('logs')
  getWorkspaceLogs(@WorkspaceId() workspaceId: string) {
    return this.agentsService.getWorkspaceLogs(workspaceId);
  }

  @Post()
  createAgent(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body()
    body: {
      name: string;
      role?: string;
      description?: string;
      systemPrompt?: string;
      provider?: string;
      model?: string;
      tools?: string[];
      isMarketplace?: boolean;
    },
  ) {
    return this.agentsService.createAgent(workspaceId, userId, body);
  }

  @Patch(':agentId')
  updateAgent(
    @WorkspaceId() workspaceId: string,
    @Param('agentId') agentId: string,
    @Body()
    body: {
      name?: string;
      role?: string;
      description?: string;
      systemPrompt?: string;
      provider?: string;
      model?: string;
      tools?: string[];
      isActive?: boolean;
    },
  ) {
    return this.agentsService.updateAgent(workspaceId, agentId, body);
  }

  @Delete(':agentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteAgent(
    @WorkspaceId() workspaceId: string,
    @Param('agentId') agentId: string,
  ): Promise<void> {
    return this.agentsService.deleteAgent(workspaceId, agentId);
  }

  @Post(':agentId/execute')
  executeAgent(
    @WorkspaceId() workspaceId: string,
    @Param('agentId') agentId: string,
    @Body() body: { promptText: string },
  ) {
    return this.agentsService.executeAgent(workspaceId, agentId, body.promptText);
  }

  @Get(':agentId/logs')
  getExecutionLogs(
    @WorkspaceId() workspaceId: string,
    @Param('agentId') agentId: string,
  ) {
    return this.agentsService.getExecutionLogs(workspaceId, agentId);
  }
}
