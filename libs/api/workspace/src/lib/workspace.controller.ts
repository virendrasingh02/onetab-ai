import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  AllowArchivedWorkspace,
  CurrentUser,
  Public,
  RequireWorkspacePermissions,
  WorkspaceId,
  WorkspaceRoles,
  zodBody,
} from '@org/api-common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import type { IncomingFile } from '@org/api-storage';
import { WorkspacePermission, WorkspaceRole } from '@org/types';
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  WORKSPACE_LOGO_MAX_BYTES,
  type CreateWorkspaceInput,
  type UpdateWorkspaceInput,
} from '@org/validation';
import { slugify } from '@org/utils';
import type { Response } from 'express';
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

  /**
   * Uploads (or replaces) the workspace logo.
   *
   * Separate from `POST /workspaces` because the bytes need a workspace to
   * belong to — the create wizard posts the workspace first, then the logo.
   */
  @Post(':workspaceId/logo')
  @UseGuards(WorkspaceRoleGuard)
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  @UseInterceptors(
    // Buffered in memory: a logo is small, and multer's disk mode would put a
    // caller-influenced filename on disk before we can vet it.
    FileInterceptor('file', { limits: { fileSize: WORKSPACE_LOGO_MAX_BYTES } }),
  )
  uploadLogo(
    @WorkspaceId() workspaceId: string,
    @UploadedFile() file: IncomingFile,
  ) {
    return this.workspaces.setLogo(workspaceId, file);
  }

  /**
   * Serves the logo bytes.
   *
   * Public, because an `<img>` tag cannot carry the bearer token — and a
   * workspace logo is branding, not private content. The id in the path is a
   * cuid, so the route discloses nothing that was not already shared.
   */
  @Get(':workspaceId/logo')
  @Public()
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cache-Control', 'public, max-age=300')
  async logo(
    @Param('workspaceId') workspaceId: string,
    @Res() response: Response,
  ): Promise<void> {
    const logo = await this.workspaces.readLogo(workspaceId);
    response.setHeader('Content-Type', logo.mimeType);
    response.send(logo.content);
  }

  @Delete(':workspaceId/logo')
  @UseGuards(WorkspaceRoleGuard)
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  removeLogo(@WorkspaceId() workspaceId: string) {
    return this.workspaces.removeLogo(workspaceId);
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
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  update(
    @WorkspaceId() workspaceId: string,
    @Body(zodBody(updateWorkspaceSchema)) body: UpdateWorkspaceInput,
  ) {
    return this.workspaces.update(workspaceId, body);
  }

  @Delete(':workspaceId')
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles(WorkspaceRole.OWNER)
  @AllowArchivedWorkspace()
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    return this.workspaces.remove(workspaceId, userId);
  }

  /**
   * Freezes the workspace. Members keep read access; every write is refused
   * until it is restored. Data is untouched, which is what makes this the
   * step to reach for before `DELETE`.
   */
  @Post(':workspaceId/archive')
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles(WorkspaceRole.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  archive(@WorkspaceId() workspaceId: string): Promise<void> {
    return this.workspaces.setArchived(workspaceId, true);
  }

  /**
   * Lifts the freeze.
   *
   * `@AllowArchivedWorkspace` is what makes this reachable at all — without
   * it the guard would refuse the very request that undoes the archive.
   */
  @Post(':workspaceId/restore')
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles(WorkspaceRole.OWNER)
  @AllowArchivedWorkspace()
  @HttpCode(HttpStatus.NO_CONTENT)
  restore(@WorkspaceId() workspaceId: string): Promise<void> {
    return this.workspaces.setArchived(workspaceId, false);
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
