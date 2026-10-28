import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@org/database';
import { randomBytes, createHash } from 'node:crypto';
import type {
  AgentDeploymentEnvironment,
  AgentDeploymentStatus,
  AgentDeploymentTarget,
  AgentDeploymentView,
  AgentDeploymentAnalyticsSummary,
  AgentDeploymentRunChannel,
  AgentWidgetConfig,
  AgentSecurityConfig,
} from '@org/types';
import { DEFAULT_AGENT_WIDGET_CONFIG } from '@org/types';
import type {
  CreateAgentDeploymentInput,
  UpdateAgentDeploymentInput,
  CreateAgentApiKeyInput,
} from '@org/validation';

/** `24h`, `7d`, `30d` or `90d` as milliseconds; anything else is 30 days. */
export function periodToMs(period: string): number {
  const match = /^(\d{1,3})([hd])$/.exec(period);
  if (!match) return 30 * 86_400_000;
  const amount = Number(match[1]);
  return amount * (match[2] === 'h' ? 3_600_000 : 86_400_000);
}

/** A short, honest label for why a run failed, from the message the runtime recorded. */
export function categorizeRunError(message: string): string {
  if (/time(d)? ?out/i.test(message)) return 'Timeout';
  if (/rate.?limit|429|too many requests/i.test(message)) return 'Rate limited';
  if (/api key|credential|unauthori[sz]ed|401|403|not connected|provider/i.test(message)) return 'Provider or credentials';
  if (/tool/i.test(message)) return 'Tool error';
  return 'Other';
}

/**
 * The runs that came in through a deployment: its embed sessions and
 * public-key calls, plus private API-key calls to the agent (those name no
 * deployment). Studio test runs and in-workspace chats are left out.
 */
export function deploymentTrafficFilter(deploymentId: string) {
  return [
    { stateJson: { path: ['deploymentId'], equals: deploymentId } },
    { stateJson: { path: ['deploymentChannel'], equals: 'api_key' } },
  ];
}

/** How a recorded run reached the agent, from its run state. */
export function runChannel(state: unknown): AgentDeploymentRunChannel | null {
  const value = (state as { deploymentChannel?: unknown } | null)?.deploymentChannel;
  return value === 'session' || value === 'public_key' || value === 'api_key' ? value : null;
}

/**
 * Runs over a period as an evenly spaced series, oldest first: hourly for a
 * period of up to two days, daily (UTC) otherwise. Empty buckets are kept so a
 * chart shows quiet stretches as quiet.
 */
export function bucketRuns(
  runs: Array<{ startedAt: Date; status: string; tokensUsed: number }>,
  period: string,
  now: number,
): Array<{ bucket: string; runs: number; failed: number; tokens: number }> {
  const span = periodToMs(period);
  const step = span <= 2 * 86_400_000 ? 3_600_000 : 86_400_000;
  const floor = (t: number) => Math.floor(t / step) * step;
  const buckets = new Map<number, { bucket: string; runs: number; failed: number; tokens: number }>();
  for (let t = floor(now - span) + step; t <= floor(now); t += step) {
    buckets.set(t, { bucket: new Date(t).toISOString(), runs: 0, failed: 0, tokens: 0 });
  }
  for (const run of runs) {
    const entry = buckets.get(floor(run.startedAt.getTime()));
    if (!entry) continue;
    entry.runs += 1;
    if (run.status === 'FAILED') entry.failed += 1;
    entry.tokens += run.tokensUsed;
  }
  return [...buckets.values()];
}

