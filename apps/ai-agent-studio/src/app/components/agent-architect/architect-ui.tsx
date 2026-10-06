import type { StudioGraphIssue } from '@org/types';
import { Badge } from '@org/ui';
import { cn } from '@org/utils';
import { AlertTriangle, ArrowRight, CircleAlert, CircleCheck } from 'lucide-react';

const WEB_APP_URL =
  (import.meta.env?.['VITE_WEB_APP_URL'] as string | undefined) ?? 'http://localhost:4200';

/** Where apps are connected: the platform's Integrations hub (shared with the whole workspace). */
export function integrationsHref(workspaceSlug: string): string {
  return `${WEB_APP_URL}/w/${workspaceSlug}/integrations`;
}

/** `Trigger → Qualify → Approve → Send`, as chips that wrap (brief §37). */
export function FlowLine({ flow, className }: { flow: string; className?: string }) {
  const steps = flow.split(' → ').filter(Boolean);
  if (!steps.length) return null;
  return (
    <ol className={cn('flex flex-wrap items-center gap-1', className)} aria-label="Workflow">
      {steps.map((step, i) => (
        <li key={`${step}-${i}`} className="flex items-center gap-1">
          {i > 0 && <ArrowRight className="size-3 shrink-0 text-muted-foreground" aria-hidden />}
          <span className="rounded-md border border-border bg-surface-raised px-1.5 py-0.5 text-[11px] font-medium text-foreground">
            {step}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Problems that stop a run (errors) or that it should know about (warnings). */
export function IssueList({ issues, className }: { issues: StudioGraphIssue[]; className?: string }) {
  if (!issues.length) return null;
  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');
  return (
    <ul className={cn('space-y-1', className)}>
      {[...errors, ...warnings].map((issue, i) => (
        <li key={i} className="flex items-start gap-1.5 text-[11px] leading-snug">
          {issue.level === 'error' ? (
            <CircleAlert className="mt-0.5 size-3 shrink-0 text-destructive-text" aria-label="Blocks a run" />
          ) : (
            <AlertTriangle className="mt-0.5 size-3 shrink-0 text-warning-text" aria-label="Warning" />
          )}
          <span className={issue.level === 'error' ? 'text-foreground' : 'text-muted-foreground'}>{issue.message}</span>
        </li>
      ))}
    </ul>
  );
}

/** What a change did, one line each — computed from the two graphs, so it is the whole list. */
export function ChangeList({ changes }: { changes: string[] }) {
  if (!changes.length) return <p className="text-xs text-muted-foreground">Nothing on the workflow changes.</p>;
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-foreground">
        {changes.length === 1 ? '1 change' : `${changes.length} changes`}
      </p>
      <ul className="space-y-0.5">
        {changes.map((c, i) => (
          <li key={i} className="flex items-start gap-1.5 text-xs text-foreground">
            <CircleCheck className="mt-0.5 size-3 shrink-0 text-success-text" aria-hidden />
            {c}
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-muted-foreground">No other steps change.</p>
    </div>
  );
}

export function ConnectionBadge({ label, connected }: { label: string; connected: boolean }) {
  return (
    <Badge variant={connected ? 'success' : 'warning'} className="gap-1">
      {connected ? <CircleCheck className="size-3" aria-hidden /> : <CircleAlert className="size-3" aria-hidden />}
      {label}
      <span className="sr-only">{connected ? ' (connected)' : ' (not connected)'}</span>
    </Badge>
  );
}

/** A readable message from an API error (`{ message }` bodies included). */
export function errorText(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    const anyErr = err as { message?: unknown; response?: { data?: { message?: unknown } } };
    const body = anyErr.response?.data?.message;
    if (typeof body === 'string' && body) return body;
    if (typeof anyErr.message === 'string' && anyErr.message) return anyErr.message;
  }
  return fallback;
}
