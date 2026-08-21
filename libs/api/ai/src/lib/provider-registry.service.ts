import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AIModelMetadata,
  AIProvider,
  AIProviderMetadata,
  AIProviderStatus,
  ProviderConnectionTestResult,
} from '@org/types';
import {
  AnthropicAdapter,
  CohereAdapter,
  DeepSeekAdapter,
  GeminiAdapter,
  GroqAdapter,
  IProviderAdapter,
  MistralAdapter,
  NvidiaAdapter,
  OllamaAdapter,
  OpenAIAdapter,
  OpenRouterAdapter,
  TogetherAdapter,
  XAIAdapter,
} from './adapters/index.js';

@Injectable()
export class ProviderRegistryService implements OnModuleInit {
  private readonly logger = new Logger(ProviderRegistryService.name);
  private readonly adapters = new Map<AIProvider, IProviderAdapter>();

  constructor(private readonly config: ConfigService) {
    this.registerAdapter(new NvidiaAdapter(this.config));
    this.registerAdapter(new OpenAIAdapter(this.config));
    this.registerAdapter(new AnthropicAdapter(this.config));
    this.registerAdapter(new GeminiAdapter(this.config));
    this.registerAdapter(new DeepSeekAdapter(this.config));
    this.registerAdapter(new GroqAdapter(this.config));
    this.registerAdapter(new MistralAdapter(this.config));
    this.registerAdapter(new XAIAdapter(this.config));
    this.registerAdapter(new TogetherAdapter(this.config));
    this.registerAdapter(new OpenRouterAdapter(this.config));
    this.registerAdapter(new CohereAdapter(this.config));
    this.registerAdapter(new OllamaAdapter(this.config));
  }

  onModuleInit(): void {
    const configuredList = Array.from(this.adapters.values())
      .filter((a) => a.isConfigured())
      .map((a) => a.provider.toUpperCase());

    this.logger.log(
      `ProviderRegistry initialized with ${this.adapters.size} providers (Configured: [${configuredList.join(', ')}])`
    );
  }

  private registerAdapter(adapter: IProviderAdapter): void {
    this.adapters.set(adapter.provider, adapter);
  }

  getAdapter(provider: AIProvider): IProviderAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      // Fallback to Ollama or Nvidia if provider not found
      return (
        this.adapters.get('nvidia') ??
        this.adapters.get('ollama') ??
        Array.from(this.adapters.values())[0]!
      );
    }
    return adapter;
  }

  hasAdapter(provider: AIProvider): boolean {
    return this.adapters.has(provider);
  }

  getAllAdapters(): IProviderAdapter[] {
    return Array.from(this.adapters.values());
  }

  getAllProvidersMetadata(): AIProviderMetadata[] {
    return Array.from(this.adapters.values()).map((adapter) => {
      const isConfigured = adapter.isConfigured();
      const models = adapter.getModels();
      const capabilities = Array.from(
        new Set(
          models.flatMap((m) =>
            Array.isArray(m.capabilities)
              ? m.capabilities
              : Object.entries(m.capabilities)
                  .filter(([, v]) => Boolean(v))
                  .map(([k]) => k)
          )
        )
      );

      const status: AIProviderStatus = isConfigured
        ? 'CONNECTED'
        : 'NOT_CONFIGURED';

      return {
        id: adapter.provider,
        name: this.formatProviderName(adapter.provider),
        type: 'llm',
        configured: isConfigured,
        requiresApiKey: adapter.provider !== 'ollama',
        status,
        capabilities,
        defaultModel: adapter.defaultModel,
        models,
        description: `High performance multi-model integration for ${this.formatProviderName(adapter.provider)}`,
      };
    });
  }

  getAllModels(): AIModelMetadata[] {
    return Array.from(this.adapters.values()).flatMap((adapter) =>
      adapter.getModels()
    );
  }

  async testConnection(
    provider: AIProvider,
    model?: string
  ): Promise<ProviderConnectionTestResult> {
    const adapter = this.getAdapter(provider);
    if (!adapter) {
      return {
        provider,
        model,
        status: 'ERROR',
        latencyMs: null,
        detail: `Unknown provider: ${provider}`,
        checkedAt: new Date().toISOString(),
      };
    }
    return adapter.healthCheck();
  }

  private formatProviderName(provider: AIProvider): string {
    const names: Record<AIProvider, string> = {
      nvidia: 'NVIDIA NIM',
      openai: 'OpenAI',
      anthropic: 'Anthropic',
      gemini: 'Google Gemini',
      deepseek: 'DeepSeek',
      groq: 'Groq (LPU)',
      mistral: 'Mistral AI',
      xai: 'xAI (Grok)',
      together: 'Together AI',
      openrouter: 'OpenRouter',
      cohere: 'Cohere',
      ollama: 'Ollama (Local)',
    };
    return names[provider] ?? provider.toUpperCase();
  }
}
