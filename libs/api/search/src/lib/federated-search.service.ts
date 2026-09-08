import { Injectable } from '@nestjs/common';
import { PrismaService } from '@org/database';
import {
  mergeFederatedResults,
  resolveSearchWorkspaces,
  type FederatedSearchResponse,
  type FederatedSearchResultItem,
  type SearchWorkspaceRef,
} from '@org/types';
import { SearchService, type SearchCategory } from './search.service.js';

export interface FederatedSearchInput {
  userId: string;
  query: string;
  /** Restrict to these workspace ids (still ∩ the caller's memberships). */
  workspaceIds?: string[];
  categories?: SearchCategory[];
  dateFrom?: string | null;
  dateTo?: string | null;
  /** Mime-type prefix filter for `files` results, e.g. `image/`. */
  fileType?: string | null;
  /** Project-id filter for `tasks` results. */
  projectId?: string | null;
  page?: number;
  pageSize?: number;
}

/**
 * Cross-workspace search (brief §4).
 *
 * Runs the per-workspace {@link SearchService} over every workspace the caller
 * is an ACTIVE member of, tags each hit with its workspace, then merges into
 * one ranked, de-duplicated, paginated page. Membership is the security
 * boundary — a workspace the caller is not in is never queried, so this cannot
 * become a cross-tenant read.
 */
@Injectable()
export class FederatedSearchService {
  /** Fan-out ceiling — a user on hundreds of workspaces still gets a bounded query. */
  private readonly MAX_WORKSPACES = 25;
  /** Per category, per workspace — enough to rank a good first few pages. */
  private readonly PER_CATEGORY = 12;

  constructor(
    private readonly prisma: PrismaService,
    private readonly search: SearchService,
  ) {}

  async searchAll(input: FederatedSearchInput): Promise<FederatedSearchResponse> {
    const query = input.query.trim();

    const memberships = await this.prisma.workspaceMember.findMany({
      where: {
        userId: input.userId,
        status: 'ACTIVE',
        workspace: { status: 'ACTIVE' },
      },
      orderBy: { joinedAt: 'asc' },
      select: {
        workspace: { select: { id: true, name: true, slug: true } },
      },
      take: 200,
    });
    const allWorkspaces: SearchWorkspaceRef[] = memberships.map(
      (m) => m.workspace,
    );

    if (query.length < 2) {
      return { items: [], hasMore: false, workspaces: allWorkspaces };
    }

    const targets = resolveSearchWorkspaces(
      allWorkspaces,
      input.workspaceIds,
    ).slice(0, this.MAX_WORKSPACES);

    // One category → push the filter into the DB query; many → run all and trim.
    const singleCategory =
      input.categories && input.categories.length === 1
        ? input.categories[0]
        : undefined;
    const categorySet = input.categories?.length
      ? new Set(input.categories)
      : null;

    const perWorkspace: FederatedSearchResultItem[][] = await Promise.all(
      targets.map(async (ws) => {
        const rows = await this.search.search({
          workspaceId: ws.id,
          userId: input.userId,
          query,
          category: singleCategory,
          limit: this.PER_CATEGORY,
        });
        return rows
          .filter((r) => !categorySet || categorySet.has(r.category))
          .map<FederatedSearchResultItem>((r) => ({ ...r, workspace: ws }));
      }),
    );

    const merged = mergeFederatedResults(perWorkspace, {
      page: Math.max(0, input.page ?? 0),
      pageSize: Math.min(50, Math.max(1, input.pageSize ?? 30)),
      dateFrom: input.dateFrom ?? null,
      dateTo: input.dateTo ?? null,
      fileTypePrefix: input.fileType ?? null,
      projectId: input.projectId ?? null,
    });

    return {
      items: merged.items,
      hasMore: merged.hasMore,
      workspaces: allWorkspaces,
    };
  }
}
