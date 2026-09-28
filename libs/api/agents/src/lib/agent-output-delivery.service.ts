import { Injectable, Logger } from '@nestjs/common';
import { safeFetch } from '@org/api-common';
import { MatrixAdminService, MatrixBotMessagingService } from '@org/api-matrix';
import { PrismaService } from '@org/database';
import { readAgentRuntime, type AgentOutputTarget } from '@org/types';
import type { AIEntityRunResult } from './ai-runtime.service.js';
import { MCPToolRegistryService } from './mcp-tool-registry.service.js';

interface DeliverableAgent {
  id: string;
  type: string;
  name: string;
  workspaceId: string;
  creatorId: string | null;
  matrixUserId: string | null;
  configuration: unknown;
}

/**
 * Whether `userId` may post into `channelId`: the channel is in the workspace,
 * not archived, and either public or one they belong to. An agent delivers
 * with its creator's authority, so it may not reach a private channel its
 * creator cannot.
 */
export async function creatorCanPostToChannel(
  prisma: PrismaService,
  workspaceId: string,
  channelId: string,
  creatorId: string | null,
): Promise<boolean> {
  if (!creatorId) return false;
  const channel = await prisma.channel.findFirst({
    where: { id: channelId, workspaceId, isArchived: false },
    select: { visibility: true },
  });
  if (!channel) return false;
  if (channel.visibility === 'PUBLIC') return true;
  const membership = await prisma.channelMember.findFirst({
    where: { channelId, userId: creatorId },
    select: { id: true },
  });
  return !!membership;
}

/**
 * Delivers a *scheduled* agent run's result to the outputs its builder graph
 * configured — a channel post (as the agent's own bot identity), a task, or an
 * https webhook. Chat replies are delivered in place by the chat bridge and
 * never come through here.
 */
@Injectable()
export class AgentOutputDeliveryService {
  private readonly logger = new Logger(AgentOutputDeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly matrixAdmin: MatrixAdminService,
    private readonly messaging: MatrixBotMessagingService,
    private readonly tools: MCPToolRegistryService,
  ) {}

  /** Returns one line per output describing what happened. Never throws. */
  async deliver(agent: DeliverableAgent, run: AIEntityRunResult, task: string): Promise<string[]> {
    const outputs = readAgentRuntime(agent.configuration).outputs;
    const results: string[] = [];
    for (const output of outputs) {
      try {
        results.push(await this.deliverOne(agent, output, run, task));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Output ${output.kind} for agent ${agent.id} failed: ${message}`);
        results.push(`${output.kind}: failed — ${message}`);
      }
    }
    return results;
  }

  private async deliverOne(
    agent: DeliverableAgent,
    output: AgentOutputTarget,
    run: AIEntityRunResult,
    task: string,
  ): Promise<string> {
    switch (output.kind) {
      case 'channel':
        return this.postToChannel(agent, output.target, run, task);
      case 'task': {
        await this.tools.executeTool(
          'create_task',
          {
            title: `${agent.name}: ${task}`.slice(0, 200),
            description: run.result.slice(0, 10_000),
            ...(output.target ? { projectId: output.target } : {}),
          },
          { workspaceId: agent.workspaceId, actingUserId: agent.creatorId, agentMatrixUserId: agent.matrixUserId },
        );
        return 'task: created';
      }
      case 'webhook': {
        if (!/^https:\/\//i.test(output.target)) return 'webhook: skipped — not an https URL';
        const res = await safeFetch(output.target, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            agentId: agent.id,
            agentName: agent.name,
            task,
            result: run.result,
            executionId: run.executionId ?? null,
            deliveredAt: new Date().toISOString(),
          }),
          maxRedirects: 0,
          maxBytes: 64 * 1024,
        });
        return `webhook: HTTP ${res.status}`;
      }
      default:
        return `${String((output as { kind: string }).kind)}: unsupported`;
    }
  }

  private async postToChannel(
    agent: DeliverableAgent,
    channelId: string,
    run: AIEntityRunResult,
    task: string,
  ): Promise<string> {
    if (!(await creatorCanPostToChannel(this.prisma, agent.workspaceId, channelId, agent.creatorId))) {
      return "channel: skipped — the agent's creator can't post there";
    }
    const channel = await this.prisma.channel.findUniqueOrThrow({
      where: { id: channelId },
      select: { name: true, matrixRoomId: true },
    });
    if (!channel.matrixRoomId) return `channel: skipped — #${channel.name} has no chat room yet`;

    const matrixUserId = agent.matrixUserId ?? (await this.provisionIdentity(agent));
    await this.matrixAdmin.joinRoomAs(matrixUserId, channel.matrixRoomId);
    await this.messaging.sendText(
      channel.matrixRoomId,
      matrixUserId,
      `**${task}**\n\n${run.result}`.slice(0, 30_000),
    );
    return `channel: posted to #${channel.name}`;
  }

  /** Same lazy bot identity the chat bridge uses (`agent-<id>` / `coworker-<id>`). */
  private async provisionIdentity(agent: DeliverableAgent): Promise<string> {
    const { matrixUserId } = await this.matrixAdmin.provisionUser({
      userId: `${agent.type === 'coworker' ? 'coworker' : 'agent'}-${agent.id}`,
      displayName: agent.name,
    });
    await this.prisma.aIAgent.update({ where: { id: agent.id }, data: { matrixUserId } });
    return matrixUserId;
  }
}
