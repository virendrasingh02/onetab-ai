import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@org/api-auth';
import { CurrentUser } from '@org/api-common';
import { AutomationsService } from './automations.service.js';

@Controller('automations')
@UseGuards(JwtAuthGuard)
export class AutomationsController {
  constructor(private readonly automationsService: AutomationsService) {}

  @Get('workflows')
  getWorkflows(@Query('workspaceId') workspaceId: string) {
    return this.automationsService.getWorkflows(workspaceId);
  }

  @Post('workflows')
  createWorkflow(
    @CurrentUser('id') userId: string,
    @Body() body: { workspaceId: string; name: string; description?: string; triggerType?: string; nodesJson?: string; edgesJson?: string }
  ) {
    return this.automationsService.createWorkflow(body.workspaceId, userId, body);
  }

  @Post('workflows/:id/trigger')
  triggerWorkflow(
    @Param('id') workflowId: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.automationsService.triggerWorkflow(workflowId, body);
  }

  @Get('workflows/:id/executions')
  getExecutions(@Param('id') workflowId: string) {
    return this.automationsService.getExecutions(workflowId);
  }
}
