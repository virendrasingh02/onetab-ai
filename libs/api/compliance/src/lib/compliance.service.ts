import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '@org/database';
import type {
  AdminPage,
  ComplianceAppVersionView,
  ComplianceAuditLogView,
  ComplianceChecklistItemView,
  ComplianceChecklistStatus,
  ComplianceCountryView,
  ComplianceEvaluationContext,
  ComplianceEvaluationResult,
  ComplianceEvidenceView,
  ComplianceIssueSource,
  ComplianceIssueStatus,
  ComplianceIssueView,
  ComplianceLegalLinkView,
  ComplianceOverview,
  CompliancePlatformView,
  CompliancePolicyView,
  ComplianceReadinessScore,
  ComplianceRegionView,
  ComplianceReleaseOverrideView,
  ComplianceRequirementScopeView,
  ComplianceRequirementView,
  ComplianceReviewStatus,
  ComplianceReviewView,
  ComplianceSeverity,
} from '@org/types';
import { ComplianceRuleEngineService } from './compliance-rule-engine.service.js';

@Injectable()
export class ComplianceService implements OnModuleInit {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ruleEngine: ComplianceRuleEngineService,
  ) {}

  async onModuleInit() {
    try {
      await this.seedOfficialGuidelines();
    } catch (error) {
      this.logger.warn(`Compliance seeding skipped or failed: ${(error as Error).message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // AUDIT LOGGING HELPER
  // ---------------------------------------------------------------------------

  async logAudit(params: {
    actorId?: string;
    actorEmail: string;
    action: string;
    targetType: string;
    targetId?: string;
    previousValue?: unknown;
    newValue?: unknown;
    platform?: string;
    country?: string;
    version?: string;
    reason?: string;
  }) {
    return this.prisma.complianceAuditLog.create({
      data: {
        actorId: params.actorId,
        actorEmail: params.actorEmail,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        previousValue: params.previousValue
          ? JSON.stringify(params.previousValue)
          : null,
        newValue: params.newValue ? JSON.stringify(params.newValue) : null,
        platform: params.platform,
        country: params.country,
        version: params.version,
        reason: params.reason,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // OVERVIEW
  // ---------------------------------------------------------------------------

  async getOverview(): Promise<ComplianceOverview> {
    const platforms = await this.prisma.compliancePlatform.findMany({
      include: {
        distributions: true,
        versions: { where: { isCurrent: true } },
      },
    });

    const reviews = await this.prisma.complianceReview.findMany({
      include: { platform: true, appVersion: true },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    const issues = await this.prisma.complianceIssue.findMany();
    const openIssues = issues.filter((i) => i.status !== 'RESOLVED' && i.status !== 'ACCEPTED');

    const criticalCount = openIssues.filter((i) => i.severity === 'CRITICAL').length;
    const highCount = openIssues.filter((i) => i.severity === 'HIGH').length;
    const mediumCount = openIssues.filter((i) => i.severity === 'MEDIUM').length;
    const lowCount = openIssues.filter((i) => i.severity === 'LOW').length;
    const resolvedCount = issues.filter((i) => i.status === 'RESOLVED' || i.status === 'ACCEPTED').length;

    // Calculate platform scores
    const webReview = reviews.find((r) => r.platform.code === 'web');
    const winDirectReview = reviews.find(
      (r) => r.platform.code === 'windows' && r.distributionId === null,
    );
    const msStoreReview = reviews.find((r) => r.distribution?.code === 'microsoft-store');
    const macAppStoreReview = reviews.find((r) => r.distribution?.code === 'mac-app-store');
    const macDirectReview = reviews.find(
      (r) => r.platform.code === 'macos' && r.distributionId === null,
    );

    const webScore = webReview?.overallScore ?? 95;
    const desktopScore = Math.round(
      ((winDirectReview?.overallScore ?? 88) +
        (msStoreReview?.overallScore ?? 82) +
        (macAppStoreReview?.overallScore ?? 78) +
        (macDirectReview?.overallScore ?? 90)) /
        4,
    );

    const overallScore = Math.round((webScore + desktopScore) / 2);

    // Countries requiring attention
    const countriesWithIssues = await this.prisma.complianceCountry.findMany({
      where: {
        issues: { some: { status: { notIn: ['RESOLVED', 'ACCEPTED'] } } },
      },
      include: {
        issues: { where: { status: { notIn: ['RESOLVED', 'ACCEPTED'] } } },
      },
    });

    const countriesRequiringAttention = countriesWithIssues.map((c) => {
      const crit = c.issues.filter((i) => i.severity === 'CRITICAL').length;
      const warn = c.issues.filter((i) => i.severity === 'HIGH' || i.severity === 'MEDIUM').length;
      return {
        code: c.code,
        name: c.name,
        criticalCount: crit,
        warningCount: warn,
        status: (crit > 0 ? 'FAILED' : 'WARNING') as ComplianceChecklistStatus,
      };
    });

    const currentVersions = platforms.map((p) => {
      const current = p.versions[0];
      return {
        platform: p.code,
        platformName: p.name,
        currentVersion: current ? current.version : p.currentVersion,
        status: (current ? current.status : 'IN_PROGRESS') as ComplianceReviewStatus,
        readinessScore: p.code === 'web' ? webScore : desktopScore,
      };
    });

    return {
      overallScore,
      overallStatus: criticalCount > 0 ? 'FAILED' : overallScore >= 90 ? 'PASSED' : 'WARNING',
      webReadiness: webScore,
      desktopReadiness: desktopScore,
      storeReadiness: {
        microsoftStore: msStoreReview?.overallScore ?? 82,
        macAppStore: macAppStoreReview?.overallScore ?? 78,
        directWindows: winDirectReview?.overallScore ?? 88,
        directMac: macDirectReview?.overallScore ?? 90,
        web: webScore,
      },
      openIssuesCount: {
        total: openIssues.length,
        critical: criticalCount,
        high: highCount,
        medium: mediumCount,
        low: lowCount,
        resolved: resolvedCount,
      },
      countriesRequiringAttention,
      currentVersions,
      upcomingDeadlines: [
        {
          id: 'dl-1',
          title: 'India DPDP Act Grievance Officer Audit',
          target: 'India (IN) - Web & Desktop',
          date: new Date(Date.now() + 14 * 86400000).toISOString(),
          severity: 'HIGH',
        },
        {
          id: 'dl-2',
          title: 'Apple macOS App Sandbox Entitlement Requirement',
          target: 'Mac App Store - v2.5.0',
          date: new Date(Date.now() + 30 * 86400000).toISOString(),
          severity: 'CRITICAL',
        },
      ],
      lastReviewDate: reviews[0]?.reviewedAt?.toISOString() ?? null,
      lastUpdated: new Date().toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // PLATFORMS & DISTRIBUTIONS
  // ---------------------------------------------------------------------------

  async listPlatforms(): Promise<CompliancePlatformView[]> {
    const platforms = await this.prisma.compliancePlatform.findMany({
      include: {
        distributions: true,
        scopes: true,
      },
      orderBy: { name: 'asc' },
    });

    return platforms.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      type: p.type as any,
      currentVersion: p.currentVersion,
      minSupportedVersion: p.minSupportedVersion,
      isActive: p.isActive,
      distributions: p.distributions.map((d) => ({
        id: d.id,
        code: d.code,
        name: d.name,
        isActive: d.isActive,
      })),
      complianceStatus: 'PASSED',
      releaseStatus: 'APPROVED',
      readinessScore: p.code === 'web' ? 95 : 85,
      activeRequirementCount: p.scopes.length,
      lastReview: new Date().toISOString(),
    }));
  }

  async createPlatform(
    actorEmail: string,
    data: {
      code: string;
      name: string;
      type?: 'WEB' | 'DESKTOP' | 'MOBILE';
      currentVersion?: string;
      minSupportedVersion?: string;
    },
  ): Promise<CompliancePlatformView> {
    const platform = await this.prisma.compliancePlatform.create({
      data: {
        code: data.code.toLowerCase(),
        name: data.name,
        type: (data.type ?? 'DESKTOP') as any,
        currentVersion: data.currentVersion ?? '1.0.0',
        minSupportedVersion: data.minSupportedVersion ?? '1.0.0',
      },
      include: { distributions: true, scopes: true },
    });

    await this.logAudit({
      actorEmail,
      action: 'PLATFORM_CREATED',
      targetType: 'PLATFORM',
      targetId: platform.id,
      newValue: platform,
      platform: platform.code,
    });

    return {
      id: platform.id,
      code: platform.code,
      name: platform.name,
      type: platform.type as any,
      currentVersion: platform.currentVersion,
      minSupportedVersion: platform.minSupportedVersion,
      isActive: platform.isActive,
      distributions: [],
      complianceStatus: 'WARNING',
      releaseStatus: 'IN_PROGRESS',
      readinessScore: 0,
      activeRequirementCount: 0,
    };
  }

  async updatePlatform(
    actorEmail: string,
    id: string,
    data: {
      name?: string;
      currentVersion?: string;
      minSupportedVersion?: string;
      isActive?: boolean;
    },
  ): Promise<CompliancePlatformView> {
    const existing = await this.prisma.compliancePlatform.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Platform not found');

    const updated = await this.prisma.compliancePlatform.update({
      where: { id },
      data,
      include: { distributions: true, scopes: true },
    });

    await this.logAudit({
      actorEmail,
      action: 'PLATFORM_UPDATED',
      targetType: 'PLATFORM',
      targetId: id,
      previousValue: existing,
      newValue: updated,
      platform: updated.code,
    });

    return {
      id: updated.id,
      code: updated.code,
      name: updated.name,
      type: updated.type as any,
      currentVersion: updated.currentVersion,
      minSupportedVersion: updated.minSupportedVersion,
      isActive: updated.isActive,
      distributions: updated.distributions.map((d) => ({
        id: d.id,
        code: d.code,
        name: d.name,
        isActive: d.isActive,
      })),
      complianceStatus: 'PASSED',
      releaseStatus: 'APPROVED',
      readinessScore: 90,
      activeRequirementCount: updated.scopes.length,
    };
  }

  // ---------------------------------------------------------------------------
  // REGIONS & COUNTRIES
  // ---------------------------------------------------------------------------

  async listRegions(): Promise<ComplianceRegionView[]> {
    const regions = await this.prisma.complianceRegion.findMany({
      include: { countries: true },
      orderBy: { name: 'asc' },
    });

    return regions.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      countriesCount: r.countries.length,
    }));
  }

  async listCountries(regionId?: string): Promise<ComplianceCountryView[]> {
    const countries = await this.prisma.complianceCountry.findMany({
      where: regionId ? { regionId } : undefined,
      include: {
        region: true,
        scopes: true,
        issues: { where: { status: { notIn: ['RESOLVED', 'ACCEPTED'] } } },
      },
      orderBy: { name: 'asc' },
    });

    return countries.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      regionId: c.regionId,
      regionCode: c.region.code,
      regionName: c.region.name,
      applicableRequirementsCount: c.scopes.length,
      countrySpecificRequirementsCount: c.scopes.filter((s) => s.countryId === c.id).length,
      openIssuesCount: c.issues.length,
      status: c.issues.length > 0 ? 'WARNING' : 'PASSED',
    }));
  }

  // ---------------------------------------------------------------------------
  // REQUIREMENTS & POLICIES
  // ---------------------------------------------------------------------------

  async listRequirements(params?: {
    category?: string;
    severity?: string;
    platform?: string;
    country?: string;
    search?: string;
  }): Promise<ComplianceRequirementView[]> {
    const where: any = {};
    if (params?.category) where.category = params.category;
    if (params?.severity) where.severity = params.severity;
    if (params?.search) {
      where.OR = [
        { code: { contains: params.search, mode: 'insensitive' } },
        { title: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const items = await this.prisma.complianceRequirement.findMany({
      where,
      include: {
        policy: true,
        scopes: {
          include: {
            country: true,
            region: true,
            platform: true,
            distribution: true,
          },
        },
        _count: {
          select: {
            issues: {
              where: { status: { notIn: ['RESOLVED', 'ACCEPTED'] } },
            },
          },
        },
      },
      orderBy: [{ severity: 'desc' }, { code: 'asc' }],
    });

    return items.map((item) => {
      const scopeSummary =
        item.scopes.length === 0
          ? 'Global (All Platforms)'
          : item.scopes
              .map((s) => {
                const parts: string[] = [];
                if (s.country) parts.push(s.country.code);
                else if (s.region) parts.push(s.region.code);
                if (s.platform) parts.push(s.platform.code);
                if (s.distribution) parts.push(s.distribution.code);
                return parts.join(' · ') || 'Global';
              })
              .join(', ');

      return {
        id: item.id,
        code: item.code,
        title: item.title,
        description: item.description,
        category: item.category as any,
        severity: item.severity as any,
        isBlocking: item.isBlocking,
        defaultStatus: item.defaultStatus as any,
        remediationGuide: item.remediationGuide,
        externalUrl: item.externalUrl,
        policyId: item.policyId,
        policyCode: item.policy?.code,
        policyName: item.policy?.name,
        scopes: item.scopes.map((s) => ({
          id: s.id,
          countryId: s.countryId,
          countryCode: s.country?.code,
          countryName: s.country?.name,
          regionId: s.regionId,
          regionCode: s.region?.code,
          platformId: s.platformId,
          platformCode: s.platform?.code,
          distributionId: s.distributionId,
          distributionCode: s.distribution?.code,
          minVersion: s.minVersion,
          maxVersion: s.maxVersion,
          isExcluded: s.isExcluded,
          overrideSeverity: s.overrideSeverity as any,
          overrideNotes: s.overrideNotes,
        })),
        openIssuesCount: item._count.issues,
        effectiveScopeSummary: scopeSummary,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      };
    });
  }

  async createRequirement(
    actorEmail: string,
    data: {
      code: string;
      title: string;
      description: string;
      category: string;
      severity: string;
      isBlocking?: boolean;
      remediationGuide?: string;
      externalUrl?: string;
      policyId?: string;
      scopes?: Array<{
        countryCode?: string;
        regionCode?: string;
        platformCode?: string;
        distributionCode?: string;
        minVersion?: string;
        maxVersion?: string;
        isExcluded?: boolean;
      }>;
    },
  ): Promise<ComplianceRequirementView> {
    const existing = await this.prisma.complianceRequirement.findUnique({
      where: { code: data.code },
    });
    if (existing) {
      throw new BadRequestException(`Requirement code '${data.code}' already exists`);
    }

    const created = await this.prisma.complianceRequirement.create({
      data: {
        code: data.code,
        title: data.title,
        description: data.description,
        category: data.category as any,
        severity: (data.severity as any) ?? 'MEDIUM',
        isBlocking: data.isBlocking ?? false,
        remediationGuide: data.remediationGuide,
        externalUrl: data.externalUrl,
        policyId: data.policyId,
      },
    });

    if (data.scopes && data.scopes.length > 0) {
      for (const sc of data.scopes) {
        const country = sc.countryCode
          ? await this.prisma.complianceCountry.findUnique({ where: { code: sc.countryCode } })
          : null;
        const region = sc.regionCode
          ? await this.prisma.complianceRegion.findUnique({ where: { code: sc.regionCode } })
          : null;
        const platform = sc.platformCode
          ? await this.prisma.compliancePlatform.findUnique({ where: { code: sc.platformCode } })
          : null;
        const distribution = sc.distributionCode
          ? await this.prisma.complianceDistribution.findUnique({ where: { code: sc.distributionCode } })
          : null;

        await this.prisma.complianceRequirementScope.create({
          data: {
            requirementId: created.id,
            countryId: country?.id,
            regionId: region?.id,
            platformId: platform?.id,
            distributionId: distribution?.id,
            minVersion: sc.minVersion,
            maxVersion: sc.maxVersion,
            isExcluded: sc.isExcluded ?? false,
          },
        });
      }
    }

    await this.logAudit({
      actorEmail,
      action: 'REQUIREMENT_CREATED',
      targetType: 'REQUIREMENT',
      targetId: created.id,
      newValue: created,
    });

    const refreshed = await this.listRequirements({ search: created.code });
    return refreshed[0];
  }

  async updateRequirement(
    actorEmail: string,
    id: string,
    data: Partial<{
      title: string;
      description: string;
      category: string;
      severity: string;
      isBlocking: boolean;
      remediationGuide: string;
      externalUrl: string;
    }>,
  ): Promise<ComplianceRequirementView> {
    const existing = await this.prisma.complianceRequirement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Requirement not found');

    const updated = await this.prisma.complianceRequirement.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        category: data.category as any,
        severity: data.severity as any,
        isBlocking: data.isBlocking,
        remediationGuide: data.remediationGuide,
        externalUrl: data.externalUrl,
      },
    });

    await this.logAudit({
      actorEmail,
      action: 'REQUIREMENT_UPDATED',
      targetType: 'REQUIREMENT',
      targetId: id,
      previousValue: existing,
      newValue: updated,
    });

    const refreshed = await this.listRequirements({ search: updated.code });
    return refreshed[0];
  }

  async deleteRequirement(actorEmail: string, id: string): Promise<void> {
    const existing = await this.prisma.complianceRequirement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Requirement not found');

    await this.prisma.complianceRequirement.delete({ where: { id } });

    await this.logAudit({
      actorEmail,
      action: 'REQUIREMENT_DELETED',
      targetType: 'REQUIREMENT',
      targetId: id,
      previousValue: existing,
    });
  }

  async listPolicies(): Promise<CompliancePolicyView[]> {
    const policies = await this.prisma.compliancePolicy.findMany({
      include: { _count: { select: { requirements: true } } },
      orderBy: { code: 'asc' },
    });

    return policies.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      version: p.version,
      effectiveDate: p.effectiveDate.toISOString(),
      reviewDate: p.reviewDate?.toISOString() ?? null,
      status: p.status as any,
      externalGuidelineRef: p.externalGuidelineRef,
      externalGuidelineUrl: p.externalGuidelineUrl,
      requirementsCount: p._count.requirements,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  async createPolicy(
    actorEmail: string,
    data: {
      code: string;
      name: string;
      description?: string;
      version?: string;
      effectiveDate?: string;
      externalGuidelineRef?: string;
      externalGuidelineUrl?: string;
    },
  ): Promise<CompliancePolicyView> {
    const policy = await this.prisma.compliancePolicy.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description,
        version: data.version ?? '1.0.0',
        effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : new Date(),
        externalGuidelineRef: data.externalGuidelineRef,
        externalGuidelineUrl: data.externalGuidelineUrl,
      },
    });

    await this.logAudit({
      actorEmail,
      action: 'POLICY_CREATED',
      targetType: 'POLICY',
      targetId: policy.id,
      newValue: policy,
    });

    return {
      id: policy.id,
      code: policy.code,
      name: policy.name,
      description: policy.description,
      version: policy.version,
      effectiveDate: policy.effectiveDate.toISOString(),
      reviewDate: policy.reviewDate?.toISOString() ?? null,
      status: policy.status as any,
      externalGuidelineRef: policy.externalGuidelineRef,
      externalGuidelineUrl: policy.externalGuidelineUrl,
      requirementsCount: 0,
      createdAt: policy.createdAt.toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // VERSIONS
  // ---------------------------------------------------------------------------

  async listVersions(platformId?: string): Promise<ComplianceAppVersionView[]> {
    const versions = await this.prisma.complianceAppVersion.findMany({
      where: platformId ? { platformId } : undefined,
      include: {
        platform: true,
        reviews: { orderBy: { createdAt: 'desc' }, take: 1 },
        issues: { where: { status: { notIn: ['RESOLVED', 'ACCEPTED'] } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return versions.map((v) => ({
      id: v.id,
      platformId: v.platformId,
      platformCode: v.platform.code,
      platformName: v.platform.name,
      version: v.version,
      releaseDate: v.releaseDate?.toISOString() ?? null,
      status: v.status as any,
      isCurrent: v.isCurrent,
      changelog: v.changelog,
      metadata: JSON.parse(v.metadata || '{}'),
      readinessScore: v.reviews[0]?.overallScore ?? 85,
      openIssuesCount: v.issues.length,
      createdAt: v.createdAt.toISOString(),
    }));
  }

  async createVersion(
    actorEmail: string,
    data: {
      platformId: string;
      version: string;
      releaseDate?: string;
      changelog?: string;
      isCurrent?: boolean;
    },
  ): Promise<ComplianceAppVersionView> {
    const platform = await this.prisma.compliancePlatform.findUnique({
      where: { id: data.platformId },
    });
    if (!platform) throw new NotFoundException('Platform not found');

    if (data.isCurrent) {
      await this.prisma.complianceAppVersion.updateMany({
        where: { platformId: data.platformId },
        data: { isCurrent: false },
      });
      await this.prisma.compliancePlatform.update({
        where: { id: data.platformId },
        data: { currentVersion: data.version },
      });
    }

    const version = await this.prisma.complianceAppVersion.create({
      data: {
        platformId: data.platformId,
        version: data.version,
        releaseDate: data.releaseDate ? new Date(data.releaseDate) : null,
        changelog: data.changelog,
        isCurrent: data.isCurrent ?? false,
      },
      include: { platform: true },
    });

    await this.logAudit({
      actorEmail,
      action: 'APP_VERSION_CREATED',
      targetType: 'APP_VERSION',
      targetId: version.id,
      platform: platform.code,
      version: version.version,
      newValue: version,
    });

    return {
      id: version.id,
      platformId: version.platformId,
      platformCode: platform.code,
      platformName: platform.name,
      version: version.version,
      releaseDate: version.releaseDate?.toISOString() ?? null,
      status: version.status as any,
      isCurrent: version.isCurrent,
      changelog: version.changelog,
      readinessScore: 0,
      openIssuesCount: 0,
      createdAt: version.createdAt.toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // EVALUATION & REVIEWS
  // ---------------------------------------------------------------------------

  async evaluate(context: ComplianceEvaluationContext): Promise<ComplianceEvaluationResult> {
    const allRequirements = await this.listRequirements();
    return this.ruleEngine.evaluate(allRequirements, context);
  }

  async listReviews(params?: { platformId?: string; status?: string }): Promise<ComplianceReviewView[]> {
    const reviews = await this.prisma.complianceReview.findMany({
      where: {
        platformId: params?.platformId,
        status: params?.status as any,
      },
      include: {
        appVersion: true,
        platform: true,
        distribution: true,
        country: true,
        reviewer: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return reviews.map((r) => ({
      id: r.id,
      appVersionId: r.appVersionId,
      appVersion: {
        id: r.appVersion.id,
        version: r.appVersion.version,
        isCurrent: r.appVersion.isCurrent,
      },
      platformId: r.platformId,
      platformCode: r.platform.code,
      platformName: r.platform.name,
      distributionId: r.distributionId,
      distributionCode: r.distribution?.code,
      distributionName: r.distribution?.name,
      countryId: r.countryId,
      countryCode: r.country?.code,
      countryName: r.country?.name,
      status: r.status as any,
      overallScore: r.overallScore,
      passedCount: r.passedCount,
      failedCount: r.failedCount,
      warningCount: r.warningCount,
      blockedCount: r.blockedCount,
      totalCount: r.totalCount,
      summary: r.summary,
      reviewerNotes: r.reviewerNotes,
      submittedAt: r.submittedAt?.toISOString() ?? null,
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
      reviewerName: r.reviewer?.name ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async getReview(reviewId: string): Promise<ComplianceReviewView> {
    const r = await this.prisma.complianceReview.findUnique({
      where: { id: reviewId },
      include: {
        appVersion: true,
        platform: true,
        distribution: true,
        country: true,
        reviewer: true,
      },
    });
    if (!r) throw new NotFoundException('Review not found');

    return {
      id: r.id,
      appVersionId: r.appVersionId,
      appVersion: {
        id: r.appVersion.id,
        version: r.appVersion.version,
        isCurrent: r.appVersion.isCurrent,
      },
      platformId: r.platformId,
      platformCode: r.platform.code,
      platformName: r.platform.name,
      distributionId: r.distributionId,
      distributionCode: r.distribution?.code,
      distributionName: r.distribution?.name,
      countryId: r.countryId,
      countryCode: r.country?.code,
      countryName: r.country?.name,
      status: r.status as any,
      overallScore: r.overallScore,
      passedCount: r.passedCount,
      failedCount: r.failedCount,
      warningCount: r.warningCount,
      blockedCount: r.blockedCount,
      totalCount: r.totalCount,
      summary: r.summary,
      reviewerNotes: r.reviewerNotes,
      submittedAt: r.submittedAt?.toISOString() ?? null,
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
      reviewerName: r.reviewer?.name ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  }

  async createReview(
    actorEmail: string,
    data: {
      appVersionId: string;
      platformId: string;
      distributionId?: string;
      countryId?: string;
      summary?: string;
    },
  ): Promise<ComplianceReviewView> {
    const version = await this.prisma.complianceAppVersion.findUnique({
      where: { id: data.appVersionId },
      include: { platform: true },
    });
    if (!version) throw new NotFoundException('Version not found');

    const country = data.countryId
      ? await this.prisma.complianceCountry.findUnique({ where: { id: data.countryId } })
      : null;

    const distribution = data.distributionId
      ? await this.prisma.complianceDistribution.findUnique({ where: { id: data.distributionId } })
      : null;

    // Evaluate applicable requirements for this review context
    const evalResult = await this.evaluate({
      platform: version.platform.code,
      distribution: distribution?.code,
      country: country?.code,
      version: version.version,
    });

    const review = await this.prisma.complianceReview.create({
      data: {
        appVersionId: data.appVersionId,
        platformId: data.platformId,
        distributionId: data.distributionId,
        countryId: data.countryId,
        status: 'IN_PROGRESS',
        overallScore: evalResult.score.overallScore,
        passedCount: evalResult.score.passed,
        failedCount: evalResult.score.failed,
        warningCount: evalResult.score.warning,
        blockedCount: evalResult.score.criticalIssues,
        totalCount: evalResult.score.total,
        summary: data.summary,
      },
      include: {
        appVersion: true,
        platform: true,
        distribution: true,
        country: true,
      },
    });

    // Seed checklist items for applicable requirements
    for (const item of evalResult.applicableRequirements) {
      await this.prisma.complianceChecklistItem.create({
        data: {
          reviewId: review.id,
          requirementId: item.requirement.id,
          status: item.status,
          notes: item.notes,
        },
      });
    }

    await this.logAudit({
      actorEmail,
      action: 'COMPLIANCE_REVIEW_CREATED',
      targetType: 'REVIEW',
      targetId: review.id,
      platform: version.platform.code,
      version: version.version,
      country: country?.code,
    });

    return this.getReview(review.id);
  }

  // ---------------------------------------------------------------------------
  // CHECKLIST
  // ---------------------------------------------------------------------------

  async getChecklist(reviewId: string): Promise<ComplianceChecklistItemView[]> {
    const items = await this.prisma.complianceChecklistItem.findMany({
      where: { reviewId },
      include: {
        requirement: true,
        assignedTo: true,
        verifiedBy: true,
        evidence: { include: { uploadedBy: true } },
      },
      orderBy: { requirement: { code: 'asc' } },
    });

    return items.map((item) => ({
      id: item.id,
      reviewId: item.reviewId,
      requirementId: item.requirementId,
      requirement: {
        id: item.requirement.id,
        code: item.requirement.code,
        title: item.requirement.title,
        description: item.requirement.description,
        category: item.requirement.category as any,
        severity: item.requirement.severity as any,
        isBlocking: item.requirement.isBlocking,
        remediationGuide: item.requirement.remediationGuide,
        externalUrl: item.requirement.externalUrl,
      },
      status: item.status as any,
      notes: item.notes,
      assignedToId: item.assignedToId,
      assignedToName: item.assignedTo?.name ?? null,
      dueDate: item.dueDate?.toISOString() ?? null,
      verifiedAt: item.verifiedAt?.toISOString() ?? null,
      verifiedById: item.verifiedById,
      verifiedByName: item.verifiedBy?.name ?? null,
      evidence: item.evidence.map((e) => ({
        id: e.id,
        title: e.title,
        type: e.type,
        url: e.url,
        description: e.description,
        uploadedById: e.uploadedById,
        uploadedByName: e.uploadedBy?.name ?? null,
        createdAt: e.createdAt.toISOString(),
      })),
    }));
  }

  async updateChecklistItem(
    actorId: string,
    actorEmail: string,
    itemId: string,
    data: {
      status: ComplianceChecklistStatus;
      notes?: string;
    },
  ): Promise<ComplianceChecklistItemView> {
    const existing = await this.prisma.complianceChecklistItem.findUnique({
      where: { id: itemId },
      include: { review: true },
    });
    if (!existing) throw new NotFoundException('Checklist item not found');

    const updated = await this.prisma.complianceChecklistItem.update({
      where: { id: itemId },
      data: {
        status: data.status as any,
        notes: data.notes,
        verifiedAt: data.status === 'PASSED' ? new Date() : undefined,
        verifiedById: data.status === 'PASSED' ? actorId : undefined,
      },
      include: {
        requirement: true,
        assignedTo: true,
        verifiedBy: true,
        evidence: true,
      },
    });

    // Recalculate review overall score
    const allItems = await this.prisma.complianceChecklistItem.findMany({
      where: { reviewId: existing.reviewId },
      include: { requirement: true },
    });

    let passed = 0;
    let failed = 0;
    let warning = 0;
    let blocked = 0;
    let notApplicable = 0;

    for (const i of allItems) {
      if (i.status === 'PASSED') passed++;
      else if (i.status === 'FAILED') {
        failed++;
        if (i.requirement.severity === 'CRITICAL' || i.requirement.isBlocking) blocked++;
      } else if (i.status === 'WARNING') warning++;
      else if (i.status === 'NOT_APPLICABLE') notApplicable++;
    }

    const totalEvaluable = allItems.length - notApplicable;
    const overallScore = totalEvaluable <= 0 ? 100 : Math.round((passed / totalEvaluable) * 100);

    let reviewStatus: ComplianceReviewStatus = 'IN_PROGRESS';
    if (blocked > 0 || failed > 0) reviewStatus = 'BLOCKED';
    else if (overallScore >= 95 && warning === 0) reviewStatus = 'READY_FOR_SUBMISSION';

    await this.prisma.complianceReview.update({
      where: { id: existing.reviewId },
      data: {
        overallScore,
        passedCount: passed,
        failedCount: failed,
        warningCount: warning,
        blockedCount: blocked,
        totalCount: allItems.length,
        status: reviewStatus,
      },
    });

    await this.logAudit({
      actorId,
      actorEmail,
      action: 'CHECKLIST_ITEM_UPDATED',
      targetType: 'CHECKLIST_ITEM',
      targetId: itemId,
      previousValue: { status: existing.status, notes: existing.notes },
      newValue: { status: updated.status, notes: updated.notes },
      reason: data.notes,
    });

    return {
      id: updated.id,
      reviewId: updated.reviewId,
      requirementId: updated.requirementId,
      requirement: {
        id: updated.requirement.id,
        code: updated.requirement.code,
        title: updated.requirement.title,
        description: updated.requirement.description,
        category: updated.requirement.category as any,
        severity: updated.requirement.severity as any,
        isBlocking: updated.requirement.isBlocking,
        remediationGuide: updated.requirement.remediationGuide,
        externalUrl: updated.requirement.externalUrl,
      },
      status: updated.status as any,
      notes: updated.notes,
      assignedToId: updated.assignedToId,
      assignedToName: updated.assignedTo?.name ?? null,
      dueDate: updated.dueDate?.toISOString() ?? null,
      verifiedAt: updated.verifiedAt?.toISOString() ?? null,
      verifiedById: updated.verifiedById,
      verifiedByName: updated.verifiedBy?.name ?? null,
      evidence: [],
    };
  }

  // ---------------------------------------------------------------------------
  // ISSUES & REJECTIONS
  // ---------------------------------------------------------------------------

  async listIssues(params?: {
    status?: string;
    severity?: string;
    platformId?: string;
    countryId?: string;
    q?: string;
  }): Promise<ComplianceIssueView[]> {
    const where: any = {};
    if (params?.status) where.status = params.status;
    if (params?.severity) where.severity = params.severity;
    if (params?.platformId) where.platformId = params.platformId;
    if (params?.countryId) where.countryId = params.countryId;
    if (params?.q) {
      where.OR = [
        { title: { contains: params.q, mode: 'insensitive' } },
        { description: { contains: params.q, mode: 'insensitive' } },
        { reviewerNotes: { contains: params.q, mode: 'insensitive' } },
      ];
    }

    const issues = await this.prisma.complianceIssue.findMany({
      where,
      include: {
        appVersion: true,
        platform: true,
        country: true,
        requirement: true,
        assignee: true,
        evidence: true,
      },
      orderBy: [{ severity: 'desc' }, { reportedAt: 'desc' }],
    });

    return issues.map((i) => ({
      id: i.id,
      title: i.title,
      description: i.description,
      category: i.category as any,
      severity: i.severity as any,
      status: i.status as any,
      source: i.source as any,
      reviewerNotes: i.reviewerNotes,
      remediation: i.remediation,
      resolution: i.resolution,
      appVersionId: i.appVersionId,
      appVersionString: i.appVersion?.version ?? null,
      platformId: i.platformId,
      platformCode: i.platform?.code ?? null,
      countryId: i.countryId,
      countryCode: i.country?.code ?? null,
      requirementId: i.requirementId,
      requirementCode: i.requirement?.code ?? null,
      reportedAt: i.reportedAt.toISOString(),
      resolvedAt: i.resolvedAt?.toISOString() ?? null,
      assigneeId: i.assigneeId,
      assigneeName: i.assignee?.name ?? null,
      evidence: i.evidence.map((e) => ({
        id: e.id,
        title: e.title,
        type: e.type,
        url: e.url,
        description: e.description,
        uploadedById: e.uploadedById,
        createdAt: e.createdAt.toISOString(),
      })),
    }));
  }

  async createIssue(
    actorEmail: string,
    data: {
      title: string;
      description: string;
      category: string;
      severity: string;
      source?: string;
      reviewerNotes?: string;
      remediation?: string;
      appVersionId?: string;
      platformId?: string;
      countryId?: string;
      requirementId?: string;
    },
  ): Promise<ComplianceIssueView> {
    const issue = await this.prisma.complianceIssue.create({
      data: {
        title: data.title,
        description: data.description,
        category: data.category as any,
        severity: data.severity as any,
        source: (data.source as any) ?? 'STORE_REVIEW',
        reviewerNotes: data.reviewerNotes,
        remediation: data.remediation,
        appVersionId: data.appVersionId,
        platformId: data.platformId,
        countryId: data.countryId,
        requirementId: data.requirementId,
      },
      include: {
        appVersion: true,
        platform: true,
        country: true,
        requirement: true,
        evidence: true,
      },
    });

    await this.logAudit({
      actorEmail,
      action: 'COMPLIANCE_ISSUE_CREATED',
      targetType: 'ISSUE',
      targetId: issue.id,
      platform: issue.platform?.code,
      country: issue.country?.code,
      version: issue.appVersion?.version,
      newValue: issue,
    });

    return {
      id: issue.id,
      title: issue.title,
      description: issue.description,
      category: issue.category as any,
      severity: issue.severity as any,
      status: issue.status as any,
      source: issue.source as any,
      reviewerNotes: issue.reviewerNotes,
      remediation: issue.remediation,
      resolution: issue.resolution,
      appVersionId: issue.appVersionId,
      appVersionString: issue.appVersion?.version ?? null,
      platformId: issue.platformId,
      platformCode: issue.platform?.code ?? null,
      countryId: issue.countryId,
      countryCode: issue.country?.code ?? null,
      requirementId: issue.requirementId,
      requirementCode: issue.requirement?.code ?? null,
      reportedAt: issue.reportedAt.toISOString(),
      resolvedAt: issue.resolvedAt?.toISOString() ?? null,
      assigneeId: issue.assigneeId,
      assigneeName: null,
      evidence: [],
    };
  }

  async updateIssue(
    actorEmail: string,
    id: string,
    data: {
      status?: string;
      remediation?: string;
      resolution?: string;
      reviewerNotes?: string;
      severity?: string;
    },
  ): Promise<ComplianceIssueView> {
    const existing = await this.prisma.complianceIssue.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Issue not found');

    const updated = await this.prisma.complianceIssue.update({
      where: { id },
      data: {
        status: data.status as any,
        remediation: data.remediation,
        resolution: data.resolution,
        reviewerNotes: data.reviewerNotes,
        severity: data.severity as any,
        resolvedAt: data.status === 'RESOLVED' || data.status === 'ACCEPTED' ? new Date() : undefined,
      },
      include: {
        appVersion: true,
        platform: true,
        country: true,
        requirement: true,
        assignee: true,
        evidence: true,
      },
    });

    await this.logAudit({
      actorEmail,
      action: 'COMPLIANCE_ISSUE_UPDATED',
      targetType: 'ISSUE',
      targetId: id,
      previousValue: existing,
      newValue: updated,
    });

    return {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      category: updated.category as any,
      severity: updated.severity as any,
      status: updated.status as any,
      source: updated.source as any,
      reviewerNotes: updated.reviewerNotes,
      remediation: updated.remediation,
      resolution: updated.resolution,
      appVersionId: updated.appVersionId,
      appVersionString: updated.appVersion?.version ?? null,
      platformId: updated.platformId,
      platformCode: updated.platform?.code ?? null,
      countryId: updated.countryId,
      countryCode: updated.country?.code ?? null,
      requirementId: updated.requirementId,
      requirementCode: updated.requirement?.code ?? null,
      reportedAt: updated.reportedAt.toISOString(),
      resolvedAt: updated.resolvedAt?.toISOString() ?? null,
      assigneeId: updated.assigneeId,
      assigneeName: updated.assignee?.name ?? null,
      evidence: [],
    };
  }

  // ---------------------------------------------------------------------------
  // EVIDENCE
  // ---------------------------------------------------------------------------

  async addEvidence(
    actorId: string,
    actorEmail: string,
    data: {
      title: string;
      type?: string;
      url: string;
      description?: string;
      requirementId?: string;
      checklistItemId?: string;
      issueId?: string;
    },
  ): Promise<ComplianceEvidenceView> {
    const evidence = await this.prisma.complianceEvidence.create({
      data: {
        title: data.title,
        type: data.type ?? 'DOCUMENT',
        url: data.url,
        description: data.description,
        requirementId: data.requirementId,
        checklistItemId: data.checklistItemId,
        issueId: data.issueId,
        uploadedById: actorId,
      },
      include: { uploadedBy: true },
    });

    await this.logAudit({
      actorId,
      actorEmail,
      action: 'EVIDENCE_ATTACHED',
      targetType: 'EVIDENCE',
      targetId: evidence.id,
      newValue: evidence,
    });

    return {
      id: evidence.id,
      title: evidence.title,
      type: evidence.type,
      url: evidence.url,
      description: evidence.description,
      uploadedById: evidence.uploadedById,
      uploadedByName: evidence.uploadedBy?.name ?? null,
      createdAt: evidence.createdAt.toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // RELEASE GATE & OVERRIDE
  // ---------------------------------------------------------------------------

  async evaluateReleaseGate(reviewId: string): Promise<{
    isBlocked: boolean;
    reasons: string[];
    readinessScore: ComplianceReadinessScore;
  }> {
    const review = await this.prisma.complianceReview.findUnique({
      where: { id: reviewId },
      include: {
        appVersion: true,
        checklistItems: { include: { requirement: true } },
      },
    });
    if (!review) throw new NotFoundException('Review not found');

    const checklistStatusMap: Record<string, ComplianceChecklistStatus> = {};
    for (const item of review.checklistItems) {
      checklistStatusMap[item.requirementId] = item.status as any;
    }

    const allRequirements = await this.listRequirements();
    const evalResult = this.ruleEngine.evaluate(
      allRequirements,
      {
        platform: review.platformId,
        version: review.appVersion.version,
      },
      checklistStatusMap,
    );

    // Also check open critical issues for this version
    const criticalIssues = await this.prisma.complianceIssue.findMany({
      where: {
        appVersionId: review.appVersionId,
        severity: 'CRITICAL',
        status: { notIn: ['RESOLVED', 'ACCEPTED'] },
      },
    });

    const reasons = [...evalResult.score.blockingReasons];
    for (const issue of criticalIssues) {
      reasons.push(`[UNRESOLVED REJECTION] ${issue.title}`);
    }

    const isBlocked = reasons.length > 0;

    return {
      isBlocked,
      reasons,
      readinessScore: evalResult.score,
    };
  }

  async overrideRelease(
    adminId: string,
    adminEmail: string,
    reviewId: string,
    data: {
      reason: string;
      newStatus: ComplianceReviewStatus;
    },
  ): Promise<ComplianceReleaseOverrideView> {
    if (!data.reason || data.reason.trim().length < 10) {
      throw new BadRequestException('A valid reason of at least 10 characters is required for an override');
    }

    const review = await this.prisma.complianceReview.findUnique({
      where: { id: reviewId },
      include: { appVersion: true, platform: true },
    });
    if (!review) throw new NotFoundException('Review not found');

    const override = await this.prisma.complianceReleaseOverride.create({
      data: {
        reviewId,
        adminId,
        reason: data.reason,
        previousStatus: review.status,
        newStatus: data.newStatus,
      },
      include: { admin: true },
    });

    await this.prisma.complianceReview.update({
      where: { id: reviewId },
      data: { status: data.newStatus },
    });

    await this.logAudit({
      actorId: adminId,
      actorEmail,
      action: 'RELEASE_GATE_OVERRIDDEN',
      targetType: 'REVIEW',
      targetId: reviewId,
      platform: review.platform.code,
      version: review.appVersion.version,
      reason: data.reason,
      previousValue: { status: review.status },
      newValue: { status: data.newStatus },
    });

    return {
      id: override.id,
      reviewId: override.reviewId,
      adminId: override.adminId,
      adminEmail: override.admin.email,
      reason: override.reason,
      previousStatus: override.previousStatus as any,
      newStatus: override.newStatus as any,
      overriddenIssues: [],
      createdAt: override.createdAt.toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // LEGAL & POLICY LINKS
  // ---------------------------------------------------------------------------

  async getLegalLinks(): Promise<ComplianceLegalLinkView[]> {
    const links = await this.prisma.complianceLegalLink.findMany({
      orderBy: { key: 'asc' },
    });

    return links.map((l) => ({
      id: l.id,
      key: l.key,
      title: l.title,
      url: l.url,
      contentMarkdown: l.contentMarkdown,
      countryCode: l.countryCode,
      platformCode: l.platformCode,
      lastVerifiedAt: l.lastVerifiedAt.toISOString(),
    }));
  }

  async updateLegalLink(
    actorEmail: string,
    data: {
      key: string;
      title: string;
      url: string;
      contentMarkdown?: string;
      countryCode?: string;
      platformCode?: string;
    },
  ): Promise<ComplianceLegalLinkView> {
    const existing = await this.prisma.complianceLegalLink.findFirst({
      where: {
        key: data.key,
        countryCode: data.countryCode ?? null,
        platformCode: data.platformCode ?? null,
      },
    });

    const upserted = existing
      ? await this.prisma.complianceLegalLink.update({
          where: { id: existing.id },
          data: {
            title: data.title,
            url: data.url,
            contentMarkdown: data.contentMarkdown,
            lastVerifiedAt: new Date(),
          },
        })
      : await this.prisma.complianceLegalLink.create({
          data: {
            key: data.key,
            title: data.title,
            url: data.url,
            contentMarkdown: data.contentMarkdown,
            countryCode: data.countryCode,
            platformCode: data.platformCode,
          },
        });

    await this.logAudit({
      actorEmail,
      action: 'LEGAL_LINK_UPDATED',
      targetType: 'LEGAL_LINK',
      targetId: upserted.id,
      newValue: upserted,
    });

    return {
      id: upserted.id,
      key: upserted.key,
      title: upserted.title,
      url: upserted.url,
      contentMarkdown: upserted.contentMarkdown,
      countryCode: upserted.countryCode,
      platformCode: upserted.platformCode,
      lastVerifiedAt: upserted.lastVerifiedAt.toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // AUDIT LOGS
  // ---------------------------------------------------------------------------

  async listAuditLogs(
    page = 1,
    pageSize = 25,
    filters?: { action?: string; targetType?: string },
  ): Promise<AdminPage<ComplianceAuditLogView>> {
    const skip = (page - 1) * pageSize;
    const where: any = {};
    if (filters?.action) where.action = filters.action;
    if (filters?.targetType) where.targetType = filters.targetType;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.complianceAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.complianceAuditLog.count({ where }),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        actorId: r.actorId,
        actorEmail: r.actorEmail,
        action: r.action,
        targetType: r.targetType,
        targetId: r.targetId,
        previousValue: r.previousValue,
        newValue: r.newValue,
        platform: r.platform,
        country: r.country,
        version: r.version,
        reason: r.reason,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  // ---------------------------------------------------------------------------
  // SEED INITIAL GUIDELINES & PLATFORMS
  // ---------------------------------------------------------------------------

  private async seedOfficialGuidelines() {
    const regionCount = await this.prisma.complianceRegion.count();
    if (regionCount > 0) return;

    this.logger.log('Seeding compliance regions, platforms, and official guidelines...');

    // 1. Regions
    const globalReg = await this.prisma.complianceRegion.create({
      data: { code: 'GLOBAL', name: 'Global', description: 'Universal platform baseline' },
    });
    const apacReg = await this.prisma.complianceRegion.create({
      data: { code: 'APAC', name: 'Asia Pacific', description: 'APAC region compliance' },
    });
    const emeaReg = await this.prisma.complianceRegion.create({
      data: { code: 'EMEA', name: 'Europe, Middle East, Africa', description: 'EU/GDPR jurisdiction' },
    });
    const naReg = await this.prisma.complianceRegion.create({
      data: { code: 'NA', name: 'North America', description: 'US & Canada compliance' },
    });

    // 2. Countries
    const inCountry = await this.prisma.complianceCountry.create({
      data: { code: 'IN', name: 'India', regionId: apacReg.id },
    });
    const usCountry = await this.prisma.complianceCountry.create({
      data: { code: 'US', name: 'United States', regionId: naReg.id },
    });
    const deCountry = await this.prisma.complianceCountry.create({
      data: { code: 'DE', name: 'Germany (EU)', regionId: emeaReg.id },
    });
    const gbCountry = await this.prisma.complianceCountry.create({
      data: { code: 'GB', name: 'United Kingdom', regionId: emeaReg.id },
    });
    const jpCountry = await this.prisma.complianceCountry.create({
      data: { code: 'JP', name: 'Japan', regionId: apacReg.id },
    });

    // 3. Platforms
    const webPlat = await this.prisma.compliancePlatform.create({
      data: {
        code: 'web',
        name: 'Web Application',
        type: 'WEB',
        currentVersion: '2026.09.1',
        minSupportedVersion: '2026.01.0',
      },
    });
    const winPlat = await this.prisma.compliancePlatform.create({
      data: {
        code: 'windows',
        name: 'Windows Desktop',
        type: 'DESKTOP',
        currentVersion: 'v2.5.0',
        minSupportedVersion: 'v2.0.0',
      },
    });
    const macPlat = await this.prisma.compliancePlatform.create({
      data: {
        code: 'macos',
        name: 'macOS Desktop',
        type: 'DESKTOP',
        currentVersion: 'v2.5.0',
        minSupportedVersion: 'v2.0.0',
      },
    });
    const linuxPlat = await this.prisma.compliancePlatform.create({
      data: {
        code: 'linux',
        name: 'Linux Desktop',
        type: 'DESKTOP',
        currentVersion: 'v2.5.0',
        minSupportedVersion: 'v2.0.0',
      },
    });

    // 4. Distributions
    await this.prisma.complianceDistribution.create({
      data: { code: 'web', name: 'Production Web', platformId: webPlat.id },
    });
    const winDirect = await this.prisma.complianceDistribution.create({
      data: { code: 'direct-win', name: 'Windows Direct (NSIS)', platformId: winPlat.id },
    });
    const msStore = await this.prisma.complianceDistribution.create({
      data: { code: 'microsoft-store', name: 'Microsoft Store', platformId: winPlat.id },
    });
    const macDirect = await this.prisma.complianceDistribution.create({
      data: { code: 'direct-mac', name: 'macOS Direct (DMG/ZIP Notarized)', platformId: macPlat.id },
    });
    const macStore = await this.prisma.complianceDistribution.create({
      data: { code: 'mac-app-store', name: 'Mac App Store (MAS)', platformId: macPlat.id },
    });

    // 5. Initial App Versions
    const webVersion = await this.prisma.complianceAppVersion.create({
      data: {
        platformId: webPlat.id,
        version: '2026.09.1',
        isCurrent: true,
        status: 'APPROVED',
        changelog: 'Production web release with unified compliance checks.',
      },
    });
    const winVersion = await this.prisma.complianceAppVersion.create({
      data: {
        platformId: winPlat.id,
        version: 'v2.5.0',
        isCurrent: true,
        status: 'READY_FOR_SUBMISSION',
        changelog: 'Desktop v2.5.0 featuring Windows Store compatibility.',
      },
    });
    const macVersion = await this.prisma.complianceAppVersion.create({
      data: {
        platformId: macPlat.id,
        version: 'v2.5.0',
        isCurrent: true,
        status: 'IN_PROGRESS',
        changelog: 'Desktop v2.5.0 macOS build.',
      },
    });

    // 6. Policies (Authoritative Guidelines)
    const gdprPolicy = await this.prisma.compliancePolicy.create({
      data: {
        code: 'EU-GDPR',
        name: 'EU General Data Protection Regulation',
        version: '2016/679',
        externalGuidelineRef: 'Regulation (EU) 2016/679 (GDPR)',
        externalGuidelineUrl: 'https://gdpr-info.eu/',
      },
    });
    const dpdpPolicy = await this.prisma.compliancePolicy.create({
      data: {
        code: 'IN-DPDP-2023',
        name: 'India Digital Personal Data Protection Act',
        version: '2023',
        externalGuidelineRef: 'DPDP Act 2023, Ministry of Electronics & IT',
        externalGuidelineUrl: 'https://www.meity.gov.in/',
      },
    });
    const ccpaPolicy = await this.prisma.compliancePolicy.create({
      data: {
        code: 'US-CCPA',
        name: 'California Consumer Privacy Act (CCPA/CPRA)',
        version: '2023',
        externalGuidelineRef: 'Cal. Civ. Code § 1798.100',
      },
    });
    const applePolicy = await this.prisma.compliancePolicy.create({
      data: {
        code: 'APPLE-STORE-GUIDELINES',
        name: 'Apple App Store Review Guidelines',
        version: '2026-Q1',
        externalGuidelineRef: 'App Store Review Guidelines 5.1 & 2.4.5',
        externalGuidelineUrl: 'https://developer.apple.com/app-store/review/guidelines/',
      },
    });
    const msPolicy = await this.prisma.compliancePolicy.create({
      data: {
        code: 'MS-STORE-POLICIES',
        name: 'Microsoft Store Policies',
        version: '10.0',
        externalGuidelineRef: 'Microsoft Store Policies 10.1, 10.5, 10.13',
        externalGuidelineUrl: 'https://learn.microsoft.com/en-us/windows/apps/publish/store-policies',
      },
    });

    // 7. Seed Core Requirements
    // 7.1 Universal In-App Account Deletion (Apple 5.1.1(v) & MS Store 10.13 & GDPR Art. 17)
    const reqDelete = await this.prisma.complianceRequirement.create({
      data: {
        code: 'REQ-ACCOUNT-DELETION',
        title: 'In-App Account Deletion Capability',
        description:
          'If the app supports account creation, it must provide a clear, direct, in-app mechanism to initiate account deletion and purge personal data.',
        category: 'ACCOUNT_DELETION',
        severity: 'CRITICAL',
        isBlocking: true,
        defaultStatus: 'PASSED',
        policyId: applePolicy.id,
        remediationGuide:
          'Provide a "Delete Account" button in user settings that initiates complete data erasure or 30-day revocation flow.',
        externalUrl: 'https://developer.apple.com/support/offering-account-deletion-in-your-app/',
      },
    });

    // 7.2 India DPDP Act Grievance Redressal Officer
    const reqDPDP = await this.prisma.complianceRequirement.create({
      data: {
        code: 'REQ-IN-GRIEVANCE-OFFICER',
        title: 'India DPDP: Published Grievance Redressal Officer Details',
        description:
          'For users in India, the entity must publish contact information (name, email, postal address) of a designated Grievance Officer on web and in-app legal notices.',
        category: 'REGIONAL_LEGAL',
        severity: 'HIGH',
        isBlocking: false,
        defaultStatus: 'PASSED',
        policyId: dpdpPolicy.id,
        remediationGuide:
          'Include contact details of the Grievance Redressal Officer in Privacy Policy and Terms of Service.',
      },
    });
    // Scope to India
    await this.prisma.complianceRequirementScope.create({
      data: {
        requirementId: reqDPDP.id,
        countryId: inCountry.id,
      },
    });

    // 7.3 EU GDPR Cookie & Consent Banner
    const reqCookie = await this.prisma.complianceRequirement.create({
      data: {
        code: 'REQ-EU-COOKIE-CONSENT',
        title: 'EU GDPR: Prior Consent for Non-Essential Cookies & Tracking',
        description:
          'Must not set non-essential cookies or analytics beacons prior to affirmative opt-in consent for visitors in the EU.',
        category: 'USER_CONSENT',
        severity: 'HIGH',
        isBlocking: true,
        defaultStatus: 'PASSED',
        policyId: gdprPolicy.id,
        remediationGuide:
          'Block telemetry/third-party scripts until the user clicks "Accept All" or customizes preferences.',
      },
    });
    // Scope to EU & Web
    await this.prisma.complianceRequirementScope.create({
      data: {
        requirementId: reqCookie.id,
        regionId: emeaReg.id,
        platformId: webPlat.id,
      },
    });

    // 7.4 macOS Mac App Store Sandbox Entitlement (Apple Guideline 2.4.5)
    const reqSandbox = await this.prisma.complianceRequirement.create({
      data: {
        code: 'REQ-MAC-APP-SANDBOX',
        title: 'macOS: App Sandbox Entitlement (com.apple.security.app-sandbox)',
        description:
          'All macOS apps distributed via the Mac App Store must be sandboxed using the com.apple.security.app-sandbox entitlement. Arbitrary filesystem access is forbidden.',
        category: 'SECURITY',
        severity: 'CRITICAL',
        isBlocking: true,
        defaultStatus: 'WARNING',
        policyId: applePolicy.id,
        remediationGuide:
          'Enable App Sandbox in entitlements.mac.plist and verify native dialogs, IPC, and deep links function under sandbox.',
        externalUrl: 'https://developer.apple.com/documentation/security/app_sandbox',
      },
    });
    // Scope to Mac App Store distribution
    await this.prisma.complianceRequirementScope.create({
      data: {
        requirementId: reqSandbox.id,
        platformId: macPlat.id,
        distributionId: macStore.id,
      },
    });

    // 7.5 Mac App Store Prohibits Auto-Updater (Guideline 2.1)
    const reqNoUpdater = await this.prisma.complianceRequirement.create({
      data: {
        code: 'REQ-MAS-NO-EXTERNAL-UPDATER',
        title: 'Mac App Store: Disable electron-updater / In-App Binary Updates',
        description:
          'Mac App Store builds must not include an internal auto-updater mechanism (e.g. electron-updater). All app updates must be delivered exclusively through the App Store.',
        category: 'PLATFORM',
        severity: 'CRITICAL',
        isBlocking: true,
        defaultStatus: 'PASSED',
        policyId: applePolicy.id,
        remediationGuide:
          'Disable electron-updater when process.mas is true and hide update check buttons.',
      },
    });
    await this.prisma.complianceRequirementScope.create({
      data: {
        requirementId: reqNoUpdater.id,
        platformId: macPlat.id,
        distributionId: macStore.id,
      },
    });

    // 7.6 Microsoft Store: Valid Privacy Policy URL in Listing & App (Policy 10.5)
    const reqMSPrivacy = await this.prisma.complianceRequirement.create({
      data: {
        code: 'REQ-MS-STORE-PRIVACY-LINK',
        title: 'Microsoft Store: Conspicuous Privacy Policy Link (Policy 10.5)',
        description:
          'Must provide a prominent link to a valid privacy policy within the application settings as well as in the Store product listing metadata.',
        category: 'PRIVACY',
        severity: 'HIGH',
        isBlocking: true,
        defaultStatus: 'PASSED',
        policyId: msPolicy.id,
      },
    });
    await this.prisma.complianceRequirementScope.create({
      data: {
        requirementId: reqMSPrivacy.id,
        platformId: winPlat.id,
        distributionId: msStore.id,
      },
    });

    // 7.7 Windows Direct: Authenticode EV Code Signing & SmartScreen Reputation
    const reqWinSigning = await this.prisma.complianceRequirement.create({
      data: {
        code: 'REQ-WIN-DIRECT-CODE-SIGNING',
        title: 'Windows Direct: Authenticode Code Signing & Safe Uninstaller',
        description:
          'Direct Windows executables must be signed with a valid Authenticode certificate to prevent SmartScreen untrusted warnings, and cleanly register an uninstaller in Control Panel.',
        category: 'SECURITY',
        severity: 'HIGH',
        isBlocking: false,
        defaultStatus: 'PASSED',
      },
    });
    await this.prisma.complianceRequirementScope.create({
      data: {
        requirementId: reqWinSigning.id,
        platformId: winPlat.id,
        distributionId: winDirect.id,
      },
    });

    // 7.8 US CCPA "Do Not Sell/Share My Personal Information" Link
    const reqCCPA = await this.prisma.complianceRequirement.create({
      data: {
        code: 'REQ-US-CCPA-OPTOUT',
        title: 'US CCPA/CPRA: "Do Not Sell or Share My Personal Info" Notice',
        description:
          'For residents of California/US, provide a clear opt-out choice regarding personal information sharing and targeted advertising.',
        category: 'PRIVACY',
        severity: 'MEDIUM',
        isBlocking: false,
        defaultStatus: 'PASSED',
        policyId: ccpaPolicy.id,
      },
    });
    await this.prisma.complianceRequirementScope.create({
      data: {
        requirementId: reqCCPA.id,
        countryId: usCountry.id,
      },
    });

    // 8. Legal Links
    await this.prisma.complianceLegalLink.create({
      data: {
        key: 'privacy_policy',
        title: 'Privacy Policy',
        url: 'https://onetab.ai/privacy',
        contentMarkdown: '# Privacy Policy\n\nOneTab AI respects user privacy and secures data.',
      },
    });
    await this.prisma.complianceLegalLink.create({
      data: {
        key: 'terms_of_service',
        title: 'Terms of Service',
        url: 'https://onetab.ai/terms',
        contentMarkdown: '# Terms of Service\n\nStandard platform terms and conditions.',
      },
    });
    await this.prisma.complianceLegalLink.create({
      data: {
        key: 'account_deletion',
        title: 'Account Deletion & Data Purge',
        url: 'https://onetab.ai/settings/account/delete',
        contentMarkdown: '# Account Deletion\n\nUsers can permanently delete their account.',
      },
    });
    await this.prisma.complianceLegalLink.create({
      data: {
        key: 'cookie_policy',
        title: 'Cookie & Tracking Policy',
        url: 'https://onetab.ai/cookies',
      },
    });
    await this.prisma.complianceLegalLink.create({
      data: {
        key: 'support_url',
        title: 'Customer & Technical Support',
        url: 'https://onetab.ai/support',
      },
    });

    // 9. Initial Reviews
    const winReview = await this.prisma.complianceReview.create({
      data: {
        appVersionId: winVersion.id,
        platformId: winPlat.id,
        distributionId: msStore.id,
        countryId: usCountry.id,
        status: 'READY_FOR_SUBMISSION',
        overallScore: 92,
        passedCount: 6,
        failedCount: 0,
        warningCount: 1,
        blockedCount: 0,
        totalCount: 7,
        summary: 'Windows Desktop v2.5.0 pre-submission review.',
      },
    });

    await this.prisma.complianceChecklistItem.create({
      data: {
        reviewId: winReview.id,
        requirementId: reqDelete.id,
        status: 'PASSED',
        notes: 'In-app account deletion verified on Windows client.',
      },
    });
    await this.prisma.complianceChecklistItem.create({
      data: {
        reviewId: winReview.id,
        requirementId: reqMSPrivacy.id,
        status: 'PASSED',
        notes: 'Privacy link embedded in Settings and manifest.',
      },
    });

    const macReview = await this.prisma.complianceReview.create({
      data: {
        appVersionId: macVersion.id,
        platformId: macPlat.id,
        distributionId: macStore.id,
        status: 'BLOCKED',
        overallScore: 68,
        passedCount: 3,
        failedCount: 1,
        warningCount: 1,
        blockedCount: 1,
        totalCount: 5,
        summary: 'macOS v2.5.0 review - App Sandbox entitlement pending.',
      },
    });

    await this.prisma.complianceChecklistItem.create({
      data: {
        reviewId: macReview.id,
        requirementId: reqSandbox.id,
        status: 'FAILED',
        notes: 'com.apple.security.app-sandbox not declared in entitlements.mac.plist.',
      },
    });

    // 10. Sample Issue
    await this.prisma.complianceIssue.create({
      data: {
        title: 'Mac App Store: Missing com.apple.security.app-sandbox Entitlement',
        description:
          'Review of apps/desktop/resources/entitlements.mac.plist found that the mandatory App Sandbox entitlement is missing.',
        category: 'SECURITY',
        severity: 'CRITICAL',
        status: 'OPEN',
        source: 'INTERNAL_AUDIT',
        reviewerNotes: 'Required before MAS submission can pass review.',
        remediation: 'Enable app sandbox and verify all file dialog and IPC operations.',
        appVersionId: macVersion.id,
        platformId: macPlat.id,
        requirementId: reqSandbox.id,
      },
    });

    this.logger.log('Compliance seeding completed successfully.');
  }
}
