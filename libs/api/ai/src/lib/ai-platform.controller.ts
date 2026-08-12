import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WorkspaceRoleGuard } from '@org/api-auth';
import { WorkspaceId } from '@org/api-common';
import {
  AIInfrastructureService,
  type ChatMessage,
} from './ai-infrastructure.service.js';

/**
 * Model inference for one workspace.
 *
 * Scoped to a workspace even though the models hold no workspace data: these
 * calls cost money and compute, so they need an owner to attribute and rate
 * limit against. Under `JwtAuthGuard` alone, any account could burn the
 * platform's inference budget without belonging to anything.
 *
 * The throttle is far below the global default for the same reason — a chat
 * round trip is orders of magnitude more expensive than a database read.
 */
@Controller({ path: 'workspaces/:workspaceId/ai', version: '1' })
@UseGuards(WorkspaceRoleGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
export class AIPlatformController {
  constructor(private readonly aiService: AIInfrastructureService) {}

  @Post('chat')
  chat(
    @WorkspaceId() _workspaceId: string,
    @Body()
    body: {
      messages: ChatMessage[];
      provider?: 'ollama' | 'openai' | 'anthropic' | 'gemini';
      model?: string;
    },
  ) {
    return this.aiService.chat(body);
  }

  @Post('summarize')
  summarize(@WorkspaceId() _workspaceId: string, @Body() body: { text: string }) {
    return this.aiService.summarizeThread(body.text);
  }

  @Post('translate')
  translate(
    @WorkspaceId() _workspaceId: string,
    @Body() body: { text: string; targetLanguage: string },
  ) {
    return this.aiService.translateText(body.text, body.targetLanguage);
  }

  @Post('generate-image')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  generateImage(
    @WorkspaceId() _workspaceId: string,
    @Body() body: { prompt: string; provider?: string },
  ) {
    return this.aiService.generateImage(body.prompt, body.provider);
  }

  @Post('vision')
  analyzeVision(
    @WorkspaceId() _workspaceId: string,
    @Body() body: { imageUrl: string; prompt?: string },
  ) {
    return this.aiService.analyzeVision(body.imageUrl, body.prompt);
  }

  @Post('rag-search')
  ragSearch(
    @WorkspaceId() _workspaceId: string,
    @Body() body: { query: string; limit?: number },
  ) {
    return this.aiService.queryRAG(body.query, body.limit);
  }
}
