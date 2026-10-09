import { aiApi } from '@org/api-client';
import type { AIChatResponse, AIModelMetadata } from '@org/types';
import { estimateCost } from './use-agent-config-data.js';

export interface ModelTestResult {
  model: string;
  ok: boolean;
  output: string;
  error?: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  latencyMs: number;
  cost: number | null;
  finishReason?: string;
}

/** Why a call failed, in words a person can act on. */
export function explainModelError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? 'Unknown error');
  const status = (error as { status?: number; response?: { status?: number } } | null)?.status ?? (error as { response?: { status?: number } } | null)?.response?.status;
  if (status === 401 || status === 403 || /api key|credential|unauthori[sz]ed|auth/i.test(raw)) {
    return `The provider rejected the request — check its API key in AI settings. (${raw})`;
  }
  if (status === 429 || /rate.?limit|too many/i.test(raw)) return `Rate limit reached — wait a moment and try again. (${raw})`;
  if (status === 402 || /credit|quota|insufficient/i.test(raw)) return `Out of AI credits or quota. (${raw})`;
  if (/timeout|timed out|ECONNABORTED/i.test(raw)) return `The model took too long to answer. (${raw})`;
  if (/not found|unknown model|unavailable/i.test(raw)) return `That model isn’t available. Pick another or connect its provider. (${raw})`;
  return raw;
}

/**
 * One real model call through the workspace's AI gateway — the same
 * credentials and model resolution an agent run uses — measured end to end.
 */
export async function runModelTest(
  workspaceId: string,
  args: { model: string; system: string; user: string; temperature?: number; maxTokens?: number; signal?: AbortSignal },
  metadata?: AIModelMetadata,
): Promise<ModelTestResult> {
  const started = performance.now();
  try {
    const res: AIChatResponse = await aiApi.chat(
      workspaceId,
      {
        model: args.model,
        messages: [
          ...(args.system.trim() ? [{ role: 'system' as const, content: args.system }] : []),
          { role: 'user' as const, content: args.user },
        ],
        ...(args.temperature !== undefined ? { temperature: args.temperature } : {}),
        ...(args.maxTokens !== undefined ? { maxTokens: args.maxTokens } : {}),
      },
      args.signal,
    );
    const latencyMs = res.usage?.latencyMs ?? Math.round(performance.now() - started);
    const inputTokens = res.usage?.promptTokens ?? 0;
    const outputTokens = res.usage?.completionTokens ?? 0;
    return {
      model: res.model ?? args.model,
      ok: true,
      output: typeof res.message?.content === 'string' ? res.message.content : JSON.stringify(res.message?.content ?? ''),
      inputTokens,
      outputTokens,
      reasoningTokens: res.usage?.reasoningTokens ?? 0,
      totalTokens: res.usage?.totalTokens ?? inputTokens + outputTokens,
      latencyMs,
      cost: estimateCost(metadata, inputTokens, outputTokens),
      ...(res.finishReason ? { finishReason: res.finishReason } : {}),
    };
  } catch (error) {
    return {
      model: args.model,
      ok: false,
      output: '',
      error: explainModelError(error),
      inputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      totalTokens: 0,
      latencyMs: Math.round(performance.now() - started),
      cost: null,
    };
  }
}
