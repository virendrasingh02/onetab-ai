import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@org/database';
import type {
  AIModelMetadata,
  AIProvider,
  AIProviderMetadata,
  AIProviderStatus,
  ProviderConnectionTestResult,
  ProviderCredentialRequirement,
  SaveProviderCredentialInput,
  UpdateModelSettingsInput,
} from '@org/types';
import { AIEncryptionService } from './ai-encryption.service.js';
import { ProviderRegistryService } from './provider-registry.service.js';

export interface ResolvedProviderCredential {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  enabled: boolean;
  isCustom: boolean;
  source: 'database' | 'environment' | 'none';
}

const PROVIDER_REQUIREMENTS: Record<AIProvider, ProviderCredentialRequirement[]> = {
  nvidia: [
    {
      name: 'apiKey',
      label: 'NVIDIA API Key',
      type: 'secret',
      required: true,
      placeholder: 'nvapi-...',
      description: 'API key from build.nvidia.com or NGC console.',
    },
    {
      name: 'baseUrl',
      label: 'Base URL',
      type: 'url',
      required: false,
      default: 'https://integrate.api.nvidia.com/v1',
      placeholder: 'https://integrate.api.nvidia.com/v1',
      description: 'NVIDIA NIM or NGC API endpoint.',
    },
  ],
  openai: [
    {
      name: 'apiKey',
      label: 'OpenAI API Key',
      type: 'secret',
      required: true,
      placeholder: 'sk-...',
      description: 'Secret API key from OpenAI platform.',
    },
    {
      name: 'baseUrl',
      label: 'Base URL',
      type: 'url',
      required: false,
      default: 'https://api.openai.com/v1',
      placeholder: 'https://api.openai.com/v1',
      description: 'Custom proxy or OpenAI-compatible endpoint.',
    },
  ],
  anthropic: [
    {
      name: 'apiKey',
      label: 'Anthropic API Key',
      type: 'secret',
      required: true,
      placeholder: 'sk-ant-...',
      description: 'API key from console.anthropic.com.',
    },
    {
      name: 'baseUrl',
      label: 'Base URL',
      type: 'url',
      required: false,
      default: 'https://api.anthropic.com/v1',
      placeholder: 'https://api.anthropic.com/v1',
    },
  ],
  gemini: [
    {
      name: 'apiKey',
      label: 'Google Gemini API Key',
      type: 'secret',
      required: true,
      placeholder: 'AIzaSy...',
      description: 'API key from Google AI Studio.',
    },
  ],
  deepseek: [
    {
      name: 'apiKey',
      label: 'DeepSeek API Key',
      type: 'secret',
      required: true,
      placeholder: 'sk-...',
      description: 'API key from platform.deepseek.com.',
    },
    {
      name: 'baseUrl',
      label: 'Base URL',
      type: 'url',
      required: false,
      default: 'https://api.deepseek.com',
      placeholder: 'https://api.deepseek.com',
    },
  ],
  groq: [
    {
      name: 'apiKey',
      label: 'Groq API Key',
      type: 'secret',
      required: true,
      placeholder: 'gsk_...',
      description: 'API key from console.groq.com.',
    },
    {
      name: 'baseUrl',
      label: 'Base URL',
      type: 'url',
      required: false,
      default: 'https://api.groq.com/openai/v1',
      placeholder: 'https://api.groq.com/openai/v1',
    },
  ],
  mistral: [
    {
      name: 'apiKey',
      label: 'Mistral API Key',
      type: 'secret',
      required: true,
      placeholder: '...',
      description: 'API key from console.mistral.ai.',
    },
    {
      name: 'baseUrl',
      label: 'Base URL',
      type: 'url',
      required: false,
      default: 'https://api.mistral.ai/v1',
      placeholder: 'https://api.mistral.ai/v1',
    },
  ],
  xai: [
    {
      name: 'apiKey',
      label: 'xAI API Key',
      type: 'secret',
      required: true,
      placeholder: 'xai-...',
      description: 'API key from console.x.ai.',
    },
    {
      name: 'baseUrl',
      label: 'Base URL',
      type: 'url',
      required: false,
      default: 'https://api.x.ai/v1',
      placeholder: 'https://api.x.ai/v1',
    },
  ],
  together: [
    {
      name: 'apiKey',
      label: 'Together AI API Key',
      type: 'secret',
      required: true,
      placeholder: '...',
      description: 'API key from api.together.ai.',
    },
    {
      name: 'baseUrl',
      label: 'Base URL',
      type: 'url',
      required: false,
      default: 'https://api.together.xyz/v1',
      placeholder: 'https://api.together.xyz/v1',
    },
  ],
  openrouter: [
    {
      name: 'apiKey',
      label: 'OpenRouter API Key',
      type: 'secret',
      required: true,
      placeholder: 'sk-or-...',
      description: 'API key from openrouter.ai/keys.',
    },
    {
      name: 'baseUrl',
      label: 'Base URL',
      type: 'url',
      required: false,
      default: 'https://openrouter.ai/api/v1',
      placeholder: 'https://openrouter.ai/api/v1',
    },
  ],
  cohere: [
    {
      name: 'apiKey',
      label: 'Cohere API Key',
      type: 'secret',
      required: true,
      placeholder: '...',
      description: 'API key from dashboard.cohere.com/api-keys.',
    },
    {
      name: 'baseUrl',
      label: 'Base URL',
      type: 'url',
      required: false,
      default: 'https://api.cohere.com/v2',
      placeholder: 'https://api.cohere.com/v2',
    },
  ],
  ollama: [
    {
      name: 'baseUrl',
      label: 'Ollama Endpoint URL',
      type: 'url',
      required: false,
      default: 'http://localhost:11434',
      placeholder: 'http://localhost:11434',
      description: 'Local or network Ollama host.',
    },
  ],
};

