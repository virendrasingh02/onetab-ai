import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import { CurrentUser, WorkspaceId } from '@org/api-common';
import { AgentsService } from './agents.service.js';

/**
 * The agent catalogue. Not workspace data, so it needs no workspace context —
 * but it is still behind the global JWT guard.
 */
@Controller({ path: 'agents', version: '1' })
export class AgentMarketplaceController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get('marketplace')
  getMarketplaceAgents() {
    return this.agentsService.getMarketplaceAgents();
  }
}

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
    },
  ) {
    return this.agentsService.createAgent(workspaceId, userId, body);
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
