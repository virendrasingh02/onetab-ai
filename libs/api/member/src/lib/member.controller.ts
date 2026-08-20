import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WorkspaceRoleGuard } from '@org/api-auth';
import {
  AllowArchivedWorkspace,
  CurrentUser,
  RequireWorkspacePermissions,
  WorkspaceId,
  WorkspaceMemberRole,
  zodBody,
} from '@org/api-common';
import { WorkspacePermission, WorkspaceRole } from '@org/types';
import {
  acceptInvitationSchema,
  inviteMembersSchema,
  updateMemberRoleSchema,
  type AcceptInvitationInput,
  type InviteMembersInput,
  type UpdateMemberRoleInput,
} from '@org/validation';
import { MemberService } from './member.service.js';

@Controller({ path: 'workspaces/:workspaceId/members', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class MemberController {
  constructor(private readonly members: MemberService) {}

  @Get()
  list(@WorkspaceId() workspaceId: string) {
    return this.members.list(workspaceId);
  }

  @Patch(':userId/role')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_MEMBERS)
  @HttpCode(HttpStatus.NO_CONTENT)
  updateRole(
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberRole() actorRole: WorkspaceRole,
    @Param('userId') targetUserId: string,
    @Body(zodBody(updateMemberRoleSchema)) body: UpdateMemberRoleInput,
  ): Promise<void> {
    return this.members.updateRole(workspaceId, actorRole, targetUserId, body);
  }

  @Delete(':userId')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_MEMBERS)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberRole() actorRole: WorkspaceRole,
    @Param('userId') targetUserId: string,
  ): Promise<void> {
    return this.members.remove(workspaceId, actorRole, targetUserId);
  }

  @Post('leave')
  @AllowArchivedWorkspace()
  @HttpCode(HttpStatus.NO_CONTENT)
  leave(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    return this.members.leave(workspaceId, userId);
  }
}

@Controller({ path: 'workspaces/:workspaceId/invitations', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class InvitationController {
  constructor(
    private readonly members: MemberService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_MEMBERS)
  list(@WorkspaceId() workspaceId: string) {
    return this.members.listInvitations(workspaceId);
  }

  @Post()
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_MEMBERS)
  invite(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body(zodBody(inviteMembersSchema)) body: InviteMembersInput,
  ) {
    const includeTokens = this.config.get('NODE_ENV') !== 'production';
    return this.members.invite(workspaceId, userId, body, includeTokens);
  }

  @Delete(':invitationId')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_MEMBERS)
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(
    @WorkspaceId() workspaceId: string,
    @Param('invitationId') invitationId: string,
  ): Promise<void> {
    return this.members.revokeInvitation(workspaceId, invitationId);
  }
}

/**
 * Accepting an invitation happens outside a workspace context — the caller is
 * not a member yet, so `WorkspaceRoleGuard` must not run here.
 */
@Controller({ path: 'invitations', version: '1' })
export class InvitationAcceptController {
  constructor(private readonly members: MemberService) {}

  @Post('accept')
  @HttpCode(HttpStatus.OK)
  accept(
    @CurrentUser('id') userId: string,
    @Body(zodBody(acceptInvitationSchema)) body: AcceptInvitationInput,
  ) {
    return this.members.acceptInvitation(body.token, userId);
  }
}
