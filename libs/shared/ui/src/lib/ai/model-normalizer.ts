/**
 * Central Model Normalizer for Onetab-AI Platform
 * Normalizes varied model ID strings, API paths, and provider prefixes into a unified metadata contract.
 */

export type ModelSpeed = 'fast' | 'balanced' | 'deep' | (string & {});

export interface ModelCapabilities {
  reasoning: boolean;
  vision: boolean;
  toolCalling: boolean;
  coding: boolean;
  structuredOutput: boolean;
}

/** Canonical metadata for one model, as the AI model UI renders it. */
export interface NormalizedModel {
  /** The id as it was passed in. */
  id: string;
  canonicalId: string;
  providerId: string;
  providerName: string;
  family: string;
  displayName: string;
  contextWindow: string;
  speed: ModelSpeed;
  costTier: string;
  capabilities: ModelCapabilities;
  description: string;
}

export interface NormalizedProvider {
  id: string;
  name: string;
}

/** A model id, or a model option object carrying one. */
export type ModelInput =
  | string
  | { id?: string; value?: string; model?: string; name?: string }
  | null
  | undefined;

type CanonicalModel = Omit<NormalizedModel, 'id'>;

// In-memory cache to prevent repeated regex and parsing overhead across frequent renders
const normalizerCache = new Map<string, NormalizedModel>();

/**
 * Standard Model Metadata Database for canonical models
 */
