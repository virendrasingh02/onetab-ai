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
import { CurrentUser, WorkspaceId } from '@org/api-common';
import {
  createBookmarkSchema,
  type CreateBookmarkInput,
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
  ) {
    return this.bookmarks.list(workspaceId, userId, targetType);
  }

  @Post()
  create(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body() body: CreateBookmarkInput,
  ) {
    const parsed = createBookmarkSchema.parse(body);
    return this.bookmarks.create(workspaceId, userId, parsed);
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
