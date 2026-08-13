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
import { WorkspaceId, zodBody } from '@org/api-common';
import {
  createPromptTemplateSchema,
  updatePromptTemplateSchema,
  type CreatePromptTemplateInput,
  type UpdatePromptTemplateInput,
} from '@org/validation';
import { PromptTemplateService } from './prompt-template.service.js';

/**
 * The prompt library for one workspace.
 *
 * Under `WorkspaceRoleGuard` like the rest of the workspace routes: prompts are
 * a tenant's own content, and the shared system templates they also see are
 * read-only, enforced in the service rather than here.
 */
@Controller({ path: 'workspaces/:workspaceId/prompt-templates', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class PromptTemplateController {
  constructor(private readonly templates: PromptTemplateService) {}

  @Get()
  list(@WorkspaceId() workspaceId: string) {
    return this.templates.list(workspaceId);
  }

  @Post()
  create(
    @WorkspaceId() workspaceId: string,
    @Body(zodBody(createPromptTemplateSchema)) body: CreatePromptTemplateInput,
  ) {
    return this.templates.create(workspaceId, body);
  }

  @Patch(':templateId')
  update(
    @WorkspaceId() workspaceId: string,
    @Param('templateId') templateId: string,
    @Body(zodBody(updatePromptTemplateSchema)) body: UpdatePromptTemplateInput,
  ) {
    return this.templates.update(workspaceId, templateId, body);
  }

  @Delete(':templateId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @WorkspaceId() workspaceId: string,
    @Param('templateId') templateId: string,
  ): Promise<void> {
    return this.templates.remove(workspaceId, templateId);
  }
}
