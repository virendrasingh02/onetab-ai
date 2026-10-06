/**
 * Central Model & Provider Icon Registry
 * Connects normalized model / provider identities to official @lobehub/icons.
 */

import {
  OpenAI,
  Claude,
  Gemini,
  Gemma,
  DeepSeek,
  Nvidia,
  Mistral,
  Qwen,
  Meta,
  Ollama,
  Groq,
  Cohere,
  OpenRouter,
  Together,
  Perplexity,
  Firecrawl,
  MCP,
  LangChain,
  LangGraph,
  ElevenLabs,
  Sora,
  Dalle,
  Flux,
  Midjourney,
  Grok,
  XAI,
  HuggingFace,
  Fireworks,
  Replicate,
  Minimax,
  Moonshot,
  Zhipu,
  ByteDance,
  Baidu,
  AlibabaCloud,
  Aws,
  Azure,
  VertexAI,
  Bedrock,
  Google,
  Anthropic,
  Fal,
} from '@lobehub/icons';
import { Bot, Sparkles, Cpu } from 'lucide-react';
import { normalizeModel, normalizeProvider } from './model-normalizer.js';

/**
 * Model-specific icon registry
 * Maps canonical model IDs to their dedicated LobeHub icon components.
 */
export const MODEL_ICONS = {
  // OpenAI & siblings
  'gpt-4o': OpenAI,
  'gpt-4o-mini': OpenAI,
  'gpt-5': OpenAI,
  'gpt-5-mini': OpenAI,
  'o1': OpenAI,
  'o1-preview': OpenAI,
  'o3-mini': OpenAI,
  'sora': Sora,
  'dalle': Dalle,

  // Anthropic / Claude
  'claude-3-7-sonnet': Claude,
  'claude-sonnet-4-5': Claude,
  'claude-3-5-sonnet': Claude,
  'claude-3-5-haiku': Claude,
  'claude-3-opus': Claude,

  // Google / Gemini
  'gemini-3-pro': Gemini,
  'gemini-2-0-flash': Gemini,
  'gemini-1-5-pro': Gemini,
  'gemini-1-5-flash': Gemini,
  'gemini-2-5-pro': Gemini,
  'gemini-2-5-flash': Gemini,
  'gemma-2': Gemma,

  // DeepSeek
  'deepseek-r1': DeepSeek,
  'deepseek-v3': DeepSeek,
  'deepseek-chat': DeepSeek,

  // NVIDIA
  'nemotron': Nvidia,

  // Mistral
  'mistral-large': Mistral,
  'codestral': Mistral,
  'pixtral': Mistral,

  // Meta
  'llama-3-3-70b': Meta,
  'llama-3-1-8b': Meta,
  'llama3': Meta,

  // Qwen
  'qwen-2-5-72b': Qwen,
  'qwen3': Qwen,

  // xAI / Grok
  'grok-2': Grok,

  // Cohere
  'command-r-plus': Cohere,

  // Perplexity
  'sonar-reasoning': Perplexity,
  'sonar': Perplexity,

  // Image & Video
  'flux': Flux,
  'midjourney': Midjourney,

  // Tools & Protocols
  'firecrawl': Firecrawl,
  'mcp': MCP,
  'langchain': LangChain,
  'langgraph': LangGraph,
  'elevenlabs': ElevenLabs,
};

/**
 * Provider-specific icon registry
 * Maps provider canonical identifiers to their official LobeHub provider icon components.
 */
export const PROVIDER_ICONS = {
  openai: OpenAI,
  anthropic: Anthropic,
  google: Google,
  gemini: Google,
  deepseek: DeepSeek,
  nvidia: Nvidia,
  mistral: Mistral,
  meta: Meta,
  qwen: Qwen,
  alibaba: AlibabaCloud,
  xai: XAI,
  groq: Groq,
  cohere: Cohere,
  ollama: Ollama,
  openrouter: OpenRouter,
  together: Together,
  perplexity: Perplexity,
  huggingface: HuggingFace,
  fireworks: Fireworks,
  replicate: Replicate,
  minimax: Minimax,
  moonshot: Moonshot,
  zhipu: Zhipu,
  bytedance: ByteDance,
  baidu: Baidu,
  aws: Aws,
  bedrock: Bedrock,
  azure: Azure,
  vertex: VertexAI,
  fal: Fal,
  firecrawl: Firecrawl,
  mcp: MCP,
  langchain: LangChain,
  langgraph: LangGraph,
  elevenlabs: ElevenLabs,
};

/**
 * Fallback Component
 */
export const GenericAIFallback = Sparkles;
export const GenericAgentFallback = Bot;

/**
 * Resolves the appropriate React component for an AI Model according to the fallback rule:
 * Exact model match -> Provider match -> Generic AI fallback (Sparkles)
 *
 * @param {string|object} modelInput - Raw model ID or object
 * @param {string} [providerInput] - Optional provider hint
 * @param {'color'|'mono'} [variant='color'] - Color or Mono visual style
 * @returns {React.ComponentType} The component ready to render
 */
export function resolveModelIconComponent(modelInput, providerInput = null, variant = 'color') {
  try {
    const meta = normalizeModel(modelInput, providerInput);

    // 1. Exact model match
    let BaseIcon = MODEL_ICONS[meta.canonicalId];

    // 2. Provider match if no model match
    if (!BaseIcon && meta.providerId) {
      BaseIcon = PROVIDER_ICONS[meta.providerId];
    }

    // 3. Fallback if still no match
    if (!BaseIcon) {
      return GenericAIFallback;
    }

    // 4. Return appropriate color vs mono variant
    if (variant === 'color' && BaseIcon.Color) {
      return BaseIcon.Color;
    }

    return BaseIcon;
  } catch {
    return GenericAIFallback;
  }
}

/**
 * Resolves the appropriate React component for an AI Provider:
 * Provider match -> Generic AI fallback
 *
 * @param {string} providerInput - Provider identifier
 * @param {'color'|'mono'} [variant='color'] - Color or Mono visual style
 * @returns {React.ComponentType}
 */
export function resolveProviderIconComponent(providerInput, variant = 'color') {
  try {
    const { id } = normalizeProvider(providerInput);
    const BaseIcon = PROVIDER_ICONS[id];

    if (!BaseIcon) {
      return Cpu;
    }

    if (variant === 'color' && BaseIcon.Color) {
      return BaseIcon.Color;
    }

    return BaseIcon;
  } catch {
    return Cpu;
  }
}
