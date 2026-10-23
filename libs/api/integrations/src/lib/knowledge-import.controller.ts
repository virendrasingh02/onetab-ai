import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import { CurrentUser, RequireWorkspacePermissions, WorkspaceId, zodBody } from '@org/api-common';
import { WorkspacePermission } from '@org/types';
import { importKnowledgeFromAppSchema } from '@org/validation';
import { KnowledgeImportService } from './knowledge-import.service.js';

/** Browse and import content from a connected Drive / Notion account into a knowledge base. */
@Controller({ path: 'workspaces/:workspaceId/knowledge-sources/:integrationId', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class KnowledgeImportController {
  constructor(private readonly imports: KnowledgeImportService) {}

  @Get('browse')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  browse(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('integrationId') integrationId: string,
    @Query('q') q?: string,
  ) {
    return this.imports.browse(workspaceId, userId, integrationId, q?.slice(0, 200));
  }

  @Post('import')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  import(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('integrationId') integrationId: string,
    @Body(zodBody(importKnowledgeFromAppSchema))
    body: { knowledgeBaseId: string; items: Array<{ id: string; name?: string }>; tags?: string[] },
  ) {
    return this.imports.importItems(workspaceId, userId, body.knowledgeBaseId, integrationId, body.items, body.tags);
  }
}
