import { cn } from '@org/utils';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  PencilLine,
  Plug,
  RefreshCw,
  X,
} from 'lucide-react';
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
      <header className="h-12 gap-2 px-3 flex shrink-0 items-center justify-between border-b border-border">
        <h2 className="min-w-0 text-base font-semibold leading-tight tracking-tight truncate text-foreground">
          {title}
        </h2>
        <div className="gap-0.5 flex items-center">
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
          coverClassName ?? 'from-brand/15 via-brand/5 to-transparent',
        )}
      />
      <div className="px-5">
        <div className="-mt-9 mb-3 flex items-end justify-between">
          {avatar}
          <Badge
            variant={isActive ? 'success' : 'neutral'}
            className="mb-1 gap-1.5 text-2xs"
          >
            <span
              className={cn(
                'size-1.5 rounded-full',
                isActive ? 'bg-success' : 'bg-muted-foreground/60',
              )}
            />
            {isActive ? 'Active' : 'Disabled'}
          </Badge>
        </div>

        <div className="min-w-0 gap-2 flex items-center">
          <h3 className="text-lg font-semibold tracking-tight truncate">
            {name}
          </h3>
          <Badge
            variant="primary"
            className="px-1.5 py-0 font-bold tracking-wider shrink-0 text-3xs uppercase"
          >
            {kind}
          </Badge>
        </div>
        {handle &&
          (onCopyHandle ? (
            <button
              type="button"
              onClick={copy}
              className="mt-0.5 gap-1 text-xs inline-flex items-center font-mono text-muted-foreground transition-colors hover:text-foreground"
              title="Copy handle"
            >
              {handle}
              {copied && <Check className="size-3 text-success" />}
            </button>
          ) : (
            <p className="mt-0.5 text-xs font-mono text-muted-foreground">
              {handle}
            </p>
          ))}
        {subtitle && (
          <p className="mt-1 text-xs font-medium text-brand-text">{subtitle}</p>
        )}

        {actions && (
          <div className="mt-4 gap-2 flex items-center">{actions}</div>
        )}
      </div>
    </div>
  );
}

