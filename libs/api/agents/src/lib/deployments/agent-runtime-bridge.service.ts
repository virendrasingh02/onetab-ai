import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@org/database';
import { randomBytes } from 'node:crypto';
import type {
  AgentExecutionState,
  AgentRunResponseView,
  AgentSessionMessage,
} from '@org/types';
import { AIRuntimeService, type AIEntityTurnContext } from '../ai-runtime.service.js';
import { AgentSessionService } from './agent-session.service.js';
import { AgentDeploymentWebhookService } from './agent-webhook.service.js';

export interface ExecuteAgentOptions {
  workspaceId: string;
  agentId: string;
  prompt: string;
  context?: Record<string, unknown>;
  deploymentId?: string;
  sessionId?: string;
  userId?: string;
  allowedTools?: string[];
  versionNumber?: number;
}

/**
 * What a caller of the public API may be told about a failed run. Provider
 * errors can quote part of the workspace's own API key, so they are replaced
 * with something the caller can act on; the full message stays in the server log.
 */
export function publicRunError(message: string): string {
  if (/api key|credential|unauthori[sz]ed|authentication|invalid.*key/i.test(message)) {
    return 'The agent’s model provider rejected the request. The agent’s owner needs to check its provider credentials.';
  }
  return message;
}

@Injectable()
export class AgentRuntimeBridgeService {
  private readonly logger = new Logger(AgentRuntimeBridgeService.name);

