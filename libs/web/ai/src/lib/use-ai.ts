import { aiApi } from '@org/api-client';
import type { AIChatMessage, AIProvider } from '@org/types';
import { useMutation } from '@tanstack/react-query';
import { useCurrentWorkspace } from '@org/web-workspace';

/**
 * Models offered in the picker.
 *
 * "Auto" sends no provider or model at all, which lets the API pick its own
 * default rather than hard-coding one the deployment may not have configured.
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

export function useAIWorkspaceId(): string | undefined {
  return useCurrentWorkspace().workspaceId;
}

/**
 * One chat completion.
 *
 * The full transcript goes up on every turn — the API is stateless, so
 * conversation memory is the caller's to carry.
 */
export function useAIChat() {
  const workspaceId = useAIWorkspaceId();

  return useMutation({
    mutationFn: ({
      messages,
      model = 'auto',
      signal,
    }: {
      messages: AIChatMessage[];
      model?: AIModelValue;
      signal?: AbortSignal;
    }) => {
      const { provider, model: modelId } = resolveModel(model);
      return aiApi.chat(
        workspaceId as string,
        {
          messages,
          ...(provider ? { provider } : {}),
          ...(modelId ? { model: modelId } : {}),
        },
        signal,
      );
    },
  });
}

export function useAISummarize() {
  const workspaceId = useAIWorkspaceId();
  return useMutation({
    mutationFn: (text: string) => aiApi.summarize(workspaceId as string, text),
  });
}

export function useAITranslate() {
  const workspaceId = useAIWorkspaceId();
  return useMutation({
    mutationFn: ({
      text,
      targetLanguage,
    }: {
      text: string;
      targetLanguage: string;
    }) => aiApi.translate(workspaceId as string, text, targetLanguage),
  });
}

export function useAIImageGeneration() {
  const workspaceId = useAIWorkspaceId();
  return useMutation({
    mutationFn: ({ prompt, provider }: { prompt: string; provider?: string }) =>
      aiApi.generateImage(workspaceId as string, prompt, provider),
  });
}

export function useAIVision() {
  const workspaceId = useAIWorkspaceId();
  return useMutation({
    mutationFn: ({ imageUrl, prompt }: { imageUrl: string; prompt?: string }) =>
      aiApi.analyzeVision(workspaceId as string, imageUrl, prompt),
  });
}

/** Retrieval over the workspace vector store. */
export function useAIRagSearch() {
  const workspaceId = useAIWorkspaceId();
  return useMutation({
    mutationFn: ({ query, limit }: { query: string; limit?: number }) =>
      aiApi.ragSearch(workspaceId as string, query, limit),
  });
}
