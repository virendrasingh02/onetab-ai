import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@org/database';
import { randomBytes } from 'node:crypto';

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

  /**
   * Saves an organisation's identity-provider binding.
   *
   * One configuration per organisation: this used to `create` unconditionally,
   * so every save from the console left another row behind and `ssoConfigs`
   * grew a new entry each time somebody corrected a typo in the SSO URL. There
   * is no unique index to upsert against — the column set predates this — so
   * the existing row is looked up and updated.
   *
   * The SCIM token is minted once and preserved across saves: rotating it as a
   * side effect of editing the sign-on URL would silently break provisioning at
   * the IdP.
   */
  async configureSSO(
    orgId: string,
    data: {
      providerType: string;
      idpEntityId?: string;
      ssoUrl?: string;
      certificate?: string;
    },
  ) {
    const existing = await this.prisma.sSOConfig.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'asc' },
    });

    if (existing) {
      return this.prisma.sSOConfig.update({
        where: { id: existing.id },
        data: {
          providerType: data.providerType,
          idpEntityId: data.idpEntityId ?? null,
          ssoUrl: data.ssoUrl ?? null,
          certificate: data.certificate ?? null,
          scimToken: existing.scimToken ?? this.mintScimToken(),
        },
      });
    }

    return this.prisma.sSOConfig.create({
      data: {
        organizationId: orgId,
        providerType: data.providerType,
        idpEntityId: data.idpEntityId,
        ssoUrl: data.ssoUrl,
        certificate: data.certificate,
        scimToken: this.mintScimToken(),
      },
    });
  }

  /** Rotates the SCIM bearer, invalidating whatever the IdP holds. */
  async rotateScimToken(orgId: string) {
    const existing = await this.prisma.sSOConfig.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'asc' },
    });

    if (!existing) {
      throw new NotFoundException('This organisation has no SSO configuration.');
    }

    return this.prisma.sSOConfig.update({
      where: { id: existing.id },
      data: { scimToken: this.mintScimToken() },
    });
  }

  /**
   * A token with real entropy.
   *
   * The old value was `scim_live_${Date.now()}` — guessable to the millisecond
   * from the row's own `createdAt`, which the console displays.
   */
  private mintScimToken(): string {
    return `scim_live_${randomBytes(24).toString('hex')}`;
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
