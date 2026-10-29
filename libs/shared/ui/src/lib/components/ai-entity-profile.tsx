import { cn } from '@org/utils';
import { AlertTriangle, Check, CheckCircle2, ChevronDown, Copy, PencilLine, Plug, RefreshCw, X } from 'lucide-react';
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

/* ------------------------------------------------------------ capabilities -- */

/** Warning strip for something the viewer has to fix (an app to connect…). */
export function AIEntityProfileNotice({
  title,
  children,
  action,
}: {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      role="status"
      className="mx-5 mb-5 flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/8 p-3 text-xs"
    >
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">{title}</p>
        {children && <p className="mt-0.5 leading-relaxed text-muted-foreground">{children}</p>}
      </div>
      {action}
    </div>
  );
}

export interface AIEntityProfileCapability {
  id: string;
  label: string;
  description?: string;
  /** Why it can't be used right now ("Connect Slack"); unset when it can. */
  blockedBy?: string;
}

/** What the entity can do, in plain words — a tick when ready, a warning when blocked. */
export function AIEntityProfileCapabilityList({ items }: { items: AIEntityProfileCapability[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-2 text-xs">
          {item.blockedBy ? (
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" aria-label="Not available yet" />
          ) : (
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" aria-label="Available" />
          )}
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-1.5 font-medium text-foreground">
              {item.label}
              {item.blockedBy && (
                <span className="text-[10px] font-normal text-warning-text">· {item.blockedBy}</span>
              )}
            </p>
            {item.description && (
              <p className="text-[11px] leading-relaxed text-muted-foreground">{item.description}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ tools -- */

export type AIEntityProfileToolGroupStatus = 'builtin' | 'connected' | 'not_connected' | 'reconnect' | 'unknown';

export interface AIEntityProfileToolGroup {
  /** `builtin` or the provider key. */
  id: string;
  name: string;
  /** App logo; built-in groups fall back to a plug icon. */
  logo?: ReactNode;
  status: AIEntityProfileToolGroupStatus;
  /** Extra line under the name ("Through the workspace account"). */
  note?: string;
  tools: Array<{ key: string; label: string; access: 'read' | 'write' }>;
  onConnect?: () => void;
  connecting?: boolean;
}

const TOOL_GROUP_STATUS: Record<
  AIEntityProfileToolGroupStatus,
  { label: string; variant: 'success' | 'warning' | 'neutral' | 'destructive' }
> = {
  builtin: { label: 'Built-in', variant: 'neutral' },
  connected: { label: 'Connected', variant: 'success' },
  not_connected: { label: 'Not connected', variant: 'warning' },
  reconnect: { label: 'Reconnect needed', variant: 'destructive' },
  unknown: { label: 'Checking…', variant: 'neutral' },
};

/**
 * Tools grouped by the app they act in, each app with its connection state
 * and a Connect button when the viewer still has to link it.
 */
export function AIEntityProfileToolGroups({ groups }: { groups: AIEntityProfileToolGroup[] }) {
  return (
    <div className="space-y-2">
      {groups.map((group) => {
        const status = TOOL_GROUP_STATUS[group.status];
        const blocked = group.status === 'not_connected' || group.status === 'reconnect';
        return (
          <div
            key={group.id}
            className={cn(
              'rounded-lg border bg-surface p-2.5 text-xs',
              blocked ? 'border-warning/40' : 'border-border',
            )}
          >
            <div className="flex items-center gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-inset text-muted-foreground">
                {group.logo ?? <Plug className="size-3.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{group.name}</p>
                {blocked ? (
                  <p className="truncate text-[10px] font-medium text-warning-text">
                    {status.label}
                    {group.note ? ` · ${group.note}` : ''}
                  </p>
                ) : (
                  group.note && <p className="truncate text-[10px] text-muted-foreground">{group.note}</p>
                )}
              </div>
              {blocked && group.onConnect ? (
                <Button
                  size="xs"
                  variant={group.status === 'reconnect' ? 'outline' : 'primary'}
                  onClick={group.onConnect}
                  disabled={group.connecting}
                  className="shrink-0"
                >
                  {group.connecting ? (
                    <Spinner className="size-3" />
                  ) : group.status === 'reconnect' ? (
                    <RefreshCw className="size-3" />
                  ) : (
                    <Plug className="size-3" />
                  )}
                  {group.status === 'reconnect' ? 'Reconnect' : 'Connect'}
                </Button>
              ) : (
                <Badge variant={status.variant} className="shrink-0 text-[10px]">
                  {status.label}
                </Badge>
              )}
            </div>
            {group.tools.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {group.tools.map((tool) => (
                  <Badge
                    key={tool.key}
                    variant="neutral"
                    className={cn('gap-1 text-[11px]', blocked && 'opacity-60')}
                    title={tool.access === 'write' ? 'Can make changes' : 'Read only'}
                  >
                    {tool.access === 'write' && <PencilLine className="size-2.5" aria-hidden />}
                    {tool.label}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------- prompt -- */

export interface AIEntityProfilePromptField {
  label: string;
  value: string | string[];
}

/**
 * The prompt an entity runs with: its structured settings (objective, goals,
 * constraints…) as short rows, then the instructions — clamped, expandable
 * and copyable.
 */
export function AIEntityProfilePrompt({
  instructions,
  fields = [],
}: {
  instructions?: string;
  fields?: AIEntityProfilePromptField[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = instructions?.trim() ?? '';
  const long = text.length > 280 || text.split('\n').length > 6;
  const shown = fields.filter((f) => (Array.isArray(f.value) ? f.value.length > 0 : f.value.trim()));

  const copy = () => {
    void navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-2.5">
      {shown.length > 0 && (
        <dl className="space-y-2 text-xs">
          {shown.map((field) => (
            <div key={field.label}>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {field.label}
              </dt>
              {Array.isArray(field.value) ? (
                <dd>
                  <ul className="mt-0.5 space-y-0.5">
                    {field.value.map((v, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-foreground/90">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/60" />
                        <span>{v}</span>
                      </li>
                    ))}
                  </ul>
                </dd>
              ) : (
                <dd className="mt-0.5 whitespace-pre-wrap text-foreground/90">{field.value}</dd>
              )}
            </div>
          ))}
        </dl>
      )}

      {text ? (
        <div className="overflow-hidden rounded-lg border border-border/70 bg-surface-inset/60">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 py-1 pl-2.5 pr-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Instructions
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={copy}
              title="Copy prompt"
              aria-label="Copy prompt"
              className="size-5"
            >
              {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
            </Button>
          </div>
          <p
            className={cn(
              'whitespace-pre-wrap p-2.5 font-mono text-[11px] leading-relaxed text-muted-foreground',
              long && !expanded && 'line-clamp-6',
            )}
          >
            {text}
          </p>
          {long && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="flex w-full items-center justify-center gap-1 border-t border-border/60 py-1 text-[11px] font-medium text-primary-text hover:bg-muted/40"
            >
              {expanded ? 'Show less' : 'Show full prompt'}
              <ChevronDown className={cn('size-3 transition-transform', expanded && 'rotate-180')} />
            </button>
          )}
        </div>
      ) : (
        shown.length === 0 && (
          <AIEntityProfileEmpty>No prompt yet — it follows only its name and role.</AIEntityProfileEmpty>
        )
      )}
    </div>
  );
}
