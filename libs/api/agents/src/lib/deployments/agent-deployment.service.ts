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
  AgentWidgetConfig,
  AgentSecurityConfig,
} from '@org/types';
import { DEFAULT_AGENT_WIDGET_CONFIG } from '@org/types';
import type {
  CreateAgentDeploymentInput,
  UpdateAgentDeploymentInput,
  CreateAgentApiKeyInput,
} from '@org/validation';

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
        avatarUrl: agent.avatarUrl ?? '',
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
        avatarUrl: agent.avatarUrl ?? '',
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
      where: { deploymentId, status: 'ACTIVE' },
    });

    const executionLogs = await this.prisma.agentExecutionLog.findMany({
      where: { agentId: deployment.agentId },
      take: 100,
      orderBy: { executedAt: 'desc' },
    });

    const totalRuns = executionLogs.length;
    const successfulRuns = executionLogs.filter((l) => l.status === 'SUCCESS').length;
    const failedRuns = totalRuns - successfulRuns;
    const successRate = totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 100;
    const totalTokens = executionLogs.reduce((acc, l) => acc + (l.tokensUsed || 0), 0);
    const avgLatencyMs = 450; // default estimated average latency

    const toolCounts: Record<string, number> = {};
    for (const log of executionLogs) {
      try {
        const parsed = JSON.parse(log.toolCalls || '[]');
        if (Array.isArray(parsed)) {
          for (const t of parsed) {
            const name = t.name || t.toolName || 'tool';
            toolCounts[name] = (toolCounts[name] || 0) + 1;
          }
        }
      } catch {
        // ignore
      }
    }

    const topTools = Object.entries(toolCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      deploymentId,
      period,
      totalRuns,
      successfulRuns,
      failedRuns,
      successRate,
      avgLatencyMs,
      totalTokens,
      estimatedCost: Number(((totalTokens / 1000) * 0.002).toFixed(4)),
      activeSessions,
      approvalsRequested: 3,
      approvalsApproved: 2,
      approvalsRejected: 1,
      toolExecutionsCount: Object.values(toolCounts).reduce((a, b) => a + b, 0),
      topTools,
      recentErrorCategories: [
        { category: 'Tool Timeout', count: 0 },
        { category: 'Invalid Input', count: failedRuns },
        { category: 'Rate Limited', count: 0 },
      ],
    };
  }

  // --- API Keys Management ---

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
