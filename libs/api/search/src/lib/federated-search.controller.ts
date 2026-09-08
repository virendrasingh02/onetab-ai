import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '@org/api-common';
import {
  FederatedSearchService,
} from './federated-search.service.js';
import type { SearchCategory } from './search.service.js';

/**
 * Cross-workspace search (brief §4).
 *
 * Deliberately outside `/workspaces/:workspaceId` — it spans every workspace
 * the caller belongs to. Only the global `JwtAuthGuard` applies; the
 * per-workspace membership check lives in `FederatedSearchService` (it queries
 * only ACTIVE memberships), so this route can never read another tenant's data.
 */
@Controller({ path: 'search', version: '1' })
export class FederatedSearchController {
  constructor(private readonly federated: FederatedSearchService) {}

  @Get()
  query(
    @CurrentUser('id') userId: string,
    @Query('q') q = '',
    @Query('workspaceIds') workspaceIds?: string,
    @Query('categories') categories?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('fileType') fileType?: string,
    @Query('projectId') projectId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const csv = (v?: string) =>
      v
        ? v
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

    return this.federated.searchAll({
      userId,
      query: q,
      workspaceIds: csv(workspaceIds),
      categories: csv(categories) as SearchCategory[] | undefined,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      fileType: fileType || null,
      projectId: projectId || null,
      page: page ? Number(page) || 0 : 0,
      pageSize: pageSize ? Number(pageSize) || undefined : undefined,
    });
  }
}
