import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@org/database';
import { AICredentialService, AIInfrastructureService } from '@org/api-ai';
import { RealtimeGatewayService } from '@org/api-realtime';
import type {
  AgentToolExecution,
  AIChatMessage,
  AIProvider,
  CoworkerPermissions,
  CoworkerStatus,
} from '@org/types';
import { isAIEntityType } from '@org/types';
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

const READ_ONLY_TOOL_NAMES = [
  'search_docs',
  'list_projects',
  'list_tasks',
  'list_channels',
];

const DELEGATE_TOOL_PREFIX = 'consult_agent_';

export interface AIEntityTurnContext {
  channelId?: string;
  channelName?: string;
  projectId?: string;
  projectName?: string;
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
    private readonly realtime: RealtimeGatewayService,
  ) {}

  /**
   * Executes a turn for an AI entity (Agent or Coworker), strictly routing behavior
   * based on `entity.type`.
   */
  async executeTurn(
    workspaceId: string,
    entityId: string,
    promptText: string,
    context: AIEntityTurnContext = {},
    onToolUpdate?: (tools: AgentToolExecution[]) => void | Promise<void>,
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

    if (entity.type === 'agent') {
      return this.executeAgentTurn(entity, workspaceId, promptText, onToolUpdate);
    } else {
      return this.executeCoworkerTurn(entity, workspaceId, promptText, context, onToolUpdate);
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
  }: InvokeAgentParams): Promise<{ agentName: string; result: string }> {
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

    const run = await this.executeTurn(workspaceId, entityId, taskRequest);
    return { agentName: targetAgent.name, result: run.result };
  }

  private async executeAgentTurn(
    entity: any,
    workspaceId: string,
    promptText: string,
    onToolUpdate?: (tools: AgentToolExecution[]) => void | Promise<void>,
  ): Promise<AIEntityRunResult> {
    this.logger.log(`Executing Agent '${entity.name}' (${entity.id})`);

    const toolSchemas = this.mcpRegistry.getToolSchemas();
    const systemPrompt = `${entity.systemPrompt}\n\nWorkspace ID: ${workspaceId}`;
    const provider = (entity.provider || 'nvidia') as AIProvider;
    const cred = await this.credentialService.resolveCredential(provider, {
      workspaceId,
    });

    const messages: AIChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: promptText },
    ];
    const toolTrace: AgentToolExecution[] = [];

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
          await onToolUpdate?.([...toolTrace]);

          const startedAt = Date.now();
          try {
            const output = await this.mcpRegistry.executeTool(
              call.function.name,
              input,
              {
                workspaceId,
                actingUserId: entity.creatorId,
                agentMatrixUserId: entity.matrixUserId,
              },
            );
            entry.status = 'success';
            entry.output = output;
            entry.durationMs = Date.now() - startedAt;
            messages.push({
              role: 'tool',
              toolCallId: call.id,
              name: call.function.name,
              content: JSON.stringify(output ?? null),
            });
          } catch (toolError) {
            const message =
              toolError instanceof Error ? toolError.message : String(toolError);
            entry.status = 'failed';
            entry.error = message;
            entry.durationMs = Date.now() - startedAt;
            messages.push({
              role: 'tool',
              toolCallId: call.id,
              name: call.function.name,
              content: JSON.stringify({ error: message }),
            });
          }
          await onToolUpdate?.([...toolTrace]);
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

      const log = await this.prisma.agentExecutionLog.create({
        data: {
          agentId: entity.id,
          status: 'SUCCESS',
          promptText,
          outputResult: chatResult.message.content,
          toolCalls: JSON.stringify(toolTrace),
          tokensUsed: chatResult.usage?.totalTokens ?? 0,
        },
      });

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
      throw err;
    }
  }

  private async executeCoworkerTurn(
    entity: any,
    workspaceId: string,
    promptText: string,
    context: AIEntityTurnContext,
    onToolUpdate?: (tools: AgentToolExecution[]) => void | Promise<void>,
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

    const toolSchemas = [
      ...this.mcpRegistry.getToolSchemasFor(allowedToolNames),
      ...delegateSchemas,
    ];

    const systemPrompt = this.buildCoworkerSystemPrompt(entity, scopedContext);
    const provider = (entity.provider || 'nvidia') as AIProvider;
    const cred = await this.credentialService.resolveCredential(provider, {
      workspaceId,
    });

    const messages: AIChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: promptText },
    ];
    const toolTrace: AgentToolExecution[] = [];

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
          await onToolUpdate?.([...toolTrace]);

          const startedAt = Date.now();
          try {
            let output: unknown;
            if (call.function.name.startsWith(DELEGATE_TOOL_PREFIX)) {
              const targetAgentId = call.function.name.slice(
                DELEGATE_TOOL_PREFIX.length,
              );
              const request =
                typeof input['request'] === 'string' && input['request'].trim()
                  ? input['request']
                  : promptText;
              output = await this.invokeAIEntity({
                entityId: targetAgentId,
                callerId: entity.id,
                workspaceId,
                request,
                fallbackPrompt: promptText,
              });
            } else {
              output = await this.mcpRegistry.executeTool(
                call.function.name,
                input,
                {
                  workspaceId,
                  actingUserId: entity.creatorId,
                  agentMatrixUserId: entity.matrixUserId,
                },
              );
            }

            entry.status = 'success';
            entry.output = output;
            entry.durationMs = Date.now() - startedAt;
            messages.push({
              role: 'tool',
              toolCallId: call.id,
              name: call.function.name,
              content: JSON.stringify(output ?? null),
            });
          } catch (toolError) {
            const message =
              toolError instanceof Error ? toolError.message : String(toolError);
            entry.status = 'failed';
            entry.error = message;
            entry.durationMs = Date.now() - startedAt;
            messages.push({
              role: 'tool',
              toolCallId: call.id,
              name: call.function.name,
              content: JSON.stringify({ error: message }),
            });
          }
          await onToolUpdate?.([...toolTrace]);
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

      const log = await this.prisma.agentExecutionLog.create({
        data: {
          agentId: entity.id,
          status: 'SUCCESS',
          promptText,
          outputResult: chatResult.message.content,
          toolCalls: JSON.stringify(toolTrace),
          tokensUsed: chatResult.usage?.totalTokens ?? 0,
        },
      });

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
