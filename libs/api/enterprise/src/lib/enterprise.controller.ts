import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { SystemRoleGuard } from '@org/api-auth';
import { CurrentUser, SystemRoles, type AuthenticatedUser } from '@org/api-common';
import { SystemRole } from '@org/types';
import type { SaveSSOConfigInput } from '@org/types';
import type { Request } from 'express';
import { EnterpriseService } from './enterprise.service.js';
import { SCIMService } from './scim.service.js';

@Controller({ path: 'enterprise', version: '1' })
@UseGuards(SystemRoleGuard)
@SystemRoles(SystemRole.SUPERADMIN)
export class EnterpriseController {
  constructor(
    private readonly enterpriseService: EnterpriseService,
    private readonly scimService: SCIMService,
  ) {}

  @Get('organizations/:id')
  getOrganization(@Param('id') id: string) {
    return this.enterpriseService.getOrganization(id);
  }

  @Post('organizations')
  createOrganization(
    @Body() body: { name: string; domain: string; billingEmail?: string },
  ) {
    return this.enterpriseService.createOrganization(body);
  }

  @Get('organizations/:id/sso')
  getSSOConfig(@Param('id') orgId: string) {
    return this.enterpriseService.getSSOConfig(orgId);
  }

  @Post('organizations/:id/sso')
  configureSSO(
    @Param('id') orgId: string,
    @Body() body: SaveSSOConfigInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.enterpriseService.configureSSO(orgId, body, user.email);
  }

  @Post('organizations/:id/sso/test-connection')
  testConnection(@Param('id') orgId: string) {
    return this.enterpriseService.testConnection(orgId);
  }

  @Post('organizations/:id/sso/rotate-scim-token')
  rotateScimToken(
    @Param('id') orgId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.enterpriseService.rotateScimToken(orgId, user.email);
  }

  @Get('organizations/:id/domains')
  getDomains(@Param('id') orgId: string) {
    return this.enterpriseService.getDomainVerificationDetails(orgId);
  }

  @Post('organizations/:id/domains/:domain/verify')
  verifyDomain(
    @Param('id') orgId: string,
    @Param('domain') domain: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.enterpriseService.verifyDomain(orgId, domain, user.email);
  }

  @Get('organizations/:id/audit-logs')
  getAuditLogs(@Param('id') orgId: string) {
    return this.enterpriseService.getAuditLogs(orgId);
  }

  /**
   * Superadmin operator view for listing organization SCIM users.
   */
  @Get('organizations/:id/scim/users')
  scimListUsers(
    @Param('id') orgId: string,
    @Query('filter') filter: string | undefined,
    @Query('startIndex') startIndex: string | undefined,
    @Query('count') count: string | undefined,
    @Req() req: Request,
  ) {
    const baseUrl = `${req.protocol}://${req.get('host')}/api/v1/scim/v2`;
    return this.scimService.listUsers(
      orgId,
      {
        filter,
        startIndex: startIndex ? parseInt(startIndex, 10) : undefined,
        count: count ? parseInt(count, 10) : undefined,
      },
      baseUrl,
    );
  }
}