const CANONICAL_MODELS: Record<string, CanonicalModel> = {
  // --- OpenAI / GPT Models ---
  'gpt-4o': {
    canonicalId: 'gpt-4o',
    providerId: 'openai',
    providerName: 'OpenAI',
    family: 'GPT',
    displayName: 'GPT-4o',
    contextWindow: '128k',
    speed: 'fast',
    costTier: '$$',
    capabilities: { reasoning: false, vision: true, toolCalling: true, coding: true, structuredOutput: true },
    description: 'High-intelligence flagship omni model for multimodal tasks.',
  },
  'gpt-4o-mini': {
    canonicalId: 'gpt-4o-mini',
    providerId: 'openai',
    providerName: 'OpenAI',
    family: 'GPT',
    displayName: 'GPT-4o Mini',
    contextWindow: '128k',
    speed: 'fast',
    costTier: '$',
    capabilities: { reasoning: false, vision: true, toolCalling: true, coding: true, structuredOutput: true },
    description: 'Fast, lightweight omni model for quick turns and high throughput.',
  },
  'gpt-5': {
    canonicalId: 'gpt-5',
    providerId: 'openai',
    providerName: 'OpenAI',
    family: 'GPT',
    displayName: 'GPT-5',
    contextWindow: '256k',
    speed: 'balanced',
    costTier: '$$$',
    capabilities: { reasoning: true, vision: true, toolCalling: true, coding: true, structuredOutput: true },
    description: 'Next-generation frontier reasoning and multimodal system.',
  },
  'gpt-5-mini': {
    canonicalId: 'gpt-5-mini',
    providerId: 'openai',
    providerName: 'OpenAI',
    family: 'GPT',
    displayName: 'GPT-5 Mini',
    contextWindow: '128k',
    speed: 'fast',
    costTier: '$$',
    capabilities: { reasoning: true, vision: true, toolCalling: true, coding: true, structuredOutput: true },
    description: 'Efficient high-speed frontier reasoning model.',
  },
  'o1': {
    canonicalId: 'o1',
    providerId: 'openai',
    providerName: 'OpenAI',
    family: 'OpenAI o-Series',
    displayName: 'OpenAI o1',
    contextWindow: '200k',
    speed: 'deep',
    costTier: '$$$',
    capabilities: { reasoning: true, vision: true, toolCalling: true, coding: true, structuredOutput: true },
    description: 'State-of-the-art chain-of-thought reasoning model for math, coding and science.',
  },
  'o1-preview': {
    canonicalId: 'o1-preview',
    providerId: 'openai',
    providerName: 'OpenAI',
    family: 'OpenAI o-Series',
    displayName: 'OpenAI o1-preview',
    contextWindow: '128k',
    speed: 'deep',
    costTier: '$$$',
    capabilities: { reasoning: true, vision: false, toolCalling: true, coding: true, structuredOutput: false },
    description: 'Preview of advanced reasoning model.',
  },
  'o3-mini': {
    canonicalId: 'o3-mini',
    providerId: 'openai',
    providerName: 'OpenAI',
    family: 'OpenAI o-Series',
    displayName: 'OpenAI o3-mini',
    contextWindow: '200k',
    speed: 'fast',
    costTier: '$',
    capabilities: { reasoning: true, vision: false, toolCalling: true, coding: true, structuredOutput: true },
    description: 'High-speed reasoning model specialized in STEM and coding.',
  },
  'sora': {
    canonicalId: 'sora',
    providerId: 'openai',
    providerName: 'OpenAI',
    family: 'Sora',
    displayName: 'OpenAI Sora',
    contextWindow: 'N/A',
    speed: 'deep',
    costTier: '$$$',
    capabilities: { reasoning: false, vision: true, toolCalling: false, coding: false, structuredOutput: false },
    description: 'Text-to-video generation model.',
  },
  'dalle': {
    canonicalId: 'dalle',
    providerId: 'openai',
    providerName: 'OpenAI',
    family: 'DALL·E',
    displayName: 'DALL·E 3',
    contextWindow: 'N/A',
    speed: 'balanced',
    costTier: '$$',
    capabilities: { reasoning: false, vision: true, toolCalling: false, coding: false, structuredOutput: false },
    description: 'High-detail image synthesis.',
  },

  // --- Anthropic / Claude Models ---
  'claude-3-7-sonnet': {
    canonicalId: 'claude-3-7-sonnet',
    providerId: 'anthropic',
    providerName: 'Anthropic',
    family: 'Claude',
    displayName: 'Claude 3.7 Sonnet',
    contextWindow: '200k',
    speed: 'balanced',
    costTier: '$$',
    capabilities: { reasoning: true, vision: true, toolCalling: true, coding: true, structuredOutput: true },
    description: 'Hybrid reasoning and instantaneous response model for agents and software engineering.',
  },
  'claude-sonnet-4-5': {
    canonicalId: 'claude-sonnet-4-5',
    providerId: 'anthropic',
    providerName: 'Anthropic',
    family: 'Claude',
    displayName: 'Claude Sonnet 4.5',
    contextWindow: '200k',
    speed: 'balanced',
    costTier: '$$',
    capabilities: { reasoning: true, vision: true, toolCalling: true, coding: true, structuredOutput: true },
    description: 'Advanced Claude flagship model with superior coding, agents, and nuanced instruction following.',
  },
  'claude-3-5-sonnet': {
    canonicalId: 'claude-3-5-sonnet',
    providerId: 'anthropic',
    providerName: 'Anthropic',
    family: 'Claude',
    displayName: 'Claude 3.5 Sonnet',
    contextWindow: '200k',
    speed: 'fast',
    costTier: '$$',
    capabilities: { reasoning: true, vision: true, toolCalling: true, coding: true, structuredOutput: true },
    description: 'Industry-leading code generation, nuances, and agent workflows.',
  },
  'claude-3-5-haiku': {
    canonicalId: 'claude-3-5-haiku',
    providerId: 'anthropic',
    providerName: 'Anthropic',
    family: 'Claude',
    displayName: 'Claude 3.5 Haiku',
    contextWindow: '200k',
    speed: 'fast',
    costTier: '$',
    capabilities: { reasoning: false, vision: true, toolCalling: true, coding: true, structuredOutput: true },
    description: 'Ultra-fast, cost-effective model for sub-agent tasks and instant analysis.',
  },
  'claude-3-opus': {
    canonicalId: 'claude-3-opus',
    providerId: 'anthropic',
    providerName: 'Anthropic',
    family: 'Claude',
    displayName: 'Claude 3 Opus',
    contextWindow: '200k',
    speed: 'deep',
    costTier: '$$$',
    capabilities: { reasoning: true, vision: true, toolCalling: true, coding: true, structuredOutput: true },
    description: 'Top-tier complex analysis and writing model.',
  },

  // --- Google / Gemini Models ---
  'gemini-3-pro': {
    canonicalId: 'gemini-3-pro',
    providerId: 'google',
    providerName: 'Google',
    family: 'Gemini',
    displayName: 'Gemini 3 Pro',
    contextWindow: '2M',
    speed: 'balanced',
    costTier: '$$',
    capabilities: { reasoning: true, vision: true, toolCalling: true, coding: true, structuredOutput: true },
    description: 'Frontier multimodal reasoning with 2 million token context.',
  },
  'gemini-2-0-flash': {
    canonicalId: 'gemini-2-0-flash',
    providerId: 'google',
    providerName: 'Google',
    family: 'Gemini',
    displayName: 'Gemini 2.0 Flash',
    contextWindow: '1M',
    speed: 'fast',
    costTier: '$',
    capabilities: { reasoning: true, vision: true, toolCalling: true, coding: true, structuredOutput: true },
    description: 'Ultra-fast next-gen multimodal with 1 million token context.',
  },
  'gemini-1-5-pro': {
    canonicalId: 'gemini-1-5-pro',
    providerId: 'google',
    providerName: 'Google',
    family: 'Gemini',
    displayName: 'Gemini 1.5 Pro',
    contextWindow: '2M',
    speed: 'balanced',
    costTier: '$$',
    capabilities: { reasoning: true, vision: true, toolCalling: true, coding: true, structuredOutput: true },
    description: '2M context flagship multimodal model.',
  },
  'gemini-1-5-flash': {
    canonicalId: 'gemini-1-5-flash',
    providerId: 'google',
    providerName: 'Google',
    family: 'Gemini',
    displayName: 'Gemini 1.5 Flash',
    contextWindow: '1M',
    speed: 'fast',
    costTier: '$',
    capabilities: { reasoning: false, vision: true, toolCalling: true, coding: true, structuredOutput: true },
    description: 'High frequency, low latency multimodal reasoning.',
  },
  'gemini-2-5-pro': {
    canonicalId: 'gemini-2-5-pro',
    providerId: 'google',
    providerName: 'Google',
    family: 'Gemini',
    displayName: 'Gemini 2.5 Pro',
    contextWindow: '1M',
    speed: 'balanced',
    costTier: '$$',
    capabilities: { reasoning: true, vision: true, toolCalling: true, coding: true, structuredOutput: true },
    description: 'Advanced multimodal reasoning with massive context capacity.',
  },
  'gemini-2-5-flash': {
    canonicalId: 'gemini-2-5-flash',
    providerId: 'google',
    providerName: 'Google',
    family: 'Gemini',
    displayName: 'Gemini 2.5 Flash',
    contextWindow: '1M',
    speed: 'fast',
    costTier: '$',
    capabilities: { reasoning: false, vision: true, toolCalling: true, coding: true, structuredOutput: true },
    description: 'Ultra low latency, cost-effective high throughput model.',
  },
  'gemma-2': {
    canonicalId: 'gemma-2',
    providerId: 'google',
    providerName: 'Google',
    family: 'Gemma',
    displayName: 'Gemma 2 27B',
    contextWindow: '8k',
    speed: 'fast',
    costTier: 'Free',
    capabilities: { reasoning: false, vision: false, toolCalling: false, coding: true, structuredOutput: false },
    description: 'Open, lightweight models built from Gemini technology.',
  },

  // --- DeepSeek Models ---
  'deepseek-r1': {
    canonicalId: 'deepseek-r1',
    providerId: 'deepseek',
    providerName: 'DeepSeek',
    family: 'DeepSeek',
    displayName: 'DeepSeek R1',
    contextWindow: '64k',
    speed: 'deep',
    costTier: '$',
    capabilities: { reasoning: true, vision: false, toolCalling: true, coding: true, structuredOutput: true },
    description: 'Open-weights reasoning powerhouse with visible chain of thought.',
  },
  'deepseek-v3': {
    canonicalId: 'deepseek-v3',
    providerId: 'deepseek',
    providerName: 'DeepSeek',
    family: 'DeepSeek',
    displayName: 'DeepSeek V3',
    contextWindow: '64k',
    speed: 'fast',
    costTier: '$',
    capabilities: { reasoning: false, vision: false, toolCalling: true, coding: true, structuredOutput: true },
    description: 'High-speed mixture-of-experts general intelligence model.',
  },
  'deepseek-chat': {
    canonicalId: 'deepseek-chat',
    providerId: 'deepseek',
    providerName: 'DeepSeek',
    family: 'DeepSeek',
    displayName: 'DeepSeek Chat',
    contextWindow: '64k',
    speed: 'fast',
    costTier: '$',
    capabilities: { reasoning: false, vision: false, toolCalling: true, coding: true, structuredOutput: true },
    description: 'General conversational model by DeepSeek.',
  },

  // --- NVIDIA Models ---
  'nemotron': {
    canonicalId: 'nemotron',
    providerId: 'nvidia',
    providerName: 'NVIDIA',
    family: 'Nemotron',
    displayName: 'Nemotron 3 Super',
    contextWindow: '128k',
    speed: 'fast',
    costTier: '$',
    capabilities: { reasoning: true, vision: false, toolCalling: true, coding: true, structuredOutput: true },
    description: 'Platform default reasoning model optimized with NVIDIA NIM.',
  },
  'nemotron-3-super-120b-a12b': {
    canonicalId: 'nemotron',
    providerId: 'nvidia',
    providerName: 'NVIDIA',
    family: 'Nemotron',
    displayName: 'Nemotron 3 Super (120B)',
    contextWindow: '128k',
    speed: 'fast',
    costTier: '$',
    capabilities: { reasoning: true, vision: false, toolCalling: true, coding: true, structuredOutput: true },
    description: 'NVIDIA Nemotron 3 Super MoE architecture with active reasoning.',
  },

  // --- Mistral Models ---
  'mistral-large': {
    canonicalId: 'mistral-large',
    providerId: 'mistral',
    providerName: 'Mistral AI',
    family: 'Mistral',
    displayName: 'Mistral Large 2',
    contextWindow: '128k',
    speed: 'balanced',
    costTier: '$$',
    capabilities: { reasoning: true, vision: false, toolCalling: true, coding: true, structuredOutput: true },
    description: 'Top-tier reasoning model for multilingual tasks and complex code.',
  },
  'codestral': {
    canonicalId: 'codestral',
    providerId: 'mistral',
    providerName: 'Mistral AI',
    family: 'Mistral',
    displayName: 'Codestral',
    contextWindow: '32k',
    speed: 'fast',
    costTier: '$',
    capabilities: { reasoning: false, vision: false, toolCalling: true, coding: true, structuredOutput: true },
    description: 'Dedicated code generation and FIM (fill-in-the-middle) completion.',
  },
  'pixtral': {
    canonicalId: 'pixtral',
    providerId: 'mistral',
    providerName: 'Mistral AI',
    family: 'Mistral',
    displayName: 'Pixtral 12B',
    contextWindow: '128k',
    speed: 'fast',
    costTier: '$',
    capabilities: { reasoning: false, vision: true, toolCalling: true, coding: true, structuredOutput: true },
    description: 'Multimodal vision and document parsing model.',
  },

  // --- Meta / Llama Models ---
  'llama-3-3-70b': {
    canonicalId: 'llama-3-3-70b',
    providerId: 'meta',
    providerName: 'Meta',
    family: 'Llama',
    displayName: 'Llama 3.3 70B',
    contextWindow: '128k',
    speed: 'balanced',
    costTier: '$',
    capabilities: { reasoning: true, vision: false, toolCalling: true, coding: true, structuredOutput: true },
    description: 'Industry-standard open weights instruction-tuned model.',
  },
  'llama-3-1-8b': {
    canonicalId: 'llama-3-1-8b',
    providerId: 'meta',
    providerName: 'Meta',
    family: 'Llama',
    displayName: 'Llama 3.1 8B',
    contextWindow: '128k',
    speed: 'fast',
    costTier: '$',
    capabilities: { reasoning: false, vision: false, toolCalling: true, coding: true, structuredOutput: true },
    description: 'High-efficiency edge & local model for quick tasks.',
  },
  'llama3': {
    canonicalId: 'llama-3-3-70b',
    providerId: 'meta',
    providerName: 'Meta',
    family: 'Llama',
    displayName: 'Llama 3',
    contextWindow: '128k',
    speed: 'fast',
    costTier: 'Free',
    capabilities: { reasoning: false, vision: false, toolCalling: true, coding: true, structuredOutput: true },
    description: 'Meta open weights LLM.',
  },

  // --- Alibaba / Qwen Models ---
  'qwen-2-5-72b': {
    canonicalId: 'qwen-2-5-72b',
    providerId: 'qwen',
    providerName: 'Qwen',
    family: 'Qwen',
    displayName: 'Qwen 2.5 72B',
    contextWindow: '128k',
    speed: 'balanced',
    costTier: '$',
    capabilities: { reasoning: true, vision: false, toolCalling: true, coding: true, structuredOutput: true },
    description: 'Top-performing open model in mathematics, coding, and multilingual reasoning.',
  },
  'qwen3': {
    canonicalId: 'qwen3',
    providerId: 'qwen',
    providerName: 'Qwen',
    family: 'Qwen',
    displayName: 'Qwen 3',
    contextWindow: '128k',
    speed: 'fast',
    costTier: '$',
    capabilities: { reasoning: true, vision: true, toolCalling: true, coding: true, structuredOutput: true },
    description: 'Next-generation Alibaba Cloud intelligence model.',
  },

  // --- xAI / Grok Models ---
  'grok-2': {
    canonicalId: 'grok-2',
    providerId: 'xai',
    providerName: 'xAI',
    family: 'Grok',
    displayName: 'Grok 2',
    contextWindow: '128k',
    speed: 'fast',
    costTier: '$$',
    capabilities: { reasoning: true, vision: true, toolCalling: true, coding: true, structuredOutput: true },
    description: 'Frontier model with real-time knowledge and image understanding.',
  },

  // --- Cohere Models ---
  'command-r-plus': {
    canonicalId: 'command-r-plus',
    providerId: 'cohere',
    providerName: 'Cohere',
    family: 'Command',
    displayName: 'Command R+',
    contextWindow: '128k',
    speed: 'balanced',
    costTier: '$$',
    capabilities: { reasoning: false, vision: false, toolCalling: true, coding: true, structuredOutput: true },
    description: 'Enterprise model built for complex RAG and multi-step tool use.',
  },

  // --- Perplexity Models ---
  'sonar-reasoning': {
    canonicalId: 'sonar-reasoning',
    providerId: 'perplexity',
    providerName: 'Perplexity',
    family: 'Sonar',
    displayName: 'Sonar Reasoning',
    contextWindow: '128k',
    speed: 'deep',
    costTier: '$$',
    capabilities: { reasoning: true, vision: false, toolCalling: true, coding: true, structuredOutput: true },
    description: 'Search-augmented reasoning with live web citations.',
  },
  'sonar': {
    canonicalId: 'sonar',
    providerId: 'perplexity',
    providerName: 'Perplexity',
    family: 'Sonar',
    displayName: 'Sonar Search',
    contextWindow: '128k',
    speed: 'fast',
    costTier: '$',
    capabilities: { reasoning: false, vision: false, toolCalling: true, coding: false, structuredOutput: true },
    description: 'Live web-connected answer synthesis.',
  },

  // --- AI Tools & Services ---
  'firecrawl': {
    canonicalId: 'firecrawl',
    providerId: 'firecrawl',
    providerName: 'Firecrawl',
    family: 'Web Scraping',
    displayName: 'Firecrawl Web Crawler',
    contextWindow: 'N/A',
    speed: 'fast',
    costTier: '$',
    capabilities: { reasoning: false, vision: false, toolCalling: true, coding: false, structuredOutput: true },
    description: 'Clean LLM-ready markdown extraction and web scraping service.',
  },
  'mcp': {
    canonicalId: 'mcp',
    providerId: 'mcp',
    providerName: 'Model Context Protocol',
    family: 'Protocol',
    displayName: 'MCP Server',
    contextWindow: 'N/A',
    speed: 'fast',
    costTier: 'Free',
    capabilities: { reasoning: false, vision: false, toolCalling: true, coding: false, structuredOutput: true },
    description: 'Standardized context and tool connection protocol.',
  },
};

