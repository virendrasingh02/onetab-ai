import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { WorkspaceRoleGuard } from '@org/api-auth';
import {
  createKnowledgeBaseSchema,
  importKnowledgeUrlSchema,
  ingestKnowledgeDocumentSchema,
  knowledgeAnswerSchema,
  knowledgeRetrievalSchema,
  updateKnowledgeBaseSchema,
  updateKnowledgeChunkSchema,
  updateKnowledgeDocumentSchema,
} from '@org/validation';
import {
  CurrentUser,
  RequireWorkspacePermissions,
  WorkspaceId,
  zodBody,
} from '@org/api-common';
import { WorkspacePermission } from '@org/types';
import type {
  CreateKnowledgeBaseInput,
  IngestDocumentInput,
  KnowledgeAnswerRequest,
  KnowledgeRetrievalQuery,
} from '@org/types';
import { MAX_UPLOAD_BYTES } from './knowledge-extract.js';
import { KnowledgeService } from './knowledge.service.js';

function parseTags(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  return raw
    .split(',')
    .map((t) => t.trim().slice(0, 60))
    .filter(Boolean)
    .slice(0, 20);
}

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
    @Body(zodBody(createKnowledgeBaseSchema)) body: CreateKnowledgeBaseInput,
  ) {
    return this.knowledgeService.createKnowledgeBase(workspaceId, userId, body);
  }

  @Patch(':id')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  update(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Body(zodBody(updateKnowledgeBaseSchema)) body: Partial<CreateKnowledgeBaseInput>,
  ) {
    return this.knowledgeService.updateKnowledgeBase(workspaceId, id, body);
  }

  @Post(':id/reindex')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  reindex(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Body() body: { embeddingModel?: string } = {},
  ) {
    const model = typeof body?.embeddingModel === 'string' ? body.embeddingModel.trim().slice(0, 200) : '';
    return this.knowledgeService.reindexKnowledgeBase(workspaceId, id, model || undefined);
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
    @Body(zodBody(ingestKnowledgeDocumentSchema)) body: IngestDocumentInput,
  ) {
    return this.knowledgeService.ingestDocument(workspaceId, id, body);
  }

  @Post(':id/documents/upload')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  uploadDocument(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @UploadedFile() file: { originalname: string; buffer: Buffer } | undefined,
    @Body('tags') tags?: string,
  ) {
    if (!file) throw new BadRequestException('Attach a file in the "file" field.');
    return this.knowledgeService.ingestFile(workspaceId, id, file, parseTags(tags));
  }

  @Post(':id/documents/import-url')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  importUrl(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Body(zodBody(importKnowledgeUrlSchema))
    body: { url: string; sitemap?: boolean; maxPages?: number; tags?: string[] },
  ) {
    return this.knowledgeService.importUrl(workspaceId, id, body);
  }

  @Get(':id/documents/:documentId')
  getDocument(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
  ) {
    return this.knowledgeService.getDocument(workspaceId, id, documentId);
  }

  @Patch(':id/documents/:documentId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  updateDocument(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Body(zodBody(updateKnowledgeDocumentSchema)) body: { name?: string; tags?: string[] },
  ) {
    return this.knowledgeService.updateDocument(workspaceId, id, documentId, body);
  }

  @Post(':id/documents/:documentId/reindex')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  reindexDocument(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
  ) {
    return this.knowledgeService.reindexDocument(workspaceId, id, documentId);
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
    @Body(zodBody(updateKnowledgeChunkSchema)) { content }: { content: string },
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
    @Body(zodBody(knowledgeRetrievalSchema)) query: KnowledgeRetrievalQuery,
  ) {
    return this.knowledgeService.retrieve(workspaceId, id, query);
  }

  @Get(':id/usage')
  usage(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Query('days') days?: string,
  ) {
    const n = Math.min(Math.max(parseInt(days ?? '7', 10) || 7, 1), 90);
    return this.knowledgeService.usageSummary(workspaceId, id, n);
  }

  // --- Grounded answer (retrieve → rerank → generate with citations) ---

  @Post(':id/answer')
  answer(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Body(zodBody(knowledgeAnswerSchema)) body: KnowledgeAnswerRequest,
  ) {
    return this.knowledgeService.answer(workspaceId, id, body);
  }
}
