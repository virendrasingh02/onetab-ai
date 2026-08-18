import { aiApi, promptTemplateApi, queryKeys } from '@org/api-client';
import type { AIChatMessage } from '@org/types';
import type {
  CreatePromptTemplateInput,
  UpdatePromptTemplateInput,
} from '@org/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentWorkspace } from '@org/web-workspace';
import { resolveModel, type AIModelValue } from './ai-models.js';

export {
  AI_MODELS,
  modelLabelFor,
  resolveModel,
  type AIModelValue,
} from './ai-models.js';

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

/* ----------------------------------------------------- prompt library --- */

/**
 * The workspace's prompt library.
 *
 * A plain query, unlike the inference hooks above: templates are stored rows,
 * not model calls, so they cache and invalidate the way every other list in the
 * app does.
 */
export function usePromptTemplates() {
  const workspaceId = useAIWorkspaceId();

  return useQuery({
    queryKey: queryKeys.promptTemplates.list(workspaceId ?? ''),
    queryFn: () => promptTemplateApi.list(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 60_000,
  });
}

export function usePromptTemplateMutations() {
  const workspaceId = useAIWorkspaceId();
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.promptTemplates.all(workspaceId ?? ''),
    });

  const create = useMutation({
    mutationFn: (input: CreatePromptTemplateInput) =>
      promptTemplateApi.create(workspaceId as string, input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({
      templateId,
      input,
    }: {
      templateId: string;
      input: UpdatePromptTemplateInput;
    }) => promptTemplateApi.update(workspaceId as string, templateId, input),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (templateId: string) =>
      promptTemplateApi.remove(workspaceId as string, templateId),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