  // Active runs map for cancellation / streaming listeners
  private readonly activeRuns = new Map<
    string,
    {
      runId: string;
      workspaceId: string;
      status: AgentExecutionState;
      listeners: Array<(event: string, data: any) => void>;
      abortController: AbortController;
    }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly runtimeService: AIRuntimeService,
    private readonly sessionService: AgentSessionService,
    private readonly webhookService: AgentDeploymentWebhookService,
  ) {}

  /**
   * Universal execution entry point used by:
   * 1. Public widget / JS embed (`POST /api/v1/agent-sessions/:sessionId/messages`)
   * 2. Headless REST API (`POST /api/v1/agents/:agentId/execute`)
   * 3. Iframe / Web Component / React SDK
   * 4. Electron Desktop integration
   * 5. Agent-to-agent invocation
   */
  async execute(options: ExecuteAgentOptions): Promise<AgentRunResponseView> {
    const {
      workspaceId,
      agentId,
      prompt,
      context,
      deploymentId,
      sessionId,
      userId,
      versionNumber,
    } = options;

    const runId = `run_${randomBytes(12).toString('hex')}`;
    const startTime = Date.now();

    // 1. Resolve agent
    const agent = await this.prisma.aIAgent.findFirst({
      where: { id: agentId, workspaceId },
      include: { workspace: true },
    });
    if (!agent) {
      throw new NotFoundException(`Agent ${agentId} not found.`);
    }

    // 2. Resolve deployment if present
    let deployment: any = null;
    if (deploymentId) {
      deployment = await this.prisma.agentDeployment.findFirst({
        where: { id: deploymentId },
      });
      if (deployment && deployment.status !== 'ACTIVE') {
        throw new ForbiddenException(`Deployment is currently ${deployment.status.toLowerCase()}.`);
      }
    }

    // 3. Track active run
    const abortController = new AbortController();
    const runState = {
      runId,
      workspaceId,
      status: 'RUNNING' as AgentExecutionState,
      listeners: [],
      abortController,
    };
    this.activeRuns.set(runId, runState);

    // 4. Dispatch agent.run.started webhook if deployment exists
    if (deploymentId) {
      this.webhookService
        .dispatchEvent(deploymentId, 'agent.run.started', {
          runId,
          agentId,
          prompt,
          timestamp: new Date().toISOString(),
        })
        .catch((e) => this.logger.warn(`Webhook error: ${e.message}`));
    }

    try {
      // 5. Append user message to session history if sessionId provided
      if (sessionId) {
        const userMsg: AgentSessionMessage = {
          id: `msg_${randomBytes(8).toString('hex')}`,
          role: 'user',
          content: prompt,
          timestamp: new Date().toISOString(),
        };
        await this.sessionService.appendMessage(sessionId, userMsg);
      }

      // 6. Build turn context and execute through existing AIRuntimeService
      const turnContext: AIEntityTurnContext = {
        requesterId: userId ?? agent.creatorId ?? undefined,
      };

      this.notifyListeners(runId, 'status', { status: 'RUNNING', runId });

      const turnResult = await this.runtimeService.executeTurn(
        workspaceId,
        agentId,
        prompt,
        turnContext,
        (toolUpdates) => {
          this.notifyListeners(runId, 'tools', { tools: toolUpdates });
        },
      );

      const latencyMs = Date.now() - startTime;
      const tokensUsed = turnResult.tokensUsed || 0;

      // 7. Check if any tool action requires human approval
      const awaitingApprovalTool = turnResult.tools.find(
        (t) =>
          (t.output as { pendingApproval?: boolean } | undefined)?.pendingApproval ||
          (t.status as string) === 'PENDING_APPROVAL',
      );

      let executionState: AgentExecutionState = 'COMPLETED';
      let awaitingApprovalPayload: any = undefined;

      if (awaitingApprovalTool) {
        executionState = 'WAITING_FOR_APPROVAL';
        awaitingApprovalPayload = {
          action: awaitingApprovalTool.name,
          description: `Action "${awaitingApprovalTool.name}" requires human confirmation before finalizing.`,
          parameters: (awaitingApprovalTool.input as Record<string, unknown>) || {},
          riskLevel: 'high',
        };

        if (deploymentId) {
          this.webhookService
            .dispatchEvent(deploymentId, 'agent.approval.requested', {
              runId,
              agentId,
              action: awaitingApprovalTool.name,
              approval: awaitingApprovalPayload,
              timestamp: new Date().toISOString(),
            })
            .catch((e) => this.logger.warn(`Approval webhook error: ${e.message}`));
        }
      }

      runState.status = executionState;

      // 8. Append assistant message to session history
      if (sessionId) {
        const assistantMsg: AgentSessionMessage = {
          id: `msg_${randomBytes(8).toString('hex')}`,
          role: 'assistant',
          content: turnResult.result,
          timestamp: new Date().toISOString(),
          toolCalls: turnResult.tools.map((t) => ({
            id: t.id || `call_${randomBytes(6).toString('hex')}`,
            name: t.name,
            input: (t.input as Record<string, unknown>) || {},
            output: t.output,
            status: t.status,
          })),
          executionState,
          awaitingApproval: awaitingApprovalPayload,
        };
        await this.sessionService.appendMessage(sessionId, assistantMsg);
      }

      // 9. Dispatch agent.run.completed webhook
      if (deploymentId) {
        this.webhookService
          .dispatchEvent(deploymentId, 'agent.run.completed', {
            runId,
            agentId,
            status: executionState,
            output: turnResult.result,
            tokensUsed,
            latencyMs,
            timestamp: new Date().toISOString(),
          })
          .catch((e) => this.logger.warn(`Webhook error: ${e.message}`));
      }

      this.notifyListeners(runId, 'completed', {
        runId,
        status: executionState,
        output: turnResult.result,
      });

      return {
        runId,
        sessionId,
        agentId,
        deploymentId,
        versionNumber: versionNumber ?? deployment?.versionNumber ?? 1,
        status: executionState,
        output: turnResult.result,
        toolExecutions: turnResult.tools.map((t) => ({
          toolName: t.name,
          arguments: (t.input as Record<string, unknown>) || {},
          output: t.output,
          status: t.status,
          durationMs: t.durationMs,
        })),
        tokensUsed,
        latencyMs,
        error: null,
        awaitingApproval: awaitingApprovalPayload,
        metadata: {
          model: agent.model,
          provider: agent.provider,
          context: context || {},
        },
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      runState.status = 'FAILED';

      this.logger.error(`Execution failed for agent ${agentId} (${runId}): ${err.message}`, err.stack);
      const safeMessage = publicRunError(err.message);

      if (deploymentId) {
        this.webhookService
          .dispatchEvent(deploymentId, 'agent.run.failed', {
            runId,
            agentId,
            status: 'FAILED',
            error: safeMessage,
            latencyMs,
            timestamp: new Date().toISOString(),
          })
          .catch((e) => this.logger.warn(`Webhook error: ${e.message}`));
      }

      this.notifyListeners(runId, 'error', { runId, error: safeMessage });

      return {
        runId,
        sessionId,
        agentId,
        deploymentId,
        versionNumber: versionNumber ?? deployment?.versionNumber ?? 1,
        status: 'FAILED',
        output: `Execution error: ${safeMessage}`,
        toolExecutions: [],
        tokensUsed: 0,
        latencyMs,
        error: safeMessage,
        metadata: {
          model: agent.model,
        },
      };
    } finally {
      setTimeout(() => this.activeRuns.delete(runId), 60000);
    }
  }

  /**
   * Cancel an active execution run
   */
  async cancelRun(runId: string, workspaceId: string): Promise<boolean> {
    const run = this.activeRuns.get(runId);
    // A run in another workspace is indistinguishable from one that doesn't exist.
    if (!run || run.workspaceId !== workspaceId) return false;
    run.status = 'CANCELLED';
    run.abortController.abort();
    this.notifyListeners(runId, 'cancelled', { runId });
    return true;
  }

  /** A recorded execution of this workspace, by id. */
  async findExecution(
    executionId: string,
    workspaceId: string,
  ): Promise<{
    id: string;
    status: string;
    startedAt: Date;
    finishedAt: Date | null;
    latencyMs: number;
    tokensUsed: number;
    toolCalls: unknown;
  } | null> {
    return this.prisma.aIExecution.findFirst({
      where: { id: executionId, workspaceId },
      select: { id: true, status: true, startedAt: true, finishedAt: true, latencyMs: true, tokensUsed: true, toolCalls: true },
    });
  }

  /** The state of a run this server started recently, for the workspace that owns it. */
  getRunState(runId: string, workspaceId: string): { runId: string; status: AgentExecutionState } | null {
    const run = this.activeRuns.get(runId);
    return run && run.workspaceId === workspaceId ? { runId: run.runId, status: run.status } : null;
  }

  /**
   * Subscribe to live SSE events for a run
   */
  subscribeToRun(runId: string, listener: (event: string, data: any) => void) {
    const run = this.activeRuns.get(runId);
    if (run) {
      run.listeners.push(listener);
    }
  }

  private notifyListeners(runId: string, event: string, data: any) {
    const run = this.activeRuns.get(runId);
    if (run) {
      for (const listener of run.listeners) {
        try {
          listener(event, data);
        } catch {
          // ignore client disconnection
        }
      }
    }
  }
}