/**
 * Standard Provider Names
 */
export const PROVIDER_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  gemini: 'Google',
  deepseek: 'DeepSeek',
  nvidia: 'NVIDIA',
  mistral: 'Mistral AI',
  meta: 'Meta',
  qwen: 'Qwen (Alibaba)',
  xai: 'xAI',
  groq: 'Groq',
  cohere: 'Cohere',
  ollama: 'Ollama',
  openrouter: 'OpenRouter',
  together: 'together.ai',
  perplexity: 'Perplexity',
  huggingface: 'Hugging Face',
  fireworks: 'Fireworks AI',
  replicate: 'Replicate',
  elevenlabs: 'ElevenLabs',
  minimax: 'MiniMax',
  moonshot: 'Moonshot AI',
  zhipu: 'Zhipu AI',
  bytedance: 'ByteDance',
  baidu: 'Baidu',
  alibaba: 'Alibaba Cloud',
  aws: 'Amazon Bedrock',
  azure: 'Microsoft Azure',
  vertex: 'Google Cloud Vertex AI',
  firecrawl: 'Firecrawl',
  mcp: 'Model Context Protocol',
  langchain: 'LangChain',
  langgraph: 'LangGraph',
};

/**
 * Cleans a model ID string: trims, removes quotes, lowercases, removes tag suffixes like :latest
 */
