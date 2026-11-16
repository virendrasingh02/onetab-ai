import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import {
  CurrentUser,
  RequireWorkspacePermissions,
  WorkspaceId,
  zodBody,
} from '@org/api-common';
import type {
  CreateGraphEntityInput,
  CreateGraphRelationshipInput,
  GraphEntityType,
  GraphQueryInput,
  GraphTraversalInput,
  IndexSourceInput,
  ContextQueryRequest,
} from '@org/types';
import { WorkspacePermission } from '@org/types';
import {
  createGraphEntitySchema,
  createGraphRelationshipSchema,
  graphQuerySchema,
  graphTraversalSchema,
  indexSourceSchema,
  updateGraphEntitySchema,
  contextQuerySchema,
} from '@org/validation';
import { KnowledgeGraphService } from './knowledge-graph.service.js';
import { ContextEngineService } from './context-engine.service.js';

@Controller({ path: 'workspaces/:workspaceId/knowledge-graph', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class KnowledgeGraphController {
  constructor(
    private readonly graphService: KnowledgeGraphService,
    private readonly contextEngine: ContextEngineService,
  ) {}

  // --- Health & Overview ---

  @Get('health')
  getHealth(@WorkspaceId() workspaceId: string) {
    return this.graphService.getGraphHealth(workspaceId);
  }

  // --- Graph Query & Traversal ---

  @Post('query')
  queryGraph(
    @WorkspaceId() workspaceId: string,
    @Body(zodBody(graphQuerySchema)) query: GraphQueryInput,
  ) {
    return this.graphService.queryGraph(workspaceId, query);
  }

  @Post('traverse')
  traverseGraph(
    @WorkspaceId() workspaceId: string,
    @Body(zodBody(graphTraversalSchema)) input: GraphTraversalInput,
  ) {
    return this.graphService.traverseGraph(workspaceId, input);
  }

  // --- Entities ---

  @Get('entities')
  listEntities(
    @WorkspaceId() workspaceId: string,
    @Query('query') query?: string,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
  ) {
    return this.graphService.queryGraph(workspaceId, {
      query,
      entityTypes: type ? [type as GraphEntityType] : undefined,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Post('entities')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  createEntity(
    @WorkspaceId() workspaceId: string,
    @Body(zodBody(createGraphEntitySchema)) body: CreateGraphEntityInput,
  ) {
    return this.graphService.createEntity(workspaceId, body);
  }

  @Get('entities/:id')
  getEntity(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.graphService.findEntity(workspaceId, id);
  }

  @Patch('entities/:id')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  updateEntity(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Body(zodBody(updateGraphEntitySchema)) body: Partial<CreateGraphEntityInput>,
  ) {
    return this.graphService.updateEntity(workspaceId, id, body);
  }

  @Delete('entities/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireWorkspacePermissions(WorkspacePermission.DELETE)
  deleteEntity(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.graphService.deleteEntity(workspaceId, id);
  }

  @Get('entities/:id/relations')
  getRelations(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Query('direction') direction?: 'OUTGOING' | 'INCOMING' | 'BOTH',
  ) {
    return this.graphService.findRelations(workspaceId, id, direction ?? 'BOTH');
  }

  // --- Relationships ---

  @Post('relationships')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  createRelationship(
    @WorkspaceId() workspaceId: string,
    @Body(zodBody(createGraphRelationshipSchema)) body: CreateGraphRelationshipInput,
  ) {
    return this.graphService.createRelationship(workspaceId, body);
  }

  // --- Sources & Ingestion ---

  @Get('sources')
  listSources(@WorkspaceId() workspaceId: string) {
    return this.graphService.listSources(workspaceId);
  }

  @Post('sources/index')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  indexSource(
    @WorkspaceId() workspaceId: string,
    @Body(zodBody(indexSourceSchema)) body: IndexSourceInput,
  ) {
    return this.graphService.indexSource(workspaceId, body);
  }

  @Post('reindex')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  reindex(@WorkspaceId() workspaceId: string) {
    return this.graphService.reindexAll(workspaceId);
  }

  @Delete('sources/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireWorkspacePermissions(WorkspacePermission.DELETE)
  deleteSource(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.graphService.removeSource(workspaceId, id);
  }

  // --- Context Engine ---

  @Post('context/build')
  buildContext(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string | null,
    @Body(zodBody(contextQuerySchema)) body: ContextQueryRequest,
  ) {
    return this.contextEngine.buildContext(workspaceId, {
      ...body,
      actingUserId: userId,
    });
  }
}
