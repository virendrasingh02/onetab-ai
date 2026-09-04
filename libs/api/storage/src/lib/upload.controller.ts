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
import { WorkspaceRoleGuard } from '@org/api-auth';
import {
  CurrentUser,
  Public,
  RequireWorkspacePermissions,
  WorkspaceId,
  zodBody,
} from '@org/api-common';
import { WorkspacePermission } from '@org/types';
import { updateUploadSchema, type UpdateUploadInput } from '@org/validation';
import type { Response } from 'express';
import {
  MAX_UPLOAD_BYTES,
  UploadService,
  type IncomingFile,
} from './upload.service.js';

/**
 * Workspace file storage.
 *
 * Everything is nested under the workspace and guarded by membership, so an
 * upload id alone never grants access to another tenant's file.
 */
@Controller({ path: 'workspaces/:workspaceId/uploads', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class UploadController {
  constructor(private readonly uploads: UploadService) {}

  /** One keyset page of the Files hub, newest first. */
  @Get()
  list(
    @WorkspaceId() workspaceId: string,
    @Query('channelId') channelId?: string,
    @Query('contextType') contextType?: string,
    @Query('contextId') contextId?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.uploads.list(workspaceId, {
      channelId,
      contextType,
      contextId,
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  /** Channels / projects / agents / apps / people a file can be filed under. */
  @Get('destinations')
  listDestinations(@WorkspaceId() workspaceId: string) {
    return this.uploads.listDestinations(workspaceId);
  }

  /** Storage consumption + the current plan's cap, for the hub meter. */
  @Get('usage')
  usage(@WorkspaceId() workspaceId: string) {
    return this.uploads.storageUsage(workspaceId);
  }

  @Post()
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  create(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @UploadedFile() file: IncomingFile,
    @Query('channelId') channelId?: string,
    @Query('contextType') contextType?: string,
    @Query('contextId') contextId?: string,
  ) {
    return this.uploads.create(workspaceId, userId, file, {
      channelId,
      contextType,
      contextId,
    });
  }

  /** Rename and/or move a file. */
  @Patch(':uploadId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  update(
    @WorkspaceId() workspaceId: string,
    @Param('uploadId') uploadId: string,
    @Body(zodBody(updateUploadSchema)) body: UpdateUploadInput,
  ) {
    return this.uploads.update(workspaceId, uploadId, body);
  }

  /** The version chain for a file, newest first. */
  @Get(':uploadId/versions')
  listVersions(
    @WorkspaceId() workspaceId: string,
    @Param('uploadId') uploadId: string,
  ) {
    return this.uploads.listVersions(workspaceId, uploadId);
  }

  /** Replace a file's content with a new version. */
  @Post(':uploadId/versions')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  replaceVersion(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('uploadId') uploadId: string,
    @UploadedFile() file: IncomingFile,
  ) {
    return this.uploads.replaceVersion(workspaceId, uploadId, userId, file);
  }

  /**
   * Streams the bytes back (authenticated path).
   *
   * `Content-Disposition: attachment` and `nosniff` together stop an uploaded
   * HTML or SVG file from executing as script on the app's own origin.
   */
  @Get(':uploadId/content')
  @Header('X-Content-Type-Options', 'nosniff')
  async download(
    @WorkspaceId() workspaceId: string,
    @Param('uploadId') uploadId: string,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.uploads.read(workspaceId, uploadId);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(file.filename)}"`,
    );
    response.send(file.content);
  }

  @Delete(':uploadId')
  @RequireWorkspacePermissions(WorkspacePermission.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @WorkspaceId() workspaceId: string,
    @Param('uploadId') uploadId: string,
  ): Promise<void> {
    return this.uploads.remove(workspaceId, uploadId);
  }
}

/**
 * Signed-URL delivery — a short-lived HMAC token in the path stands in for the
 * bearer token, so a plain `<img>` / `<a download>` can reach the bytes. The
 * token carries the upload id and an expiry and is verified in
 * `UploadService.readByToken`; there is no workspace check because the
 * signature *is* the authorization and it is useless once it expires.
 */
@Controller({ path: 'files', version: '1' })
export class PublicFileController {
  constructor(private readonly uploads: UploadService) {}

  @Public()
  @Get(':token')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cache-Control', 'private, max-age=3600')
  async serve(
    @Param('token') token: string,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.uploads.readByToken(token);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader(
      'Content-Disposition',
      `${file.download ? 'attachment' : 'inline'}; filename="${encodeURIComponent(
        file.filename,
      )}"`,
    );
    response.send(file.content);
  }
}
