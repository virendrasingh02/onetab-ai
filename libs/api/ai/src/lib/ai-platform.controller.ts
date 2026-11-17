import { ContentModerationService } from './content-moderation.service.js';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WorkspaceRoleGuard } from '@org/api-auth';
import {
  CurrentUser,
  RequireWorkspacePermissions,
  WorkspaceId,
  zodBody,
  type AuthenticatedUser,
} from '@org/api-common';
import {
  WorkspacePermission,
  type AIProvider,
  type SaveProviderCredentialInput,
  type UpdateModelSettingsInput,
} from '@org/types';
import {
  saveProviderCredentialSchema,
  updateModelSettingsSchema,
} from '@org/validation';
import type { Response } from 'express';
import { z } from 'zod';
import {
  parseTaskFilterRules,
  sanitizeTaskFilterReply,
  taskFilterSystemPrompt,
  type TaskFilterContext,
  type TaskFilterResult,
} from './task-filter-parse.js';

const taskFilterSchema = z.object({
  prompt: z.string().trim().min(1).max(300),
  statuses: z
    .array(z.object({ id: z.string().max(100), name: z.string().max(100) }))
    .max(50),
  members: z
    .array(z.object({ id: z.string().max(100), name: z.string().max(200) }))
    .max(500),
  milestones: z.array(z.string().max(200)).max(200),
});
import { AICredentialService } from './ai-credential.service.js';
import {
  AIInfrastructureService,
  type ChatMessage,
} from './ai-infrastructure.service.js';

/**
 * Model inference and configuration for one workspace.
 *
 * Scoped to a workspace even though the models hold no workspace data: these
 * calls cost money and compute, so they need an owner to attribute and rate
 * limit against.
 */
