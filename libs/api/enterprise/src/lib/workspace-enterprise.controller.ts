import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import {
  CurrentUser,
  RequirePlanFeature,
  WorkspaceRoles,
  type AuthenticatedUser,
} from '@org/api-common';
import { WorkspaceRole } from '@org/types';
import type {
  DomainVerificationDto,
  EnterpriseSSOConfigDto,
  GenerateRecoveryCodeResponse,
  RotateScimTokenResponse,
  SSOGroupRoleMappingDto,
} from '@org/types';
import {
  domainInputSchema,
  saveGroupRoleMappingSchema,
  saveSSOConfigSchema,
} from '@org/validation';
import { EnterpriseService } from './enterprise.service.js';

@Controller({ path: 'workspaces/:workspaceId/enterprise/identity', version: '1' })
@UseGuards(WorkspaceRoleGuard)
@WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.OWNER)
@RequirePlanFeature('sso_saml')
export class WorkspaceEnterpriseController {
  constructor(private readonly enterpriseService: EnterpriseService) {}

  @Get()
  async getIdentityOverview(
    @Param('workspaceId') workspaceId: string,
  ): Promise<{
    sso: EnterpriseSSOConfigDto;
    domains: DomainVerificationDto[];
    groupMappings: SSOGroupRoleMappingDto[];
  }> {
    const orgId = await this.enterpriseService.ensureOrganizationForWorkspace(workspaceId);
    const [sso, domains, groupMappings] = await Promise.all([
      this.enterpriseService.getSSOConfig(orgId),
      this.enterpriseService.getDomainVerificationDetails(orgId),
      this.enterpriseService.getGroupRoleMappings(orgId),
    ]);

    return { sso, domains, groupMappings };
  }

  @Put('sso')
  async configureSSO(
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EnterpriseSSOConfigDto> {
    const input = saveSSOConfigSchema.parse(body);
    const orgId = await this.enterpriseService.ensureOrganizationForWorkspace(workspaceId);
    return this.enterpriseService.configureSSO(orgId, input, user.email);
  }

  @Post('test-connection')
  async testConnection(@Param('workspaceId') workspaceId: string) {
    const orgId = await this.enterpriseService.ensureOrganizationForWorkspace(workspaceId);
    return this.enterpriseService.testConnection(orgId);
  }

  @Get('domains')
  async getDomains(@Param('workspaceId') workspaceId: string): Promise<DomainVerificationDto[]> {
    const orgId = await this.enterpriseService.ensureOrganizationForWorkspace(workspaceId);
    return this.enterpriseService.getDomainVerificationDetails(orgId);
  }

  @Post('domains')
  async addDomain(
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DomainVerificationDto> {
    const { domain } = domainInputSchema.parse(body);
    const orgId = await this.enterpriseService.ensureOrganizationForWorkspace(workspaceId);
    return this.enterpriseService.addDomain(orgId, domain, user.email);
  }

  @Post('domains/:domain/verify')
  async verifyDomain(
    @Param('workspaceId') workspaceId: string,
    @Param('domain') domain: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DomainVerificationDto> {
    const orgId = await this.enterpriseService.ensureOrganizationForWorkspace(workspaceId);
    return this.enterpriseService.verifyDomain(orgId, domain, user.email);
  }

  @Delete('domains/:domain')
  async removeDomain(
    @Param('workspaceId') workspaceId: string,
    @Param('domain') domain: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean }> {
    const orgId = await this.enterpriseService.ensureOrganizationForWorkspace(workspaceId);
    await this.enterpriseService.removeDomain(orgId, domain, user.email);
    return { success: true };
  }

  @Post('scim/rotate-token')
  async rotateScimToken(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RotateScimTokenResponse> {
    const orgId = await this.enterpriseService.ensureOrganizationForWorkspace(workspaceId);
    return this.enterpriseService.rotateScimToken(orgId, user.email);
  }

  @Post('scim/toggle')
  async toggleScim(
    @Param('workspaceId') workspaceId: string,
    @Body('enabled') enabled: boolean,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EnterpriseSSOConfigDto> {
    const orgId = await this.enterpriseService.ensureOrganizationForWorkspace(workspaceId);
    return this.enterpriseService.toggleScim(orgId, Boolean(enabled), user.email);
  }

  // A recovery code signs in as an administrator, so only the owner may mint
  // one; otherwise an admin could use it to become the owner.
  @Post('recovery-code')
  @WorkspaceRoles(WorkspaceRole.OWNER)
  async generateRecoveryCode(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GenerateRecoveryCodeResponse> {
    const orgId = await this.enterpriseService.ensureOrganizationForWorkspace(workspaceId);
    return this.enterpriseService.generateEmergencyRecoveryCode(orgId, user.email);
  }

  @Get('group-mappings')
  async getGroupMappings(@Param('workspaceId') workspaceId: string): Promise<SSOGroupRoleMappingDto[]> {
    const orgId = await this.enterpriseService.ensureOrganizationForWorkspace(workspaceId);
    return this.enterpriseService.getGroupRoleMappings(orgId);
  }

  @Put('group-mappings')
  async saveGroupMapping(
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SSOGroupRoleMappingDto> {
    const input = saveGroupRoleMappingSchema.parse(body);
    const orgId = await this.enterpriseService.ensureOrganizationForWorkspace(workspaceId);
    return this.enterpriseService.saveGroupRoleMapping(orgId, input, user.email);
  }

  @Delete('group-mappings/:id')
  async deleteGroupMapping(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean }> {
    const orgId = await this.enterpriseService.ensureOrganizationForWorkspace(workspaceId);
    await this.enterpriseService.deleteGroupRoleMapping(orgId, id, user.email);
    return { success: true };
  }

  @Get('audit-logs')
  async getAuditLogs(@Param('workspaceId') workspaceId: string) {
    const orgId = await this.enterpriseService.ensureOrganizationForWorkspace(workspaceId);
    return this.enterpriseService.getAuditLogs(orgId);
  }
}
