import type {
  AICredentialService,
  AIInfrastructureService,
  ModelResolverService,
  ProviderRegistryService,
} from '@org/api-ai';
import type { AIChatMessage, AIProvider } from '@org/types';

/**
 * One model call that survives a provider outage.
 *
 * Unattended agents run at 6 PM whether or not their provider is having a bad
 * minute, so a transient failure ("temporarily overloaded", a timeout, a rate
 * limit) moves on to the next enabled provider that has a key, instead of
 * failing the step. A step that pinned a provider or model is not moved —
 * that choice is respected, and it fails (and retries) like before.
 */

export interface FailoverDeps {
  ai: AIInfrastructureService;
  modelResolver: ModelResolverService;
  credentials: AICredentialService;
  providers?: ProviderRegistryService;
}

export interface FailoverResult {
  response: Awaited<ReturnType<AIInfrastructureService['chat']>>;
  provider: AIProvider;
  model: string;
  /** Providers tried before the one that answered, with why they failed. */
  failedOver?: string[];
}

const TRANSIENT = /overloaded|unavailable|temporarily|capacity|timed? ?out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|socket hang up|\b429\b|rate.?limit|\b50[0234]\b|try again/i;

export function isTransientModelError(message: string): boolean {
  return TRANSIENT.test(message);
}

export async function chatWithFailover(
  deps: FailoverDeps,
  workspaceId: string,
  cfg: Record<string, unknown>,
  messages: AIChatMessage[],
  options: {
    temperature?: number;
    maxTokens?: number;
    /** Give up on one provider after this long and try the next. */
    timeoutMs?: number;
  } = {},
): Promise<FailoverResult> {
  const pinned = Boolean(cfg['provider'] || cfg['model']);
  const first = deps.modelResolver.resolve({
    ...(cfg['provider'] ? { requestedProvider: cfg['provider'] as AIProvider } : {}),
    ...(cfg['model'] ? { requestedModel: String(cfg['model']) } : {}),
  });
  const candidates: Array<{ provider: AIProvider; model: string }> = [{ provider: first.provider, model: first.model }];
  if (!pinned && deps.providers) {
    for (const m of deps.providers.getEnabledModels()) {
      if (candidates.some((c) => c.provider === m.provider)) continue;
      if (!deps.providers.hasAdapter(m.provider)) continue;
      candidates.push({ provider: m.provider, model: m.model });
    }
  }

  const failures: string[] = [];
  let lastError: string | undefined;
  for (const [index, candidate] of candidates.entries()) {
    const cred = await deps.credentials.resolveCredential(candidate.provider, { workspaceId });
    // A fallback without a key would only fail again; skip it quietly.
    if (index > 0 && !cred.apiKey) continue;
    const controller = options.timeoutMs ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), options.timeoutMs) : null;
    try {
      const call = deps.ai.chat({
        provider: candidate.provider,
        model: candidate.model,
        apiKey: cred.apiKey,
        baseUrl: cred.baseUrl,
        messages,
        ...(options.temperature !== undefined && Number.isFinite(options.temperature) ? { temperature: options.temperature } : {}),
        ...(options.maxTokens ? { maxTokens: options.maxTokens } : {}),
        ...(controller ? { signal: controller.signal } : {}),
      });
      // Not every adapter stops on the signal (a response body can hang after
      // the headers arrive), so the deadline is enforced here, not trusted to it.
      const response = controller
        ? await Promise.race([
            call,
            new Promise<never>((_resolve, reject) =>
              controller.signal.addEventListener('abort', () => reject(new Error('timed out')), { once: true }),
            ),
          ])
        : await call;
      return { response, provider: candidate.provider, model: candidate.model, ...(failures.length ? { failedOver: failures } : {}) };
    } catch (error) {
      const aborted = controller?.signal.aborted;
      const message = aborted
        ? `the model took longer than ${Math.round((options.timeoutMs ?? 0) / 1000)}s (timed out)`
        : error instanceof Error
          ? error.message
          : String(error);
      if (!aborted && (pinned || !isTransientModelError(message))) throw error;
      failures.push(`${candidate.provider}: ${message}`);
      lastError = message;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  throw new Error(
    failures.length > 1
      ? `Every configured AI model is unavailable right now — ${failures.join('; ')}.`
      : lastError ?? 'No AI model is available.',
  );
}

/** `provider/model` for the trace, without doubling a provider the model id already names. */
export function modelLabel(provider: string, model: string): string {
  return model.startsWith(`${provider}/`) ? model : `${provider}/${model}`;
}