@Controller({ path: 'workspaces/:workspaceId/ai', version: '1' })
@UseGuards(WorkspaceRoleGuard)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class AIPlatformController {
  constructor(
    private readonly aiService: AIInfrastructureService,
    private readonly credentialService: AICredentialService,
    private readonly moderation: ContentModerationService,
  ) {}

  @Get('providers')
  getProviders(@WorkspaceId() workspaceId: string) {
    return this.credentialService.listWorkspaceProviders(workspaceId);
  }

  @Get('providers/:provider')
  getProvider(
    @WorkspaceId() workspaceId: string,
    @Param('provider') provider: AIProvider,
  ) {
    return this.credentialService.getWorkspaceProvider(workspaceId, provider);
  }

  @Post('providers/:provider/credentials')
  // Workspace AI credentials decide where every prompt in the workspace is
  // sent and who pays for it; a guest could previously replace or delete them.
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  saveCredential(
    @WorkspaceId() workspaceId: string,
    @Param('provider') provider: AIProvider,
    @Body(zodBody(saveProviderCredentialSchema))
    body: SaveProviderCredentialInput,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.credentialService.saveCredential(
      workspaceId,
      provider,
      body,
      user?.id,
    );
  }

  @Patch('providers/:provider/credentials')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  updateCredential(
    @WorkspaceId() workspaceId: string,
    @Param('provider') provider: AIProvider,
    @Body(zodBody(saveProviderCredentialSchema))
    body: SaveProviderCredentialInput,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.credentialService.saveCredential(
      workspaceId,
      provider,
      body,
      user?.id,
    );
  }

  @Delete('providers/:provider/credentials')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  deleteCredential(
    @WorkspaceId() workspaceId: string,
    @Param('provider') provider: AIProvider,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.credentialService.deleteCredential(
      workspaceId,
      provider,
      user?.id,
    );
  }

  @Post('providers/:provider/test')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  testProvider(
    @WorkspaceId() workspaceId: string,
    @Param('provider') provider: AIProvider,
    @Body() body: { model?: string },
  ) {
    return this.credentialService.testWorkspaceConnection(
      workspaceId,
      provider,
      body?.model,
    );
  }

  @Patch('models/:model')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  updateModelSetting(
    @WorkspaceId() workspaceId: string,
    @Param('model') model: string,
    @Body(zodBody(updateModelSettingsSchema)) body: UpdateModelSettingsInput,
  ) {
    return this.credentialService.updateModelSettings(workspaceId, model, body);
  }

  @Get('models')
  getModels(@WorkspaceId() workspaceId: string) {
    return this.credentialService.listWorkspaceModels(workspaceId);
  }

  @Post('test-connection')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  testConnection(
    @WorkspaceId() workspaceId: string,
    @Body() body: { provider: AIProvider; model?: string },
  ) {
    return this.credentialService.testWorkspaceConnection(
      workspaceId,
      body.provider,
      body.model,
    );
  }

  @Post('chat')
  async chat(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body()
    body: {
      messages: ChatMessage[];
      provider?: AIProvider;
      model?: string;
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
      tools?: Array<Record<string, unknown>>;
      structuredOutput?: Record<string, unknown>;
    },
  ) {
    const provider = body.provider || 'nvidia';
    const cred = await this.credentialService.resolveCredential(provider, {
      workspaceId,
      userId: user?.id,
    });
    return this.aiService.chat({
      ...body,
      moderate: 'all',
      provider,
      model: body.model || cred.defaultModel,
      apiKey: cred.apiKey,
      baseUrl: cred.baseUrl,
    });
  }

  @Post('stream')
  async stream(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body()
    body: {
      messages: ChatMessage[];
      provider?: AIProvider;
      model?: string;
      temperature?: number;
      maxTokens?: number;
      tools?: Array<Record<string, unknown>>;
      structuredOutput?: Record<string, unknown>;
    },
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      const provider = body.provider || 'nvidia';
      const cred = await this.credentialService.resolveCredential(provider, {
        workspaceId,
        userId: user?.id,
      });
      for await (const event of this.aiService.streamChat({
        ...body,
        moderate: 'all',
        provider,
        model: body.model || cred.defaultModel,
        apiKey: cred.apiKey,
        baseUrl: cred.baseUrl,
      })) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (err: unknown) {
      const errorEvent = {
        type: 'error',
        error: {
          code: 'AI_PROVIDER_ERROR',
          message: err instanceof Error ? err.message : String(err),
        },
      };
      res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
    } finally {
      res.end();
    }
  }

  @Post('summarize')
  async summarize(
    @WorkspaceId() _workspaceId: string,
    @Body() body: { text: string },
  ) {
    await this.moderation.assertTextAllowed(body.text);
    return this.aiService.summarizeThread(body.text);
  }

  /**
   * Board smart filter: a sentence in, the Filter menu's facets out. Uses the
   * workspace's model when one answers in time, else the rule parser, so the
   * bar always returns something real rather than an error.
   */
  @Post('task-filter')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async taskFilter(
    @WorkspaceId() _workspaceId: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body(zodBody(taskFilterSchema)) body: z.infer<typeof taskFilterSchema>,
  ): Promise<TaskFilterResult> {
    const ctx: TaskFilterContext = { ...body, currentUserId: user?.id };
    await this.moderation.assertTextAllowed(body.prompt);
    try {
      const res = await this.aiService.chat({
        messages: [
          { role: 'system', content: taskFilterSystemPrompt(ctx) },
          { role: 'user', content: body.prompt },
        ],
        temperature: 0,
        maxTokens: 400,
        signal: AbortSignal.timeout(12_000),
      });
      const parsed = sanitizeTaskFilterReply(res.message.content ?? '', ctx);
      if (parsed) return parsed;
    } catch {
      // No provider, a timeout or a bad reply: the rule parser still answers.
    }
    return parseTaskFilterRules(ctx);
  }

  @Post('translate')
  async translate(
    @WorkspaceId() _workspaceId: string,
    @Body() body: { text: string; targetLanguage: string },
  ) {
    await this.moderation.assertTextAllowed(body.text);
    return this.aiService.translateText(body.text, body.targetLanguage);
  }

  @Post('generate-image')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async generateImage(
    @WorkspaceId() _workspaceId: string,
    @Body() body: { prompt: string; provider?: string },
  ) {
    await this.moderation.assertTextAllowed(body.prompt);
    return this.aiService.generateImage(body.prompt, body.provider);
  }

  @Post('vision')
  async analyzeVision(
    @WorkspaceId() _workspaceId: string,
    @Body() body: { imageUrl: string; prompt?: string },
  ) {
    await this.moderation.assertTextAllowed(body.prompt);
    return this.aiService.analyzeVision(body.imageUrl, body.prompt);
  }

  /**
   * Retrieval over this workspace's documents.
   */
  @Post('rag-search')
  ragSearch(
    @WorkspaceId() workspaceId: string,
    @Body() body: { query: string; limit?: number },
  ) {
    return this.aiService.queryRAG(workspaceId, body.query, body.limit);
  }
}
