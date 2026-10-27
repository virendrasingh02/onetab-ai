import { Body, Controller, Headers, HttpCode, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@org/api-common';
import { AutomationsService } from './automations.service.js';
import { CanvasAgentRunService } from './studio/canvas-agent-run.service.js';

/**
 * Inbound webhooks for workflows and canvas agents, called from outside the
 * app. They live apart from the workspace controllers on purpose:
 * `WorkspaceRoleGuard` requires a signed-in member and ignores `@Public()`,
 * so a webhook under it could never be called. Each route is authenticated by
 * its own secret in `x-webhook-secret`, and reads the workspace from the URL.
 */
@Controller({ path: 'workspaces/:workspaceId', version: '1' })
@Public()
export class AutomationWebhooksController {
  constructor(
    private readonly automationsService: AutomationsService,
    private readonly canvasAgents: CanvasAgentRunService,
  ) {}

  @Post('automations/workflows/:workflowId/webhook')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  triggerWorkflow(
    @Param('workspaceId') workspaceId: string,
    @Param('workflowId') workflowId: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-webhook-secret') secretHeader?: string,
  ) {
    return this.automationsService.triggerWebhook(workspaceId, workflowId, body, secretHeader);
  }

  /** Starts a switched-on webhook agent; the JSON body becomes `{{event}}`. */
  @Post('agent-graphs/:agentId/webhook')
  @HttpCode(202)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  triggerCanvasAgent(
    @Param('workspaceId') workspaceId: string,
    @Param('agentId') agentId: string,
    @Body() body: unknown,
    @Headers('x-webhook-secret') secretHeader?: string,
  ) {
    const payload = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : { body };
    return this.canvasAgents.webhook(workspaceId, agentId, payload, secretHeader);
  }
}
