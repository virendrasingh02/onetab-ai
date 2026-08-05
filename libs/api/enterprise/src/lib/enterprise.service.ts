import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/database';

@Injectable()
export class EnterpriseService {
  private readonly logger = new Logger(EnterpriseService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getOrganization(orgId: string) {
    return this.prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      include: {
        departments: true,
        ssoConfigs: true,
        subscriptions: true,
        _count: { select: { auditLogs: true } },
      },
    });
  }

  async createOrganization(data: { name: string; domain: string; billingEmail?: string }) {
    const org = await this.prisma.organization.create({
      data: {
        name: data.name,
        domain: data.domain,
        billingEmail: data.billingEmail,
        departments: {
          create: [{ name: 'Engineering', code: 'ENG' }, { name: 'Product & Design', code: 'PROD' }],
        },
        subscriptions: {
          create: { planTier: 'ENTERPRISE', seatsTotal: 100, seatsUsed: 5 },
        },
      },
    });
    this.logger.log(`Created enterprise organization '${org.name}' (${org.id})`);
    return org;
  }

  async configureSSO(orgId: string, data: { providerType: string; idpEntityId?: string; ssoUrl?: string; certificate?: string }) {
    return this.prisma.sSOConfig.create({
      data: {
        organizationId: orgId,
        providerType: data.providerType,
        idpEntityId: data.idpEntityId,
        ssoUrl: data.ssoUrl,
        certificate: data.certificate,
        scimToken: `scim_live_${Date.now()}`,
      },
    });
  }

  async logAuditEvent(orgId: string, actorEmail: string, action: string, targetResource: string, details: Record<string, unknown> = {}) {
    return this.prisma.enterpriseAuditLog.create({
      data: {
        organizationId: orgId,
        actorEmail,
        action,
        targetResource,
        details: JSON.stringify(details),
      },
    });
  }

  async getAuditLogs(orgId: string) {
    return this.prisma.enterpriseAuditLog.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
