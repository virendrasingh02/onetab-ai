import type { AIProvider } from '@org/types';

/**
 * Models offered in the picker.
 *
 * "Auto" sends no provider or model at all, which lets the API pick its own
 * default rather than hard-coding one the deployment may not have configured.
 *
 * Kept apart from `use-ai.ts` so the catalogue can be imported without pulling
 * in the query client and the workspace hooks behind it — `ai-suggestions.ts`
 * builds the `@` vocabulary from this list and is otherwise pure text work.
 */
export const AI_MODELS = [
  { value: 'auto', label: 'Auto (Recommended)' },
  { value: 'openai', label: 'OpenAI GPT-4o', provider: 'openai', model: 'gpt-4o' },
  {
    value: 'anthropic',
    label: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
  },
  {
    value: 'gemini',
    label: 'Google Gemini 1.5 Pro',
    provider: 'gemini',
    model: 'gemini-1.5-pro',
  },
  {
    value: 'ollama',
    label: 'Ollama Llama 3 (Local)',
    provider: 'ollama',
    model: 'llama3',
  },
] as const satisfies ReadonlyArray<{
  value: string;
  label: string;
  provider?: AIProvider;
  model?: string;
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
