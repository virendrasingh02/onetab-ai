import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WorkspaceRoleGuard } from '@org/api-auth';
import { CurrentUser, RequireWorkspacePermissions, WorkspaceId, zodBody } from '@org/api-common';
import { WorkspacePermission } from '@org/types';
import {
  editAgentGraphSchema,
  understandAgentSchema,
  validateAgentGraphSchema,
  type EditAgentGraphInput,
  type UnderstandAgentInput,
} from '@org/validation';
import { AgentArchitectService } from './agent-architect.service.js';

/**
 * AI Agent Studio — "Create with one prompt" and editing agents in plain
 * words. Every route here plans or proposes; none saves. Agents are created
 * and changed through the agent routes (`workspaces/:id/agents`), which apply
 * the workspace's creation policy and keep versions.
 */
@Controller({ path: 'workspaces/:workspaceId/agent-architect', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class AgentArchitectController {
  constructor(private readonly architect: AgentArchitectService) {}

  /** "Create an agent that…" → what it understood, the plan, what's missing, the workflow. */
  @Post('understand')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  understand(@WorkspaceId() workspaceId: string, @CurrentUser('id') userId: string, @Body(zodBody(understandAgentSchema)) body: UnderstandAgentInput) {
    return this.architect.understand(workspaceId, userId, body);
  }

  /** "Add Slack notifications" → the changed graph and what changed. Applying it is a normal save. */
  @Post('edit')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  edit(@WorkspaceId() workspaceId: string, @CurrentUser('id') userId: string, @Body(zodBody(editAgentGraphSchema)) body: EditAgentGraphInput) {
    return this.architect.edit(workspaceId, userId, body);
  }

  /** Why the last run failed, and what would fix it. */
  @Post(':agentId/diagnose')
  diagnose(@WorkspaceId() workspaceId: string, @Param('agentId') agentId: string, @Body(zodBody(validateAgentGraphSchema)) body: { graphJson?: string }) {
    return this.architect.diagnose(workspaceId, agentId, body.graphJson);
  }

  /** Where the workflow wastes calls or time, with the changes that fix it. */
  @Post(':agentId/optimize')
  optimize(@WorkspaceId() workspaceId: string, @Param('agentId') agentId: string, @Body(zodBody(editAgentGraphSchema.pick({ graphJson: true }))) body: { graphJson: string }) {
    return this.architect.optimize(workspaceId, agentId, body.graphJson);
  }
}
