import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@org/api-auth';
import { CurrentUser } from '@org/api-common';
import { AgentsService } from './agents.service.js';

@Controller('agents')
@UseGuards(JwtAuthGuard)
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  getAgents(@Query('workspaceId') workspaceId: string) {
    return this.agentsService.getAgents(workspaceId);
  }

  @Get('marketplace')
  getMarketplaceAgents() {
    return this.agentsService.getMarketplaceAgents();
  }

  @Post()
  createAgent(
    @CurrentUser('id') userId: string,
    @Body() body: { workspaceId: string; name: string; role?: string; description?: string; systemPrompt?: string; provider?: string; model?: string; tools?: string[] }
  ) {
    return this.agentsService.createAgent(body.workspaceId, userId, body);
  }

  @Post(':id/execute')
  executeAgent(
    @Param('id') agentId: string,
    @Body() body: { promptText: string }
  ) {
    return this.agentsService.executeAgent(agentId, body.promptText);
  }

  @Get(':id/logs')
  getExecutionLogs(@Param('id') agentId: string) {
    return this.agentsService.getExecutionLogs(agentId);
  }
}
