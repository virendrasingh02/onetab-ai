/**
 * Model-inference contracts, shared between the Nest AI module and the web
 * screens so a change to a response shape breaks the compile rather than the
 * screen.
 */
import type { IsoDateString } from './entities.js';

export type AIProvider =
  | 'nvidia'
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'deepseek'
  | 'groq'
  | 'mistral'
  | 'xai'
  | 'together'
  | 'openrouter'
  | 'cohere'
  | 'ollama';

export type AIModelType =
  | 'llm'
  | 'vision'
  | 'image'
  | 'video'
  | 'audio'
  | 'embedding'
  | 'reranking';

export interface AIModelCapabilities {
  chat: boolean;
  reasoning: boolean;
  coding: boolean;
  toolCalling: boolean;
  streaming: boolean;
  structuredOutput: boolean;
  vision: boolean;
  imageGeneration: boolean;
  audioInput: boolean;
  audioOutput: boolean;
  embeddings: boolean;
  longContext: boolean;
  agents: boolean;
}

export interface AIModelPricing {
  pricingType: 'free' | 'usage' | 'tier' | 'unknown';
  inputPricePerMillion?: number;
  outputPricePerMillion?: number;
  cachedInputPricePerMillion?: number;
}

export interface AIModelMetadata {
  id: string;
  provider: AIProvider;
  model: string;
  name: string;
  type?: AIModelType;
  enabled: boolean;
  default?: boolean;
  capabilities: AIModelCapabilities | Array<string>;
  contextWindow?: number;
  maxTokens?: number;
  description?: string;
  pricingType?: 'free' | 'usage' | 'tier' | 'unknown';
  pricing?: AIModelPricing;
  recommendedFor?: string[];
  inputModalities?: string[];
  outputModalities?: string[];
}

export type AIProviderStatus =
  | 'CONNECTED'
  | 'NOT_CONFIGURED'
  | 'AUTH_ERROR'
  | 'RATE_LIMITED'
  | 'UNAVAILABLE'
  | 'DISABLED'
  | 'ERROR';

export interface ProviderCredentialRequirement {
  name: string;
  label: string;
  type: 'secret' | 'text' | 'url' | 'select';
  required: boolean;
  placeholder?: string;
  default?: string;
  description?: string;
  options?: Array<{ label: string; value: string }>;
}

export interface AIProviderMetadata {
  id: AIProvider;
  name: string;
  type: AIModelType;
  configured: boolean;
  requiresApiKey: boolean;
  status: AIProviderStatus;
  capabilities: string[];
  defaultModel: string;
  models: AIModelMetadata[];
  description?: string;
  baseUrl?: string;
  maskedKey?: string;
  enabled?: boolean;
  credentialRequirements?: ProviderCredentialRequirement[];
}

export interface SaveProviderCredentialInput {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  enabled?: boolean;
}

export interface UpdateModelSettingsInput {
  enabled?: boolean;
  isDefault?: boolean;
}

export interface ProviderConnectionTestResult {
  provider: AIProvider;
  model?: string;
  status: AIProviderStatus;
  latencyMs: number | null;
  detail: string;
  checkedAt: string;
}

export type AIErrorCode =
  | 'AI_PROVIDER_AUTH_ERROR'
  | 'AI_RATE_LIMITED'
  | 'AI_MODEL_UNAVAILABLE'
  | 'AI_REQUEST_TIMEOUT'
  | 'AI_PROVIDER_ERROR'
  | 'AI_CAPABILITY_UNSUPPORTED'
  | 'AI_CONTEXT_OVERFLOW'
  | 'AI_INVALID_REQUEST';

export interface AIToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCalls?: AIToolCall[];
  /** Set on a `role: 'tool'` message: which call (by `AIToolCall.id`) this is the result of. */
  toolCallId?: string;
}

export interface AIChatRequest {
  messages: AIChatMessage[];
  provider?: AIProvider;
  model?: string;
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
  tools?: Array<Record<string, unknown>>;
  structuredOutput?: Record<string, unknown>;
}

export interface AIChatUsage {
  promptTokens?: number;
  completionTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
}

export type AIInferenceUsage = AIChatUsage;

export interface AIChatResponse {
  message: AIChatMessage;
  usage?: AIChatUsage;
  provider?: AIProvider;
  model?: string;
  finishReason?: string;
}


/* ------------------------------------------------------------- Streaming --- */

export interface AIStreamStartEvent {
  type: 'message_start';
  provider: AIProvider;
  model: string;
}

export interface AIStreamContentDeltaEvent {
  type: 'content_delta';
  content: string;
}

export interface AIStreamReasoningDeltaEvent {
  type: 'reasoning_delta';
  content: string;
}

export interface AIStreamToolCallEvent {
  type: 'tool_call';
  toolCall: AIToolCall;
}

export interface AIStreamToolResultEvent {
  type: 'tool_result';
  result: {
    toolCallId: string;
    output: unknown;
  };
}

export interface AIStreamUsageEvent {
  type: 'usage';
  usage: AIChatUsage;
}


export interface AIStreamCompleteEvent {
  type: 'message_complete';
  finishReason?: string;
}

export interface AIStreamErrorEvent {
  type: 'error';
  error: {
    code: AIErrorCode;
    message: string;
    status?: number;
  };
}

export type AIStreamEvent =
  | AIStreamStartEvent
  | AIStreamContentDeltaEvent
  | AIStreamReasoningDeltaEvent
  | AIStreamToolCallEvent
  | AIStreamToolResultEvent
  | AIStreamUsageEvent
  | AIStreamCompleteEvent
  | AIStreamErrorEvent;

export interface ModelResolutionResult {
  provider: AIProvider;
  model: string;
  source:
    | 'explicit'
    | 'agent'
    | 'workflow'
    | 'user'
    | 'workspace'
    | 'organization'
    | 'platform_default'
    | 'environment_default'
    | 'safe_fallback';
  capabilities: AIModelCapabilities;
}

export interface AIModelRequirements {
  provider: AIProvider;
  model: string;
  requiresApiKey: boolean;
  contextWindow: number;
  maxOutputTokens: number;
  supportedInputModalities: string[];
  supportedOutputModalities: string[];
  streamingSupported: boolean;
  toolCallingSupported: boolean;
  reasoningSupported: boolean;
}

export interface AISummaryResponse {
  summary: string;
}

export interface AITranslationResponse {
  translatedText: string;
}

export interface AIImageResponse {
  imageUrl: string;
}

export interface AIVisionResponse {
  analysis: string;
}

/** One retrieved passage from the workspace vector store. */
export interface AIRagResult {
  text: string;
  score: number;
  metadata?: Record<string, unknown>;
}

/**
 * A saved prompt.
 *
 * `workspaceId` is null for the system templates that ship with the platform:
 * they appear in every workspace's library and are read-only there.
 */
export interface PromptTemplate {
  id: string;
  workspaceId: string | null;
  title: string;
  category: string;
  promptText: string;
  isSystem: boolean;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}
