import { Injectable } from '@nestjs/common';
import type {
  AIModelCapabilities,
  AIModelMetadata,
  AIModelRequirements,
  AIProvider,
} from '@org/types';
import { ProviderRegistryService } from './provider-registry.service.js';

@Injectable()
export class ModelRegistryService {
  constructor(private readonly providerRegistry: ProviderRegistryService) {}

  getAllModels(): AIModelMetadata[] {
    return this.providerRegistry.getAllModels();
  }

  findModel(modelOrId: string): AIModelMetadata | undefined {
    const all = this.getAllModels();
    return all.find(
      (m) =>
        m.id === modelOrId ||
        m.model === modelOrId ||
        m.id.toLowerCase() === modelOrId.toLowerCase() ||
        m.model.toLowerCase() === modelOrId.toLowerCase()
    );
  }

  getModelsForProvider(provider: AIProvider): AIModelMetadata[] {
    const adapter = this.providerRegistry.getAdapter(provider);
    return adapter ? adapter.getModels() : [];
  }

  supports(
    modelOrId: string,
    capability: keyof AIModelCapabilities
  ): boolean {
    const model = this.findModel(modelOrId);
    if (!model) return true; // optimistic default if custom model string

    if (Array.isArray(model.capabilities)) {
      return (
        model.capabilities.includes(capability) ||
        model.capabilities.includes(capability.toLowerCase())
      );
    }

    return Boolean(model.capabilities[capability]);
  }

  getModelRequirements(modelOrId: string): AIModelRequirements | undefined {
    const model = this.findModel(modelOrId);
    if (!model) return undefined;

    const capabilities = Array.isArray(model.capabilities)
      ? {
          chat: model.capabilities.includes('chat'),
          reasoning: model.capabilities.includes('reasoning'),
          coding: model.capabilities.includes('coding'),
          toolCalling: model.capabilities.includes('tool_calling') || model.capabilities.includes('toolCalling'),
          streaming: model.capabilities.includes('streaming'),
          structuredOutput: model.capabilities.includes('structuredOutput'),
          vision: model.capabilities.includes('vision'),
          imageGeneration: model.capabilities.includes('imageGeneration'),
          audioInput: model.capabilities.includes('audioInput'),
          audioOutput: model.capabilities.includes('audioOutput'),
          embeddings: model.capabilities.includes('embeddings'),
          longContext: model.capabilities.includes('longContext'),
          agents: model.capabilities.includes('agents'),
        }
      : model.capabilities;

    return {
      provider: model.provider,
      model: model.model,
      requiresApiKey: model.provider !== 'ollama',
      contextWindow: model.contextWindow ?? 128_000,
      maxOutputTokens: model.maxTokens ?? 4096,
      supportedInputModalities: capabilities.vision ? ['text', 'image'] : ['text'],
      supportedOutputModalities: ['text'],
      streamingSupported: capabilities.streaming,
      toolCallingSupported: capabilities.toolCalling,
      reasoningSupported: capabilities.reasoning,
    };
  }
}
