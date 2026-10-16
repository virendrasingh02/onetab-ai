import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import { CurrentUser, WorkspaceId, zodBody } from '@org/api-common';
import {
  createBookmarkSchema,
  importBookmarksSchema,
  type CreateBookmarkInput,
  type ImportBookmarksInput,
} from '@org/validation';
import { BookmarksService } from './bookmarks.service.js';

@Controller({ path: 'workspaces/:workspaceId/bookmarks', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class BookmarksController {
  constructor(private readonly bookmarks: BookmarksService) {}

  @Get()
  list(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Query('targetType') targetType?: string,
    @Query('limit') limit?: string,
  ) {
    return this.bookmarks.list(
      workspaceId,
      userId,
      targetType,
      limit ? Number(limit) : undefined,
    );
  }

  @Post()
  create(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body(zodBody(createBookmarkSchema)) body: CreateBookmarkInput,
  ) {
    return this.bookmarks.create(workspaceId, userId, body);
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  import(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body(zodBody(importBookmarksSchema)) body: ImportBookmarksInput,
  ) {
    return this.bookmarks.import(workspaceId, userId, body);
  }

  @Delete(':bookmarkId')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('bookmarkId') bookmarkId: string,
  ): Promise<void> {
    return this.bookmarks.delete(workspaceId, userId, bookmarkId);
  }

  @Delete('by-target/:targetType/:targetId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteByTarget(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('targetType') targetType: string,
    @Param('targetId') targetId: string,
  ): Promise<void> {
    return this.bookmarks.deleteByTarget(
      workspaceId,
      userId,
      targetType,
      targetId,
    );
  }
}
