import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@org/database';
import { ApprovalsService, AICredentialService, AIInfrastructureService } from '@org/api-ai';
import { IntegrationsService } from '@org/api-integrations';
import { CreditService } from '@org/api-workspace';
import { RealtimeGatewayService } from '@org/api-realtime';
import type {
  AgentToolExecution,
  AIChatMessage,
  AIProvider,
  CoworkerPermissions,
  CoworkerStatus,
} from '@org/types';
import { isAIEntityType } from '@org/types';
import {
  IntegrationToolBridgeService,
  type IntegrationToolSchema,
} from './integration-tool-bridge.service.js';
import { MCPToolRegistryService } from './mcp-tool-registry.service.js';

function parseToolArguments(json: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(json);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function parsePermissions(value: unknown): CoworkerPermissions {
  if (value && typeof value === 'object') return value as CoworkerPermissions;
  return {};
}

function parseToolNames(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

const READ_ONLY_TOOL_NAMES = [
  'search_docs',
  'list_projects',
  'list_tasks',
  'list_channels',
  'list_memory',
];

const DELEGATE_TOOL_PREFIX = 'consult_agent_';

/** A coworker delegating to an agent, which delegates to another coworker,
 *  forever — capped independently of the 4-round-per-turn tool loop limit. */
const MAX_DELEGATION_DEPTH = 3;

/** Same per-token estimate `WorkflowEngineService` already uses for
 *  `AIExecution.totalCost`, so agent and workflow runs price consistently
 *  against the shared credit ledger. */
const ESTIMATED_COST_PER_TOKEN_USD = 0.000002;

/** How many recent workspace memory facts to surface to every turn. */
const MEMORY_CONTEXT_LIMIT = 20;

export interface AIEntityTurnContext {
  channelId?: string;
  channelName?: string;
  projectId?: string;
  projectName?: string;
  /** The Matrix room this turn is running in, if any — used to post the
   *  outcome of a gated tool call back where the conversation happened. */
  roomId?: string;
  threadRootId?: string;
}

export interface AIEntityRunResult {
  entityId: string;
  entityName: string;
  type: 'agent' | 'coworker';
  result: string;
  logId: string;
  tools: AgentToolExecution[];
}

export interface InvokeAgentParams {
  entityId: string;
  callerId: string;
  workspaceId: string;
  request: string;
  fallbackPrompt?: string;
  delegationDepth?: number;
}

/**
 * Unified AI Runtime for both AI Agents and AI Coworkers.
 *
 * Enforces strict type discrimination ('agent' vs 'coworker') while sharing the
 * underlying LLM execution, MCP tool invocation, context scoping, logging,
 * and error handling. AI Coworkers can securely delegate to linked AI Agents
 * through `invokeAIEntity`.
 */
@Injectable()
export class AIRuntimeService {
  private readonly logger = new Logger(AIRuntimeService.name);
  public static readonly MAX_TOOL_ROUNDS = 4;

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AIInfrastructureService,
    private readonly credentialService: AICredentialService,
    private readonly mcpRegistry: MCPToolRegistryService,
    private readonly integrationTools: IntegrationToolBridgeService,
    private readonly integrationsService: IntegrationsService,
    private readonly approvals: ApprovalsService,
    private readonly creditService: CreditService,
    private readonly realtime: RealtimeGatewayService,
  ) {}

  /**
   * Executes a turn for an AI entity (Agent or Coworker), strictly routing behavior
   * based on `entity.type`.
   *
   * `delegationDepth` is internal — callers never pass it. It only grows when
   * a Coworker delegates to an Agent that (via a further Coworker) delegates
   * again, and is capped at {@link MAX_DELEGATION_DEPTH} to prevent an
   * uncontrolled agent-calls-agent loop (audit §16).
   */
  async executeTurn(
    workspaceId: string,
    entityId: string,
    promptText: string,
    context: AIEntityTurnContext = {},
    onToolUpdate?: (tools: AgentToolExecution[]) => void | Promise<void>,
    delegationDepth = 0,
  ): Promise<AIEntityRunResult> {
    const entity = await this.prisma.aIAgent.findFirst({
      where: { id: entityId, workspaceId },
      include: {
        agentLinks: {
          include: {
            agent: {
              select: { id: true, name: true, description: true, isActive: true },
            },
          },
        },
        workspace: { select: { name: true } },
      },
    });

    if (!entity) throw new NotFoundException('AI Entity not found.');
    if (!entity.isActive) {
      throw new Error(`AI Entity '${entity.name}' is deactivated.`);
    }
    if (!isAIEntityType(entity.type)) {
      throw new Error(`Invalid entity type '${entity.type}'. Expected 'agent' or 'coworker'.`);
    }

    await this.assertCreditsAvailable(workspaceId);

    if (entity.type === 'agent') {
      return this.executeAgentTurn(entity, workspaceId, promptText, context, onToolUpdate, delegationDepth);
    } else {
      return this.executeCoworkerTurn(entity, workspaceId, promptText, context, onToolUpdate, delegationDepth);
    }
  }

  /**
   * Invokes an AI Agent on behalf of an AI Coworker (controlled delegation).
   */
  async invokeAIEntity({
    entityId,
    callerId,
    workspaceId,
    request,
    fallbackPrompt,
    delegationDepth = 0,
  }: InvokeAgentParams): Promise<{ agentName: string; result: string }> {
    if (delegationDepth >= MAX_DELEGATION_DEPTH) {
      throw new Error(
        `Delegation depth limit (${MAX_DELEGATION_DEPTH}) reached — refusing to delegate further to prevent a runaway agent chain.`,
      );
    }

    const targetAgent = await this.prisma.aIAgent.findFirst({
      where: { id: entityId, workspaceId },
      select: { id: true, name: true, type: true, isActive: true },
    });

    if (!targetAgent) {
      throw new NotFoundException(`Target AI agent '${entityId}' not found.`);
    }
    if (targetAgent.type !== 'agent') {
      throw new Error(
        `Cannot delegate to entity '${targetAgent.name}': entity type is '${targetAgent.type}', but only 'agent' may be delegated to.`,
      );
    }
    if (!targetAgent.isActive) {
      throw new Error(`Target AI agent '${targetAgent.name}' is inactive.`);
    }

    const link = await this.prisma.coworkerAgent.findFirst({
      where: { coworkerId: callerId, agentId: entityId },
    });
    if (!link) {
      throw new Error(
        `Coworker '${callerId}' is not authorized to delegate to agent '${targetAgent.name}'.`,
      );
    }

    const taskRequest = request.trim() || fallbackPrompt || 'Execute assigned task';
    this.logger.log(
      `Delegation: Coworker '${callerId}' invoking Agent '${targetAgent.name}' (${entityId})`,
    );

    const run = await this.executeTurn(
      workspaceId,
      entityId,
      taskRequest,
      {},
      undefined,
      delegationDepth + 1,
    );
    return { agentName: targetAgent.name, result: run.result };
  }

  /** Pre-flight check mirroring `WorkflowEngineService.executeWorkflow` — a
   *  depleted shared credit balance blocks a run before any tokens are spent,
   *  rather than only failing the deduction afterward. */
  private async assertCreditsAvailable(workspaceId: string): Promise<void> {
    const account = await this.prisma.creditAccount.findUnique({ where: { workspaceId } });
    if (account && account.balance <= 0) {
      throw new BadRequestException({
        code: 'CREDIT_LIMIT_REACHED',
        message:
          'Your shared AI credit balance is depleted. Please top up your credits to continue running agents.',
      });
    }
  }

  /** Best-effort — a run that already produced a result must not fail the
   *  caller because the ledger write failed (e.g. a balance race). */
  private async deductRunCredits(
    workspaceId: string,
    entityId: string,
    tokensUsed: number,
    entityName: string,
  ): Promise<void> {
    if (tokensUsed <= 0) return;
    const amount = Number((tokensUsed * ESTIMATED_COST_PER_TOKEN_USD).toFixed(5));
    if (amount <= 0) return;
    try {
      await this.creditService.deductCredits(
        workspaceId,
        amount,
        'AGENT',
        entityId,
        `AI Agent run — ${entityName}`,
      );
    } catch (error) {
      this.logger.warn(`Credit deduction failed for agent ${entityId}: ${String(error)}`);
    }
  }

  /** The most recently updated workspace memory facts, rendered for a system
   *  prompt — or '' when there are none, so callers can splice it in freely. */
  private async buildMemoryContext(workspaceId: string): Promise<string> {
    const rows = await this.prisma.aIMemory.findMany({
      where: { workspaceId },
      select: { key: true, value: true },
      orderBy: { updatedAt: 'desc' },
      take: MEMORY_CONTEXT_LIMIT,
    });
    if (rows.length === 0) return '';
    const lines = rows.map((r) => `- ${r.key}: ${r.value}`).join('\n');
    return `\n\nRemembered context for this workspace (from save_memory):\n${lines}`;
  }

  /**
   * Resolves and runs one tool call — shared by both Agent and Coworker
   * turns. Mutates `entry` in place (status/output/error/durationMs) and
   * returns the `role: 'tool'` message content to feed back to the model.
   *
   * A destructive or confirmation-gated integration action is never executed
   * here: it raises an `ApprovalRequest` and tells the model (and, via the
   * tool trace, the run UI) that the action is pending human review instead.
   */
  private async runToolCall(
    entry: AgentToolExecution,
    call: { id: string; function: { name: string; arguments: string } },
    input: Record<string, unknown>,
    entity: any,
    workspaceId: string,
    context: AIEntityTurnContext,
    integrationTools: Map<string, IntegrationToolSchema>,
    isCoworker: boolean,
    delegationDepth: number,
  ): Promise<string> {
    const startedAt = Date.now();
    const ctx = {
      workspaceId,
      actingUserId: entity.creatorId as string | null,
      agentMatrixUserId: entity.matrixUserId as string | null,
    };

    try {
      if (isCoworker && call.function.name.startsWith(DELEGATE_TOOL_PREFIX)) {
        const targetAgentId = call.function.name.slice(DELEGATE_TOOL_PREFIX.length);
        const request =
          typeof input['request'] === 'string' && (input['request'] as string).trim()
            ? (input['request'] as string)
            : '';
        const output = await this.invokeAIEntity({
          entityId: targetAgentId,
          callerId: entity.id,
          workspaceId,
          request,
          fallbackPrompt: request || undefined,
          delegationDepth,
        });
        entry.status = 'success';
        entry.output = output;
        entry.durationMs = Date.now() - startedAt;
        return JSON.stringify(output ?? null);
      }

      const integrationTool = integrationTools.get(call.function.name);
      if (integrationTool) {
        const { definition } = integrationTool;
        if (definition.permissionLevel === 'destructive' || definition.requiresConfirmation) {
          const approval = await this.approvals.createForEntityAction({
            workspaceId,
            entityType: entity.type,
            entityId: entity.id,
            requesterId: entity.creatorId ?? null,
            actionType: call.function.name,
            proposedPayload: {
              integrationId: integrationTool.integrationId,
              actionId: integrationTool.actionId,
              actionLabel: definition.label,
              input,
              roomId: context.roomId ?? null,
              threadRootId: context.threadRootId ?? null,
            },
          });
          entry.status = 'success';
          entry.durationMs = Date.now() - startedAt;
          entry.output = { pendingApproval: true, approvalId: approval.id };
          return JSON.stringify({
            status: 'pending_approval',
            approvalId: approval.id,
            message: `'${definition.label}' requires human approval before it can run. Request ${approval.id} has been queued — do not retry this action this turn; tell the user it is awaiting approval.`,
          });
        }
        if (!ctx.actingUserId) {
          throw new Error(
            'This action needs an acting user, but the agent has no creator on record.',
          );
        }
        const result = await this.integrationsService.executeAction(
          integrationTool.integrationId,
          integrationTool.actionId,
          input,
          undefined,
          ctx.actingUserId,
          workspaceId,
        );
        entry.status = 'success';
        entry.output = result;
        entry.durationMs = Date.now() - startedAt;
        return JSON.stringify(result ?? null);
      }

      const output = await this.mcpRegistry.executeTool(call.function.name, input, ctx);
      entry.status = 'success';
      entry.output = output;
      entry.durationMs = Date.now() - startedAt;
      return JSON.stringify(output ?? null);
    } catch (toolError) {
      const message = toolError instanceof Error ? toolError.message : String(toolError);
      entry.status = 'failed';
      entry.error = message;
      entry.durationMs = Date.now() - startedAt;
      return JSON.stringify({ error: message });
    }
  }

  private async executeAgentTurn(
    entity: any,
    workspaceId: string,
    promptText: string,
    context: AIEntityTurnContext,
    onToolUpdate?: (tools: AgentToolExecution[]) => void | Promise<void>,
    delegationDepth = 0,
  ): Promise<AIEntityRunResult> {
    this.logger.log(`Executing Agent '${entity.name}' (${entity.id})`);

    const allowedToolNames = parseToolNames(entity.tools);
    const integrationSchemas = await this.integrationTools.getToolsForEntity(
      workspaceId,
      entity.id,
      entity.creatorId,
    );
    const integrationToolMap = new Map(integrationSchemas.map((t) => [t.name, t]));
    const toolSchemas = [
      ...(allowedToolNames.length > 0
        ? this.mcpRegistry.getToolSchemasFor(allowedToolNames)
        : this.mcpRegistry.getToolSchemas()),
      ...integrationSchemas.map((t) => t.schema),
    ];

    const memoryContext = await this.buildMemoryContext(workspaceId);
    const systemPrompt = `${entity.systemPrompt}\n\nWorkspace ID: ${workspaceId}${memoryContext}`;
    const provider = (entity.provider || 'nvidia') as AIProvider;
    const cred = await this.credentialService.resolveCredential(provider, {
      workspaceId,
    });

    const messages: AIChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: promptText },
    ];
    const toolTrace: AgentToolExecution[] = [];
    const emitProgress = async (status: 'running' | 'completed' | 'failed') => {
      await this.broadcast(workspaceId, 'agent.run_progress', {
        entityId: entity.id,
        entityType: 'agent',
        workspaceId,
        status,
        tools: toolTrace,
      });
      await onToolUpdate?.([...toolTrace]);
    };

    try {
      let chatResult = await this.aiService.chat({
        provider,
        model: entity.model || undefined,
        apiKey: cred.apiKey,
        baseUrl: cred.baseUrl,
        messages,
        tools: toolSchemas.length > 0 ? toolSchemas : undefined,
      });

      for (
        let round = 0;
        round < AIRuntimeService.MAX_TOOL_ROUNDS &&
        (chatResult.message.toolCalls?.length ?? 0) > 0;
        round++
      ) {
        messages.push(chatResult.message);

        for (const call of chatResult.message.toolCalls ?? []) {
          const input = parseToolArguments(call.function.arguments);
          const entry: AgentToolExecution = {
            id: call.id,
            name: call.function.name,
            status: 'running',
            input,
          };
          toolTrace.push(entry);
          await emitProgress('running');

          const toolMessageContent = await this.runToolCall(
            entry,
            call,
            input,
            entity,
            workspaceId,
            context,
            integrationToolMap,
            false,
            delegationDepth,
          );
          messages.push({
            role: 'tool',
            toolCallId: call.id,
            name: call.function.name,
            content: toolMessageContent,
          });
          await emitProgress('running');
        }

        chatResult = await this.aiService.chat({
          provider,
          model: entity.model || undefined,
          apiKey: cred.apiKey,
          baseUrl: cred.baseUrl,
          messages,
          tools: toolSchemas.length > 0 ? toolSchemas : undefined,
        });
      }

      const tokensUsed = chatResult.usage?.totalTokens ?? 0;
      const log = await this.prisma.agentExecutionLog.create({
        data: {
          agentId: entity.id,
          status: 'SUCCESS',
          promptText,
          outputResult: chatResult.message.content,
          toolCalls: JSON.stringify(toolTrace),
          tokensUsed,
        },
      });
      await this.deductRunCredits(workspaceId, entity.id, tokensUsed, entity.name);
      await emitProgress('completed');

      return {
        entityId: entity.id,
        entityName: entity.name,
        type: 'agent',
        result: chatResult.message.content,
        logId: log.id,
        tools: toolTrace,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Agent '${entity.name}' (${entity.id}) turn failed: ${message}`,
      );
      await this.prisma.agentExecutionLog.create({
        data: {
          agentId: entity.id,
          status: 'FAILED',
          promptText,
          outputResult: message,
          toolCalls: JSON.stringify(toolTrace),
          tokensUsed: 0,
        },
      });
      await emitProgress('failed');
      throw err;
    }
  }

  private async executeCoworkerTurn(
    entity: any,
    workspaceId: string,
    promptText: string,
    context: AIEntityTurnContext,
    onToolUpdate?: (tools: AgentToolExecution[]) => void | Promise<void>,
    delegationDepth = 0,
  ): Promise<AIEntityRunResult> {
    this.logger.log(`Executing Coworker '${entity.name}' (${entity.id})`);

    await this.setCoworkerStatus(entity.id, 'WORKING');
    await this.broadcast(workspaceId, 'coworker.status_changed', {
      coworkerId: entity.id,
      workspaceId,
      status: 'WORKING',
    });
    await this.broadcast(workspaceId, 'coworker.execution_started', {
      coworkerId: entity.id,
      workspaceId,
    });

    const permissions = parsePermissions(entity.permissions);
    const scopedContext = await this.scopeContext(entity.id, context);

    const allowedToolNames = [
      ...READ_ONLY_TOOL_NAMES,
      ...(permissions.allowActions ?? []),
    ];

    const delegateAgents = (entity.agentLinks ?? [])
      .map((link: any) => link.agent)
      .filter((agent: any) => agent && agent.isActive);

    const delegateSchemas = delegateAgents.map((agent: any) => ({
      type: 'function',
      function: {
        name: `${DELEGATE_TOOL_PREFIX}${agent.id}`,
        description: `Delegate task to specialist agent '${agent.name}'${
          agent.description ? `: ${agent.description}` : ''
        }. Use this when the user request requires that specialist capability.`,
        parameters: {
          type: 'object',
          properties: {
            request: {
              type: 'string',
              description: `Specific instructions for '${agent.name}'.`,
            },
          },
          required: ['request'],
        },
      },
    }));

    const integrationSchemas = await this.integrationTools.getToolsForEntity(
      workspaceId,
      entity.id,
      entity.creatorId,
    );
    const integrationToolMap = new Map(integrationSchemas.map((t) => [t.name, t]));

    const toolSchemas = [
      ...this.mcpRegistry.getToolSchemasFor(allowedToolNames),
      ...delegateSchemas,
      ...integrationSchemas.map((t) => t.schema),
    ];

    const memoryContext = await this.buildMemoryContext(workspaceId);
    const systemPrompt = `${this.buildCoworkerSystemPrompt(entity, scopedContext)}${memoryContext}`;
    const provider = (entity.provider || 'nvidia') as AIProvider;
    const cred = await this.credentialService.resolveCredential(provider, {
      workspaceId,
    });

    const messages: AIChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: promptText },
    ];
    const toolTrace: AgentToolExecution[] = [];
    const emitProgress = async (status: 'running' | 'completed' | 'failed') => {
      await this.broadcast(workspaceId, 'agent.run_progress', {
        entityId: entity.id,
        entityType: 'coworker',
        workspaceId,
        status,
        tools: toolTrace,
      });
      await onToolUpdate?.([...toolTrace]);
    };

    try {
      let chatResult = await this.aiService.chat({
        provider,
        model: entity.model || undefined,
        apiKey: cred.apiKey,
        baseUrl: cred.baseUrl,
        messages,
        tools: toolSchemas.length > 0 ? toolSchemas : undefined,
      });

      for (
        let round = 0;
        round < AIRuntimeService.MAX_TOOL_ROUNDS &&
        (chatResult.message.toolCalls?.length ?? 0) > 0;
        round++
      ) {
        messages.push(chatResult.message);

        for (const call of chatResult.message.toolCalls ?? []) {
          const input = parseToolArguments(call.function.arguments);
          const entry: AgentToolExecution = {
            id: call.id,
            name: call.function.name,
            status: 'running',
            input,
          };
          toolTrace.push(entry);
          await emitProgress('running');

          const toolMessageContent = await this.runToolCall(
            entry,
            call,
            input,
            entity,
            workspaceId,
            context,
            integrationToolMap,
            true,
            delegationDepth,
          );
          messages.push({
            role: 'tool',
            toolCallId: call.id,
            name: call.function.name,
            content: toolMessageContent,
          });
          await emitProgress('running');
        }

        chatResult = await this.aiService.chat({
          provider,
          model: entity.model || undefined,
          apiKey: cred.apiKey,
          baseUrl: cred.baseUrl,
          messages,
          tools: toolSchemas.length > 0 ? toolSchemas : undefined,
        });
      }

      const tokensUsed = chatResult.usage?.totalTokens ?? 0;
      const log = await this.prisma.agentExecutionLog.create({
        data: {
          agentId: entity.id,
          status: 'SUCCESS',
          promptText,
          outputResult: chatResult.message.content,
          toolCalls: JSON.stringify(toolTrace),
          tokensUsed,
        },
      });
      await this.deductRunCredits(workspaceId, entity.id, tokensUsed, entity.name);

      await this.setCoworkerStatus(entity.id, 'AVAILABLE');
      await this.broadcast(workspaceId, 'coworker.status_changed', {
        coworkerId: entity.id,
        workspaceId,
        status: 'AVAILABLE',
      });
      await this.broadcast(workspaceId, 'coworker.execution_completed', {
        coworkerId: entity.id,
        workspaceId,
        logId: log.id,
      });
      await emitProgress('completed');

      return {
        entityId: entity.id,
        entityName: entity.name,
        type: 'coworker',
        result: chatResult.message.content,
        logId: log.id,
        tools: toolTrace,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Coworker '${entity.name}' (${entity.id}) turn failed: ${message}`,
      );
      await this.prisma.agentExecutionLog.create({
        data: {
          agentId: entity.id,
          status: 'FAILED',
          promptText,
          outputResult: message,
          toolCalls: JSON.stringify(toolTrace),
          tokensUsed: 0,
        },
      });
      await this.setCoworkerStatus(entity.id, 'ERROR');
      await this.broadcast(workspaceId, 'coworker.status_changed', {
        coworkerId: entity.id,
        workspaceId,
        status: 'ERROR',
      });
      await this.broadcast(workspaceId, 'coworker.execution_failed', {
        coworkerId: entity.id,
        workspaceId,
        error: message,
      });
      await emitProgress('failed');
      throw err;
    }
  }

  private async setCoworkerStatus(id: string, status: CoworkerStatus): Promise<void> {
    await this.prisma.aIAgent.update({
      where: { id },
      data: { status, lastActiveAt: new Date() },
    });
  }

  private async scopeContext(
    coworkerId: string,
    context: AIEntityTurnContext,
  ): Promise<AIEntityTurnContext> {
    const scoped: AIEntityTurnContext = {};

    if (context.channelId) {
      const link = await this.prisma.channelCoworker.findFirst({
        where: { coworkerId, channelId: context.channelId, isEnabled: true },
        include: { channel: { select: { name: true } } },
      });
      if (link) {
        scoped.channelId = context.channelId;
        scoped.channelName = link.channel.name;
      }
    }

    if (context.projectId) {
      const link = await this.prisma.projectCoworker.findFirst({
        where: { coworkerId, projectId: context.projectId },
        include: { project: { select: { name: true } } },
      });
      if (link) {
        scoped.projectId = context.projectId;
        scoped.projectName = link.project.name;
      }
    }

    return scoped;
  }

  private buildCoworkerSystemPrompt(
    coworker: any,
    context: AIEntityTurnContext,
  ): string {
    const lines = [
      `You are ${coworker.name}, a persistent AI teammate at "${coworker.workspace?.name || 'Workspace'}" — a colleague with a stable identity and ongoing working relationship.`,
      `Role: ${coworker.role}.`,
    ];
    if (coworker.description) lines.push(`About you: ${coworker.description}`);
    if (coworker.personality) lines.push(`Working style & personality: ${coworker.personality}`);
    if (coworker.systemInstructions?.trim()) {
      lines.push(`Instructions from your team:\n${coworker.systemInstructions}`);
    }
    if (context.channelName) {
      lines.push(`You are responding inside the #${context.channelName} channel.`);
    }
    if (context.projectName) {
      lines.push(`This conversation concerns the "${context.projectName}" project.`);
    }
    lines.push(
      'When appropriate, delegate specialized tasks to your specialist agents (using `consult_agent_*` tools) rather than guessing answers yourself.',
    );
    return lines.join('\n\n');
  }

  private async broadcast(
    workspaceId: string,
    type: string,
    payload: unknown,
  ): Promise<void> {
    try {
      await this.realtime.broadcastToWorkspace(workspaceId, { type, payload });
    } catch (error) {
      this.logger.warn(`Failed to broadcast ${type}: ${String(error)}`);
    }
  }
}
