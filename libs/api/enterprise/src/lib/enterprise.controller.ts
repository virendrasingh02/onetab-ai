import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SystemRoleGuard } from '@org/api-auth';
import { SystemRoles } from '@org/api-common';
import { SystemRole } from '@org/types';
import { EnterpriseService } from './enterprise.service.js';
import { SCIMService, type SCIMUserPayload } from './scim.service.js';

/**
 * Platform-operator administration.
 *
 * Nothing in the schema links an `Organization` to a user or workspace, so
 * there is no per-tenant membership to authorise against — the only correct
 * gate available is the platform role. Previously these sat behind
 * `JwtAuthGuard` alone, which meant any signed-in account could read any
 * organisation, rewrite its SSO configuration, read its audit log, and list
 * every user on the platform through SCIM.
 *
 * If organisations later gain members, this should become a membership guard
 * in the shape of `WorkspaceRoleGuard` rather than staying operator-only.
 */
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

  @Post('organizations/:id/sso')
  configureSSO(
    @Param('id') orgId: string,
    @Body()
    body: {
      providerType: string;
      idpEntityId?: string;
      ssoUrl?: string;
      certificate?: string;
    },
  ) {
    return this.enterpriseService.configureSSO(orgId, body);
  }

  @Get('organizations/:id/audit-logs')
  getAuditLogs(@Param('id') orgId: string) {
    return this.enterpriseService.getAuditLogs(orgId);
  }

  /**
   * SCIM 2.0 directory sync.
   *
   * Operator-gated for now. A real deployment authenticates the IdP with the
   * per-organisation `SSOConfig.scimToken` instead of a user session — these
   * are machine-to-machine endpoints and no browser should reach them.
   */
  @Get('scim/v2/Users')
  scimListUsers() {
    return this.scimService.listUsers();
  }

  @Post('scim/v2/Users')
  scimProvisionUser(@Body() body: SCIMUserPayload) {
    return this.scimService.provisionUser(body);
  }
}
