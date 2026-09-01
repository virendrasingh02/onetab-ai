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

  /**
   * Optional launch allowlists. Empty (env unset) means "surface everything" —
   * so other environments are unaffected. When set, `getEnabled*` and the
   * provider/model metadata the settings UI and model picker read are narrowed
   * to these. Every adapter is still *registered* and directly callable; this
   * only controls what is advertised. "Add the rest later" = extend the env
   * lists (or clear them).
   */
  private readonly enabledProviders: Set<AIProvider>;
  private readonly enabledModelIds: Set<string>;

  constructor(private readonly config: ConfigService) {
    this.enabledProviders = new Set(
      (this.config.get<string>('AI_ENABLED_PROVIDERS') ?? '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean) as AIProvider[],
    );
    this.enabledModelIds = new Set(
      (this.config.get<string>('AI_ENABLED_MODELS') ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );

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
    if (this.enabledProviders.size > 0) {
      this.logger.log(
        `AI provider allowlist active: [${Array.from(this.enabledProviders)
          .join(', ')
          .toUpperCase()}]`,
      );
    }
    if (this.enabledModelIds.size > 0) {
      this.logger.log(
        `AI model allowlist active: [${Array.from(this.enabledModelIds).join(', ')}]`,
      );
    }
  }

  /** Whether a provider is surfaced in the UI (always true when no allowlist). */
  isProviderEnabled(provider: AIProvider): boolean {
    return (
      this.enabledProviders.size === 0 || this.enabledProviders.has(provider)
    );
  }

  private isModelEnabled(model: AIModelMetadata): boolean {
    if (!this.isProviderEnabled(model.provider)) return false;
    if (this.enabledModelIds.size === 0) return true;
    return (
      this.enabledModelIds.has(model.id) || this.enabledModelIds.has(model.model)
    );
  }

  /** Models surfaced in the picker / settings, after the launch allowlists. */
  getEnabledModels(): AIModelMetadata[] {
    return this.getAllModels().filter((m) => this.isModelEnabled(m));
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
    return Array.from(this.adapters.values())
      .filter((adapter) => this.isProviderEnabled(adapter.provider))
      .map((adapter) => {
        const isConfigured = adapter.isConfigured();
        const models = adapter
          .getModels()
          .filter((m) => this.isModelEnabled(m));
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
