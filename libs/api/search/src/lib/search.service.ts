import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService } from '@org/database';

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
  /** Full-text rank, higher is a better match. Absent for `people` (ILIKE). */
  score?: number;
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
 * Workspace search, served from Postgres full-text search.
 *
 * Every searched table carries a `GENERATED ALWAYS AS (...) STORED` `tsvector`
 * column with a GIN index (migration `search_fts`), so a query is an indexed
 * `@@` match plus a `ts_rank` sort rather than a sequential `ILIKE '%q%'` over
 * `content`. User input goes through `websearch_to_tsquery`, which accepts
 * quoted phrases, `or`, and `-negation`, and never throws on junk.
 *
 * The shape is still engine-agnostic — swapping in Meilisearch later is a
 * change to this file.
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
    // `websearch_to_tsquery` bound once and reused per branch.
    const tsq = Prisma.sql`websearch_to_tsquery('english', ${query})`;

    switch (category) {
      case 'channels': {
        const rows = await this.prisma.$queryRaw<
          Array<{
            id: string;
            name: string;
            slug: string;
            topic: string | null;
            description: string | null;
            score: number;
          }>
        >(Prisma.sql`
          SELECT c."id", c."name", c."slug", c."topic", c."description",
                 ts_rank(c."searchVector", ${tsq}) AS score
          FROM "channels" c
          WHERE c."workspaceId" = ${workspaceId}
            AND c."isArchived" = false
            AND c."searchVector" @@ ${tsq}
            AND (
              c."visibility" = 'PUBLIC'
              OR EXISTS (
                SELECT 1 FROM "channel_members" cm
                WHERE cm."channelId" = c."id" AND cm."userId" = ${userId}
              )
            )
          ORDER BY score DESC, c."name" ASC
          LIMIT ${take}
        `);
        return rows.map((row) => ({
          id: row.id,
          category,
          title: `#${row.name}`,
          snippet: row.topic ?? row.description ?? undefined,
          href: `c/${row.slug}`,
          score: Number(row.score),
        }));
      }

      case 'docs': {
        const rows = await this.prisma.$queryRaw<
          Array<{
            id: string;
            title: string;
            content: string;
            kind: string;
            score: number;
          }>
        >(Prisma.sql`
          SELECT d."id", d."title", d."content", d."kind"::text AS kind,
                 ts_rank(d."searchVector", ${tsq}) AS score
          FROM "work_documents" d
          WHERE d."workspaceId" = ${workspaceId}
            AND d."searchVector" @@ ${tsq}
          ORDER BY score DESC, d."updatedAt" DESC
          LIMIT ${take}
        `);
        return rows.map((row) => ({
          id: row.id,
          category,
          title: row.title,
          snippet: snippet(row.content, query),
          href: `docs/${row.id}`,
          score: Number(row.score),
          metadata: { kind: row.kind },
        }));
      }

      case 'files': {
        const rows = await this.prisma.$queryRaw<
          Array<{
            id: string;
            filename: string;
            mimeType: string;
            size: number;
            score: number;
          }>
        >(Prisma.sql`
          SELECT u."id", u."filename", u."mimeType", u."size",
                 ts_rank(u."searchVector", ${tsq}) AS score
          FROM "uploads" u
          WHERE u."workspaceId" = ${workspaceId}
            AND u."searchVector" @@ ${tsq}
          ORDER BY score DESC, u."createdAt" DESC
          LIMIT ${take}
        `);
        return rows.map((row) => ({
          id: row.id,
          category,
          title: row.filename,
          snippet: row.mimeType,
          href: `files`,
          score: Number(row.score),
          metadata: { size: Number(row.size), mimeType: row.mimeType },
        }));
      }

      case 'tasks': {
        const rows = await this.prisma.$queryRaw<
          Array<{
            id: string;
            title: string;
            description: string | null;
            status: string;
            priority: string;
            projectId: string | null;
            score: number;
          }>
        >(Prisma.sql`
          SELECT t."id", t."title", t."description",
                 t."status"::text AS status, t."priority"::text AS priority,
                 t."projectId",
                 ts_rank(t."searchVector", ${tsq}) AS score
          FROM "tasks" t
          WHERE t."workspaceId" = ${workspaceId}
            AND t."searchVector" @@ ${tsq}
          ORDER BY score DESC, t."updatedAt" DESC
          LIMIT ${take}
        `);
        return rows.map((row) => ({
          id: row.id,
          category,
          title: row.title,
          snippet: row.description ? snippet(row.description, query) : undefined,
          href: row.projectId ? `tasks?project=${row.projectId}` : `tasks`,
          score: Number(row.score),
          metadata: { status: row.status, priority: row.priority },
        }));
      }

      case 'projects': {
        const rows = await this.prisma.$queryRaw<
          Array<{
            id: string;
            name: string;
            description: string | null;
            status: string;
            score: number;
          }>
        >(Prisma.sql`
          SELECT p."id", p."name", p."description", p."status"::text AS status,
                 ts_rank(p."searchVector", ${tsq}) AS score
          FROM "projects" p
          WHERE p."workspaceId" = ${workspaceId}
            AND p."searchVector" @@ ${tsq}
          ORDER BY score DESC, p."updatedAt" DESC
          LIMIT ${take}
        `);
        return rows.map((row) => ({
          id: row.id,
          category,
          title: row.name,
          snippet: row.description ?? undefined,
          href: `tasks?project=${row.id}`,
          score: Number(row.score),
          metadata: { status: row.status },
        }));
      }

      case 'people': {
        // Names do not benefit from stemming, and `users` is not tenant-scoped,
        // so people stay on a scoped ILIKE rather than a generated tsvector.
        const contains = { contains: query, mode: 'insensitive' as const };
        const rows = await this.prisma.workspaceMember.findMany({
          where: {
            workspaceId,
            user: {
              OR: [
                { name: contains },
                { displayName: contains },
                { email: contains },
              ],
            },
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
