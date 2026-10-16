/**
 * Central Model & Provider Icon Registry
 * Connects normalized model / provider identities to official @lobehub/icons.
 */

/*
 * Each brand's plain SVG Mono/Color components are imported directly. The
 * package barrel (and each brand's own index) also pulls in Avatar/Combine
 * variants that need `@lobehub/ui` + `antd`, which this app doesn't ship.
 */
import OpenAIMono from '@lobehub/icons/es/OpenAI/components/Mono.js';
import ClaudeMono from '@lobehub/icons/es/Claude/components/Mono.js';
import ClaudeColor from '@lobehub/icons/es/Claude/components/Color.js';
import GeminiMono from '@lobehub/icons/es/Gemini/components/Mono.js';
import GeminiColor from '@lobehub/icons/es/Gemini/components/Color.js';
import GemmaMono from '@lobehub/icons/es/Gemma/components/Mono.js';
import GemmaColor from '@lobehub/icons/es/Gemma/components/Color.js';
import DeepSeekMono from '@lobehub/icons/es/DeepSeek/components/Mono.js';
import DeepSeekColor from '@lobehub/icons/es/DeepSeek/components/Color.js';
import NvidiaMono from '@lobehub/icons/es/Nvidia/components/Mono.js';
import NvidiaColor from '@lobehub/icons/es/Nvidia/components/Color.js';
import MistralMono from '@lobehub/icons/es/Mistral/components/Mono.js';
import MistralColor from '@lobehub/icons/es/Mistral/components/Color.js';
import QwenMono from '@lobehub/icons/es/Qwen/components/Mono.js';
import QwenColor from '@lobehub/icons/es/Qwen/components/Color.js';
import MetaMono from '@lobehub/icons/es/Meta/components/Mono.js';
import MetaColor from '@lobehub/icons/es/Meta/components/Color.js';
import OllamaMono from '@lobehub/icons/es/Ollama/components/Mono.js';
import GroqMono from '@lobehub/icons/es/Groq/components/Mono.js';
import CohereMono from '@lobehub/icons/es/Cohere/components/Mono.js';
import CohereColor from '@lobehub/icons/es/Cohere/components/Color.js';
import OpenRouterMono from '@lobehub/icons/es/OpenRouter/components/Mono.js';
import OpenRouterColor from '@lobehub/icons/es/OpenRouter/components/Color.js';
import TogetherMono from '@lobehub/icons/es/Together/components/Mono.js';
import TogetherColor from '@lobehub/icons/es/Together/components/Color.js';
import PerplexityMono from '@lobehub/icons/es/Perplexity/components/Mono.js';
import PerplexityColor from '@lobehub/icons/es/Perplexity/components/Color.js';
import FirecrawlMono from '@lobehub/icons/es/Firecrawl/components/Mono.js';
import FirecrawlColor from '@lobehub/icons/es/Firecrawl/components/Color.js';
import MCPMono from '@lobehub/icons/es/MCP/components/Mono.js';
import LangChainMono from '@lobehub/icons/es/LangChain/components/Mono.js';
import LangChainColor from '@lobehub/icons/es/LangChain/components/Color.js';
import LangGraphMono from '@lobehub/icons/es/LangGraph/components/Mono.js';
import LangGraphColor from '@lobehub/icons/es/LangGraph/components/Color.js';
import ElevenLabsMono from '@lobehub/icons/es/ElevenLabs/components/Mono.js';
import SoraMono from '@lobehub/icons/es/Sora/components/Mono.js';
import SoraColor from '@lobehub/icons/es/Sora/components/Color.js';
import DalleMono from '@lobehub/icons/es/Dalle/components/Mono.js';
import DalleColor from '@lobehub/icons/es/Dalle/components/Color.js';
import FluxMono from '@lobehub/icons/es/Flux/components/Mono.js';
import MidjourneyMono from '@lobehub/icons/es/Midjourney/components/Mono.js';
import GrokMono from '@lobehub/icons/es/Grok/components/Mono.js';
import XAIMono from '@lobehub/icons/es/XAI/components/Mono.js';
import HuggingFaceMono from '@lobehub/icons/es/HuggingFace/components/Mono.js';
import HuggingFaceColor from '@lobehub/icons/es/HuggingFace/components/Color.js';
import FireworksMono from '@lobehub/icons/es/Fireworks/components/Mono.js';
import FireworksColor from '@lobehub/icons/es/Fireworks/components/Color.js';
import ReplicateMono from '@lobehub/icons/es/Replicate/components/Mono.js';
import MinimaxMono from '@lobehub/icons/es/Minimax/components/Mono.js';
import MinimaxColor from '@lobehub/icons/es/Minimax/components/Color.js';
import MoonshotMono from '@lobehub/icons/es/Moonshot/components/Mono.js';
import ZhipuMono from '@lobehub/icons/es/Zhipu/components/Mono.js';
import ZhipuColor from '@lobehub/icons/es/Zhipu/components/Color.js';
import ByteDanceMono from '@lobehub/icons/es/ByteDance/components/Mono.js';
import ByteDanceColor from '@lobehub/icons/es/ByteDance/components/Color.js';
import BaiduMono from '@lobehub/icons/es/Baidu/components/Mono.js';
import BaiduColor from '@lobehub/icons/es/Baidu/components/Color.js';
import AlibabaCloudMono from '@lobehub/icons/es/AlibabaCloud/components/Mono.js';
import AlibabaCloudColor from '@lobehub/icons/es/AlibabaCloud/components/Color.js';
import AwsMono from '@lobehub/icons/es/Aws/components/Mono.js';
import AwsColor from '@lobehub/icons/es/Aws/components/Color.js';
import AzureMono from '@lobehub/icons/es/Azure/components/Mono.js';
import AzureColor from '@lobehub/icons/es/Azure/components/Color.js';
import VertexAIMono from '@lobehub/icons/es/VertexAI/components/Mono.js';
import VertexAIColor from '@lobehub/icons/es/VertexAI/components/Color.js';
import BedrockMono from '@lobehub/icons/es/Bedrock/components/Mono.js';
import BedrockColor from '@lobehub/icons/es/Bedrock/components/Color.js';
import GoogleMono from '@lobehub/icons/es/Google/components/Mono.js';
import GoogleColor from '@lobehub/icons/es/Google/components/Color.js';
import AnthropicMono from '@lobehub/icons/es/Anthropic/components/Mono.js';
import FalMono from '@lobehub/icons/es/Fal/components/Mono.js';
import FalColor from '@lobehub/icons/es/Fal/components/Color.js';
import { createElement, type ComponentType } from 'react';
import { Bot, Sparkles, Cpu } from 'lucide-react';
import { normalizeModel, normalizeProvider, type ModelInput } from './model-normalizer.js';

