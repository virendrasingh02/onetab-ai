import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@org/database';
import {
  PLANS_CONFIG,
  canUpgradeAgent,
  isAIEntityType,
  normalizePlanTier,
  type AIEntityType,
  type CoworkerPermissions,
  type CoworkerStatus,
} from '@org/types';

function parsePermissions(value: unknown): CoworkerPermissions {
  if (value && typeof value === 'object') return value as CoworkerPermissions;
  return {};
}

export interface CreateEntityDto {
  type: AIEntityType;
  name: string;
  role?: string;
  description?: string;
  avatarUrl?: string | null;
  personality?: string;
  /** Shown as the first message in this entity's DM when it has no history yet. */
  welcomeMessage?: string;
  systemPrompt?: string;
  systemInstructions?: string;
  provider?: string;
  model?: string;
  tools?: string[];
  permissions?: CoworkerPermissions;
  configuration?: Record<string, unknown>;
  graphJson?: string;
  isMarketplace?: boolean;
  agentIds?: string[];
  integrationIds?: string[];
}

export interface UpdateEntityDto {
  name?: string;
  role?: string;
  description?: string;
  avatarUrl?: string | null;
  personality?: string;
  /** Shown as the first message in this entity's DM when it has no history yet. */
  welcomeMessage?: string;
  systemPrompt?: string;
  systemInstructions?: string;
  provider?: string;
  model?: string;
  tools?: string[];
  permissions?: CoworkerPermissions;
  configuration?: Record<string, unknown>;
  graphJson?: string;
  isActive?: boolean;
  status?: CoworkerStatus;
}