@Injectable()
export class AgentDeploymentService {
  private readonly logger = new Logger(AgentDeploymentService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a collision-resistant public key: ot_pub_<hex>
   */
  generatePublicKey(): string {
    return `ot_pub_${randomBytes(16).toString('hex')}`;
  }

  /**
   * Generates a secure API key: ot_live_<hex> and its SHA-256 hash
   */
  generateApiKey(): { key: string; prefix: string; hash: string } {
    const raw = randomBytes(24).toString('hex');
    const key = `ot_live_${raw}`;
    const prefix = key.slice(0, 15);
    const hash = createHash('sha256').update(key).digest('hex');
    return { key, prefix, hash };
  }

  async listDeployments(
    workspaceId: string,
    agentId: string,
  ): Promise<AgentDeploymentView[]> {
    const agent = await this.prisma.aIAgent.findFirst({
      where: { id: agentId, workspaceId },
      select: {
        id: true,
        name: true,
        description: true,
        avatarUrl: true,
        role: true,
        model: true,
        configuration: true,
      },
    });
    if (!agent) {
      throw new NotFoundException('Agent not found in workspace.');
    }

    const deployments = await this.prisma.agentDeployment.findMany({
      where: { workspaceId, agentId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            sessions: true,
            webhooks: true,
          },
        },
      },
    });