/** Props every brand icon (and the lucide fallbacks) accepts. */
export interface AIIconProps {
  size?: number | string;
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
}

export type AIIconComponent = ComponentType<AIIconProps>;
export type AIIconVariant = 'color' | 'mono';

/** A LobeHub brand icon: mono by default, with an optional `.Color` variant. */
type BrandIcon = AIIconComponent & { Color?: AIIconComponent };

// The Mono/Color files are typed with LobeHub's own props; ours are a subset.
function brand(mono: unknown, color?: unknown): BrandIcon {
  const Mono = mono as AIIconComponent;
  const icon = ((props: AIIconProps) => createElement(Mono, props)) as BrandIcon;
  icon.displayName = Mono.displayName;
  if (color) icon.Color = color as AIIconComponent;
  return icon;
}

const OpenAI = brand(OpenAIMono);
const Claude = brand(ClaudeMono, ClaudeColor);
const Gemini = brand(GeminiMono, GeminiColor);
const Gemma = brand(GemmaMono, GemmaColor);
const DeepSeek = brand(DeepSeekMono, DeepSeekColor);
const Nvidia = brand(NvidiaMono, NvidiaColor);
const Mistral = brand(MistralMono, MistralColor);
const Qwen = brand(QwenMono, QwenColor);
const Meta = brand(MetaMono, MetaColor);
const Ollama = brand(OllamaMono);
const Groq = brand(GroqMono);
const Cohere = brand(CohereMono, CohereColor);
const OpenRouter = brand(OpenRouterMono, OpenRouterColor);
const Together = brand(TogetherMono, TogetherColor);
const Perplexity = brand(PerplexityMono, PerplexityColor);
const Firecrawl = brand(FirecrawlMono, FirecrawlColor);
const MCP = brand(MCPMono);
const LangChain = brand(LangChainMono, LangChainColor);
const LangGraph = brand(LangGraphMono, LangGraphColor);
const ElevenLabs = brand(ElevenLabsMono);
const Sora = brand(SoraMono, SoraColor);
const Dalle = brand(DalleMono, DalleColor);
const Flux = brand(FluxMono);
const Midjourney = brand(MidjourneyMono);
const Grok = brand(GrokMono);
const XAI = brand(XAIMono);
const HuggingFace = brand(HuggingFaceMono, HuggingFaceColor);
const Fireworks = brand(FireworksMono, FireworksColor);
const Replicate = brand(ReplicateMono);
const Minimax = brand(MinimaxMono, MinimaxColor);
const Moonshot = brand(MoonshotMono);
const Zhipu = brand(ZhipuMono, ZhipuColor);
const ByteDance = brand(ByteDanceMono, ByteDanceColor);
const Baidu = brand(BaiduMono, BaiduColor);
const AlibabaCloud = brand(AlibabaCloudMono, AlibabaCloudColor);
const Aws = brand(AwsMono, AwsColor);
const Azure = brand(AzureMono, AzureColor);
const VertexAI = brand(VertexAIMono, VertexAIColor);
const Bedrock = brand(BedrockMono, BedrockColor);
const Google = brand(GoogleMono, GoogleColor);
const Anthropic = brand(AnthropicMono);
const Fal = brand(FalMono, FalColor);

/**
 * Model-specific icon registry
 * Maps canonical model IDs to their dedicated LobeHub icon components.
 */
export const MODEL_ICONS: Record<string, BrandIcon> = {
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
export const PROVIDER_ICONS: Record<string, BrandIcon> = {
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
export const GenericAIFallback: AIIconComponent = Sparkles;
export const GenericAgentFallback: AIIconComponent = Bot;

/**
 * Resolves the appropriate React component for an AI Model according to the fallback rule:
 * Exact model match -> Provider match -> Generic AI fallback (Sparkles)
 *
 * @param {string|object} modelInput - Raw model ID or object
 * @param {string} [providerInput] - Optional provider hint
 * @param {'color'|'mono'} [variant='color'] - Color or Mono visual style
 * @returns {React.ComponentType} The component ready to render
 */
export function resolveModelIconComponent(
  modelInput: ModelInput,
  providerInput: string | null = null,
  variant: AIIconVariant = 'color',
): AIIconComponent {
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
export function resolveProviderIconComponent(providerInput: unknown, variant: AIIconVariant = 'color'): AIIconComponent {
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
