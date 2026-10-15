import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppEvent } from '@org/api-common';
import { Prisma, PrismaService } from '@org/database';
import {
  CANVAS_AGENT_TRIGGER,
  PLANS_CONFIG,
  PLAN_HIERARCHY,
  planPeriodCents,
  WorkspacePermission,
  WorkspaceRole,
  getPlanLimit,
  getUsagePercentage,
  hasFeature,
  isLimitReached,
  isNearLimit,
  normalizePlanTier,
  roleHasPermission,
  type BillingPortalResponse,
  type CustomLLMConfigDto,
  type DowngradeImpactSummary,
  type DowngradePlanInput,
  type EnterpriseInquiryInput,
  type InvoiceItemDto,
  type PlanFeature,
  type PlanTier,
  type ResourceUsageMetric,
  type SaveCustomLLMInput,
  type TestCustomLLMInput,
  type TestCustomLLMResponse,
  type WorkspaceBillingSummary,
} from '@org/types';
import { BillingAuditService } from './billing-audit.service.js';
import { resolveBillingMode } from './billing-mode.js';
import { CreditService } from './credit.service.js';
import { PAYMENT_PROVIDER, PaymentProviderError, type PaymentProvider } from './payment-provider.js';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly creditService: CreditService,
    private readonly audit: BillingAuditService,
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  /**
   * Retrieves full billing status, live resource usage, limits, and entitlements.
   */
  async getBillingSummary(
    workspaceId: string,
    userRole?: WorkspaceRole,
  ): Promise<WorkspaceBillingSummary> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        subscription: true,
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found.');
    }

    const planTier = normalizePlanTier(workspace.subscription?.planTier ?? 'free');
    const planConfig = PLANS_CONFIG[planTier];

    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);

    // Query live resource counts in parallel
    const [
      memberCount,
      projectCount,
      storageResult,
      aiSessionCount,
      automationCount,
      integrationCount,
      microAgentsCount,
      concurrentRunning,
      monthlyRequests,
      creditAccount,
    ] = await Promise.all([
      this.prisma.workspaceMember.count({
        where: { workspaceId, status: 'ACTIVE' },
      }),
      this.prisma.project.count({
        where: { workspaceId },
      }),
      this.prisma.upload.aggregate({
        where: { workspaceId },
        _sum: { size: true },
      }),
      this.prisma.aIChatSession.count({
        where: { workspaceId },
      }),
      // Plain workflows only: Studio agents count as agents, canvas-run copies are hidden.
      this.prisma.automationWorkflow.count({
        where: {
          workspaceId,
          triggerType: { not: CANVAS_AGENT_TRIGGER },
          agentProfile: { equals: Prisma.DbNull },
        },
      }),
      this.prisma.externalIntegration.count({
        where: { workspaceId, status: 'CONNECTED' },
      }),
      // Micro agents = entity agents + Studio-planned agents (same rule as PlanGateService).
      Promise.all([
        this.prisma.aIAgent.count({ where: { workspaceId, type: 'agent' } }),
        this.prisma.automationWorkflow.count({
          where: {
            workspaceId,
            triggerType: { not: CANVAS_AGENT_TRIGGER },
            agentProfile: { not: Prisma.DbNull },
          },
        }),
      ]).then(([a, b]) => a + b),
      this.prisma.workflowExecution.count({
        where: { workflow: { workspaceId }, status: 'RUNNING' },
      }),
      this.prisma.workflowExecution.count({
        where: { workflow: { workspaceId }, startedAt: { gte: currentMonthStart } },
      }),
      this.creditService.getOrCreateAccount(workspaceId),
    ]);

    const totalStorageBytes = Number(storageResult._sum?.size ?? 0);

    // Build metric helpers
    const buildMetric = (
      key: keyof typeof planConfig.limits,
      label: string,
      used: number,
      unit?: string,
    ): ResourceUsageMetric => {
      const limit = getPlanLimit(planTier, key);
      return {
        key,
        label,
        used,
        limit,
        percentage: getUsagePercentage(used, limit),
        isNearLimit: isNearLimit(used, limit),
        isLimitReached: isLimitReached(used, limit),
        unit,
      };
    };

    const usage = {
      members: buildMetric('max_members', 'Team Members', memberCount),
      projects: buildMetric('max_projects', 'Active Projects', projectCount),
      storage: buildMetric('storage_bytes', 'Storage Used', totalStorageBytes, 'bytes'),
      aiRequests: buildMetric('monthly_ai_requests', 'AI Requests', aiSessionCount + monthlyRequests),
      automations: buildMetric('max_active_automations', 'Automations', automationCount),
      integrations: buildMetric('max_active_integrations', 'Integrations', integrationCount),
      microAgents: buildMetric('micro_agents', 'Micro Agents', microAgentsCount),
      concurrentExecutions: buildMetric('concurrent_executions', 'Concurrent Executions', concurrentRunning),
      networkTransfer: buildMetric(
        'network_transfer_gb',
        'Network Transfer',
        Math.round((totalStorageBytes / (1024 * 1024 * 1024)) * 10) / 10,
        'GB',
      ),
      aiCredits: buildMetric('ai_credits_usd', 'AI Credits Remaining', creditAccount.balance, 'USD'),
    };

    // Calculate entitlements matrix
    const entitlements = Object.keys(planConfig.features).reduce((acc, feat) => {
      acc[feat as PlanFeature] = true;
      return acc;
    }, {} as Record<PlanFeature, boolean>);

    // Populate all other features as boolean flags
    const allFeatures: PlanFeature[] = [
      'core_workspace',
      'basic_projects',
      'unlimited_projects',
      'advanced_project_management',
      'basic_views',
      'advanced_views',
      'multiple_assignees',
      'basic_ai',
      'advanced_ai',
      'custom_prompt_templates',
      'agent_marketplace',
      'agent_builder',
      'agent_upgrades',
      'per_agent_config',
      'transparent_ai_billing',
      'unlimited_testing_staging',
      'extended_execution_hours',
      'custom_agent',
      'custom_llm',
      'enterprise_ai_governance',
      'basic_automations',
      'advanced_automations',
      'unlimited_workflows',
      'standard_integrations',
      'advanced_integrations',
      'custom_integrations',
      'api_access',
      'advanced_api_limits',
      'basic_collaboration',
      'team_admin',
      'roles_and_permissions',
      'custom_roles',
      'audit_logs',
      'sso_saml',
      'scim_provisioning',
      'security_policies',
      'dedicated_infrastructure',
      'custom_data_retention',
      'priority_support',
      'dedicated_support',
      'enterprise_support',
      'custom_deployment',
    ];

    for (const f of allFeatures) {
      entitlements[f] = hasFeature(planTier, f);
    }

    const canManageBilling =
      userRole === WorkspaceRole.OWNER ||
      (userRole ? roleHasPermission(userRole, WorkspacePermission.MANAGE_BILLING) : false);

    const subscriptionDto = workspace.subscription
      ? {
          id: workspace.subscription.id,
          workspaceId: workspace.subscription.workspaceId,
          planTier: normalizePlanTier(workspace.subscription.planTier),
          billingInterval: (workspace.subscription.billingInterval.toLowerCase() === 'annual'
            ? 'annual'
            : 'monthly') as 'monthly' | 'annual',
          status: workspace.subscription.status as any,
          seatsTotal: workspace.subscription.seatsTotal,
          seatsUsed: memberCount,
          cancelAtPeriodEnd: workspace.subscription.cancelAtPeriodEnd,
          currentPeriodStart: workspace.subscription.currentPeriodStart.toISOString(),
          currentPeriodEnd: workspace.subscription.currentPeriodEnd.toISOString(),
          renewAt: workspace.subscription.renewAt.toISOString(),
          trialStart: workspace.subscription.trialStart?.toISOString() ?? null,
          trialEnd: workspace.subscription.trialEnd?.toISOString() ?? null,
          trialStatus: (workspace.subscription.trialStatus as any) ?? null,
          trialUsed: workspace.subscription.trialUsed ?? false,
          convertedAt: workspace.subscription.convertedAt?.toISOString() ?? null,
          appliedPromotionCode: workspace.subscription.appliedPromotionCode ?? null,
          discountPercent: workspace.subscription.discountPercent ?? null,
          source: (workspace.subscription.source as any) ?? 'FREE',
          provider: workspace.subscription.provider ?? null,
          pastDueSince: workspace.subscription.pastDueSince?.toISOString() ?? null,
          scheduledPlanTier: workspace.subscription.scheduledPlanTier
            ? normalizePlanTier(workspace.subscription.scheduledPlanTier)
            : null,
          scheduledBillingInterval: workspace.subscription.scheduledBillingInterval
            ? workspace.subscription.scheduledBillingInterval.toLowerCase() === 'annual'
              ? ('annual' as const)
              : ('monthly' as const)
            : null,
          scheduledChangeAt: workspace.subscription.scheduledChangeAt?.toISOString() ?? null,
          createdAt: workspace.subscription.createdAt.toISOString(),
          updatedAt: workspace.subscription.updatedAt.toISOString(),
        }
      : null;

    return {
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      plan: planTier,
      planConfig,
      subscription: subscriptionDto,
      creditAccount,
      usage,
      entitlements,
      canManageBilling,
      paymentsEnabled: this.provider.isConfigured(),
      paymentProvider: this.provider.isConfigured() ? this.provider.name : null,
      billingMode: resolveBillingMode(this.config),
    };
  }

  private async requireSubscription(workspaceId: string) {
    const sub = await this.prisma.workspaceSubscription.findUnique({ where: { workspaceId } });
    if (!sub || normalizePlanTier(sub.planTier) === 'free') {
      throw new BadRequestException(
        'This workspace is on the Free plan — there is no paid subscription to change.',
      );
    }
    return sub;
  }

  /** Keeps paid access until the period ends, then returns the workspace to Free. */
  async cancelSubscription(workspaceId: string, actorId?: string): Promise<WorkspaceBillingSummary> {
    const sub = await this.requireSubscription(workspaceId);
    if (sub.providerSubscriptionId) {
      await this.callProvider(() => this.provider.cancelAtPeriodEnd(sub.providerSubscriptionId as string));
    }
    await this.prisma.workspaceSubscription.update({
      where: { workspaceId },
      data: { cancelAtPeriodEnd: true, scheduledPlanTier: 'FREE', scheduledChangeAt: sub.currentPeriodEnd },
    });
    await this.audit.record({
      action: 'SUBSCRIPTION_CANCEL_SCHEDULED',
      targetType: 'subscription',
      targetId: workspaceId,
      workspaceId,
      actorId,
      details: { effectiveAt: sub.currentPeriodEnd },
    });
    this.notify(
      workspaceId,
      'cancel',
      'Cancellation scheduled',
      `Your plan stays active until ${sub.currentPeriodEnd.toDateString()}, then moves to Free.`,
    );
    return this.getBillingSummary(workspaceId, WorkspaceRole.OWNER);
  }

  /** Undo a scheduled cancellation or downgrade while the period is still running. */
  async reactivateSubscription(workspaceId: string, actorId?: string): Promise<WorkspaceBillingSummary> {
    const sub = await this.requireSubscription(workspaceId);
    if (!sub.cancelAtPeriodEnd && !sub.scheduledPlanTier) {
      throw new BadRequestException('There is no pending cancellation or downgrade to undo.');
    }
    if (sub.currentPeriodEnd <= new Date()) {
      throw new ConflictException('The billing period has already ended. Please subscribe again.');
    }
    if (sub.providerSubscriptionId) {
      await this.callProvider(() => this.provider.resume(sub.providerSubscriptionId as string));
    }
    await this.prisma.workspaceSubscription.update({
      where: { workspaceId },
      data: {
        cancelAtPeriodEnd: false,
        scheduledPlanTier: null,
        scheduledBillingInterval: null,
        scheduledChangeAt: null,
      },
    });
    await this.audit.record({
      action: 'SUBSCRIPTION_REACTIVATED',
      targetType: 'subscription',
      targetId: workspaceId,
      workspaceId,
      actorId,
    });
    this.notify(workspaceId, 'reactivate', 'Subscription reactivated', 'Your plan will renew as normal.');
    return this.getBillingSummary(workspaceId, WorkspaceRole.OWNER);
  }

  /** Hosted payment-method / invoice management page from the payment provider. */
  async createPortalSession(workspaceId: string): Promise<BillingPortalResponse> {
    if (!this.provider.isConfigured()) {
      throw new ServiceUnavailableException({
        code: 'PAYMENT_PROVIDER_NOT_CONFIGURED',
        message: 'Payment management is unavailable because no payment provider is configured.',
      });
    }
    const sub = await this.prisma.workspaceSubscription.findUnique({
      where: { workspaceId },
      select: { providerCustomerId: true, workspace: { select: { slug: true } } },
    });
    if (!sub?.providerCustomerId) {
      throw new BadRequestException(
        'This workspace has no payment profile yet — subscribe to a paid plan first.',
      );
    }
    const base = (
      this.config.get<string>('WEB_APP_URL') ||
      this.config.get<string>('APP_URL') ||
      'http://localhost:4200'
    ).replace(/\/+$/, '');
    const url = await this.callProvider(() =>
      this.provider.createPortalSession(
        sub.providerCustomerId as string,
        `${base}/w/${sub.workspace.slug}/settings/billing`,
      ),
    );
    return { url };
  }

  private async callProvider<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof PaymentProviderError) {
        throw new ServiceUnavailableException({
          code: 'PAYMENT_PROVIDER_ERROR',
          message: 'The payment provider could not complete that request. Nothing was changed — please retry.',
        });
      }
      throw err;
    }
  }

  private notify(workspaceId: string, kind: string, title: string, body: string): void {
    this.events.emit(AppEvent.BillingNotice, {
      workspaceId,
      actorId: null,
      title,
      body,
      dedupeKey: `${kind}:${workspaceId}:${Date.now().toString(36)}`,
    });
  }

  /**
   * Audits potential resource overages before a downgrade is performed.
   */
  async getDowngradeImpact(
    workspaceId: string,
    targetPlanInput: PlanTier,
  ): Promise<DowngradeImpactSummary> {
    const targetPlan = normalizePlanTier(targetPlanInput);
    const summary = await this.getBillingSummary(workspaceId);
    const targetConfig = PLANS_CONFIG[targetPlan];

    const warnings: DowngradeImpactSummary['warnings'] = [];

    // Check members
    if (
      targetConfig.limits.max_members !== -1 &&
      summary.usage.members.used > targetConfig.limits.max_members
    ) {
      warnings.push({
        resource: 'Team Members',
        currentUsage: summary.usage.members.used,
        targetLimit: targetConfig.limits.max_members,
        impactDescription: `You have ${summary.usage.members.used} members. ${targetConfig.name} allows ${targetConfig.limits.max_members}. Existing members will be preserved, but new member invitations will be blocked.`,
        requiresReduction: false,
      });
    }

    // Check projects
    if (
      targetConfig.limits.max_projects !== -1 &&
      summary.usage.projects.used > targetConfig.limits.max_projects
    ) {
      warnings.push({
        resource: 'Projects',
        currentUsage: summary.usage.projects.used,
        targetLimit: targetConfig.limits.max_projects,
        impactDescription: `You have ${summary.usage.projects.used} projects. ${targetConfig.name} allows ${targetConfig.limits.max_projects}. Creating new projects will be restricted until active projects are reduced.`,
        requiresReduction: false,
      });
    }

    // Check automations
    if (
      targetConfig.limits.max_active_automations !== -1 &&
      summary.usage.automations.used > targetConfig.limits.max_active_automations
    ) {
      warnings.push({
        resource: 'Automations',
        currentUsage: summary.usage.automations.used,
        targetLimit: targetConfig.limits.max_active_automations,
        impactDescription: `You have ${summary.usage.automations.used} workflows. ${targetConfig.name} allows ${targetConfig.limits.max_active_automations}.`,
        requiresReduction: false,
      });
    }

    // Check Micro Agents
    if (
      targetConfig.machineLimits.microAgents !== -1 &&
      summary.usage.microAgents.used > targetConfig.machineLimits.microAgents
    ) {
      warnings.push({
        resource: 'Micro Agents',
        currentUsage: summary.usage.microAgents.used,
        targetLimit: targetConfig.machineLimits.microAgents,
        impactDescription: `You have ${summary.usage.microAgents.used} Micro Agents. ${targetConfig.name} allows ${targetConfig.machineLimits.microAgents}. Existing agents are preserved, but creating new agents will be blocked until active count is reduced.`,
        requiresReduction: false,
      });
    }

    // Check Agent Upgrades
    if (
      PLANS_CONFIG[summary.plan].machineLimits.agentUpgrades &&
      !targetConfig.machineLimits.agentUpgrades
    ) {
      warnings.push({
        resource: 'Agent Upgrades',
        currentUsage: 1,
        targetLimit: 0,
        impactDescription: 'Agent upgrades and custom performance configurations are not included on the Free plan and will be disabled.',
        requiresReduction: false,
      });
    }

    // List restricted features
    const currentFeatures = PLANS_CONFIG[summary.plan].features;
    const targetFeatures = targetConfig.features;
    const restrictedFeatures = currentFeatures.filter((f) => !targetFeatures.includes(f));

    return {
      currentPlan: summary.plan,
      targetPlan,
      canDowngrade: true,
      warnings,
      restrictedFeatures,
    };
  }

  /**
   * Schedules a move to a lower plan at the end of the current period. Nothing
   * is removed now; limits then apply to *new* writes only (data is preserved).
   */
  async downgradePlan(
    workspaceId: string,
    userId: string,
    input: DowngradePlanInput,
  ): Promise<WorkspaceBillingSummary> {
    const targetPlan = normalizePlanTier(input.targetPlan);
    const sub = await this.requireSubscription(workspaceId);
    const currentPlan = normalizePlanTier(sub.planTier);
    if (PLAN_HIERARCHY[targetPlan] >= PLAN_HIERARCHY[currentPlan]) {
      throw new BadRequestException('The target plan must be lower than your current plan.');
    }
    if (targetPlan === 'free') return this.cancelSubscription(workspaceId, userId);

    const impact = await this.getDowngradeImpact(workspaceId, targetPlan);
    if (impact.warnings.length > 0 && !input.acknowledgeOverages) {
      throw new ConflictException({
        code: 'DOWNGRADE_OVERAGES_UNACKNOWLEDGED',
        message: 'This downgrade puts the workspace over some limits. Review and confirm to continue.',
        impact,
      });
    }

    const interval = sub.billingInterval.toLowerCase() === 'annual' ? 'annual' : 'monthly';
    if (sub.providerSubscriptionId) {
      await this.callProvider(() =>
        this.provider.scheduleChangeAtPeriodEnd({
          providerSubscriptionId: sub.providerSubscriptionId as string,
          planTier: targetPlan,
          billingInterval: interval,
          currency: 'USD',
          productName: `${PLANS_CONFIG[targetPlan].name} plan (${interval})`,
          unitAmountCents: planPeriodCents(targetPlan, interval),
          workspaceId,
        }),
      );
    }
    await this.prisma.workspaceSubscription.update({
      where: { workspaceId },
      data: {
        scheduledPlanTier: targetPlan.toUpperCase(),
        scheduledBillingInterval: interval.toUpperCase(),
        scheduledChangeAt: sub.currentPeriodEnd,
      },
    });
    await this.audit.record({
      action: 'DOWNGRADE_SCHEDULED',
      targetType: 'subscription',
      targetId: workspaceId,
      workspaceId,
      actorId: userId,
      details: { from: currentPlan, to: targetPlan, effectiveAt: sub.currentPeriodEnd, reason: input.reason },
    });
    this.notify(
      workspaceId,
      'downgrade',
      'Downgrade scheduled',
      `Your workspace moves to ${PLANS_CONFIG[targetPlan].name} on ${sub.currentPeriodEnd.toDateString()}.`,
    );
    return this.getBillingSummary(workspaceId, WorkspaceRole.OWNER);
  }

  /**
   * Records an Enterprise inquiry for custom LLM, volume seats, and dedicated SLA.
   */
  async submitEnterpriseInquiry(
    workspaceId: string,
    userId: string,
    input: EnterpriseInquiryInput,
  ) {
    if (!input.name || !input.email || !input.companyName) {
      throw new BadRequestException('Name, work email, and company name are required.');
    }

    const inquiry = await this.prisma.enterpriseSalesInquiry.create({
      data: {
        workspaceId,
        userId,
        name: input.name,
        email: input.email,
        companyName: input.companyName,
        teamSize: input.teamSize ?? null,
        customLlmRequirements: input.customLlmRequirements ?? null,
        message: input.message ?? null,
      },
    });

    return {
      success: true,
      inquiryId: inquiry.id,
      message: 'Thank you. Our enterprise solutions team will reach out within 1 business day.',
    };
  }

  /**
   * Reads Enterprise Custom LLM configuration (Enterprise tier required).
   */
  async getCustomLLMConfig(workspaceId: string): Promise<CustomLLMConfigDto | null> {
    const sub = await this.prisma.workspaceSubscription.findUnique({
      where: { workspaceId },
      select: { planTier: true, customLlmConfig: true },
    });

    const plan = normalizePlanTier(sub?.planTier ?? 'free');
    if (!hasFeature(plan, 'custom_llm')) {
      throw new ForbiddenException(
        'Custom LLM configuration is exclusively available on the Enterprise plan.',
      );
    }

    if (!sub?.customLlmConfig) {
      return null;
    }

    try {
      const parsed = JSON.parse(sub.customLlmConfig);
      return {
        provider: parsed.provider || 'custom',
        endpointUrl: parsed.endpointUrl || '',
        modelIdentifier: parsed.modelIdentifier || '',
        hasApiKey: !!parsed.apiKey,
        maskedApiKey: parsed.apiKey ? `••••••••••••${parsed.apiKey.slice(-4)}` : undefined,
        temperature: parsed.temperature ?? 0.7,
        maxTokens: parsed.maxTokens ?? 4096,
        contextWindow: parsed.contextWindow ?? 32768,
        systemPrompt: parsed.systemPrompt,
        fallbackModel: parsed.fallbackModel,
        isPrivateNetwork: parsed.isPrivateNetwork ?? false,
        isEnabled: parsed.isEnabled ?? true,
        lastTestedAt: parsed.lastTestedAt,
        lastTestStatus: parsed.lastTestStatus,
        lastTestError: parsed.lastTestError,
      };
    } catch {
      return null;
    }
  }

  /**
   * Saves Enterprise Custom LLM configuration.
   */
  async saveCustomLLMConfig(
    workspaceId: string,
    input: SaveCustomLLMInput,
  ): Promise<CustomLLMConfigDto> {
    const sub = await this.prisma.workspaceSubscription.findUnique({
      where: { workspaceId },
      select: { planTier: true, customLlmConfig: true },
    });

    const plan = normalizePlanTier(sub?.planTier ?? 'free');
    if (!hasFeature(plan, 'custom_llm')) {
      throw new ForbiddenException(
        'Custom LLM configuration is exclusively available on the Enterprise plan.',
      );
    }

    let existingApiKey = '';
    if (sub?.customLlmConfig) {
      try {
        const parsed = JSON.parse(sub.customLlmConfig);
        existingApiKey = parsed.apiKey || '';
      } catch {
        // ignore
      }
    }

    const payload = {
      provider: input.provider || 'custom',
      endpointUrl: input.endpointUrl,
      modelIdentifier: input.modelIdentifier,
      apiKey: input.apiKey && input.apiKey.trim().length > 0 ? input.apiKey.trim() : existingApiKey,
      temperature: input.temperature ?? 0.7,
      maxTokens: input.maxTokens ?? 4096,
      contextWindow: input.contextWindow ?? 32768,
      systemPrompt: input.systemPrompt ?? '',
      fallbackModel: input.fallbackModel,
      isPrivateNetwork: input.isPrivateNetwork ?? false,
      isEnabled: input.isEnabled ?? true,
      updatedAt: new Date().toISOString(),
    };

    await this.prisma.workspaceSubscription.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        planTier: 'ENTERPRISE',
        customLlmConfig: JSON.stringify(payload),
      },
      update: {
        customLlmConfig: JSON.stringify(payload),
      },
    });

    return {
      provider: payload.provider as any,
      endpointUrl: payload.endpointUrl,
      modelIdentifier: payload.modelIdentifier,
      hasApiKey: !!payload.apiKey,
      maskedApiKey: payload.apiKey ? `••••••••••••${payload.apiKey.slice(-4)}` : undefined,
      temperature: payload.temperature,
      maxTokens: payload.maxTokens,
      contextWindow: payload.contextWindow,
      systemPrompt: payload.systemPrompt,
      fallbackModel: payload.fallbackModel,
      isPrivateNetwork: payload.isPrivateNetwork,
      isEnabled: payload.isEnabled,
    };
  }

  /**
   * Tests custom LLM connectivity with given endpoint & credentials.
   */
  async testCustomLLMConnection(input: TestCustomLLMInput): Promise<TestCustomLLMResponse> {
    if (!input.endpointUrl || !input.modelIdentifier) {
      throw new BadRequestException('Endpoint URL and Model Identifier are required.');
    }

    const startTime = Date.now();
    try {
      // Best-effort test against OpenAI-compatible /v1/models or test prompt
      const url = input.endpointUrl.replace(/\/+$/, '');
      const modelsEndpoint = url.endsWith('/v1') ? `${url}/models` : `${url}/v1/models`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (input.apiKey) {
        headers['Authorization'] = `Bearer ${input.apiKey}`;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(modelsEndpoint, {
        method: 'GET',
        headers,
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      const latencyMs = Date.now() - startTime;

      if (res.ok) {
        return {
          success: true,
          latencyMs,
          model: input.modelIdentifier,
          message: `Connection successful! Responded in ${latencyMs}ms.`,
        };
      }

      // If /models wasn't supported, test /chat/completions with 1 token
      const chatEndpoint = url.endsWith('/v1') ? `${url}/chat/completions` : `${url}/v1/chat/completions`;
      const chatRes = await fetch(chatEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: input.modelIdentifier,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
      });

      const chatLatencyMs = Date.now() - startTime;
      if (chatRes.ok) {
        return {
          success: true,
          latencyMs: chatLatencyMs,
          model: input.modelIdentifier,
          message: `Model inference verified in ${chatLatencyMs}ms.`,
        };
      }

      return {
        success: false,
        latencyMs: chatLatencyMs,
        model: input.modelIdentifier,
        message: `Endpoint returned HTTP ${chatRes.status}`,
        error: `HTTP ${chatRes.status}: ${chatRes.statusText}`,
      };
    } catch (err: any) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        model: input.modelIdentifier,
        message: 'Could not connect to custom LLM endpoint.',
        error: err.message || String(err),
      };
    }
  }

  /** Real invoices recorded from payment-provider events and approved activations. */
  async getInvoices(workspaceId: string): Promise<InvoiceItemDto[]> {
    const rows = await this.prisma.billingInvoice.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => ({
      id: r.id,
      invoiceNumber: r.number,
      amountCents: r.amountCents,
      currency: r.currency,
      status: r.status as InvoiceItemDto['status'],
      periodStart: r.periodStart.toISOString(),
      periodEnd: r.periodEnd.toISOString(),
      pdfUrl: r.pdfUrl ?? undefined,
      hostedUrl: r.hostedUrl ?? undefined,
      description: r.description,
    }));
  }
}
