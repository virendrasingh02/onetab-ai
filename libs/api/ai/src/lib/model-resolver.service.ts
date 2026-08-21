import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AIModelCapabilities,
  AIProvider,
  ModelResolutionResult,
} from '@org/types';
import { NEMOTRON_MODEL_ID } from './adapters/nvidia.adapter.js';
import { ModelRegistryService } from './model-registry.service.js';

export interface ResolveModelParams {
  requestedProvider?: AIProvider;
  requestedModel?: string;
  agentModel?: { provider?: string; model?: string };
  workflowModel?: { provider?: string; model?: string };
  userPreference?: { provider?: AIProvider; model?: string };
  workspacePreference?: { provider?: AIProvider; model?: string };
}

@Injectable()
export class ModelResolverService {
  private readonly defaultProvider: AIProvider;
  private readonly defaultModel: string;

  constructor(
    private readonly config: ConfigService,
    private readonly modelRegistry: ModelRegistryService
  ) {
    this.defaultProvider =
      (this.config.get<string>('AI_DEFAULT_PROVIDER') as AIProvider) ?? 'nvidia';
    this.defaultModel =
      this.config.get<string>('AI_DEFAULT_MODEL') ?? NEMOTRON_MODEL_ID;
  }

  resolve(params: ResolveModelParams = {}): ModelResolutionResult {
    let provider: AIProvider | undefined = params.requestedProvider;
    let model: string | undefined = params.requestedModel;
    let source: ModelResolutionResult['source'];

    // 1. Explicit request
    if (model && model !== 'auto') {
      const canonical = this.resolveAlias(model, provider);
      provider = canonical.provider;
      model = canonical.model;
      source = 'explicit';
    }
    // 2. Agent model
    else if (params.agentModel?.model) {
      const canonical = this.resolveAlias(
        params.agentModel.model,
        params.agentModel.provider as AIProvider
      );
      provider = canonical.provider;
      model = canonical.model;
      source = 'agent';
    }
    // 3. Workflow model
    else if (params.workflowModel?.model) {
      const canonical = this.resolveAlias(
        params.workflowModel.model,
        params.workflowModel.provider as AIProvider
      );
      provider = canonical.provider;
      model = canonical.model;
      source = 'workflow';
    }
    // 4. User preference
    else if (params.userPreference?.model) {
      provider = params.userPreference.provider ?? this.defaultProvider;
      model = params.userPreference.model;
      source = 'user';
    }
    // 5. Workspace preference
    else if (params.workspacePreference?.model) {
      provider = params.workspacePreference.provider ?? this.defaultProvider;
      model = params.workspacePreference.model;
      source = 'workspace';
    }
    // 7/8. Platform / Environment default (NVIDIA Nemotron 3 Super)
    else {
      provider = this.defaultProvider;
      model = this.defaultModel;
      source = 'platform_default';
    }

    // Ensure provider matches model if provider was unspecified
    if (!provider) {
      provider = this.inferProviderFromModel(model) ?? this.defaultProvider;
    }

    const modelMeta = this.modelRegistry.findModel(model);
    const capabilities: AIModelCapabilities = modelMeta && !Array.isArray(modelMeta.capabilities)
      ? modelMeta.capabilities
      : {
          chat: true,
          reasoning: true,
          coding: true,
          toolCalling: true,
          streaming: true,
          structuredOutput: true,
          vision: false,
          imageGeneration: false,
          audioInput: false,
          audioOutput: false,
          embeddings: false,
          longContext: true,
          agents: true,
        };

    return {
      provider,
      model,
      source,
      capabilities,
    };
  }

  private resolveAlias(
    model: string,
    existingProvider?: AIProvider
  ): { provider: AIProvider; model: string } {
    let resolvedModel = model.trim();
    let resolvedProvider = existingProvider;

    if (
      resolvedModel === 'nemotron-3-super' ||
      resolvedModel === 'nemotron' ||
      resolvedModel === NEMOTRON_MODEL_ID ||
      resolvedModel.includes('nemotron')
    ) {
      resolvedModel = NEMOTRON_MODEL_ID;
      resolvedProvider = 'nvidia';
    } else if (resolvedModel === 'gpt-4o' || resolvedModel === 'openai') {
      resolvedModel = 'gpt-4o';
      resolvedProvider = 'openai';
    } else if (
      resolvedModel === 'claude-sonnet' ||
      resolvedModel === 'claude-sonnet-4-5' ||
      resolvedModel === 'anthropic'
    ) {
      resolvedModel = 'claude-3-5-sonnet-20241022';
      resolvedProvider = 'anthropic';
    } else if (resolvedModel === 'gemini' || resolvedModel === 'gemini-pro') {
      resolvedModel = 'gemini-1.5-pro';
      resolvedProvider = 'gemini';
    } else if (resolvedModel === 'llama3' || resolvedModel === 'ollama') {
      resolvedModel = 'llama3';
      resolvedProvider = 'ollama';
    } else if (resolvedModel === 'deepseek' || resolvedModel === 'deepseek-v3') {
      resolvedModel = 'deepseek-chat';
      resolvedProvider = 'deepseek';
    } else if (resolvedModel === 'groq') {
      resolvedModel = 'llama-3.3-70b-versatile';
      resolvedProvider = 'groq';
    } else if (resolvedModel === 'mistral') {
      resolvedModel = 'mistral-large-latest';
      resolvedProvider = 'mistral';
    } else if (resolvedModel === 'grok' || resolvedModel === 'xai') {
      resolvedModel = 'grok-2-1212';
      resolvedProvider = 'xai';
    } else if (resolvedModel === 'together') {
      resolvedModel = 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo';
      resolvedProvider = 'together';
    } else if (resolvedModel === 'openrouter') {
      resolvedModel = 'auto';
      resolvedProvider = 'openrouter';
    } else if (resolvedModel === 'cohere') {
      resolvedModel = 'command-r-plus-08-2024';
      resolvedProvider = 'cohere';
    }

    if (!resolvedProvider) {
      resolvedProvider = this.inferProviderFromModel(resolvedModel) ?? this.defaultProvider;
    }

    return { provider: resolvedProvider, model: resolvedModel };
  }

  private inferProviderFromModel(model: string): AIProvider | undefined {
    if (model.includes('nemotron') || model.startsWith('nvidia/')) return 'nvidia';
    if (model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3')) return 'openai';
    if (model.startsWith('claude-')) return 'anthropic';
    if (model.startsWith('gemini-')) return 'gemini';
    if (model.startsWith('deepseek-')) return 'deepseek';
    if (model.includes('groq') || model.startsWith('llama-3.3')) return 'groq';
    if (model.startsWith('mistral-') || model.startsWith('codestral')) return 'mistral';
    if (model.startsWith('grok-')) return 'xai';
    if (model.startsWith('meta-llama/')) return 'together';
    if (model.startsWith('command-') || model.startsWith('embed-multilingual')) return 'cohere';
    if (model === 'llama3' || model.startsWith('ollama')) return 'ollama';
    return undefined;
  }
}
