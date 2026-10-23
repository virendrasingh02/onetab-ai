import type { AgentDeploymentView } from '@org/types';
import { Button } from '@org/ui';
import { cn } from '@org/utils';
import { CheckCircle2, CircleAlert, Loader2, Play, XCircle } from 'lucide-react';
import { useState } from 'react';
import { apiBase, errorMessage } from './use-deployment.js';

type CheckState =
  | { phase: 'idle' }
  | { phase: 'running' }
  | { phase: 'ok'; ms: number }
  | { phase: 'failed'; message: string };

interface ReadinessItem {
  label: string;
  ok: boolean;
  /** A soft warning: the install works, but it's worth fixing. */
  warn?: boolean;
  hint?: string;
}

/** What the live deployment says about whether an embed can work right now. */
export function readinessOf(deployment: AgentDeploymentView): ReadinessItem[] {
  const open = deployment.allowedOrigins.length === 0 || deployment.allowedOrigins.includes('*');
  return [
    {
      label: 'Deployment is active',
      ok: deployment.status === 'ACTIVE',
      hint: `It is ${deployment.status.toLowerCase()}, so embeds and API calls are refused.`,
    },
    {
      label: deployment.publishedAt ? `Version ${deployment.publishedVersionTag ?? `v${deployment.versionNumber}`} is live` : 'A version is published',
      ok: !!deployment.publishedAt,
      hint: 'Publish the agent from its header, then choose the live version in the Versions tab so visitors get a stable agent.',
    },
    {
      label: open ? 'Any site can embed this' : `Limited to ${deployment.allowedOrigins.length} origin${deployment.allowedOrigins.length === 1 ? '' : 's'}`,
      ok: !open,
      warn: open,
      hint: 'Set allowed origins in Widget Studio before going public.',
    },
  ];
}

/**
 * Readiness checklist plus a live probe: starts a real session against the
 * public API with this deployment's public key, so a wrong key, a suspended
 * deployment or a blocked origin shows up here rather than on the customer's site.
 */
export function InstallCheck({ deployment }: { deployment: AgentDeploymentView }) {
  const [state, setState] = useState<CheckState>({ phase: 'idle' });
  const items = readinessOf(deployment);

  const run = async () => {
    setState({ phase: 'running' });
    const started = performance.now();
    try {
      const res = await fetch(`${apiBase()}/agent-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicKey: deployment.publicKey, userContext: { source: 'studio-install-check' } }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
        const message = Array.isArray(body?.message) ? body?.message.join(' ') : body?.message;
        setState({ phase: 'failed', message: message || `The API answered HTTP ${res.status}.` });
        return;
      }
      setState({ phase: 'ok', ms: Math.round(performance.now() - started) });
    } catch (err) {
      setState({ phase: 'failed', message: errorMessage(err, 'Could not reach the API.') });
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-border/80 bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold text-foreground">Before you ship</div>
        <Button type="button" size="xs" variant="outline" className="gap-1.5" disabled={state.phase === 'running'} onClick={() => void run()}>
          {state.phase === 'running' ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />}
          Test connection
        </Button>
      </div>

      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.label} className="flex items-start gap-2 text-xs">
            {item.ok ? (
              <CheckCircle2 className="mt-px size-3.5 shrink-0 text-success" />
            ) : item.warn ? (
              <CircleAlert className="mt-px size-3.5 shrink-0 text-warning" />
            ) : (
              <XCircle className="mt-px size-3.5 shrink-0 text-destructive" />
            )}
            <span className="min-w-0">
              <span className="text-foreground">{item.label}</span>
              {!item.ok && item.hint ? <span className="block text-muted-foreground">{item.hint}</span> : null}
            </span>
          </li>
        ))}
      </ul>

      {state.phase === 'ok' ? (
        <p className={cn('flex items-center gap-1.5 text-xs text-success')} role="status">
          <CheckCircle2 className="size-3.5" /> The API accepted this public key and started a session ({state.ms} ms).
        </p>
      ) : state.phase === 'failed' ? (
        <p className="flex items-start gap-1.5 text-xs text-destructive" role="alert">
          <XCircle className="mt-px size-3.5 shrink-0" /> {state.message}
        </p>
      ) : null}
    </div>
  );
}
