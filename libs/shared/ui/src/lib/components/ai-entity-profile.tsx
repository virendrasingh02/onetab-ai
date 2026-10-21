import { cn } from '@org/utils';
import { Check, ChevronDown, X } from 'lucide-react';
import { useState, type ComponentType, type ReactNode } from 'react';
import { Badge } from './badge.js';
import { Button } from './button.js';
import { Spinner } from './loading-state.js';
import { ScrollArea } from './scroll-area.js';

/**
 * The one layout for an AI agent's or AI coworker's right-panel profile, so
 * both read the same: header → cover + identity → actions → facts → sections.
 */

type IconType = ComponentType<{ className?: string }>;

export interface AIEntityProfilePanelProps {
  title: string;
  /** Overflow (⋯) menu, rendered next to the close button. */
  menu?: ReactNode;
  onClose?: () => void;
  className?: string;
  children: ReactNode;
}

export function AIEntityProfilePanel({
  title,
  menu,
  onClose,
  className,
  children,
}: AIEntityProfilePanelProps) {
  return (
    <aside
      className={cn(
        'flex h-full w-full flex-col overflow-hidden bg-surface text-foreground',
        className,
      )}
    >
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        <h2 className="min-w-0 truncate text-base font-semibold leading-tight tracking-tight text-foreground">
          {title}
        </h2>
        <div className="flex items-center gap-0.5">
          {menu}
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={onClose}
              aria-label="Close profile"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </header>
      <ScrollArea className="flex-1">{children}</ScrollArea>
    </aside>
  );
}

export interface AIEntityProfileHeroProps {
  avatar: ReactNode;
  name: string;
  /** "AI Agent" / "AI Coworker". */
  kind: string;
  isActive: boolean;
  /** Mono handle under the name; clickable when `onCopyHandle` is given. */
  handle?: string;
  onCopyHandle?: () => void;
  subtitle?: ReactNode;
  /** Gradient classes for the cover band. */
  coverClassName?: string;
  /** Primary + secondary buttons row. */
  actions?: ReactNode;
}

export function AIEntityProfileHero({
  avatar,
  name,
  kind,
  isActive,
  handle,
  onCopyHandle,
  subtitle,
  coverClassName,
  actions,
}: AIEntityProfileHeroProps) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    onCopyHandle?.();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div
        className={cn(
          'h-20 w-full border-b border-border/60 bg-gradient-to-br',
          coverClassName ?? 'from-primary/15 via-primary/5 to-transparent',
        )}
      />
      <div className="px-5">
        <div className="-mt-9 mb-3 flex items-end justify-between">
          {avatar}
          <Badge variant={isActive ? 'success' : 'neutral'} className="mb-1 gap-1.5 text-[10px]">
            <span
              className={cn(
                'size-1.5 rounded-full',
                isActive ? 'bg-success' : 'bg-muted-foreground/60',
              )}
            />
            {isActive ? 'Active' : 'Disabled'}
          </Badge>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-lg font-semibold tracking-tight">{name}</h3>
          <Badge
            variant="primary"
            className="shrink-0 px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider"
          >
            {kind}
          </Badge>
        </div>
        {handle &&
          (onCopyHandle ? (
            <button
              type="button"
              onClick={copy}
              className="mt-0.5 inline-flex items-center gap-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
              title="Copy handle"
            >
              {handle}
              {copied && <Check className="size-3 text-success" />}
            </button>
          ) : (
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">{handle}</p>
          ))}
        {subtitle && <p className="mt-1 text-xs font-medium text-primary-text">{subtitle}</p>}

        {actions && <div className="mt-4 flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** Key/value rows under the hero. */
export function AIEntityProfileFacts({ children }: { children: ReactNode }) {
  return (
    <dl className="mx-5 my-5 divide-y divide-border/60 rounded-xl border border-border bg-surface-inset/40 px-3.5 text-xs">
      {children}
    </dl>
  );
}

export function AIEntityProfileFact({
  icon: Icon,
  label,
  children,
}: {
  icon: IconType;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 py-2">
      <dt className="flex shrink-0 items-center gap-2 text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </dt>
      <dd className="flex min-w-0 justify-end text-right font-medium text-foreground">
        {children}
      </dd>
    </div>
  );
}

export function AIEntityProfileSection({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: IconType;
  title: string;
  count?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mx-5 border-t border-border/60 py-4 last:pb-6">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Icon className="size-3.5 text-primary" />
          {title}
        </h4>
        {count !== undefined && (
          <span className="font-mono text-[10px] text-muted-foreground">{count}</span>
        )}
      </div>
      {children}
    </section>
  );
}

/** Dashed placeholder for an empty section. */
export function AIEntityProfileEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
      {children}
    </p>
  );
}

/** Muted inset block for long text (instructions, persona). */
export function AIEntityProfileQuote({
  children,
  mono,
}: {
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <p
      className={cn(
        'whitespace-pre-wrap rounded-lg border border-border/70 bg-surface-inset/60 p-2.5 text-xs leading-relaxed text-muted-foreground',
        mono && 'font-mono text-[11px]',
      )}
    >
      {children}
    </p>
  );
}

export interface AIEntityProfileRun {
  id: string;
  failed: boolean;
  title: string;
  output?: string | null;
  tokens?: number | null;
  at?: string | null;
}

export function AIEntityProfileRunList({
  runs,
  loading,
  emptyText,
}: {
  runs: AIEntityProfileRun[];
  loading?: boolean;
  emptyText: string;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Spinner className="size-4" />
      </div>
    );
  }
  if (runs.length === 0) return <AIEntityProfileEmpty>{emptyText}</AIEntityProfileEmpty>;

  return (
    <div className="space-y-1.5">
      {runs.map((run) => {
        const expanded = expandedId === run.id;
        return (
          <div key={run.id} className="overflow-hidden rounded-lg border border-border bg-surface text-xs">
            <button
              type="button"
              aria-expanded={expanded}
              className="flex w-full items-center justify-between gap-2 p-2.5 text-left transition-colors hover:bg-muted/40"
              onClick={() => setExpandedId(expanded ? null : run.id)}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    'size-2 shrink-0 rounded-full',
                    run.failed ? 'bg-destructive' : 'bg-success',
                  )}
                />
                <span className="truncate font-medium">{run.title}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                {run.at &&
                  new Date(run.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                <ChevronDown
                  className={cn('size-3 transition-transform', !expanded && '-rotate-90')}
                />
              </span>
            </button>
            {expanded && (
              <div className="space-y-1.5 border-t border-border bg-muted/20 p-2.5 text-[11px]">
                <p className="whitespace-pre-wrap leading-relaxed text-foreground">
                  {run.output || 'Completed without textual output.'}
                </p>
                {!!run.tokens && (
                  <div className="flex justify-between border-t border-border/40 pt-1 font-mono text-[10px] text-muted-foreground">
                    <span>Tokens</span>
                    <span>{run.tokens}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
