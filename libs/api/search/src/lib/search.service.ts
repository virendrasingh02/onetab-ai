import { Injectable } from '@nestjs/common';
import { PrismaService } from '@org/database';

export type SearchCategory =
  | 'channels'
  | 'docs'
  | 'files'
  | 'tasks'
  | 'projects'
  | 'people';

export interface SearchResultItem {
  id: string;
  category: SearchCategory;
  title: string;
  snippet?: string;
  /** Workspace-relative route the result opens. */
  href?: string;
  metadata?: Record<string, unknown>;
}

export interface SearchOptions {
  workspaceId: string;
  /** The calling member — private channels they are not in must not surface. */
  userId: string;
  query: string;
  category?: SearchCategory;
  limit?: number;
}

const CATEGORIES: SearchCategory[] = [
  'channels',
  'docs',
  'files',
  'tasks',
  'projects',
  'people',
];

/** Keeps one loud category from crowding out the rest in an "all" search. */
const PER_CATEGORY_LIMIT = 8;

/** Trims a body down to a window around the first match. */
function snippet(body: string, query: string, radius = 60): string {
  const at = body.toLowerCase().indexOf(query.toLowerCase());
  if (at === -1) return body.slice(0, radius * 2).trim();

  const start = Math.max(0, at - radius);
  const end = Math.min(body.length, at + query.length + radius);
  return `${start > 0 ? '…' : ''}${body.slice(start, end).trim()}${
    end < body.length ? '…' : ''
  }`;
}

/**
 * Workspace search, served from Postgres.
 *
 * Meilisearch is the intended engine, but nothing is indexed into it yet and a
 * search box that always returns nothing is worse than a slower one that works.
 * `ILIKE` over the handful of tables people actually search is accurate and
 * needs no second system; the shape here is deliberately engine-agnostic so
 * swapping the backend later is a change to this file.
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(options: SearchOptions): Promise<SearchResultItem[]> {
    const query = options.query.trim();
    if (query.length < 2) return [];

    const { workspaceId, userId } = options;
    const limit = options.limit ?? PER_CATEGORY_LIMIT;
    const wanted = options.category ? [options.category] : CATEGORIES;

    const groups = await Promise.all(
      wanted.map((category) =>
        this.searchOne(category, workspaceId, userId, query, limit),
      ),
    );

    return groups.flat();
  }

  /** Counts per category, for the filter chips above the results. */
  async counts(
    workspaceId: string,
    userId: string,
    query: string,
  ): Promise<Record<SearchCategory, number>> {
    const results = await this.search({ workspaceId, userId, query, limit: 100 });
    const counts = Object.fromEntries(
      CATEGORIES.map((category) => [category, 0]),
    ) as Record<SearchCategory, number>;

    for (const result of results) counts[result.category] += 1;
    return counts;
  }

  private async searchOne(
    category: SearchCategory,
    workspaceId: string,
    userId: string,
    query: string,
    take: number,
  ): Promise<SearchResultItem[]> {
    const contains = { contains: query, mode: 'insensitive' as const };

    switch (category) {
      case 'channels': {
        const rows = await this.prisma.channel.findMany({
          where: {
            workspaceId,
            isArchived: false,
            // Mirrors ChannelService.list: a private channel is only a result
            // for someone who is in it. Filtering on workspace + archived alone
            // leaked private channel names, topics and existence to every
            // member (audit S3).
            OR: [
              { visibility: 'PUBLIC' },
              { members: { some: { userId } } },
            ],
            AND: [
              {
                OR: [
                  { name: contains },
                  { topic: contains },
                  { description: contains },
                ],
              },
            ],
          },
          take,
          orderBy: { name: 'asc' },
        });
        return rows.map((row) => ({
          id: row.id,
          category,
          title: `#${row.name}`,
          snippet: row.topic ?? row.description ?? undefined,
          // `/w/:slug/channels` is the browse screen; a single channel is `c/:slug`.
          href: `c/${row.slug}`,
        }));
      }

      case 'docs': {
        const rows = await this.prisma.workDocument.findMany({
          where: { workspaceId, OR: [{ title: contains }, { content: contains }] },
          take,
          orderBy: { updatedAt: 'desc' },
        });
        return rows.map((row) => ({
          id: row.id,
          category,
          title: row.title,
          snippet: snippet(row.content, query),
          href: `docs/${row.id}`,
          metadata: { kind: row.kind },
        }));
      }

      case 'files': {
        const rows = await this.prisma.upload.findMany({
          where: { workspaceId, filename: contains },
          take,
          orderBy: { createdAt: 'desc' },
        });
        return rows.map((row) => ({
          id: row.id,
          category,
          title: row.filename,
          snippet: row.mimeType,
          href: `files`,
          metadata: { size: row.size, mimeType: row.mimeType },
        }));
      }

      case 'tasks': {
        const rows = await this.prisma.task.findMany({
          where: {
            workspaceId,
            OR: [{ title: contains }, { description: contains }],
          },
          take,
          orderBy: { updatedAt: 'desc' },
        });
        return rows.map((row) => ({
          id: row.id,
          category,
          title: row.title,
          snippet: row.description ? snippet(row.description, query) : undefined,
          href: row.projectId ? `tasks?project=${row.projectId}` : `tasks`,
          metadata: { status: row.status, priority: row.priority },
        }));
      }

      case 'projects': {
        const rows = await this.prisma.project.findMany({
          where: {
            workspaceId,
            OR: [{ name: contains }, { description: contains }],
          },
          take,
          orderBy: { updatedAt: 'desc' },
        });
        return rows.map((row) => ({
          id: row.id,
          category,
          title: row.name,
          snippet: row.description ?? undefined,
          href: `tasks?project=${row.id}`,
          metadata: { status: row.status },
        }));
      }

      case 'people': {
        // Only members of this workspace: search must not become a directory
        // of every account on the platform.
        const rows = await this.prisma.workspaceMember.findMany({
          where: {
            workspaceId,
            user: { OR: [{ name: contains }, { displayName: contains }] },
          },
          include: {
            user: {
              select: { id: true, name: true, displayName: true, avatarUrl: true },
            },
          },
          take,
        });
        return rows.map((row) => ({
          id: row.user.id,
          category,
          title: row.user.displayName ?? row.user.name,
          snippet: row.role,
          href: `members`,
          metadata: { avatarUrl: row.user.avatarUrl, role: row.role },
        }));
      }
    }
  }
}
