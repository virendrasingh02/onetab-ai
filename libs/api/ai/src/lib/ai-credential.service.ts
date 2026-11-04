import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { assertPublicHttpUrl, UnsafeUrlError } from '@org/api-common';
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

/** Long enough for a cold model, short enough to answer inside one request. */
const PROBE_TIMEOUT_MS = 20_000;

/** The `metadata` column holds the reason the last check failed, if it did. */
function readLastError(metadata: string | null | undefined): string | undefined {
  try {
    const parsed = JSON.parse(metadata || '{}') as { lastError?: unknown };
    return typeof parsed.lastError === 'string' ? parsed.lastError : undefined;
  } catch {
    return undefined;
  }
}

function probeRecord(result: ProviderConnectionTestResult) {
  return {
    status: result.status,
    lastTestedAt: new Date(result.checkedAt),
    metadata: JSON.stringify(result.status === 'CONNECTED' ? {} : { lastError: result.detail }),
  };
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
    let workspaceSettings: { baseUrl?: string; defaultModel?: string } = {};
    if (scope.workspaceId) {
      const wsCred = await this.prisma.aIProviderCredential.findFirst({
        where: { provider, scopeType: 'workspace', scopeId: scope.workspaceId },
      });
      // A row without a key still names this workspace's endpoint and default
      // model (a keyless Ollama host, or a default on the platform's key).
      workspaceSettings = {
        baseUrl: wsCred?.baseUrl ?? undefined,
        defaultModel: wsCred?.defaultModel ?? undefined,
      };
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
      ...workspaceSettings,
      enabled: true,
      isCustom: false,
      source: envApiKey || envValid?.valid ? 'environment' : 'none',
    };
  }

  /**
   * A workspace-supplied base URL is where the API server will send requests
   * (with the key attached), so it must not point into the server's own
   * network. Self-hosted deployments that run a model server on a private
   * address (a local Ollama) opt in with `AI_ALLOW_PRIVATE_NETWORK=true`.
   */
  private async assertUsableBaseUrl(baseUrl: string): Promise<void> {
    if (this.config.get<string>('AI_ALLOW_PRIVATE_NETWORK') === 'true') return;
    try {
      await assertPublicHttpUrl(baseUrl);
    } catch (err) {
      if (err instanceof UnsafeUrlError) {
        throw new BadRequestException(
          `That base URL can't be used: ${err.message} Private model servers need AI_ALLOW_PRIVATE_NETWORK=true on the API.`,
        );
      }
      throw err;
    }
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

    const withWorkspaceSettings = await this.modelSettingsApplier(workspaceId);

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
        // Without its own key the workspace still runs on a platform key.
        configured = Boolean(cred.encryptedApiKey) || provider.configured;
        maskedKey = cred.maskedKey || (cred.encryptedApiKey ? '••••••••••••' : undefined);
        const saved = cred.status as AIProviderStatus;
        status = configured && saved !== 'NOT_CONFIGURED' ? saved : provider.status;
        enabled = cred.enabled;
        if (cred.defaultModel) defaultModel = cred.defaultModel;
        if (cred.baseUrl) baseUrl = cred.baseUrl;
      } else if (!configured && provider.id === 'ollama') {
        configured = true;
        status = 'CONNECTED';
      }

      return {
        ...provider,
        configured,
        status: enabled ? status : 'DISABLED',
        enabled,
        defaultModel,
        baseUrl,
        maskedKey,
        credentialRequirements: requirements,
        credentialSource: cred?.encryptedApiKey
          ? 'workspace'
          : provider.configured
            ? 'environment'
            : 'none',
        lastTestedAt: cred?.lastTestedAt?.toISOString(),
        lastError: readLastError(cred?.metadata),
        models: provider.models.map(withWorkspaceSettings),
      };
    });
  }

  /** Every model, with this workspace's enabled/default choices applied. */
  async listWorkspaceModels(workspaceId: string): Promise<AIModelMetadata[]> {
    const withWorkspaceSettings = await this.modelSettingsApplier(workspaceId);
    return this.providerRegistry.getAllModels().map(withWorkspaceSettings);
  }

  private async modelSettingsApplier(
    workspaceId: string
  ): Promise<(model: AIModelMetadata) => AIModelMetadata> {
    const settings = await this.prisma.aIModelSetting.findMany({
      where: { workspaceId },
    });
    const byModel = new Map(settings.map((s) => [s.modelId, s]));
    return (m) => {
      const setting = byModel.get(m.id) || byModel.get(m.model);
      return setting
        ? { ...m, enabled: setting.enabled, default: setting.isDefault }
        : m;
    };
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
   *
   * Anything that changes where or how the provider is reached is checked
   * against the provider, so the saved status is what it actually answered.
   * With `verify`, a failed check writes nothing, keeping a working key safe
   * from a mistyped replacement.
   */
  async saveCredential(
    workspaceId: string,
    provider: AIProvider,
    input: SaveProviderCredentialInput,
    userId?: string
  ): Promise<AIProviderMetadata> {
    // Checked first: a row for a provider this deployment doesn't offer could
    // never be read back, so it would be saved and then reported as a failure.
    if (
      !this.providerRegistry.hasAdapter(provider) ||
      !this.providerRegistry.isProviderEnabled(provider)
    ) {
      throw new NotFoundException(`AI Provider '${provider}' not found`);
    }

    const newKey = input.apiKey?.trim() || undefined;
    const newBaseUrl = input.baseUrl?.trim() || undefined;
    const newModel = input.defaultModel?.trim() || undefined;
    if (newBaseUrl) await this.assertUsableBaseUrl(newBaseUrl);

    const existing = await this.prisma.aIProviderCredential.findFirst({
      where: { provider, scopeType: 'workspace', scopeId: workspaceId },
    });

    const connectionChanged =
      !existing ||
      Boolean(newKey) ||
      (input.baseUrl !== undefined && (newBaseUrl ?? null) !== existing.baseUrl) ||
      (input.defaultModel !== undefined && (newModel ?? null) !== existing.defaultModel);

    let probe: ProviderConnectionTestResult | undefined;
    if (connectionChanged) {
      const current = await this.resolveCredential(provider, { workspaceId });
      probe = await this.probeProvider(provider, {
        apiKey: newKey ?? current.apiKey,
        baseUrl: input.baseUrl !== undefined ? newBaseUrl : current.baseUrl,
        model: input.defaultModel !== undefined ? newModel : current.defaultModel,
      });
      if (input.verify && probe.status !== 'CONNECTED') {
        throw new UnprocessableEntityException(probe.detail);
      }
    }

    let encryptedApiKey = existing?.encryptedApiKey ?? '';
    let maskedKey = existing?.maskedKey ?? '';

    if (newKey) {
      encryptedApiKey = this.encryption.encrypt(newKey);
      maskedKey = this.encryption.maskApiKey(newKey);
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
        baseUrl: newBaseUrl ?? null,
        defaultModel: newModel ?? null,
        enabled: input.enabled ?? true,
        createdBy: userId ?? null,
        ...(probe ? probeRecord(probe) : {}),
      },
      update: {
        ...(encryptedApiKey ? { encryptedApiKey, maskedKey } : {}),
        ...(input.baseUrl !== undefined ? { baseUrl: newBaseUrl ?? null } : {}),
        ...(input.defaultModel !== undefined ? { defaultModel: newModel ?? null } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(probe ? probeRecord(probe) : {}),
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
    const result = await this.probeProvider(provider, {
      apiKey: cred.apiKey,
      baseUrl: cred.baseUrl,
      model: model || cred.defaultModel,
    });

    await this.prisma.aIProviderCredential.updateMany({
      where: { provider, scopeType: 'workspace', scopeId: workspaceId },
      data: probeRecord(result),
    });

    return result;
  }

  /** One tiny real request to the provider. Never writes anything. */
  private async probeProvider(
    provider: AIProvider,
    target: { apiKey?: string; baseUrl?: string; model?: string }
  ): Promise<ProviderConnectionTestResult> {
    const checkedAt = new Date().toISOString();
    const { apiKey, baseUrl } = target;

    if (!apiKey && provider !== 'ollama') {
      return {
        provider,
        model: target.model,
        status: 'NOT_CONFIGURED',
        latencyMs: null,
        detail: 'Add an API key to connect this provider.',
        checkedAt,
      };
    }

    if (!this.providerRegistry.hasAdapter(provider)) {
      return {
        provider,
        model: target.model,
        status: 'ERROR',
        latencyMs: null,
        detail: `Adapter for provider '${provider}' not registered.`,
        checkedAt,
      };
    }

    const adapter = this.providerRegistry.getAdapter(provider);
    const model = target.model || adapter.defaultModel;
    const startTime = Date.now();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      // Not every adapter stops on the signal, so the deadline is enforced here.
      await Promise.race([
        adapter.chat({
          model,
          messages: [{ role: 'user', content: 'Ping' }],
          maxTokens: 5,
          temperature: 0.1,
          apiKey,
          baseUrl,
          signal: controller.signal,
        }),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new HttpException('The provider did not answer in time.', 504));
          }, PROBE_TIMEOUT_MS);
        }),
      ]);

      const latencyMs = Date.now() - startTime;
      return {
        provider,
        model,
        status: 'CONNECTED',
        latencyMs,
        detail: `Connection successful (${latencyMs}ms)`,
        checkedAt,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // Stored and shown to the workspace, so a key echoed back stops here.
      const safeMessage = apiKey ? message.split(apiKey).join('••••') : message;
      return {
        provider,
        model,
        status: this.statusForProbeFailure(err, message),
        latencyMs: Date.now() - startTime,
        detail: `Connection failed: ${safeMessage}`.slice(0, 500),
        checkedAt,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Adapters raise HttpExceptions with the provider's status; others are text. */
  private statusForProbeFailure(err: unknown, message: string): AIProviderStatus {
    const code = err instanceof HttpException ? err.getStatus() : undefined;
    if (code === 401 || code === 403 || message.includes('API_KEY')) return 'AUTH_ERROR';
    if (code === 429) return 'RATE_LIMITED';
    if (code === 503 || code === 504) return 'UNAVAILABLE';
    return 'ERROR';
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