/** Key/value rows under the hero. */
export function AIEntityProfileFacts({ children }: { children: ReactNode }) {
  return (
    <dl className="mx-5 my-5 px-3.5 text-xs divide-y divide-border/60 rounded-xl border border-border bg-surface-inset/40">
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
    <div className="min-h-10 gap-3 py-2 flex items-center justify-between">
      <dt className="gap-2 flex shrink-0 items-center text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </dt>
      <dd className="min-w-0 font-medium flex justify-end text-right text-foreground">
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
    <section className="mx-5 py-4 last:pb-6 border-t border-border/60">
      <div className="mb-2.5 gap-2 flex items-center justify-between">
        <h4 className="gap-1.5 font-semibold tracking-wider flex items-center text-meta text-muted-foreground uppercase">
          <Icon className="size-3.5 text-brand-text" />
          {title}
        </h4>
        {count !== undefined && (
          <span className="font-mono text-2xs text-muted-foreground">
            {count}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

/** Dashed placeholder for an empty section. */
export function AIEntityProfileEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="p-3 text-xs rounded-lg border border-dashed border-border text-center text-muted-foreground">
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
        'p-2.5 text-xs leading-relaxed rounded-lg border border-border/70 bg-surface-inset/60 whitespace-pre-wrap text-muted-foreground',
        mono && 'font-mono text-meta',
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
      <div className="py-4 flex justify-center">
        <Spinner className="size-4" />
      </div>
    );
  }
  if (runs.length === 0)
    return <AIEntityProfileEmpty>{emptyText}</AIEntityProfileEmpty>;

  return (
    <div className="space-y-1.5">
      {runs.map((run) => {
        const expanded = expandedId === run.id;
        return (
          <div
            key={run.id}
            className="text-xs overflow-hidden rounded-lg border border-border bg-surface"
          >
            <button
              type="button"
              aria-expanded={expanded}
              className="gap-2 p-2.5 flex w-full items-center justify-between text-left transition-colors hover:bg-muted/40"
              onClick={() => setExpandedId(expanded ? null : run.id)}
            >
              <span className="min-w-0 gap-2 flex items-center">
                <span
                  className={cn(
                    'size-2 shrink-0 rounded-full',
                    run.failed ? 'bg-destructive' : 'bg-success',
                  )}
                />
                <span className="font-medium truncate">{run.title}</span>
              </span>
              <span className="gap-1 flex shrink-0 items-center text-2xs text-muted-foreground">
                {run.at &&
                  new Date(run.at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                <ChevronDown
                  className={cn(
                    'size-3 transition-transform',
                    !expanded && '-rotate-90',
                  )}
                />
              </span>
            </button>
            {expanded && (
              <div className="space-y-1.5 p-2.5 border-t border-border bg-muted/20 text-meta">
                <p className="leading-relaxed whitespace-pre-wrap text-foreground">
                  {run.output || 'Completed without textual output.'}
                </p>
                {!!run.tokens && (
                  <div className="pt-1 flex justify-between border-t border-border/40 font-mono text-2xs text-muted-foreground">
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
      className="mx-5 mb-5 gap-2.5 p-3 text-xs flex items-start rounded-xl border border-warning/30 bg-warning/8"
    >
      <AlertTriangle
        className="mt-0.5 size-3.5 shrink-0 text-warning"
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">{title}</p>
        {children && (
          <p className="mt-0.5 leading-relaxed text-muted-foreground">
            {children}
          </p>
        )}
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
export function AIEntityProfileCapabilityList({
  items,
}: {
  items: AIEntityProfileCapability[];
}) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="gap-2 text-xs flex items-start">
          {item.blockedBy ? (
            <AlertTriangle
              className="mt-0.5 size-3.5 shrink-0 text-warning"
              aria-label="Not available yet"
            />
          ) : (
            <CheckCircle2
              className="mt-0.5 size-3.5 shrink-0 text-success"
              aria-label="Available"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="gap-x-1.5 font-medium flex flex-wrap items-center text-foreground">
              {item.label}
              {item.blockedBy && (
                <span className="font-normal text-2xs text-warning-text">
                  · {item.blockedBy}
                </span>
              )}
            </p>
            {item.description && (
              <p className="leading-relaxed text-meta text-muted-foreground">
                {item.description}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ tools -- */

export type AIEntityProfileToolGroupStatus =
  'builtin' | 'connected' | 'not_connected' | 'reconnect' | 'unknown';

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
export function AIEntityProfileToolGroups({
  groups,
}: {
  groups: AIEntityProfileToolGroup[];
}) {
  return (
    <div className="space-y-2">
      {groups.map((group) => {
        const status = TOOL_GROUP_STATUS[group.status];
        const blocked =
          group.status === 'not_connected' || group.status === 'reconnect';
        return (
          <div
            key={group.id}
            className={cn(
              'p-2.5 text-xs rounded-lg border bg-surface',
              blocked ? 'border-warning/40' : 'border-border',
            )}
          >
            <div className="gap-2 flex items-center">
              <span className="size-6 flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-inset text-muted-foreground">
                {group.logo ?? <Plug className="size-3.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate text-foreground">
                  {group.name}
                </p>
                {blocked ? (
                  <p className="font-medium truncate text-2xs text-warning-text">
                    {status.label}
                    {group.note ? ` · ${group.note}` : ''}
                  </p>
                ) : (
                  group.note && (
                    <p className="truncate text-2xs text-muted-foreground">
                      {group.note}
                    </p>
                  )
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
                <Badge variant={status.variant} className="shrink-0 text-2xs">
                  {status.label}
                </Badge>
              )}
            </div>
            {group.tools.length > 0 && (
              <div className="mt-2 gap-1.5 flex flex-wrap">
                {group.tools.map((tool) => (
                  <Badge
                    key={tool.key}
                    variant="neutral"
                    className={cn('gap-1 text-meta', blocked && 'opacity-60')}
                    title={
                      tool.access === 'write' ? 'Can make changes' : 'Read only'
                    }
                  >
                    {tool.access === 'write' && (
                      <PencilLine className="size-2.5" aria-hidden />
                    )}
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
  const shown = fields.filter((f) =>
    Array.isArray(f.value) ? f.value.length > 0 : f.value.trim(),
  );

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
              <dt className="font-semibold tracking-wider text-2xs text-muted-foreground uppercase">
                {field.label}
              </dt>
              {Array.isArray(field.value) ? (
                <dd>
                  <ul className="mt-0.5 space-y-0.5">
                    {field.value.map((v, i) => (
                      <li
                        key={i}
                        className="gap-1.5 flex items-start text-foreground/90"
                      >
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/60" />
                        <span>{v}</span>
                      </li>
                    ))}
                  </ul>
                </dd>
              ) : (
                <dd className="mt-0.5 whitespace-pre-wrap text-foreground/90">
                  {field.value}
                </dd>
              )}
            </div>
          ))}
        </dl>
      )}

      {text ? (
        <div className="overflow-hidden rounded-lg border border-border/70 bg-surface-inset/60">
          <div className="gap-2 py-1 pl-2.5 pr-1 flex items-center justify-between border-b border-border/60">
            <span className="font-semibold tracking-wider text-2xs text-muted-foreground uppercase">
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
              {copied ? (
                <Check className="size-3 text-success" />
              ) : (
                <Copy className="size-3" />
              )}
            </Button>
          </div>
          <p
            className={cn(
              'p-2.5 leading-relaxed font-mono text-meta whitespace-pre-wrap text-muted-foreground',
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
              className="gap-1 py-1 font-medium flex w-full items-center justify-center border-t border-border/60 text-meta text-brand-text hover:bg-muted/40"
            >
              {expanded ? 'Show less' : 'Show full prompt'}
              <ChevronDown
                className={cn(
                  'size-3 transition-transform',
                  expanded && 'rotate-180',
                )}
              />
            </button>
          )}
        </div>
      ) : (
        shown.length === 0 && (
          <AIEntityProfileEmpty>
            No prompt yet — it follows only its name and role.
          </AIEntityProfileEmpty>
        )
      )}
    </div>
  );
}
