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
import {
  CurrentUser,
  WorkspaceId,
  WorkspaceRoles,
  zodBody,
} from '@org/api-common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import { WorkspaceRole } from '@org/types';
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  type CreateWorkspaceInput,
  type UpdateWorkspaceInput,
} from '@org/validation';
import { slugify } from '@org/utils';
import { WorkspaceService } from './workspace.service.js';

@Controller({ path: 'workspaces', version: '1' })
export class WorkspaceController {
  constructor(private readonly workspaces: WorkspaceService) {}

  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.workspaces.listForUser(userId);
  }

  @Post()
  create(
    @CurrentUser('id') userId: string,
    @Body(zodBody(createWorkspaceSchema)) body: CreateWorkspaceInput,
  ) {
    return this.workspaces.create(userId, body);
  }

  /** Slug availability helper for the create form. */
  @Get('slug-suggestion')
  async suggestSlug(@Query('name') name = '') {
    return { slug: await this.workspaces.suggestSlug(slugify(name) || 'workspace') };
  }

  @Get(':workspaceSlug')
  @UseGuards(WorkspaceRoleGuard)
  findOne(
    @Param('workspaceSlug') slug: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.workspaces.findBySlug(slug, userId);
  }

  @Patch(':workspaceId')
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles(WorkspaceRole.ADMIN)
  update(
    @WorkspaceId() workspaceId: string,
    @Body(zodBody(updateWorkspaceSchema)) body: UpdateWorkspaceInput,
  ) {
    return this.workspaces.update(workspaceId, body);
  }

  @Delete(':workspaceId')
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles(WorkspaceRole.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    return this.workspaces.remove(workspaceId, userId);
  }

  @Post(':workspaceId/transfer-ownership')
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles(WorkspaceRole.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  transferOwnership(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body('userId') newOwnerUserId: string,
  ): Promise<void> {
    return this.workspaces.transferOwnership(
      workspaceId,
      userId,
      newOwnerUserId,
    );
  }
}