@Injectable()
export class AICredentialService {
  private readonly logger = new Logger(AICredentialService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly encryption: AIEncryptionService,
    private readonly providerRegistry: ProviderRegistryService
  ) {}

  /**
   * Resolves a provider's active credential across scopes with hierarchical priority:
   * 1. User credential
   * 2. Workspace credential
   * 3. Organization credential
   * 4. System credential
   * 5. Environment fallback
   */
  async resolveCredential(
    provider: AIProvider,
    scope: { workspaceId?: string; userId?: string; orgId?: string }
  ): Promise<ResolvedProviderCredential> {
    // 1. User scope check
    if (scope.userId) {
      const userCred = await this.prisma.aIProviderCredential.findFirst({
        where: { provider, scopeType: 'user', scopeId: scope.userId },
      });
      if (userCred && userCred.enabled && userCred.encryptedApiKey) {
        return {
          apiKey: this.encryption.decrypt(userCred.encryptedApiKey),
          baseUrl: userCred.baseUrl ?? undefined,
          defaultModel: userCred.defaultModel ?? undefined,
          enabled: userCred.enabled,
          isCustom: true,
          source: 'database',
        };
      }
    }

    // 2. Workspace scope check
    if (scope.workspaceId) {
      const wsCred = await this.prisma.aIProviderCredential.findFirst({
        where: { provider, scopeType: 'workspace', scopeId: scope.workspaceId },
      });
      if (wsCred && wsCred.encryptedApiKey) {
        return {
          apiKey: this.encryption.decrypt(wsCred.encryptedApiKey),
          baseUrl: wsCred.baseUrl ?? undefined,
          defaultModel: wsCred.defaultModel ?? undefined,
          enabled: wsCred.enabled,
          isCustom: true,
          source: 'database',
        };
      }
    }

    // 3. Organization scope check
    if (scope.orgId) {
      const orgCred = await this.prisma.aIProviderCredential.findFirst({
        where: { provider, scopeType: 'organization', scopeId: scope.orgId },
      });
      if (orgCred && orgCred.enabled && orgCred.encryptedApiKey) {
        return {
          apiKey: this.encryption.decrypt(orgCred.encryptedApiKey),
          baseUrl: orgCred.baseUrl ?? undefined,
          defaultModel: orgCred.defaultModel ?? undefined,
          enabled: orgCred.enabled,
          isCustom: true,
          source: 'database',
        };
      }
    }

    // 4. System scope check
    const sysCred = await this.prisma.aIProviderCredential.findFirst({
      where: { provider, scopeType: 'system', scopeId: 'system' },
    });
    if (sysCred && sysCred.enabled && sysCred.encryptedApiKey) {
      return {
        apiKey: this.encryption.decrypt(sysCred.encryptedApiKey),
        baseUrl: sysCred.baseUrl ?? undefined,
        defaultModel: sysCred.defaultModel ?? undefined,
        enabled: sysCred.enabled,
        isCustom: true,
        source: 'database',
      };
    }

    // 5. Environment fallback
    const adapter = this.providerRegistry.getAdapter(provider);
    const envValid = adapter?.validateConfig();
    const envApiKey = this.getEnvApiKeyForProvider(provider);

    return {
      apiKey: envApiKey,
      baseUrl: undefined,
      defaultModel: undefined,
      enabled: true,
      isCustom: false,
      source: envApiKey || envValid?.valid ? 'environment' : 'none',
    };
  }

