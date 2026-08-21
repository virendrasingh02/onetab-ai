import type { AIProvider } from '@org/types';

/**
 * Models offered in the picker across supported providers.
 *
 * "Auto" sends no provider or model at all, which lets the API pick its own
 * default (NVIDIA Nemotron 3 Super) rather than hard-coding one.
 */
export const AI_MODELS = [
  {
    value: 'auto',
    label: 'Auto (Default)',
    category: 'Default',
    description: 'Auto-selects platform default (Nemotron 3 Super)',
  },
  // NVIDIA
  {
    value: 'nemotron',
    label: 'Nemotron 3 Super (NVIDIA)',
    provider: 'nvidia',
    model: 'nvidia/nemotron-3-super-120b-a12b',
    category: 'NVIDIA',
    badge: 'Reasoning',
  },
  // OpenAI
  {
    value: 'openai',
    label: 'OpenAI GPT-4o',
    provider: 'openai',
    model: 'gpt-4o',
    category: 'OpenAI',
    badge: 'Vision & Tools',
  },
  {
    value: 'gpt-4o-mini',
    label: 'OpenAI GPT-4o Mini',
    provider: 'openai',
    model: 'gpt-4o-mini',
    category: 'OpenAI',
    badge: 'Fast',
  },
  // Anthropic
  {
    value: 'anthropic',
    label: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    category: 'Anthropic',
    badge: 'Coding & Agents',
  },
  // Google
  {
    value: 'gemini',
    label: 'Google Gemini 1.5 Pro',
    provider: 'gemini',
    model: 'gemini-1.5-pro',
    category: 'Google',
    badge: '2M Context',
  },
  // DeepSeek
  {
    value: 'deepseek',
    label: 'DeepSeek-V3',
    provider: 'deepseek',
    model: 'deepseek-chat',
    category: 'DeepSeek',
    badge: 'Code & Math',
  },
  {
    value: 'deepseek-r1',
    label: 'DeepSeek-R1 (Reasoner)',
    provider: 'deepseek',
    model: 'deepseek-reasoner',
    category: 'DeepSeek',
    badge: 'Reasoning',
  },
  // Groq
  {
    value: 'groq',
    label: 'Llama 3.3 70B (Groq LPU)',
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    category: 'Groq',
    badge: 'Ultra Fast',
  },
  // Mistral
  {
    value: 'mistral',
    label: 'Mistral Large',
    provider: 'mistral',
    model: 'mistral-large-latest',
    category: 'Mistral',
    badge: 'Multilingual',
  },
  // xAI
  {
    value: 'xai',
    label: 'Grok 2 (xAI)',
    provider: 'xai',
    model: 'grok-2-1212',
    category: 'xAI',
    badge: 'Reasoning',
  },
  // Together AI
  {
    value: 'together',
    label: 'Llama 3.1 70B Turbo (Together)',
    provider: 'together',
    model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    category: 'Together AI',
    badge: 'Open Source',
  },
  // OpenRouter
  {
    value: 'openrouter',
    label: 'OpenRouter (Auto Routing)',
    provider: 'openrouter',
    model: 'auto',
    category: 'OpenRouter',
    badge: 'Multi-Model',
  },
  // Cohere
  {
    value: 'cohere',
    label: 'Command R+ (Cohere)',
    provider: 'cohere',
    model: 'command-r-plus-08-2024',
    category: 'Cohere',
    badge: 'RAG & Tools',
  },
  // Ollama
  {
    value: 'ollama',
    label: 'Ollama Llama 3 (Local)',
    provider: 'ollama',
    model: 'llama3',
    category: 'Local',
    badge: 'Offline',
  },
] as const satisfies ReadonlyArray<{
  value: string;
  label: string;
  provider?: AIProvider;
  model?: string;
  category?: string;
  badge?: string;
  description?: string;
}>;

export type AIModelValue = (typeof AI_MODELS)[number]['value'];

export function resolveModel(value: AIModelValue) {
  const entry = AI_MODELS.find((option) => option.value === value);
  return {
    provider: entry && 'provider' in entry ? entry.provider : undefined,
    model: entry && 'model' in entry ? entry.model : undefined,
  };
}

export function modelLabelFor(value: AIModelValue) {
  return AI_MODELS.find((option) => option.value === value)?.label ?? 'Auto';
}
