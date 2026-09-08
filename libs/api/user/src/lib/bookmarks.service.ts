import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@org/database';
import type { BookmarkDto } from '@org/types';
import type { CreateBookmarkInput } from '@org/validation';

@Injectable()
export class BookmarksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    workspaceId: string,
    userId: string,
    targetType?: string,
  ): Promise<BookmarkDto[]> {
    const rows = await this.prisma.bookmark.findMany({
      where: {
        workspaceId,
        userId,
        ...(targetType ? { targetType } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return rows.map((r) => ({
      id: r.id,
      workspaceId: r.workspaceId,
      userId: r.userId,
      targetType: r.targetType,
      targetId: r.targetId,
      title: r.title,
      snippet: r.snippet,
      tags: r.tags,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async create(
    workspaceId: string,
    userId: string,
    input: CreateBookmarkInput,
  ): Promise<BookmarkDto> {
    const row = await this.prisma.bookmark.upsert({
      where: {
        workspaceId_userId_targetType_targetId: {
          workspaceId,
          userId,
          targetType: input.targetType,
          targetId: input.targetId,
        },
      },
      create: {
        workspaceId,
        userId,
        targetType: input.targetType,
        targetId: input.targetId,
        title: input.title,
        snippet: input.snippet ?? null,
        tags: input.tags ?? [],
        metadata: (input.metadata as any) ?? {},
      },
      update: {
        title: input.title,
        snippet: input.snippet ?? null,
        tags: input.tags ?? [],
        metadata: (input.metadata as any) ?? {},
      },
    });

    return {
      id: row.id,
      workspaceId: row.workspaceId,
      userId: row.userId,
      targetType: row.targetType,
      targetId: row.targetId,
      title: row.title,
      snippet: row.snippet,
      tags: row.tags,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async delete(
    workspaceId: string,
    userId: string,
    bookmarkId: string,
  ): Promise<void> {
    const res = await this.prisma.bookmark.deleteMany({
      where: {
        id: bookmarkId,
        workspaceId,
        userId,
      },
    });
    if (res.count === 0) {
      throw new NotFoundException('Bookmark not found');
    }
  }

  async deleteByTarget(
    workspaceId: string,
    userId: string,
    targetType: string,
    targetId: string,
  ): Promise<void> {
    await this.prisma.bookmark.deleteMany({
      where: {
        workspaceId,
        userId,
        targetType,
        targetId,
      },
    });
  }
}