  /**
   * Lists all available AI providers for a given workspace with masked keys and live statuses.
   */
  async listWorkspaceProviders(workspaceId: string): Promise<AIProviderMetadata[]> {
    const baseProviders = this.providerRegistry.getAllProvidersMetadata();

    // Fetch all workspace-configured credentials
    const wsCreds = await this.prisma.aIProviderCredential.findMany({
      where: { scopeType: 'workspace', scopeId: workspaceId },
    });
    const credMap = new Map(wsCreds.map((c) => [c.provider, c]));

    // Fetch model settings for this workspace
    const modelSettings = await this.prisma.aIModelSetting.findMany({
      where: { workspaceId },
    });
    const modelSettingMap = new Map(modelSettings.map((s) => [s.modelId, s]));

    return baseProviders.map((provider) => {
      const cred = credMap.get(provider.id);
      const requirements = PROVIDER_REQUIREMENTS[provider.id] || [];

      let configured = provider.configured;
      let maskedKey: string | undefined = undefined;
      let status: AIProviderStatus = provider.status;
      let enabled = true;
      let defaultModel = provider.defaultModel;
      let baseUrl = provider.baseUrl;

      if (cred) {
        configured = Boolean(cred.encryptedApiKey || provider.id === 'ollama');
        maskedKey = cred.maskedKey || (cred.encryptedApiKey ? '••••••••••••' : undefined);
        status = (cred.status as AIProviderStatus) || (configured ? 'CONNECTED' : 'NOT_CONFIGURED');
        enabled = cred.enabled;
        if (cred.defaultModel) defaultModel = cred.defaultModel;
        if (cred.baseUrl) baseUrl = cred.baseUrl;
      } else if (!configured && provider.id === 'ollama') {
        configured = true;
        status = 'CONNECTED';
      }

      // Map models with workspace-specific enabled/default overrides
      const models: AIModelMetadata[] = provider.models.map((m) => {
        const setting = modelSettingMap.get(m.id) || modelSettingMap.get(m.model);
        return {
          ...m,
          enabled: setting ? setting.enabled : m.enabled,
          default: setting ? setting.isDefault : m.default,
        };
      });

      return {
        ...provider,
        configured,
        status: enabled ? status : 'DISABLED',
        enabled,
        defaultModel,
        baseUrl,
        maskedKey,
        credentialRequirements: requirements,
        models,
      };
    });
  }

  /**
   * Retrieves single provider metadata for a workspace.
   */
  async getWorkspaceProvider(
    workspaceId: string,
    provider: AIProvider
  ): Promise<AIProviderMetadata> {
    const list = await this.listWorkspaceProviders(workspaceId);
    const found = list.find((p) => p.id === provider);
    if (!found) throw new NotFoundException(`AI Provider '${provider}' not found`);
    return found;
  }

