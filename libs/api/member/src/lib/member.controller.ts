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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WorkspaceRoleGuard } from '@org/api-auth';
import {
  AllowArchivedWorkspace,
  CurrentUser,
  Public,
  RequireWorkspacePermissions,
  WorkspaceId,
  WorkspaceMemberRole,
  zodBody,
} from '@org/api-common';
import { WorkspacePermission, WorkspaceRole } from '@org/types';
import {
  acceptInvitationSchema,
  createInvitationLinkSchema,
  declineInvitationSchema,
  inviteMembersSchema,
  updateInvitationLinkSchema,
  updateMemberRoleSchema,
  type AcceptInvitationInput,
  type CreateInvitationLinkInput,
  type DeclineInvitationInput,
  type InviteMembersInput,
  type UpdateInvitationLinkInput,
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
  list(
    @WorkspaceId() workspaceId: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('scope') scope?: string,
  ) {
    return this.members.listInvitations(workspaceId, { status, search, scope });
  }

  @Post()
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_MEMBERS)
  invite(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @WorkspaceMemberRole() actorRole: WorkspaceRole,
    @Body(zodBody(inviteMembersSchema)) body: InviteMembersInput,
  ) {
    const includeTokens = this.config.get('NODE_ENV') !== 'production';
    return this.members.invite(
      workspaceId,
      userId,
      actorRole,
      body,
      includeTokens,
    );
  }

  @Post(':invitationId/resend')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_MEMBERS)
  resend(
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberRole() actorRole: WorkspaceRole,
    @Param('invitationId') invitationId: string,
  ) {
    const includeTokens = this.config.get('NODE_ENV') !== 'production';
    return this.members.resendInvitation(
      workspaceId,
      actorRole,
      invitationId,
      includeTokens,
    );
  }

  @Delete(':invitationId')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_MEMBERS)
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberRole() actorRole: WorkspaceRole,
    @Param('invitationId') invitationId: string,
  ): Promise<void> {
    return this.members.revokeInvitation(workspaceId, actorRole, invitationId);
  }
}

@Controller({ path: 'workspaces/:workspaceId/invitation-links', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class InvitationLinkController {
  constructor(private readonly members: MemberService) {}

  @Get()
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_MEMBERS)
  list(@WorkspaceId() workspaceId: string) {
    return this.members.listInvitationLinks(workspaceId);
  }

  @Post()
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_MEMBERS)
  create(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @WorkspaceMemberRole() actorRole: WorkspaceRole,
    @Body(zodBody(createInvitationLinkSchema)) body: CreateInvitationLinkInput,
  ) {
    return this.members.createInvitationLink(
      workspaceId,
      userId,
      actorRole,
      body,
    );
  }

  @Patch(':linkId')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_MEMBERS)
  update(
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberRole() actorRole: WorkspaceRole,
    @Param('linkId') linkId: string,
    @Body(zodBody(updateInvitationLinkSchema)) body: UpdateInvitationLinkInput,
  ) {
    return this.members.updateInvitationLink(
      workspaceId,
      actorRole,
      linkId,
      body,
    );
  }

  @Delete(':linkId')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_MEMBERS)
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberRole() actorRole: WorkspaceRole,
    @Param('linkId') linkId: string,
  ): Promise<void> {
    return this.members.revokeInvitationLink(workspaceId, actorRole, linkId);
  }

  @Post(':linkId/regenerate')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_MEMBERS)
  regenerate(
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberRole() actorRole: WorkspaceRole,
    @Param('linkId') linkId: string,
  ) {
    return this.members.regenerateInvitationLink(
      workspaceId,
      actorRole,
      linkId,
    );
  }
}

/**
 * Public and unauthenticated acceptance endpoints.
 */
@Controller({ path: 'invitations', version: '1' })
export class InvitationAcceptController {
  constructor(private readonly members: MemberService) {}

  @Public()
  @Get('preview/:token')
  preview(@Param('token') token: string) {
    return this.members.getInvitationPreview(token);
  }

  @Post('accept')
  @HttpCode(HttpStatus.OK)
  accept(
    @CurrentUser('id') userId: string,
    @Body(zodBody(acceptInvitationSchema)) body: AcceptInvitationInput,
  ) {
    return this.members.acceptInvitation(body.token, userId);
  }

  @Public()
  @Post('decline')
  @HttpCode(HttpStatus.NO_CONTENT)
  decline(@Body(zodBody(declineInvitationSchema)) body: DeclineInvitationInput) {
    return this.members.declineInvitation(body.token);
  }
}
