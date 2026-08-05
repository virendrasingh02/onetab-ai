import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@org/api-auth';
import { EnterpriseService } from './enterprise.service.js';
import { SCIMService, type SCIMUserPayload } from './scim.service.js';

@Controller('enterprise')
@UseGuards(JwtAuthGuard)
export class EnterpriseController {
  constructor(
    private readonly enterpriseService: EnterpriseService,
    private readonly scimService: SCIMService
  ) {}

  @Get('organizations/:id')
  getOrganization(@Param('id') id: string) {
    return this.enterpriseService.getOrganization(id);
  }

  @Post('organizations')
  createOrganization(@Body() body: { name: string; domain: string; billingEmail?: string }) {
    return this.enterpriseService.createOrganization(body);
  }

  @Post('organizations/:id/sso')
  configureSSO(
    @Param('id') orgId: string,
    @Body() body: { providerType: string; idpEntityId?: string; ssoUrl?: string; certificate?: string }
  ) {
    return this.enterpriseService.configureSSO(orgId, body);
  }

  @Get('organizations/:id/audit-logs')
  getAuditLogs(@Param('id') orgId: string) {
    return this.enterpriseService.getAuditLogs(orgId);
  }

  // SCIM 2.0 Endpoints
  @Get('scim/v2/Users')
  scimListUsers() {
    return this.scimService.listUsers();
  }

  @Post('scim/v2/Users')
  scimProvisionUser(@Body() body: SCIMUserPayload) {
    return this.scimService.provisionUser(body);
  }
}