  /**
   * Saves or updates a provider credential for a workspace.
   * Securely encrypts the API key at rest and never returns plaintext to the caller.
   */
  async saveCredential(
    workspaceId: string,
    provider: AIProvider,
    input: SaveProviderCredentialInput,
    userId?: string
  ): Promise<AIProviderMetadata> {
    const existing = await this.prisma.aIProviderCredential.findFirst({
      where: { provider, scopeType: 'workspace', scopeId: workspaceId },
    });

    let encryptedApiKey = existing?.encryptedApiKey ?? '';
    let maskedKey = existing?.maskedKey ?? '';

    if (input.apiKey && input.apiKey.trim()) {
      const cleanKey = input.apiKey.trim();
      encryptedApiKey = this.encryption.encrypt(cleanKey);
      maskedKey = this.encryption.maskApiKey(cleanKey);
    }

    await this.prisma.aIProviderCredential.upsert({
      where: {
        provider_scopeType_scopeId: {
          provider,
          scopeType: 'workspace',
          scopeId: workspaceId,
        },
      },
      create: {
        provider,
        scopeType: 'workspace',
        scopeId: workspaceId,
        encryptedApiKey,
        maskedKey,
        baseUrl: input.baseUrl?.trim() || null,
        defaultModel: input.defaultModel?.trim() || null,
        enabled: input.enabled ?? true,
        createdBy: userId ?? null,
        status: encryptedApiKey || provider === 'ollama' ? 'CONNECTED' : 'NOT_CONFIGURED',
      },
      update: {
        ...(encryptedApiKey ? { encryptedApiKey, maskedKey } : {}),
        ...(input.baseUrl !== undefined ? { baseUrl: input.baseUrl.trim() || null } : {}),
        ...(input.defaultModel !== undefined
          ? { defaultModel: input.defaultModel.trim() || null }
          : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        status: encryptedApiKey || provider === 'ollama' ? 'CONNECTED' : 'NOT_CONFIGURED',
      },
    });

    this.logger.log(
      `AI Provider credential updated for workspace '${workspaceId}', provider '${provider}' (key masked: ${maskedKey || 'none'})`
    );

    return this.getWorkspaceProvider(workspaceId, provider);
  }

  /**
   * Deletes a provider credential from a workspace.
   */
  async deleteCredential(
    workspaceId: string,
    provider: AIProvider,
    userId?: string
  ): Promise<void> {
    await this.prisma.aIProviderCredential.deleteMany({
      where: { provider, scopeType: 'workspace', scopeId: workspaceId },
    });

    this.logger.log(
      `AI Provider credential deleted for workspace '${workspaceId}', provider '${provider}' by user '${userId ?? 'unknown'}'`
    );
  }

  /**
   * Updates model enablement or default state for a workspace.
   */
  async updateModelSettings(
    workspaceId: string,
    modelId: string,
    input: UpdateModelSettingsInput
  ): Promise<void> {
    if (input.isDefault) {
      // Clear other defaults in this workspace
      await this.prisma.aIModelSetting.updateMany({
        where: { workspaceId },
        data: { isDefault: false },
      });
    }

    await this.prisma.aIModelSetting.upsert({
      where: {
        workspaceId_modelId: {
          workspaceId,
          modelId,
        },
      },
      create: {
        workspaceId,
        modelId,
        enabled: input.enabled ?? true,
        isDefault: input.isDefault ?? false,
      },
      update: {
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      },
    });
  }

  /**
   * Tests connection to a provider using workspace credential or env fallback.
   */
  async testWorkspaceConnection(
    workspaceId: string,
    provider: AIProvider,
    model?: string
  ): Promise<ProviderConnectionTestResult> {
    const cred = await this.resolveCredential(provider, { workspaceId });

    if (!cred.apiKey && provider !== 'ollama') {
      return {
        provider,
        model,
        status: 'NOT_CONFIGURED',
        latencyMs: null,
        detail: `No API key configured for ${provider} in this workspace or environment.`,
        checkedAt: new Date().toISOString(),
      };
    }

    const adapter = this.providerRegistry.getAdapter(provider);
    if (!adapter) {
      return {
        provider,
        model,
        status: 'ERROR',
        latencyMs: null,
        detail: `Adapter for provider '${provider}' not registered.`,
        checkedAt: new Date().toISOString(),
      };
    }

    const startTime = Date.now();
    try {
      // Execute lightweight probe chat with resolved credentials
      const targetModel = model || cred.defaultModel || adapter.defaultModel;
      await adapter.chat({
        model: targetModel,
        messages: [{ role: 'user', content: 'Ping' }],
        maxTokens: 5,
        temperature: 0.1,
      });

      const latencyMs = Date.now() - startTime;

      // Update credential status in DB if exists
      await this.prisma.aIProviderCredential.updateMany({
        where: { provider, scopeType: 'workspace', scopeId: workspaceId },
        data: {
          status: 'CONNECTED',
          lastTestedAt: new Date(),
        },
      });

      return {
        provider,
        model: targetModel,
        status: 'CONNECTED',
        latencyMs,
        detail: `Connection successful (${latencyMs}ms)`,
        checkedAt: new Date().toISOString(),
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const message = err instanceof Error ? err.message : String(err);
      let status: AIProviderStatus = 'ERROR';

      if (message.includes('401') || message.includes('auth') || message.includes('API_KEY')) {
        status = 'AUTH_ERROR';
      } else if (message.includes('429') || message.includes('rate limit')) {
        status = 'RATE_LIMITED';
      } else if (message.includes('503') || message.includes('unavailable')) {
        status = 'UNAVAILABLE';
      }

      await this.prisma.aIProviderCredential.updateMany({
        where: { provider, scopeType: 'workspace', scopeId: workspaceId },
        data: {
          status,
          lastTestedAt: new Date(),
        },
      });

      return {
        provider,
        model,
        status,
        latencyMs,
        detail: `Connection failed: ${message}`,
        checkedAt: new Date().toISOString(),
      };
    }
  }

  private getEnvApiKeyForProvider(provider: AIProvider): string | undefined {
    switch (provider) {
      case 'nvidia':
        return this.config.get<string>('NVIDIA_API_KEY');
      case 'openai':
        return this.config.get<string>('OPENAI_API_KEY');
      case 'anthropic':
        return this.config.get<string>('ANTHROPIC_API_KEY');
      case 'gemini':
        return (
          this.config.get<string>('GOOGLE_AI_API_KEY') ||
          this.config.get<string>('GEMINI_API_KEY')
        );
      case 'deepseek':
        return this.config.get<string>('DEEPSEEK_API_KEY');
      case 'groq':
        return this.config.get<string>('GROQ_API_KEY');
      case 'mistral':
        return this.config.get<string>('MISTRAL_API_KEY');
      case 'xai':
        return this.config.get<string>('XAI_API_KEY');
      case 'together':
        return this.config.get<string>('TOGETHER_API_KEY');
      case 'openrouter':
        return this.config.get<string>('OPENROUTER_API_KEY');
      case 'cohere':
        return this.config.get<string>('COHERE_API_KEY');
      case 'ollama':
        return undefined;
      default:
        return undefined;
    }
  }
}
