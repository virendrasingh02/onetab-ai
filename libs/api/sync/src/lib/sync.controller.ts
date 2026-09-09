import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import { CurrentUser, WorkspaceId } from '@org/api-common';
import type { SyncChangesDigest, SyncState } from '@org/types';
import { SyncService } from './sync.service.js';

/**
 * Incremental background-sync endpoints for one workspace.
 *
 * Read-only and additive: clients that predate this controller keep working
 * unchanged, and `@org/sync` falls back to a full refetch on a 404. Guarded by
 * `WorkspaceRoleGuard` exactly like the notifications surface, and every query
 * is scoped to the caller + workspace inside the service.
 */
@Controller({ path: 'workspaces/:workspaceId/sync', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Get('changes')
  getChanges(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Query('since') since?: string,
  ): Promise<SyncChangesDigest> {
    return this.sync.getChanges(workspaceId, userId, since);
  }

  @Get('state')
  getState(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
  ): Promise<SyncState> {
    return this.sync.getState(workspaceId, userId);
  }
}
