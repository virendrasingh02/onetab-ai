import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@org/database';
import type { BookmarkDto } from '@org/types';
import type {
  CreateBookmarkInput,
  ImportBookmarksInput,
} from '@org/validation';

/** Enough for any realistic shortlist; the page renders the whole list. */
const DEFAULT_LIST_LIMIT = 200;
const MAX_LIST_LIMIT = 500;

type BookmarkRow = {
  id: string;
  workspaceId: string;
  userId: string;
  targetType: string;
  targetId: string;
  title: string;
  snippet: string | null;
  tags: string[];
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function toDto(row: BookmarkRow): BookmarkDto {
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

function metadataRoomId(metadata: unknown): string | undefined {
  const roomId = (metadata as { roomId?: unknown } | undefined)?.roomId;
  return typeof roomId === 'string' && roomId ? roomId : undefined;
}

@Injectable()
export class BookmarksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    workspaceId: string,
    userId: string,
    targetType?: string,
    limit = DEFAULT_LIST_LIMIT,
  ): Promise<BookmarkDto[]> {
    const take = Math.min(Math.max(1, Math.floor(limit) || DEFAULT_LIST_LIMIT), MAX_LIST_LIMIT);
    const rows = await this.prisma.bookmark.findMany({
      where: {
        workspaceId,
        userId,
        ...(targetType ? { targetType } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
    });

    return rows.map(toDto);
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

    return toDto(row);
  }

  /**
   * Uploads saves made before bookmarks lived on the server (Matrix account
   * data / a device cache). Never overwrites: anything already saved — or
   * removed and re-saved — on the server wins.
   *
   * A saved message names its Matrix room, and a channel room belongs to one
   * workspace: those entries are filed under that workspace when the reader is
   * an active member of it, and dropped when they are not (the room is no
   * longer theirs to open). Rooms with no channel (DMs, agent/app chats) stay
   * in the workspace the import came from.
   */
  async import(
    workspaceId: string,
    userId: string,
    input: ImportBookmarksInput,
  ): Promise<{ imported: number }> {
    if (input.items.length === 0) return { imported: 0 };

    const roomIds = [
      ...new Set(
        input.items
          .map((item) => metadataRoomId(item.metadata))
          .filter((id): id is string => !!id),
      ),
    ];
    const [channels, memberships] = await Promise.all([
      roomIds.length
        ? this.prisma.channel.findMany({
            where: { matrixRoomId: { in: roomIds } },
            select: { matrixRoomId: true, workspaceId: true },
          })
        : Promise.resolve([]),
      this.prisma.workspaceMember.findMany({
        where: { userId, status: 'ACTIVE' },
        select: { workspaceId: true },
      }),
    ]);
    const roomWorkspace = new Map(
      channels.map((c) => [c.matrixRoomId as string, c.workspaceId]),
    );
    const memberOf = new Set(memberships.map((m) => m.workspaceId));

    const data = input.items.flatMap((item) => {
      const roomId = metadataRoomId(item.metadata);
      const target = (roomId && roomWorkspace.get(roomId)) || workspaceId;
      if (!memberOf.has(target)) return [];
      return [
        {
          workspaceId: target,
          userId,
          targetType: item.targetType,
          targetId: item.targetId,
          title: item.title,
          snippet: item.snippet ?? null,
          tags: item.tags ?? [],
          metadata: (item.metadata as any) ?? {},
        },
      ];
    });
    if (data.length === 0) return { imported: 0 };

    const result = await this.prisma.bookmark.createMany({
      data,
      skipDuplicates: true,
    });
    return { imported: result.count };
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
