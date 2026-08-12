import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import { WorkspaceId } from '@org/api-common';
import { SearchService, type SearchCategory } from './search.service.js';

/**
 * Search within one workspace.
 *
 * Workspace-scoped by path and guarded by membership — search is exactly the
 * kind of endpoint that would otherwise become a cross-tenant read of every
 * document title in the database.
 */
@Controller({ path: 'workspaces/:workspaceId/search', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  query(
    @WorkspaceId() workspaceId: string,
    @Query('q') q = '',
    @Query('category') category?: SearchCategory,
    @Query('limit') limit?: string,
  ) {
    return this.search.search({
      workspaceId,
      query: q,
      category,
      limit: limit ? Math.min(Number(limit) || 8, 50) : undefined,
    });
  }

  /** Result counts per category, for the filter chips. */
  @Get('counts')
  counts(@WorkspaceId() workspaceId: string, @Query('q') q = '') {
    return this.search.counts(workspaceId, q);
  }
}
