import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WorkspaceRoleGuard } from '@org/api-auth';
import {
  CurrentUser,
  RequireWorkspacePermissions,
  WorkspaceId,
  WorkspaceMemberRole,
  WorkspacePermissions,
  WorkspacePolicies,
  zodBody,
  type AuthenticatedUser,
} from '@org/api-common';
import {
  WorkspacePermission,
  type WorkspacePolicy,
  type WorkspaceRole,
} from '@org/types';
import { z } from 'zod';
import {
  AgentInstallService,
  type InstallActor,
} from './agent-install.service.js';

const accessSchema = z.object({
  mode: z.enum(['EVERYONE', 'RESTRICTED']).optional(),
  userIds: z.array(z.string().max(60)).max(200).optional(),
  roles: z.array(z.string().max(20)).max(8).optional(),
});

const installSchema = z.object({
  scope: z.enum(['WORKSPACE', 'PERSONAL', 'ADMIN_MANAGED']).optional(),
  access: accessSchema.optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  approvedPermissions: z.array(z.string().max(200)).max(200).optional(),
  reason: z.string().max(500).optional(),
});

const resolveSchema = installSchema.extend({
  action: z.enum(['APPROVE', 'REJECT']),
  rejectionReason: z.string().max(500).optional(),
});

const updateSchema = installSchema.pick({ settings: true, approvedPermissions: true });
const enabledSchema = z.object({ enabled: z.boolean() });
const accessUpdateSchema = installSchema.pick({ scope: true, access: true });

/**
 * Agent install lifecycle. Every route is behind `WorkspaceRoleGuard` (members
 * only, workspace taken from the path); finer rules — who may install, approve,
 * or manage a given install — live in `AgentInstallService` so they hold for
 * every caller, not just this controller.
 */
@Controller({ path: 'marketplace/workspaces/:workspaceId/agent-installs', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class AgentInstallController {
  constructor(private readonly installs: AgentInstallService) {}

  private actor(
    user: AuthenticatedUser,
    role: WorkspaceRole | undefined,
    permissions: readonly WorkspacePermission[] | undefined,
    policies: WorkspacePolicy | undefined,
  ): InstallActor {
    return { id: user.id, name: user.name ?? user.email, role, permissions: permissions ?? [], policies };
  }

  @Get()
  list(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @WorkspaceMemberRole() role: WorkspaceRole | undefined,
    @WorkspacePermissions() permissions: readonly WorkspacePermission[] | undefined,
    @WorkspacePolicies() policies: WorkspacePolicy | undefined,
  ) {
    return this.installs.list(workspaceId, this.actor(user, role, permissions, policies));
  }

  @Get('audit')
  audit(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @WorkspaceMemberRole() role: WorkspaceRole | undefined,
    @WorkspacePermissions() permissions: readonly WorkspacePermission[] | undefined,
    @Query('limit') limit?: string,
  ) {
    this.installs.requireManager(this.actor(user, role, permissions, undefined), 'view the agent audit history');
    return this.installs.listAudit(workspaceId, Number(limit) || 100);
  }

  @Get('approvals')
  approvals(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @WorkspaceMemberRole() role: WorkspaceRole | undefined,
    @WorkspacePermissions() permissions: readonly WorkspacePermission[] | undefined,
  ) {
    return this.installs.listApprovals(workspaceId, this.actor(user, role, permissions, undefined));
  }

  @Get(':slug/preview')
  preview(
    @WorkspaceId() workspaceId: string,
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
    @WorkspaceMemberRole() role: WorkspaceRole | undefined,
    @WorkspacePermissions() permissions: readonly WorkspacePermission[] | undefined,
    @WorkspacePolicies() policies: WorkspacePolicy | undefined,
  ) {
    return this.installs.preview(workspaceId, slug, this.actor(user, role, permissions, policies));
  }

  @Post(':slug')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  install(
    @WorkspaceId() workspaceId: string,
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
    @WorkspaceMemberRole() role: WorkspaceRole | undefined,
    @WorkspacePermissions() permissions: readonly WorkspacePermission[] | undefined,
    @WorkspacePolicies() policies: WorkspacePolicy | undefined,
    @Body(zodBody(installSchema)) body: z.infer<typeof installSchema>,
  ) {
    return this.installs.install(workspaceId, slug, this.actor(user, role, permissions, policies), body);
  }

  @Post(':slug/request')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  request(
    @WorkspaceId() workspaceId: string,
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
    @WorkspaceMemberRole() role: WorkspaceRole | undefined,
    @WorkspacePermissions() permissions: readonly WorkspacePermission[] | undefined,
    @Body(zodBody(installSchema)) body: z.infer<typeof installSchema>,
  ) {
    return this.installs.requestApproval(workspaceId, slug, this.actor(user, role, permissions, undefined), body);
  }

  @Post(':slug/resolve')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  resolve(
    @WorkspaceId() workspaceId: string,
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
    @WorkspaceMemberRole() role: WorkspaceRole | undefined,
    @WorkspacePermissions() permissions: readonly WorkspacePermission[] | undefined,
    @Body(zodBody(resolveSchema)) body: z.infer<typeof resolveSchema>,
  ) {
    return this.installs.resolveApproval(workspaceId, slug, this.actor(user, role, permissions, undefined), body);
  }

  @Post(':slug/update')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  update(
    @WorkspaceId() workspaceId: string,
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
    @WorkspaceMemberRole() role: WorkspaceRole | undefined,
    @WorkspacePermissions() permissions: readonly WorkspacePermission[] | undefined,
    @Body(zodBody(updateSchema)) body: z.infer<typeof updateSchema>,
  ) {
    return this.installs.update(workspaceId, slug, this.actor(user, role, permissions, undefined), body);
  }

  @Patch(':slug/enabled')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  setEnabled(
    @WorkspaceId() workspaceId: string,
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
    @WorkspaceMemberRole() role: WorkspaceRole | undefined,
    @WorkspacePermissions() permissions: readonly WorkspacePermission[] | undefined,
    @Body(zodBody(enabledSchema)) body: z.infer<typeof enabledSchema>,
  ) {
    return this.installs.setEnabled(workspaceId, slug, this.actor(user, role, permissions, undefined), body.enabled);
  }

  @Patch(':slug/access')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  updateAccess(
    @WorkspaceId() workspaceId: string,
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
    @WorkspaceMemberRole() role: WorkspaceRole | undefined,
    @WorkspacePermissions() permissions: readonly WorkspacePermission[] | undefined,
    @Body(zodBody(accessUpdateSchema)) body: z.infer<typeof accessUpdateSchema>,
  ) {
    return this.installs.updateAccess(workspaceId, slug, this.actor(user, role, permissions, undefined), body);
  }

  @Post(':slug/health')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  health(
    @WorkspaceId() workspaceId: string,
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
    @WorkspaceMemberRole() role: WorkspaceRole | undefined,
    @WorkspacePermissions() permissions: readonly WorkspacePermission[] | undefined,
  ) {
    return this.installs.checkHealth(workspaceId, slug, this.actor(user, role, permissions, undefined));
  }

  @Delete(':slug')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  uninstall(
    @WorkspaceId() workspaceId: string,
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
    @WorkspaceMemberRole() role: WorkspaceRole | undefined,
    @WorkspacePermissions() permissions: readonly WorkspacePermission[] | undefined,
    @Query('purge') purge?: string,
    @Query('confirm') confirm?: string,
  ) {
    return this.installs.uninstall(workspaceId, slug, this.actor(user, role, permissions, undefined), {
      purge: purge === 'true',
      confirm: confirm === 'true',
    });
  }
}
