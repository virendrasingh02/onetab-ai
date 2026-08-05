import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@org/api-auth';
import { AIInfrastructureService, type ChatMessage } from './ai-infrastructure.service.js';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AIPlatformController {
  constructor(private readonly aiService: AIInfrastructureService) {}

  @Post('chat')
  chat(
    @Body() body: { messages: ChatMessage[]; provider?: 'ollama' | 'openai' | 'anthropic' | 'gemini'; model?: string }
  ) {
    return this.aiService.chat(body);
  }

  @Post('summarize')
  summarize(@Body() body: { text: string }) {
    return this.aiService.summarizeThread(body.text);
  }

  @Post('translate')
  translate(@Body() body: { text: string; targetLanguage: string }) {
    return this.aiService.translateText(body.text, body.targetLanguage);
  }

  @Post('generate-image')
  generateImage(@Body() body: { prompt: string; provider?: string }) {
    return this.aiService.generateImage(body.prompt, body.provider);
  }

  @Post('vision')
  analyzeVision(@Body() body: { imageUrl: string; prompt?: string }) {
    return this.aiService.analyzeVision(body.imageUrl, body.prompt);
  }

  @Post('rag-search')
  ragSearch(@Body() body: { query: string; limit?: number }) {
    return this.aiService.queryRAG(body.query, body.limit);
  }
}
