import { agentsApi } from '@org/api-client';
import { appLabel, type StudioCanvasGraph } from '@org/types';
import { Button } from '@org/ui';
import { cn } from '@org/utils';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronRight, ExternalLink, Loader2, X } from 'lucide-react';
import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { AppConnectorIcon } from '../common/app-connector-icon.jsx';
import { integrationsHref } from './architect-ui.js';

/** One thing the Copilot did while handling a request — shown as a checklist as it goes. */
export interface ActivityStep {
  id: string;
  label: string;
  state: 'running' | 'done' | 'failed';
  /** Shown when the step is expanded (what changed, what was found). */
  detail?: string[];
}

const COLLAPSE_AFTER = 5;

/** The step-by-step trail of a request: a spinner on the step in progress, ticks on the finished ones. */
export function ActivityTimeline({ steps }: { steps: ActivityStep[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [showAll, setShowAll] = useState(false);
  const settled = steps.every((s) => s.state !== 'running');
  // A long finished trail folds down to its last few steps
  const hidden = settled && !showAll && steps.length > COLLAPSE_AFTER ? steps.length - 3 : 0;
  const shown = steps.slice(hidden);

  return (
    <ol className="space-y-0.5" aria-label="What the Copilot did">
      {hidden > 0 && (
        <li>
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="ml-6 cursor-pointer rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
          >
            Show {hidden} earlier step{hidden === 1 ? '' : 's'}
          </button>
        </li>
      )}
      {shown.map((step) => {
        const expandable = !!step.detail?.length;
        const expanded = !!open[step.id];
        const label = step.label.replace(/…$/, '');
        const row = (
          <>
            <span className="flex size-4 shrink-0 items-center justify-center" aria-hidden>
              {step.state === 'running' ? (
                <Loader2 className="size-3.5 animate-spin text-primary" />
              ) : step.state === 'failed' ? (
                <X className="size-3.5 text-destructive-text" />
              ) : (
                <Check className="size-3.5 text-success" />
              )}
            </span>
            <span className={cn('min-w-0 flex-1 truncate', step.state === 'running' ? 'text-foreground' : 'text-muted-foreground')}>
              {step.state === 'running' ? step.label : label}
            </span>
            {expandable && <ChevronRight className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-90')} aria-hidden />}
          </>
        );
        return (
          <li key={step.id}>
            {expandable ? (
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen((o) => ({ ...o, [step.id]: !o[step.id] }))}
                className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-left text-xs transition-colors hover:bg-surface-raised/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {row}
              </button>
            ) : (
              <div className="flex items-center gap-2 px-1 py-1 text-xs">{row}</div>
            )}
            {expandable && expanded && (
              <ul className="mb-1 ml-[22px] space-y-0.5 border-l border-border pl-3">
                {step.detail?.map((d, i) => (
                  <li key={i} className="text-xs leading-snug text-muted-foreground">
                    {d}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** `**bold**` inside a line. */
function inline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**') && p.length > 4 ? (
      <strong key={i} className="font-semibold text-foreground">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    ),
  );
}

type Block =
  | { kind: 'p'; lines: string[] }
  | { kind: 'ol' | 'ul'; items: { text: string; sub: string[] }[] };

/**
 * The Copilot's own replies, laid out: paragraphs, `1.` numbered steps,
 * `•`/`-` bullets, and indented `  -` sub-points under a step.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = useMemo(() => {
    const out: Block[] = [];
    const last = () => out[out.length - 1];
    for (const raw of text.split('\n')) {
      const line = raw.trimEnd();
      if (!line.trim()) {
        out.push({ kind: 'p', lines: [] });
        continue;
      }
      const sub = line.match(/^\s{2,}[-•]\s+(.*)$/);
      const ol = line.match(/^\d+\.\s+(.*)$/);
      const ul = line.match(/^[-•]\s+(.*)$/);
      const prev = last();
      if (sub && prev && prev.kind !== 'p' && prev.items.length) {
        prev.items[prev.items.length - 1].sub.push(sub[1]);
      } else if (ol || ul) {
        const kind = ol ? 'ol' : 'ul';
        const item = { text: (ol ?? ul)?.[1] ?? '', sub: [] };
        if (prev?.kind === kind) prev.items.push(item);
        else out.push({ kind, items: [item] });
      } else if (prev?.kind === 'p' && prev.lines.length) {
        prev.lines.push(line);
      } else {
        out.push({ kind: 'p', lines: [line] });
      }
    }
    return out.filter((b) => (b.kind === 'p' ? b.lines.length > 0 : b.items.length > 0));
  }, [text]);

  return (
    <div className={cn('space-y-2', className)}>
      {blocks.map((b, i) =>
        b.kind === 'p' ? (
          <p key={i} className="whitespace-pre-line">
            {b.lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && '\n'}
                {inline(l)}
              </Fragment>
            ))}
          </p>
        ) : (
          <Fragment key={i}>
            {(() => {
              const List = b.kind;
              return (
                <List className={cn('space-y-1.5 pl-5', b.kind === 'ol' ? 'list-decimal marker:text-muted-foreground' : 'list-disc marker:text-muted-foreground/60')}>
                  {b.items.map((item, j) => (
                    <li key={j} className="pl-0.5">
                      {inline(item.text)}
                      {item.sub.length > 0 && (
                        <ul className="mt-1 list-[circle] space-y-0.5 pl-4 text-muted-foreground marker:text-muted-foreground/60">
                          {item.sub.map((s, k) => (
                            <li key={k}>{inline(s)}</li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </List>
              );
            })()}
          </Fragment>
        ),
      )}
    </div>
  );
}

export const connectionsQueryKey = (workspaceId: string, agentId: string) => ['canvas-agent-connections', workspaceId, agentId] as const;

/**
 * One "Connect X" button per app the workflow uses that isn't connected yet,
 * from the server's own check (the saved graph) plus apps the canvas names.
 * Connected apps show as ticked, so the list doubles as a checklist.
 */
export function ConnectApps({
  workspaceId,
  workspaceSlug,
  agentId,
  graph,
  quiet,
}: {
  workspaceId: string;
  workspaceSlug: string;
  agentId: string;
  graph: StudioCanvasGraph;
  /** Nothing at all when no app is needed (rather than a link to Integrations). */
  quiet?: boolean;
}) {
  const { data: statuses, isError } = useQuery({
    queryKey: connectionsQueryKey(workspaceId, agentId),
    queryFn: () => agentsApi.connections(workspaceId, agentId),
    staleTime: 10_000,
    // Coming back from the Integrations tab picks up the new connection
    refetchOnWindowFocus: true,
  });

  const apps = useMemo(() => {
    const byKey = new Map<string, { provider: string; label: string; connected: boolean }>();
    for (const s of statuses ?? []) byKey.set(s.provider.toUpperCase(), { provider: s.provider, label: s.label, connected: s.connected });
    for (const n of graph.nodes) {
      const app = n.data?.config?.['needsConnection'];
      if (typeof app !== 'string' || !app) continue;
      const key = app.toUpperCase();
      if (!byKey.has(key)) byKey.set(key, { provider: app, label: appLabel(app), connected: false });
    }
    // Still to connect first
    return [...byKey.values()].sort((a, b) => Number(a.connected) - Number(b.connected));
  }, [statuses, graph]);

  const href = integrationsHref(workspaceSlug);
  if (!apps.length) {
    if (quiet || (!statuses && !isError)) return null;
    return (
      <Button size="xs" variant="outline" asChild>
        <a href={href} target="_blank" rel="noreferrer">
          Open Integrations <ExternalLink className="size-3" aria-hidden />
        </a>
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1.5" aria-label="Apps this agent uses">
      {apps.map((app) =>
        app.connected ? (
          <span key={app.provider} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-muted-foreground">
            <AppConnectorIcon connectorId={app.provider.toLowerCase()} size={16} />
            {app.label} connected
            <Check className="size-3.5 text-success" aria-hidden />
          </span>
        ) : (
          <a
            key={app.provider}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-2xs transition-colors hover:border-border-strong hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <AppConnectorIcon connectorId={app.provider.toLowerCase()} size={16} />
            Connect {app.label}
          </a>
        ),
      )}
    </div>
  );
}
