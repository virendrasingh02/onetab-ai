import type { AIProvider } from '@org/types';

/**
 * Models offered in the picker across supported providers.
 *
 * "Auto" sends no provider or model at all, which lets the API pick its own
 * default (NVIDIA Nemotron 3 Super) rather than hard-coding one.
 */
export interface AIModelPickerOption<V extends string = string> {
  value: V;
  label: string;
  provider?: AIProvider;
  model?: string;
  category?: string;
  badge?: string;
  description?: string;
}

const MODEL_LIST = [
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
    model: 'claude-sonnet-4-5',
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
  // --- Enable later --------------------------------------------------------
  // The following providers are wired end-to-end (adapters + credential
  // resolution) but intentionally kept out of the picker for launch. Uncomment
  // an entry — and add its provider to AI_ENABLED_PROVIDERS on the API — to
  // switch it on. Nothing else needs to change.
  //
  // DeepSeek-V3 ......... provider: 'deepseek',   model: 'deepseek-chat'
  // DeepSeek-R1 ......... provider: 'deepseek',   model: 'deepseek-reasoner'
  // Groq Llama 3.3 70B .. provider: 'groq',       model: 'llama-3.3-70b-versatile'
  // Mistral Large ....... provider: 'mistral',    model: 'mistral-large-latest'
  // Grok 2 (xAI) ........ provider: 'xai',        model: 'grok-2-1212'
  // Llama 3.1 70B Turbo . provider: 'together',   model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo'
  // OpenRouter (auto) ... provider: 'openrouter', model: 'auto'
  // Command R+ (Cohere) . provider: 'cohere',     model: 'command-r-plus-08-2024'
  // Ollama Llama 3 ...... provider: 'ollama',     model: 'llama3'
] as const satisfies ReadonlyArray<AIModelPickerOption>;

export type AIModelValue = (typeof MODEL_LIST)[number]['value'];

export const AI_MODELS: ReadonlyArray<AIModelPickerOption<AIModelValue>> = MODEL_LIST;

export function resolveModel(value: AIModelValue) {
  const entry = AI_MODELS.find((option) => option.value === value);
  return { provider: entry?.provider, model: entry?.model };
}

export function modelLabelFor(value: AIModelValue) {
  return AI_MODELS.find((option) => option.value === value)?.label ?? 'Auto';
}
