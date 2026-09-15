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
  UseGuards,
} from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import {
  CurrentUser,
  RequireWorkspacePermissions,
  WorkspaceId,
} from '@org/api-common';
import { WorkspacePermission } from '@org/types';
import type {
  CreateKnowledgeBaseInput,
  IngestDocumentInput,
  KnowledgeRetrievalQuery,
} from '@org/types';
import { KnowledgeService } from './knowledge.service.js';

@Controller({ path: 'workspaces/:workspaceId/knowledge', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  list(@WorkspaceId() workspaceId: string) {
    return this.knowledgeService.listKnowledgeBases(workspaceId);
  }

  @Get(':id')
  get(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.knowledgeService.getKnowledgeBase(workspaceId, id);
  }

  @Post()
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  create(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body() body: CreateKnowledgeBaseInput,
  ) {
    return this.knowledgeService.createKnowledgeBase(workspaceId, userId, body);
  }

  @Patch(':id')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  update(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Body() body: Partial<CreateKnowledgeBaseInput>,
  ) {
    return this.knowledgeService.updateKnowledgeBase(workspaceId, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireWorkspacePermissions(WorkspacePermission.DELETE)
  delete(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.knowledgeService.deleteKnowledgeBase(workspaceId, id);
  }

  // --- Documents ---

  @Get(':id/documents')
  listDocuments(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.knowledgeService.listDocuments(workspaceId, id);
  }

  @Post(':id/documents')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  ingestDocument(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Body() body: IngestDocumentInput,
  ) {
    return this.knowledgeService.ingestDocument(workspaceId, id, body);
  }

  @Delete(':id/documents/:documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireWorkspacePermissions(WorkspacePermission.DELETE)
  deleteDocument(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
  ) {
    return this.knowledgeService.deleteDocument(workspaceId, id, documentId);
  }

  // --- Chunks ---

  @Get(':id/documents/:documentId/chunks')
  listChunks(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
  ) {
    return this.knowledgeService.listChunks(workspaceId, id, documentId);
  }

  @Patch(':id/documents/:documentId/chunks/:chunkId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  updateChunk(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Param('chunkId') chunkId: string,
    @Body('content') content: string,
  ) {
    return this.knowledgeService.updateChunk(
      workspaceId,
      id,
      documentId,
      chunkId,
      content,
    );
  }

  // --- Retrieval Test ---

  @Post(':id/retrieve')
  retrieve(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Body() query: KnowledgeRetrievalQuery,
  ) {
    return this.knowledgeService.retrieve(workspaceId, id, query);
  }
}
