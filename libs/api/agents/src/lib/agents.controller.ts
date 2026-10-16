import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WorkspaceRoleGuard } from '@org/api-auth';
import {
  MarketplaceService,
  type PublishStudioAgentInput,
} from '@org/api-marketplace';
import {
  CurrentUser,
  RequireWorkspacePermissions,
  WorkspaceId,
  WorkspaceMemberRole,
  WorkspacePolicies,
  zodBody,
} from '@org/api-common';
import {
  agentChatSchema,
  agentTestRunSchema,
  agentVersionSchema,
  createAgentSchema,
  executeAIEntitySchema,
  linkAgentSchema,
  publishAgentListingSchema,
  setEnabledSchema,
  testMcpToolSchema,
  updateAgentSchema,
  validateAgentGraphSchema,
  type CreateAgentInput,
} from '@org/validation';
import {
  isPolicyRoleAllowed,
  WorkspacePermission,
  type WorkspacePolicy,
  type WorkspaceRole,
} from '@org/types';
import { AgentsService } from './agents.service.js';
import { CanManageAIEntity } from './ai-entity-access.guard.js';
import { STUDIO_TEMPLATES } from './studio-templates/studio-templates.js';

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
  constructor(
    private readonly agentsService: AgentsService,
    private readonly marketplace: MarketplaceService,
  ) {}

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
  /** The built-in agent templates a workspace can start from. */
  @Get('templates')
  getTemplates() {
    return STUDIO_TEMPLATES;
  }

  @Get('logs')
  getWorkspaceLogs(@WorkspaceId() workspaceId: string) {
    return this.agentsService.getWorkspaceLogs(workspaceId);
  }

  @Post()
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  createAgent(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @WorkspaceMemberRole() role: WorkspaceRole | undefined,
    @WorkspacePolicies() policies: WorkspacePolicy | undefined,
    @Body(zodBody(createAgentSchema)) body: CreateAgentInput,
  ) {
    // Settings → Permissions & Policies → "Who can create AI Agents".
    if (policies && !isPolicyRoleAllowed(role, policies.whoCanCreateAgents)) {
      throw new ForbiddenException(
        'You do not have permission to create AI agents in this workspace.',
      );
    }
    return this.agentsService.createAgent(workspaceId, userId, body);
  }

  @Patch(':agentId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @CanManageAIEntity('agentId')
  updateAgent(
    @WorkspaceId() workspaceId: string,
    @Param('agentId') agentId: string,
    @Body(zodBody(updateAgentSchema)) body: Parameters<AgentsService['updateAgent']>[2],
  ) {
    return this.agentsService.updateAgent(workspaceId, agentId, body);
  }

  @Delete(':agentId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @CanManageAIEntity('agentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteAgent(
    @WorkspaceId() workspaceId: string,
    @Param('agentId') agentId: string,
  ): Promise<void> {
    return this.agentsService.deleteAgent(workspaceId, agentId);
  }

  @Post(':agentId/execute')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  executeAgent(
    @WorkspaceId() workspaceId: string,
    @Param('agentId') agentId: string,
    @Body(zodBody(executeAIEntitySchema)) body: { promptText: string },
  ) {
    return this.agentsService.executeAgent(workspaceId, agentId, body.promptText);
  }

  /** One chat turn with this agent; the conversation is stored for the caller. */
  @Post(':agentId/chat')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  chat(
    @WorkspaceId() workspaceId: string,
    @Param('agentId') agentId: string,
    @CurrentUser('id') userId: string,
    @Body(zodBody(agentChatSchema)) body: { conversationId?: string; message: string },
  ) {
    return this.agentsService.chat(workspaceId, agentId, userId, body);
  }

  @Get(':agentId/conversations')
  listConversations(
    @WorkspaceId() workspaceId: string,
    @Param('agentId') agentId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.agentsService.listConversations(workspaceId, agentId, userId);
  }

  @Get(':agentId/conversations/:conversationId')
  getConversation(
    @WorkspaceId() workspaceId: string,
    @Param('agentId') agentId: string,
    @Param('conversationId') conversationId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.agentsService.getConversation(workspaceId, agentId, userId, conversationId);
  }

  @Delete(':agentId/conversations/:conversationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteConversation(
    @WorkspaceId() workspaceId: string,
    @Param('agentId') agentId: string,
    @Param('conversationId') conversationId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.agentsService.deleteConversation(workspaceId, agentId, userId, conversationId);
  }

  @Get(':agentId/logs')
  getExecutionLogs(
    @WorkspaceId() workspaceId: string,
    @Param('agentId') agentId: string,
  ) {
    return this.agentsService.getExecutionLogs(workspaceId, agentId);
  }

  // --- AI Agent Studio Endpoints ---

  @Post(':agentId/validate')
  validateAgent(
    @WorkspaceId() workspaceId: string,
    @Param('agentId') agentId: string,
    @Body(zodBody(validateAgentGraphSchema)) body: { graphJson?: string },
  ) {
    return this.agentsService.validateGraph(body.graphJson);
  }

  @Post(':agentId/publish')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @CanManageAIEntity('agentId')
  publishAgent(
    @WorkspaceId() workspaceId: string,
    @Param('agentId') agentId: string,
    @Body(zodBody(agentVersionSchema)) body: { summary?: string },
  ) {
    return this.agentsService.publishAgent(workspaceId, agentId, body.summary);
  }

  // --- AI Agent Studio -> marketplace -------------------------------------

  /** The marketplace listing this agent has been published as, or `null`. */
  @Get(':agentId/marketplace')
  getMarketplaceListing(
    @WorkspaceId() workspaceId: string,
    @Param('agentId') agentId: string,
  ) {
    return this.marketplace.getStudioListing(workspaceId, agentId);
  }

  /** Publishes (or re-publishes) the agent's latest published version as a listing. */
  @Put(':agentId/marketplace')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @CanManageAIEntity('agentId')
  publishToMarketplace(
    @WorkspaceId() workspaceId: string,
    @Param('agentId') agentId: string,
    @CurrentUser('id') userId: string,
    @Body(zodBody(publishAgentListingSchema)) body: PublishStudioAgentInput,
  ) {
    return this.marketplace.publishStudioAgent(workspaceId, agentId, userId, body);
  }

  @Delete(':agentId/marketplace')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @CanManageAIEntity('agentId')
  unpublishFromMarketplace(
    @WorkspaceId() workspaceId: string,
    @Param('agentId') agentId: string,
  ) {
    return this.marketplace.unpublishStudioAgent(workspaceId, agentId);
  }

  @Post(':agentId/unpublish')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @CanManageAIEntity('agentId')
  unpublishAgent(
    @WorkspaceId() workspaceId: string,
    @Param('agentId') agentId: string,
  ) {
    return this.agentsService.unpublishAgent(workspaceId, agentId);
  }

  @Get(':agentId/versions')
  getAgentVersions(
    @WorkspaceId() workspaceId: string,
    @Param('agentId') agentId: string,
  ) {
    return this.agentsService.getAgentVersions(workspaceId, agentId);
  }

  @Post(':agentId/versions')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @CanManageAIEntity('agentId')
  createAgentVersion(
    @WorkspaceId() workspaceId: string,
    @Param('agentId') agentId: string,
    @Body(zodBody(agentVersionSchema)) body: { summary?: string },
  ) {
    return this.agentsService.createAgentVersion(workspaceId, agentId, body.summary);
  }

  @Post(':agentId/versions/:version/restore')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @CanManageAIEntity('agentId')
  restoreAgentVersion(
    @WorkspaceId() workspaceId: string,
    @Param('agentId') agentId: string,
    @Param('version') version: string,
  ) {
    return this.agentsService.restoreAgentVersion(workspaceId, agentId, parseInt(version, 10));
  }

  @Post(':agentId/test-run')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  testRunAgent(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('agentId') agentId: string,
    @Body(zodBody(agentTestRunSchema))
    body: { input?: Record<string, unknown>; message?: string; prompt?: string },
  ) {
    return this.agentsService.testRunWorkflow(
      workspaceId,
      agentId,
      body.input ?? { message: body.message ?? body.prompt },
      userId,
    );
  }

  @Get('studio/mcp-tools')
  listMcpTools() {
    return this.agentsService.listMcpTools();
  }

  @Post('studio/mcp-tools/test')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  testMcpTool(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body(zodBody(testMcpToolSchema)) body: { toolName: string; params: Record<string, unknown> },
  ) {
    return this.agentsService.testMcpTool(body.toolName, body.params, workspaceId, userId);
  }

  /** The apps this agent needs and which of them the caller has connected. */
  @Get(':agentId/connections')
  getConnections(
    @WorkspaceId() workspaceId: string,
    @Param('agentId') agentId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.agentsService.getConnections(workspaceId, agentId, userId);
  }

  /**
   * One agent, for the Agent Studio editor. Declared last so the literal
   * single-segment routes above (`logs`) keep winning over this parameter.
   */
  @Get(':agentId')
  getAgent(
    @WorkspaceId() workspaceId: string,
    @Param('agentId') agentId: string,
  ) {
    return this.agentsService.getAgent(workspaceId, agentId);
  }
}

/**
 * Which agents a channel has added. Workspace-guarded like the rest; the
 * channel id is validated against the workspace in the service.
 * `AgentMatrixBridgeService` reads these rows to decide whether an agent may
 * answer in a channel's room.
 */
@Controller({
  path: 'workspaces/:workspaceId/channels/:channelId/agents',
  version: '1',
})
@UseGuards(WorkspaceRoleGuard)
export class ChannelAgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  list(
    @WorkspaceId() workspaceId: string,
    @Param('channelId') channelId: string,
  ) {
    return this.agentsService.listChannelAgents(workspaceId, channelId);
  }

  @Post()
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  add(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('channelId') channelId: string,
    @Body(zodBody(linkAgentSchema)) body: { agentId: string },
  ) {
    return this.agentsService.addChannelAgent(
      workspaceId,
      channelId,
      body.agentId,
      userId,
    );
  }

  @Patch(':agentId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  setEnabled(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('channelId') channelId: string,
    @Param('agentId') agentId: string,
    @Body(zodBody(setEnabledSchema)) body: { isEnabled: boolean },
  ) {
    return this.agentsService.setChannelAgentEnabled(
      workspaceId,
      channelId,
      agentId,
      body.isEnabled,
      userId,
    );
  }

  @Delete(':agentId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('channelId') channelId: string,
    @Param('agentId') agentId: string,
  ): Promise<void> {
    return this.agentsService.removeChannelAgent(
      workspaceId,
      channelId,
      agentId,
      userId,
    );
  }
}