    return deployments.map((d) => ({
      id: d.id,
      workspaceId: d.workspaceId,
      agentId: d.agentId,
      name: d.name,
      environment: d.environment as AgentDeploymentEnvironment,
      status: d.status as AgentDeploymentStatus,
      versionNumber: d.versionNumber,
      target: d.target as AgentDeploymentTarget,
      publicKey: d.publicKey,
      allowedOrigins: d.allowedOrigins,
      widgetConfig: (d.widgetConfig as AgentWidgetConfig) || DEFAULT_AGENT_WIDGET_CONFIG,
      securityConfig: (d.securityConfig as AgentSecurityConfig) || {},
      metadata: (d.metadata as Record<string, unknown>) || {},
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      publishedAt: d.publishedAt?.toISOString() ?? null,
      agentName: agent.name,
      agentDescription: agent.description,
      agentAvatarUrl: agent.avatarUrl,
      agentRole: agent.role,
      agentModel: agent.model,
      publishedVersionTag: `v${d.versionNumber}.0.0`,
      activeSessionsCount: d._count.sessions,
      webhooksCount: d._count.webhooks,
    }));
  }

  async getDeployment(
    workspaceId: string,
    deploymentId: string,
  ): Promise<AgentDeploymentView> {
    const d = await this.prisma.agentDeployment.findFirst({
      where: { id: deploymentId, workspaceId },
      include: {
        agent: {
          select: {
            name: true,
            description: true,
            avatarUrl: true,
            role: true,
            model: true,
          },
        },
        _count: {
          select: {
            sessions: true,
            webhooks: true,
          },
        },
      },
    });

    if (!d) {
      throw new NotFoundException('Deployment not found.');
    }

    return {
      id: d.id,
      workspaceId: d.workspaceId,
      agentId: d.agentId,
      name: d.name,
      environment: d.environment as AgentDeploymentEnvironment,
      status: d.status as AgentDeploymentStatus,
      versionNumber: d.versionNumber,
      target: d.target as AgentDeploymentTarget,
      publicKey: d.publicKey,
      allowedOrigins: d.allowedOrigins,
      widgetConfig: (d.widgetConfig as AgentWidgetConfig) || DEFAULT_AGENT_WIDGET_CONFIG,
      securityConfig: (d.securityConfig as AgentSecurityConfig) || {},
      metadata: (d.metadata as Record<string, unknown>) || {},
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      publishedAt: d.publishedAt?.toISOString() ?? null,
      agentName: d.agent.name,
      agentDescription: d.agent.description,
      agentAvatarUrl: d.agent.avatarUrl,
      agentRole: d.agent.role,
      agentModel: d.agent.model,
      publishedVersionTag: `v${d.versionNumber}.0.0`,
      activeSessionsCount: d._count?.sessions ?? 0,
      webhooksCount: d._count?.webhooks ?? 0,
    };
  }

  async getDeploymentByPublicKey(publicKey: string) {
    const deployment = await this.prisma.agentDeployment.findUnique({
      where: { publicKey },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            description: true,
            avatarUrl: true,
            role: true,
            model: true,
            provider: true,
            systemInstructions: true,
            welcomeMessage: true,
            tools: true,
            configuration: true,
            graphJson: true,
          },
        },
      },
    });

    if (!deployment) {
      throw new NotFoundException('Deployment not found or invalid public key.');
    }

    return deployment;
  }

  async ensureDefaultDeployment(
    workspaceId: string,
    agentId: string,
  ): Promise<AgentDeploymentView> {
    const existing = await this.prisma.agentDeployment.findFirst({
      where: { workspaceId, agentId, environment: 'PRODUCTION' },
      orderBy: { createdAt: 'asc' },
    });

    if (existing) {
      return this.getDeployment(workspaceId, existing.id);
    }

    const agent = await this.prisma.aIAgent.findFirst({
      where: { id: agentId, workspaceId },
    });
    if (!agent) {
      throw new NotFoundException('Agent not found.');
    }

    const config = (agent.configuration as Record<string, any>) || {};
    const versionNumber = config.currentVersion ?? 1;

    const widgetConfig = {
      ...DEFAULT_AGENT_WIDGET_CONFIG,
      appearance: {
        ...DEFAULT_AGENT_WIDGET_CONFIG.appearance,
        title: agent.name || 'AI Assistant',
        subtitle: agent.role || 'Universal Agent',
        // Empty = follow the agent's live avatar, so a later change reaches the deployed widget.
        avatarUrl: '',
      },
    };

    const created = await this.prisma.agentDeployment.create({
      data: {
        workspaceId,
        agentId,
        name: 'Default Production Deployment',
        environment: 'PRODUCTION',
        status: 'ACTIVE',
        versionNumber,
        target: 'WIDGET',
        publicKey: this.generatePublicKey(),
        allowedOrigins: ['*'],
        widgetConfig: widgetConfig as any,
        securityConfig: {
          allowedTools: agent.tools ? JSON.parse(agent.tools) : [],
          rateLimitPerMinute: 60,
          requireAuthentication: false,
          sensitiveActionsRequireApproval: true,
        },
        publishedAt: new Date(),
      },
    });

    return this.getDeployment(workspaceId, created.id);
  }

  async createDeployment(
    workspaceId: string,
    agentId: string,
    input: CreateAgentDeploymentInput,
  ): Promise<AgentDeploymentView> {
    const agent = await this.prisma.aIAgent.findFirst({
      where: { id: agentId, workspaceId },
    });
    if (!agent) {
      throw new NotFoundException('Agent not found.');
    }

    const config = (agent.configuration as Record<string, any>) || {};
    const versionNumber = input.versionNumber ?? config.currentVersion ?? 1;

    const mergedWidgetConfig = {
      ...DEFAULT_AGENT_WIDGET_CONFIG,
      ...(input.widgetConfig || {}),
      appearance: {
        ...DEFAULT_AGENT_WIDGET_CONFIG.appearance,
        title: agent.name || 'AI Assistant',
        subtitle: agent.role || 'Universal Agent',
        // Empty = follow the agent's live avatar, so a later change reaches the deployed widget.
        avatarUrl: '',
        ...((input.widgetConfig?.['appearance'] as any) || {}),
      },
      behavior: {
        ...DEFAULT_AGENT_WIDGET_CONFIG.behavior,
        ...((input.widgetConfig?.['behavior'] as any) || {}),
      },
    };

    const created = await this.prisma.agentDeployment.create({
      data: {
        workspaceId,
        agentId,
        name: input.name,
        environment: input.environment,
        status: 'ACTIVE',
        versionNumber,
        target: input.target,
        publicKey: this.generatePublicKey(),
        allowedOrigins: input.allowedOrigins || ['*'],
        widgetConfig: mergedWidgetConfig as any,
        securityConfig: (input.securityConfig as any) || {
          rateLimitPerMinute: 60,
          sensitiveActionsRequireApproval: true,
        },
        metadata: (input.metadata as any) || {},
        publishedAt: new Date(),
      },
    });

    return this.getDeployment(workspaceId, created.id);
  }

  async updateDeployment(
    workspaceId: string,
    deploymentId: string,
    input: UpdateAgentDeploymentInput,
  ): Promise<AgentDeploymentView> {
    const existing = await this.prisma.agentDeployment.findFirst({
      where: { id: deploymentId, workspaceId },
    });
    if (!existing) {
      throw new NotFoundException('Deployment not found.');
    }

    const data: Record<string, unknown> = {};
    if (input.name) data['name'] = input.name;
    if (input.environment) data['environment'] = input.environment;
    if (input.status) data['status'] = input.status;
    if (input.target) data['target'] = input.target;
    if (input.versionNumber) data['versionNumber'] = input.versionNumber;
    if (input.allowedOrigins) data['allowedOrigins'] = input.allowedOrigins;
    if (input.widgetConfig) {
      data['widgetConfig'] = {
        ...(existing.widgetConfig as Record<string, unknown>),
        ...input.widgetConfig,
      };
    }
    if (input.securityConfig) {
      data['securityConfig'] = {
        ...(existing.securityConfig as Record<string, unknown>),
        ...input.securityConfig,
      };
    }
    if (input.metadata) {
      data['metadata'] = {
        ...(existing.metadata as Record<string, unknown>),
        ...input.metadata,
      };
    }

    await this.prisma.agentDeployment.update({
      where: { id: deploymentId },
      data,
    });

    return this.getDeployment(workspaceId, deploymentId);
  }

  async publishVersion(
    workspaceId: string,
    deploymentId: string,
    versionNumber: number,
  ): Promise<AgentDeploymentView> {
    const deployment = await this.prisma.agentDeployment.findFirst({
      where: { id: deploymentId, workspaceId },
      include: { agent: true },
    });
    if (!deployment) throw new NotFoundException('Deployment not found.');

    const config = (deployment.agent.configuration as Record<string, any>) || {};
    const versions = Array.isArray(config.versions) ? config.versions : [];
    const targetVer = versions.find((v: any) => v.version === versionNumber);
    if (!targetVer && versionNumber !== config.currentVersion) {
      throw new BadRequestException(`Version ${versionNumber} is not a valid published version snapshot.`);
    }

    await this.prisma.agentDeployment.update({
      where: { id: deploymentId },
      data: {
        versionNumber,
        status: 'ACTIVE',
        publishedAt: new Date(),
      },
    });

    this.logger.log(`Promoted deployment ${deploymentId} to version ${versionNumber}`);
    return this.getDeployment(workspaceId, deploymentId);
  }

  async rollbackDeployment(
    workspaceId: string,
    deploymentId: string,
    targetVersion: number,
    summary = 'Rolled back deployment version',
  ): Promise<AgentDeploymentView> {
    const deployment = await this.prisma.agentDeployment.findFirst({
      where: { id: deploymentId, workspaceId },
      include: { agent: true },
    });
    if (!deployment) throw new NotFoundException('Deployment not found.');

    const config = (deployment.agent.configuration as Record<string, any>) || {};
    const versions = Array.isArray(config.versions) ? config.versions : [];
    const targetSnapshot = versions.find((v: any) => v.version === targetVersion);
    if (!targetSnapshot) {
      throw new BadRequestException(`Version snapshot ${targetVersion} does not exist to rollback to.`);
    }

    const previousVersion = deployment.versionNumber;

    await this.prisma.agentDeployment.update({
      where: { id: deploymentId },
      data: {
        versionNumber: targetVersion,
        metadata: {
          ...((deployment.metadata as Record<string, any>) || {}),
          rollbackHistory: [
            ...(((deployment.metadata as Record<string, any>)?.['rollbackHistory'] as any[]) || []),
            {
              fromVersion: previousVersion,
              toVersion: targetVersion,
              timestamp: new Date().toISOString(),
              summary,
            },
          ],
        },
      },
    });

    this.logger.log(`Rolled back deployment ${deploymentId} from v${previousVersion} to v${targetVersion}`);
    return this.getDeployment(workspaceId, deploymentId);
  }

  async setDeploymentStatus(
    workspaceId: string,
    deploymentId: string,
    status: AgentDeploymentStatus,
  ): Promise<AgentDeploymentView> {
    const deployment = await this.prisma.agentDeployment.findFirst({
      where: { id: deploymentId, workspaceId },
    });
    if (!deployment) throw new NotFoundException('Deployment not found.');

    await this.prisma.agentDeployment.update({
      where: { id: deploymentId },
      data: { status },
    });

    return this.getDeployment(workspaceId, deploymentId);
  }

  async deleteDeployment(workspaceId: string, deploymentId: string): Promise<void> {
    const deployment = await this.prisma.agentDeployment.findFirst({
      where: { id: deploymentId, workspaceId },
    });
    if (!deployment) throw new NotFoundException('Deployment not found.');

    await this.prisma.agentDeployment.delete({
      where: { id: deploymentId },
    });
  }

  async getDeploymentAnalytics(
    workspaceId: string,
    deploymentId: string,
    period = '30d',
  ): Promise<AgentDeploymentAnalyticsSummary> {
    const deployment = await this.prisma.agentDeployment.findFirst({
      where: { id: deploymentId, workspaceId },
    });
    if (!deployment) throw new NotFoundException('Deployment not found.');

    const activeSessions = await this.prisma.agentDeploymentSession.count({
      where: { deploymentId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
    });

    const now = Date.now();
    const since = new Date(now - periodToMs(period));
    const executions = await this.prisma.aIExecution.findMany({
      where: {
        workspaceId,
        agentId: deployment.agentId,
        startedAt: { gte: since },
        OR: deploymentTrafficFilter(deploymentId),
      },
      select: {
        id: true,
        status: true,
        startedAt: true,
        latencyMs: true,
        tokensUsed: true,
        totalCost: true,
        toolCalls: true,
        errorsJson: true,
        stateJson: true,
      },
      orderBy: { startedAt: 'desc' },
      take: 5000,
    });

    const successfulRuns = executions.filter((e) => e.status === 'COMPLETED').length;
    const failedRuns = executions.filter((e) => e.status === 'FAILED').length;
    const finished = successfulRuns + failedRuns;
    const timed = executions.filter((e) => e.status !== 'RUNNING' && e.latencyMs > 0);

    const approvals = executions.length
      ? await this.prisma.approvalRequest.findMany({
          where: { workspaceId, executionId: { in: executions.map((e) => e.id) } },
          select: { state: true },
        })
      : [];

    const toolCounts: Record<string, number> = {};
    for (const execution of executions) {
      const calls = Array.isArray(execution.toolCalls) ? (execution.toolCalls as Array<Record<string, unknown>>) : [];
      for (const call of calls) {
        const name = String(call?.['name'] ?? call?.['toolName'] ?? 'tool');
        toolCounts[name] = (toolCounts[name] || 0) + 1;
      }
    }

    const errorCategories: Record<string, number> = {};
    for (const execution of executions) {
      if (execution.status !== 'FAILED') continue;
      const message = (execution.errorsJson as { message?: string } | null)?.message ?? '';
      const category = categorizeRunError(message);
      errorCategories[category] = (errorCategories[category] || 0) + 1;
    }

    const channelCounts: Partial<Record<AgentDeploymentRunChannel, number>> = {};
    for (const execution of executions) {
      const channel = runChannel(execution.stateJson);
      if (channel) channelCounts[channel] = (channelCounts[channel] ?? 0) + 1;
    }

    return {
      deploymentId,
      period,
      totalRuns: executions.length,
      successfulRuns,
      failedRuns,
      successRate: finished > 0 ? Math.round((successfulRuns / finished) * 100) : 0,
      avgLatencyMs: timed.length ? Math.round(timed.reduce((sum, e) => sum + e.latencyMs, 0) / timed.length) : 0,
      totalTokens: executions.reduce((sum, e) => sum + e.tokensUsed, 0),
      estimatedCost: Number(executions.reduce((sum, e) => sum + e.totalCost, 0).toFixed(4)),
      activeSessions,
      approvalsRequested: approvals.length,
      approvalsApproved: approvals.filter((a) => a.state === 'APPROVED').length,
      approvalsRejected: approvals.filter((a) => a.state === 'REJECTED').length,
      approvalsPending: await this.countPendingApprovals(workspaceId, deployment.agentId, deploymentId),
      toolExecutionsCount: Object.values(toolCounts).reduce((a, b) => a + b, 0),
      topTools: Object.entries(toolCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      recentErrorCategories: Object.entries(errorCategories)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count),
      channels: (Object.entries(channelCounts) as Array<[AgentDeploymentRunChannel, number]>)
        .map(([channel, count]) => ({ channel, count }))
        .sort((a, b) => b.count - a.count),
      series: bucketRuns(executions, period, now),
      recentRuns: executions.slice(0, 8).map((e) => {
        const prompt = (e.stateJson as { prompt?: unknown } | null)?.prompt;
        return {
          id: e.id,
          status: e.status,
          channel: runChannel(e.stateJson),
          startedAt: e.startedAt.toISOString(),
          latencyMs: e.latencyMs,
          tokensUsed: e.tokensUsed,
          prompt: typeof prompt === 'string' ? prompt.slice(0, 140) : null,
        };
      }),
    };
  }

  /** Undecided approvals from this deployment's runs, however long ago they were raised. */
  private async countPendingApprovals(workspaceId: string, agentId: string, deploymentId: string): Promise<number> {
    const waiting = await this.prisma.aIExecution.findMany({
      where: { workspaceId, agentId, status: 'WAITING_APPROVAL', OR: deploymentTrafficFilter(deploymentId) },
      select: { id: true },
      take: 1000,
    });
    if (waiting.length === 0) return 0;
    return this.prisma.approvalRequest.count({
      where: { workspaceId, state: 'PENDING', executionId: { in: waiting.map((e) => e.id) } },
    });
  }

  /** Throws NotFound unless the deployment belongs to this agent in this workspace. */
  async assertDeployment(workspaceId: string, agentId: string, deploymentId: string): Promise<void> {
    const found = await this.prisma.agentDeployment.findFirst({
      where: { id: deploymentId, workspaceId, agentId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Deployment not found.');
  }

  // --- API Keys Management ---

  /** The workspace's API keys: prefix and metadata only, never the secret. */
  async listApiKeys(workspaceId: string) {
    const keys = await this.prisma.agentApiKey.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    return keys.map((k) => ({
      id: k.id,
      workspaceId: k.workspaceId,
      name: k.name,
      keyPrefix: k.keyPrefix,
      scopes: k.scopes,
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      expiresAt: k.expiresAt?.toISOString() ?? null,
      isActive: k.isActive && !(k.expiresAt && k.expiresAt < new Date()),
      createdAt: k.createdAt.toISOString(),
      updatedAt: k.updatedAt.toISOString(),
    }));
  }

  /** Stops a key working. The row stays, so usage history keeps its name. */
  async revokeApiKey(workspaceId: string, keyId: string): Promise<void> {
    const { count } = await this.prisma.agentApiKey.updateMany({
      where: { id: keyId, workspaceId },
      data: { isActive: false },
    });
    if (count === 0) throw new NotFoundException('API key not found.');
  }

  async createApiKey(workspaceId: string, input: CreateAgentApiKeyInput) {
    const { key, prefix, hash } = this.generateApiKey();
    const expiresAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 86400000)
      : null;

    const record = await this.prisma.agentApiKey.create({
      data: {
        workspaceId,
        name: input.name,
        keyPrefix: prefix,
        keyHash: hash,
        scopes: input.scopes,
        expiresAt,
      },
    });

    return {
      id: record.id,
      name: record.name,
      apiKey: key, // Returned once upon creation!
      keyPrefix: record.keyPrefix,
      scopes: record.scopes,
      expiresAt: record.expiresAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
    };
  }

  async validateApiKey(key: string) {
    if (!key.startsWith('ot_live_')) return null;
    const hash = createHash('sha256').update(key).digest('hex');
    const record = await this.prisma.agentApiKey.findUnique({
      where: { keyHash: hash },
    });

    if (!record || !record.isActive) return null;
    if (record.expiresAt && record.expiresAt < new Date()) return null;

    // Update lastUsedAt asynchronously
    this.prisma.agentApiKey
      .update({
        where: { id: record.id },
        data: { lastUsedAt: new Date() },
      })
      .catch((e) => this.logger.warn(`Failed to update key lastUsedAt: ${e.message}`));

    return record;
  }
}