export function cleanModelString(raw: unknown): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/:latest$/i, '')
    .trim();
}

/**
 * Splits prefix: "provider/model" or "provider:model"
 */
function extractProviderAndModel(raw: string): { prefixProvider: string | null; cleanModel: string } {
  const cleaned = cleanModelString(raw);
  if (!cleaned) return { prefixProvider: null, cleanModel: '' };

  const delimiterMatch = cleaned.match(/^([a-z0-9_-]+)[/:](.+)$/i);
  if (delimiterMatch) {
    const rawProvider = delimiterMatch[1]!.toLowerCase();
    const rest = delimiterMatch[2]!;
    return { prefixProvider: rawProvider, cleanModel: rest };
  }

  return { prefixProvider: null, cleanModel: cleaned };
}

/**
 * Normalizes any model ID, provider input, or model option into a canonical representation.
 *
 * @param {string|object} rawModelInput - Raw model ID (e.g. "openai/gpt-4o", "claude-sonnet-4-5", "o1", etc.)
 * @param {string} [explicitProvider] - Optional explicit provider name/id (e.g. "anthropic", "openai", "google")
 * @returns {object} Normalized model identity object
 */
export function normalizeModel(rawModelInput: ModelInput, explicitProvider: string | null = null): NormalizedModel {
  const inputStr = typeof rawModelInput === 'object' && rawModelInput !== null
    ? String(rawModelInput.id || rawModelInput.value || rawModelInput.model || rawModelInput.name || '')
    : String(rawModelInput || '');

  const cacheKey = `${inputStr}:::${explicitProvider || ''}`;
  const cached = normalizerCache.get(cacheKey);
  if (cached) return cached;

  const { prefixProvider, cleanModel } = extractProviderAndModel(inputStr);
  const providerHint = (explicitProvider || prefixProvider || '').toLowerCase().trim();
  const lowerModel = cleanModel.toLowerCase();

  // 1. Direct match in Canonical Models
  const direct = CANONICAL_MODELS[lowerModel];
  if (direct) {
    const result: NormalizedModel = {
      ...direct,
      id: inputStr || cleanModel,
    };
    normalizerCache.set(cacheKey, result);
    return result;
  }

  // 2. Pattern Matching / Resolution Heuristics
  let matchedCanonical: CanonicalModel | null | undefined = null;

  // GPT / OpenAI
  if (/^gpt-?5/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['gpt-5'];
  } else if (/^gpt-?4o-?mini/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['gpt-4o-mini'];
  } else if (/^gpt-?4o/i.test(lowerModel) || /^chatgpt-?4o/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['gpt-4o'];
  } else if (/^gpt-?4/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['gpt-4o'];
  } else if (/^o3-?mini/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['o3-mini'];
  } else if (/^o1-?preview/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['o1-preview'];
  } else if (/^o1/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['o1'];
  } else if (/sora/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['sora'];
  } else if (/dall-?e/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['dalle'];
  }

  // Claude / Anthropic
  else if (/claude.*3[.-]7.*sonnet/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['claude-3-7-sonnet'];
  } else if (/claude.*sonnet.*4[.-]5/i.test(lowerModel) || /claude-4[.-]5/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['claude-sonnet-4-5'];
  } else if (/claude.*3[.-]5.*sonnet/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['claude-3-5-sonnet'];
  } else if (/claude.*3[.-]5.*haiku/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['claude-3-5-haiku'];
  } else if (/claude.*opus/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['claude-3-opus'];
  } else if (/claude/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['claude-3-5-sonnet'];
  }

  // Gemini / Google
  else if (/gemini.*3.*pro/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['gemini-3-pro'];
  } else if (/gemini.*2[.-]5.*pro/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['gemini-2-5-pro'];
  } else if (/gemini.*2[.-]5.*flash/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['gemini-2-5-flash'];
  } else if (/gemini.*2[.-]0.*flash/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['gemini-2-0-flash'];
  } else if (/gemini.*1[.-]5.*pro/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['gemini-1-5-pro'];
  } else if (/gemini.*1[.-]5.*flash/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['gemini-1-5-flash'];
  } else if (/gemini/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['gemini-2-0-flash'];
  } else if (/gemma/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['gemma-2'];
  }

  // DeepSeek
  else if (/deepseek.*r1/i.test(lowerModel) || /deepseek-reasoner/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['deepseek-r1'];
  } else if (/deepseek.*v3/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['deepseek-v3'];
  } else if (/deepseek/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['deepseek-chat'];
  }

  // NVIDIA
  else if (/nemotron/i.test(lowerModel) || /nvidia/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['nemotron'];
  }

  // Mistral
  else if (/codestral/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['codestral'];
  } else if (/pixtral/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['pixtral'];
  } else if (/mistral/i.test(lowerModel) || /mixtral/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['mistral-large'];
  }

  // Meta / Llama
  else if (/llama.*3[.-]3.*70b/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['llama-3-3-70b'];
  } else if (/llama.*3[.-]1.*8b/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['llama-3-1-8b'];
  } else if (/llama/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['llama3'];
  }

  // Qwen
  else if (/qwen.*72b/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['qwen-2-5-72b'];
  } else if (/qwen/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['qwen3'];
  }

  // xAI / Grok
  else if (/grok/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['grok-2'];
  }

  // Cohere
  else if (/command/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['command-r-plus'];
  }

  // Perplexity
  else if (/sonar.*reason/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['sonar-reasoning'];
  } else if (/sonar/i.test(lowerModel) || /perplexity/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['sonar'];
  }

  // Tools & Apps
  else if (/firecrawl/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['firecrawl'];
  } else if (/mcp/i.test(lowerModel)) {
    matchedCanonical = CANONICAL_MODELS['mcp'];
  }

  if (matchedCanonical) {
    const result: NormalizedModel = {
      ...matchedCanonical,
      id: inputStr || cleanModel,
      // If user passed a specific version suffix, preserve it in displayName if useful
      displayName: matchedCanonical.displayName,
    };
    normalizerCache.set(cacheKey, result);
    return result;
  }

  // 3. Fallback for custom / dynamic / unmapped models
  let derivedProvider = providerHint || 'custom';
  if (derivedProvider === 'custom') {
    if (lowerModel.includes('openai') || lowerModel.startsWith('gpt')) derivedProvider = 'openai';
    else if (lowerModel.includes('anthropic') || lowerModel.includes('claude')) derivedProvider = 'anthropic';
    else if (lowerModel.includes('google') || lowerModel.includes('gemini')) derivedProvider = 'google';
    else if (lowerModel.includes('deepseek')) derivedProvider = 'deepseek';
    else if (lowerModel.includes('meta') || lowerModel.includes('llama')) derivedProvider = 'meta';
    else if (lowerModel.includes('qwen') || lowerModel.includes('alibaba')) derivedProvider = 'qwen';
    else if (lowerModel.includes('mistral')) derivedProvider = 'mistral';
    else if (lowerModel.includes('nvidia') || lowerModel.includes('nemotron')) derivedProvider = 'nvidia';
    else if (lowerModel.includes('groq')) derivedProvider = 'groq';
    else if (lowerModel.includes('ollama')) derivedProvider = 'ollama';
    else if (lowerModel.includes('cohere')) derivedProvider = 'cohere';
    else if (lowerModel.includes('xai') || lowerModel.includes('grok')) derivedProvider = 'xai';
    else if (lowerModel.includes('perplexity')) derivedProvider = 'perplexity';
  }

  // Format a friendly display name from the slug if possible
  const formattedName = cleanModel
    ? cleanModel
        .split(/[-_]/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    : 'Unknown Model';

  const fallbackResult: NormalizedModel = {
    id: inputStr || 'unknown',
    canonicalId: lowerModel || 'unknown',
    providerId: derivedProvider,
    providerName: PROVIDER_NAMES[derivedProvider] || (derivedProvider ? derivedProvider.toUpperCase() : 'AI Provider'),
    family: derivedProvider.toUpperCase(),
    displayName: formattedName,
    contextWindow: '128k',
    speed: 'balanced',
    costTier: '$$',
    capabilities: {
      reasoning: lowerModel.includes('reason') || lowerModel.includes('think') || lowerModel.includes('r1'),
      vision: lowerModel.includes('vision') || lowerModel.includes('omni') || lowerModel.includes('4o'),
      toolCalling: true,
      coding: true,
      structuredOutput: true,
    },
    description: `AI model provided by ${PROVIDER_NAMES[derivedProvider] || derivedProvider}.`,
  };

  normalizerCache.set(cacheKey, fallbackResult);
  return fallbackResult;
}

/**
 * Normalizes provider identifier into standard lowercase ID and display name
 */
export function normalizeProvider(providerInput: unknown): NormalizedProvider {
  if (!providerInput || typeof providerInput !== 'string') {
    return { id: 'generic', name: 'AI Provider' };
  }

  const p = providerInput.toLowerCase().trim();
  let canonical = p;
  if (p === 'gemini') canonical = 'google';
  if (p === 'local' || p.includes('self-hosted')) canonical = 'ollama';

  return {
    id: canonical,
    name: PROVIDER_NAMES[canonical] || providerInput,
  };
}