@Injectable()
export class AIEntitiesService {
  private readonly logger = new Logger(AIEntitiesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getEntities(workspaceId: string, type?: AIEntityType) {
    if (type && !isAIEntityType(type)) {
      throw new BadRequestException(
        `Invalid entity type filter '${type}'. Allowed: 'agent', 'coworker'.`,
      );
    }

    // Ensure standard coworkers exist when querying
    await this.seedInitialCoworkers(workspaceId);

    const rows = await this.prisma.aIAgent.findMany({
      where: {
        workspaceId,
        ...(type ? { type } : {}),
      },
      include: {
        schedules: true,
        agentLinks: {
          include: {
            agent: {
              select: {
                id: true,
                name: true,
                role: true,
                description: true,
                avatarUrl: true,
                isActive: true,
              },
            },
          },
        },
        appLinks: {
          include: {
            integration: {
              select: {
                id: true,
                provider: true,
                displayName: true,
                status: true,
              },
            },
          },
        },
        _count: {
          select: {
            logs: true,
            channelLinks: true,
            projectLinks: true,
            channelCoworkers: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return rows.map((row) => ({
      ...row,
      permissions: parsePermissions(row.permissions),
    }));
  }

  async getEntity(workspaceId: string, entityId: string) {
    const row = await this.prisma.aIAgent.findFirst({
      where: { id: entityId, workspaceId },
      include: {
        schedules: true,
        agentLinks: {
          include: {
            agent: {
              select: {
                id: true,
                name: true,
                role: true,
                description: true,
                avatarUrl: true,
                isActive: true,
              },
            },
          },
        },
        appLinks: {
          include: {
            integration: {
              select: {
                id: true,
                provider: true,
                displayName: true,
                status: true,
              },
            },
          },
        },
        _count: {
          select: {
            logs: true,
            channelLinks: true,
            projectLinks: true,
            channelCoworkers: true,
          },
        },
      },
    });

    if (!row) throw new NotFoundException('AI Entity not found.');
    return {
      ...row,
      permissions: parsePermissions(row.permissions),
    };
  }

  async createEntity(
    workspaceId: string,
    creatorId: string,
    dto: CreateEntityDto,
  ) {
    if (!isAIEntityType(dto.type)) {
      throw new BadRequestException(
        `Invalid entity type '${dto.type}'. Allowed: 'agent', 'coworker'.`,
      );
    }

    if (dto.type === 'agent') {
      const sub = await this.prisma.workspaceSubscription.findUnique({
        where: { workspaceId },
        select: { planTier: true, status: true, trialStatus: true, trialEnd: true },
      });

      if (sub?.trialStatus === 'ACTIVE' && sub.trialEnd && sub.trialEnd < new Date()) {
        throw new BadRequestException({
          code: 'TRIAL_EXPIRED',
          message:
            'Your 7-day free trial has expired. Please upgrade your plan to continue creating agents.',
        });
      }

      const planTier = normalizePlanTier(sub?.planTier ?? 'starter');
      const planConfig = PLANS_CONFIG[planTier];
      const maxAgents = planConfig.machineLimits.microAgents;

      if (maxAgents !== -1) {
        const currentAgentsCount = await this.prisma.aIAgent.count({
          where: { workspaceId, type: 'agent' },
        });

        if (currentAgentsCount >= maxAgents) {
          throw new BadRequestException({
            code: 'PLAN_LIMIT_REACHED',
            message: `You've reached your Micro Agent limit (${maxAgents}) for ${planConfig.name}. Please upgrade to create more agents.`,
          });
        }
      }
    }

    const defaultTools =
      dto.type === 'coworker'
        ? ['search_docs', 'list_projects', 'list_tasks', 'list_channels']
        : ['search_docs', 'create_task'];

    const entity = await this.prisma.aIAgent.create({
      data: {
        workspaceId,
        creatorId,
        type: dto.type,
        name: dto.name,
        role: dto.role ?? (dto.type === 'coworker' ? 'Coworker' : 'Assistant'),
        description: dto.description,
        avatarUrl: dto.avatarUrl,
        personality: dto.personality,
        welcomeMessage: dto.welcomeMessage,
        systemPrompt:
          dto.systemPrompt ??
          (dto.type === 'coworker'
            ? 'You are a persistent AI teammate.'
            : 'You are an autonomous AI employee.'),
        systemInstructions: dto.systemInstructions ?? '',
        status: 'AVAILABLE',
        provider:
          dto.provider ?? (process.env['AI_DEFAULT_PROVIDER'] || 'nvidia'),
        model:
          dto.model ??
          (process.env['AI_DEFAULT_MODEL'] ||
            'nvidia/nemotron-3-super-120b-a12b'),
        tools: JSON.stringify(dto.tools ?? defaultTools),
        permissions: (dto.permissions ?? {}) as any,
        configuration: (dto.configuration ?? {}) as any,
        graphJson: dto.graphJson,
        isMarketplace: dto.isMarketplace ?? false,
      },
    });

    // Link delegate agents if provided
    if (dto.agentIds && dto.agentIds.length > 0) {
      await this.prisma.coworkerAgent.createMany({
        data: dto.agentIds.map((agentId) => ({
          coworkerId: entity.id,
          agentId,
        })),
        skipDuplicates: true,
      });
    }

    // Link apps if provided
    if (dto.integrationIds && dto.integrationIds.length > 0) {
      await this.prisma.coworkerApp.createMany({
        data: dto.integrationIds.map((integrationId) => ({
          coworkerId: entity.id,
          integrationId,
        })),
        skipDuplicates: true,
      });
    }

    return this.getEntity(workspaceId, entity.id);
  }

  async updateEntity(
    workspaceId: string,
    entityId: string,
    dto: UpdateEntityDto,
  ) {
    await this.assertEntity(workspaceId, entityId);

    if (
      dto.provider !== undefined ||
      dto.model !== undefined ||
      dto.configuration !== undefined
    ) {
      const sub = await this.prisma.workspaceSubscription.findUnique({
        where: { workspaceId },
        select: { planTier: true },
      });
      const planTier = normalizePlanTier(sub?.planTier ?? 'starter');
      if (!canUpgradeAgent(planTier)) {
        throw new BadRequestException({
          code: 'FEATURE_NOT_AVAILABLE',
          message:
            'Agent upgrades and custom model performance configurations are not included in the Starter plan. Please upgrade to Pro or Business.',
        });
      }
    }

    const updated = await this.prisma.aIAgent.update({
      where: { id: entityId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
        ...(dto.personality !== undefined
          ? { personality: dto.personality }
          : {}),
        ...(dto.welcomeMessage !== undefined
          ? { welcomeMessage: dto.welcomeMessage }
          : {}),
        ...(dto.systemPrompt !== undefined
          ? { systemPrompt: dto.systemPrompt }
          : {}),
        ...(dto.systemInstructions !== undefined
          ? { systemInstructions: dto.systemInstructions }
          : {}),
        ...(dto.provider !== undefined ? { provider: dto.provider } : {}),
        ...(dto.model !== undefined ? { model: dto.model } : {}),
        ...(dto.tools !== undefined
          ? { tools: JSON.stringify(dto.tools) }
          : {}),
        ...(dto.permissions !== undefined
          ? { permissions: dto.permissions as any }
          : {}),
        ...(dto.configuration !== undefined
          ? { configuration: dto.configuration as any }
          : {}),
        ...(dto.graphJson !== undefined ? { graphJson: dto.graphJson } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });

    return {
      ...updated,
      permissions: parsePermissions(updated.permissions),
    };
  }

  async deleteEntity(workspaceId: string, entityId: string): Promise<void> {
    await this.assertEntity(workspaceId, entityId);
    await this.prisma.aIAgent.delete({ where: { id: entityId } });
  }

  async linkAgent(workspaceId: string, coworkerId: string, agentId: string) {
    await this.assertEntity(workspaceId, coworkerId);
    const agent = await this.prisma.aIAgent.findFirst({
      where: { id: agentId, workspaceId, type: 'agent' },
    });
    if (!agent) {
      throw new NotFoundException(
        `Target agent '${agentId}' not found in workspace.`,
      );
    }

    return this.prisma.coworkerAgent.upsert({
      where: { coworkerId_agentId: { coworkerId, agentId } },
      create: { coworkerId, agentId },
      update: {},
    });
  }

  async unlinkAgent(workspaceId: string, coworkerId: string, agentId: string) {
    await this.assertEntity(workspaceId, coworkerId);
    await this.prisma.coworkerAgent.deleteMany({
      where: { coworkerId, agentId },
    });
  }

  async linkApp(workspaceId: string, coworkerId: string, integrationId: string) {
    await this.assertEntity(workspaceId, coworkerId);
    return this.prisma.coworkerApp.upsert({
      where: { coworkerId_integrationId: { coworkerId, integrationId } },
      create: { coworkerId, integrationId },
      update: {},
    });
  }

  async unlinkApp(workspaceId: string, coworkerId: string, integrationId: string) {
    await this.assertEntity(workspaceId, coworkerId);
    await this.prisma.coworkerApp.deleteMany({
      where: { coworkerId, integrationId },
    });
  }

  async createSchedule(
    workspaceId: string,
    entityId: string,
    data: { cronExpression: string; description?: string },
  ) {
    await this.assertEntity(workspaceId, entityId);
    return this.prisma.agentSchedule.create({
      data: {
        agentId: entityId,
        cronExpression: data.cronExpression,
        description: data.description,
      },
    });
  }

  async updateSchedule(
    workspaceId: string,
    entityId: string,
    scheduleId: string,
    data: { cronExpression?: string; description?: string; isActive?: boolean },
  ) {
    await this.assertEntity(workspaceId, entityId);
    const existing = await this.prisma.agentSchedule.findFirst({
      where: { id: scheduleId, agentId: entityId },
    });
    if (!existing) throw new NotFoundException('Schedule not found.');
    return this.prisma.agentSchedule.update({
      where: { id: scheduleId },
      data,
    });
  }

  async deleteSchedule(workspaceId: string, entityId: string, scheduleId: string): Promise<void> {
    await this.assertEntity(workspaceId, entityId);
    await this.prisma.agentSchedule.deleteMany({
      where: { id: scheduleId, agentId: entityId },
    });
  }

  async getEntityLogs(workspaceId: string, entityId: string) {
    await this.assertEntity(workspaceId, entityId);
    return this.prisma.agentExecutionLog.findMany({
      where: { agentId: entityId },
      orderBy: { executedAt: 'desc' },
      take: 50,
    });
  }

  async getWorkspaceLogs(workspaceId: string, type?: AIEntityType) {
    return this.prisma.agentExecutionLog.findMany({
      where: {
        agent: {
          workspaceId,
          ...(type ? { type } : {}),
        },
      },
      include: {
        agent: {
          select: { id: true, name: true, type: true },
        },
      },
      orderBy: { executedAt: 'desc' },
      take: 100,
    });
  }

  async seedInitialCoworkers(workspaceId: string, creatorId?: string): Promise<void> {
    try {
      const existing = await this.prisma.aIAgent.findMany({
        where: { workspaceId, type: 'coworker' },
        select: { name: true },
      });
      const names = new Set(existing.map((e) => e.name));

      // 1. Seed Nova (General / Product Coworker)
      if (!names.has('Nova')) {
        await this.prisma.aIAgent.create({
          data: {
            workspaceId,
            creatorId: creatorId ?? null,
            type: 'coworker',
            name: 'Nova',
            role: 'Product & General Coworker',
            description:
              'Persistent AI product partner for planning, specifications, research, and team coordination.',
            personality:
              'Strategic, inquisitive, articulate, and proactive. Helps turn complex ideas into actionable roadmaps.',
            systemPrompt:
              'You are Nova, a persistent AI teammate and product partner.',
            systemInstructions:
              'Focus on structured thinking, user-centric solutions, clear specifications, and proactive delegation to specialists.',
            status: 'AVAILABLE',
            tools: JSON.stringify([
              'search_docs',
              'create_doc',
              'create_task',
              'list_tasks',
              'list_projects',
              'list_channels',
            ]),
            permissions: { knowledgeAccess: true } as any,
          },
        });
        this.logger.log(`Seeded default coworker 'Nova' in workspace ${workspaceId}`);
      }

      // 2. Seed Codey (Engineering Coworker)
      if (!names.has('Codey')) {
        const codey = await this.prisma.aIAgent.create({
          data: {
            workspaceId,
            creatorId: creatorId ?? null,
            type: 'coworker',
            name: 'Codey',
            role: 'Engineering Coworker',
            description:
              'Persistent AI engineering teammate for code architecture, debugging, reviews, and development.',
            personality:
              'Pragmatic, detail-oriented, technically rigorous. Prefers robust code solutions and clean architecture.',
            systemPrompt:
              'You are Codey, a persistent AI engineering coworker.',
            systemInstructions:
              'Offer precise code analysis, adhere to project conventions, debug methodically, and delegate to specialist agents when appropriate.',
            status: 'AVAILABLE',
            tools: JSON.stringify([
              'search_docs',
              'create_doc',
              'create_task',
              'list_tasks',
              'list_projects',
            ]),
            permissions: { knowledgeAccess: true } as any,
          },
        });
        this.logger.log(`Seeded default coworker 'Codey' in workspace ${workspaceId}`);

        // Link Codey to any active Code Reviewer Agent in the workspace
        const reviewerAgent = await this.prisma.aIAgent.findFirst({
          where: {
            workspaceId,
            type: 'agent',
            name: { contains: 'Reviewer', mode: 'insensitive' },
          },
          select: { id: true },
        });
        if (reviewerAgent) {
          await this.prisma.coworkerAgent.create({
            data: {
              coworkerId: codey.id,
              agentId: reviewerAgent.id,
            },
          });
          this.logger.log(`Linked Codey to Code Reviewer Agent (${reviewerAgent.id})`);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to seed initial coworkers for workspace ${workspaceId}: ${String(error)}`);
    }
  }

  private async assertEntity(workspaceId: string, entityId: string) {
    const exists = await this.prisma.aIAgent.findFirst({
      where: { id: entityId, workspaceId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('AI Entity not found.');
  }
}
