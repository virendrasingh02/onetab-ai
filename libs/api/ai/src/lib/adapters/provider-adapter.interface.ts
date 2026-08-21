import type {
  AIChatMessage,
  AIChatResponse,
  AIModelMetadata,
  AIProvider,
  AIStreamEvent,
  ProviderConnectionTestResult,
} from '@org/types';

export interface ChatExecutionOptions {
  model: string;
  messages: AIChatMessage[];
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
  tools?: Array<Record<string, unknown>>;
  structuredOutput?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface ProviderValidationResult {
  valid: boolean;
  reason?: string;
}

export interface IProviderAdapter {
  readonly provider: AIProvider;
  readonly defaultModel: string;

  getModels(): AIModelMetadata[];
  validateConfig(): ProviderValidationResult;
  isConfigured(): boolean;
  chat(options: ChatExecutionOptions): Promise<AIChatResponse>;
  stream(options: ChatExecutionOptions): AsyncGenerator<AIStreamEvent, void, unknown>;
  healthCheck(): Promise<ProviderConnectionTestResult>;
  generateEmbeddings?(texts: string[]): Promise<number[][]>;
}
