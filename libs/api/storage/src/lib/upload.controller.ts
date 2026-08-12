import {
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { WorkspaceRoleGuard } from '@org/api-auth';
import { CurrentUser, WorkspaceId } from '@org/api-common';
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

  @Get()
  list(
    @WorkspaceId() workspaceId: string,
    @Query('channelId') channelId?: string,
  ) {
    return this.uploads.list(workspaceId, channelId);
  }

  @Post()
  @UseInterceptors(
    // Buffered in memory: the size cap is small, and multer's disk mode would
    // put a caller-influenced filename on disk before we can vet it.
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  create(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @UploadedFile() file: IncomingFile,
    @Query('channelId') channelId?: string,
  ) {
    return this.uploads.create(workspaceId, userId, file, channelId);
  }

  /**
   * Streams the bytes back.
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
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @WorkspaceId() workspaceId: string,
    @Param('uploadId') uploadId: string,
  ): Promise<void> {
    return this.uploads.remove(workspaceId, uploadId);
  }
}
