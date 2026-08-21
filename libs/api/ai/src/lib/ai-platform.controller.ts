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
  WorkspaceId,
  type AuthenticatedUser,
} from '@org/api-common';
import type {
  AIProvider,
  SaveProviderCredentialInput,
  UpdateModelSettingsInput,
} from '@org/types';
import type { Response } from 'express';
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
    private readonly credentialService: AICredentialService
  ) {}

  @Get('providers')
  getProviders(@WorkspaceId() workspaceId: string) {
    return this.credentialService.listWorkspaceProviders(workspaceId);
  }

  @Get('providers/:provider')
  getProvider(
    @WorkspaceId() workspaceId: string,
    @Param('provider') provider: AIProvider
  ) {
    return this.credentialService.getWorkspaceProvider(workspaceId, provider);
  }

  @Post('providers/:provider/credentials')
  saveCredential(
    @WorkspaceId() workspaceId: string,
    @Param('provider') provider: AIProvider,
    @Body() body: SaveProviderCredentialInput,
    @CurrentUser() user?: AuthenticatedUser
  ) {
    return this.credentialService.saveCredential(
      workspaceId,
      provider,
      body,
      user?.id
    );
  }

  @Patch('providers/:provider/credentials')
  updateCredential(
    @WorkspaceId() workspaceId: string,
    @Param('provider') provider: AIProvider,
    @Body() body: SaveProviderCredentialInput,
    @CurrentUser() user?: AuthenticatedUser
  ) {
    return this.credentialService.saveCredential(
      workspaceId,
      provider,
      body,
      user?.id
    );
  }

  @Delete('providers/:provider/credentials')
  deleteCredential(
    @WorkspaceId() workspaceId: string,
    @Param('provider') provider: AIProvider,
    @CurrentUser() user?: AuthenticatedUser
  ) {
    return this.credentialService.deleteCredential(
      workspaceId,
      provider,
      user?.id
    );
  }

  @Post('providers/:provider/test')
  testProvider(
    @WorkspaceId() workspaceId: string,
    @Param('provider') provider: AIProvider,
    @Body() body: { model?: string }
  ) {
    return this.credentialService.testWorkspaceConnection(
      workspaceId,
      provider,
      body?.model
    );
  }

  @Patch('models/:model')
  updateModelSetting(
    @WorkspaceId() workspaceId: string,
    @Param('model') model: string,
    @Body() body: UpdateModelSettingsInput
  ) {
    return this.credentialService.updateModelSettings(
      workspaceId,
      model,
      body
    );
  }

  @Get('models')
  getModels(@WorkspaceId() _workspaceId: string) {
    return this.aiService.getAllModels();
  }

  @Post('test-connection')
  testConnection(
    @WorkspaceId() workspaceId: string,
    @Body() body: { provider: AIProvider; model?: string }
  ) {
    return this.credentialService.testWorkspaceConnection(
      workspaceId,
      body.provider,
      body.model
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
    }
  ) {
    const provider = body.provider || 'nvidia';
    const cred = await this.credentialService.resolveCredential(provider, {
      workspaceId,
      userId: user?.id,
    });
    return this.aiService.chat({
      ...body,
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
    @Res() res: Response
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
  summarize(@WorkspaceId() _workspaceId: string, @Body() body: { text: string }) {
    return this.aiService.summarizeThread(body.text);
  }

  @Post('translate')
  translate(
    @WorkspaceId() _workspaceId: string,
    @Body() body: { text: string; targetLanguage: string }
  ) {
    return this.aiService.translateText(body.text, body.targetLanguage);
  }

  @Post('generate-image')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  generateImage(
    @WorkspaceId() _workspaceId: string,
    @Body() body: { prompt: string; provider?: string }
  ) {
    return this.aiService.generateImage(body.prompt, body.provider);
  }

  @Post('vision')
  analyzeVision(
    @WorkspaceId() _workspaceId: string,
    @Body() body: { imageUrl: string; prompt?: string }
  ) {
    return this.aiService.analyzeVision(body.imageUrl, body.prompt);
  }

  /**
   * Retrieval over this workspace's documents.
   */
  @Post('rag-search')
  ragSearch(
    @WorkspaceId() workspaceId: string,
    @Body() body: { query: string; limit?: number }
  ) {
    return this.aiService.queryRAG(workspaceId, body.query, body.limit);
  }
}
