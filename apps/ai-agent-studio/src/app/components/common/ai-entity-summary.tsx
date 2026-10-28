import { AIModelBadge, Badge, UserAvatar } from '@org/ui';
import { cn } from '@org/utils';
import { Activity, AlertTriangle, Archive, CheckCircle2, Pause, PenLine, Trash2, Zap, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * The one way Studio shows an AI entity's identity and key facts, so a canvas
 * agent on My Agents and a coworker on AI Coworkers read the same: avatar,
 * name, kind, role, status, model, then a strip of facts.
 *
 * Everything here renders phrasing content only (spans), so it can sit inside
 * a disclosure `<button>` as well as a plain card. Actions go beside it.
 */

export type AIEntityStatus = 'live' | 'working' | 'error' | 'published' | 'testing' | 'draft' | 'paused' | 'archived' | 'trash';

const STATUS: Record<AIEntityStatus, { label: string; variant: 'success' | 'info' | 'warning' | 'destructive' | 'neutral' | 'outline'; icon: LucideIcon }> = {
  live: { label: 'Live', variant: 'success', icon: CheckCircle2 },
  published: { label: 'Published', variant: 'success', icon: CheckCircle2 },
  working: { label: 'Working', variant: 'info', icon: Activity },
  testing: { label: 'Testing', variant: 'warning', icon: Zap },
  error: { label: 'Error', variant: 'destructive', icon: AlertTriangle },
  draft: { label: 'Draft', variant: 'outline', icon: PenLine },
  paused: { label: 'Paused', variant: 'neutral', icon: Pause },
  archived: { label: 'Archived', variant: 'neutral', icon: Archive },
  trash: { label: 'In Trash', variant: 'destructive', icon: Trash2 },
};

export function aiEntityStatusLabel(status: AIEntityStatus): string {
  return STATUS[status].label;
}

export function AIEntityStatusBadge({ status, className }: { status: AIEntityStatus; className?: string }) {
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <Badge variant={s.variant} className={cn('gap-1 text-2xs', className)}>
      <Icon className="size-2.5" aria-hidden />
      {s.label}
    </Badge>
  );
}

/** The entity's model, or the workspace default when it names none. */
export function AIEntityModel({ model, provider }: { model: string | null | undefined; provider?: string | null }) {
  if (!model) {
    return (
      <span className="inline-flex h-5 items-center rounded-md border border-border px-1.5 text-[10px] font-medium text-muted-foreground">
        {provider ? `${provider} default` : 'Workspace default'}
      </span>
    );
  }
  return <AIModelBadge modelId={model} provider={provider ?? undefined} variant="subtle" size="xs" />;
}

export function AIEntityHeader({
  avatar,
  name,
  kind,
  role,
  meta,
  status,
  badges,
  model,
  provider,
  nameSlot,
  children,
}: {
  avatar: ReactNode;
  name: string;
  kind: 'Agent' | 'Coworker';
  role?: string | null;
  /** Short extra descriptors after the role, e.g. the environment or business area. */
  meta?: Array<string | null | undefined | false>;
  status: AIEntityStatus;
  /** Extra badges after the status (e.g. "Was Finance"). */
  badges?: ReactNode;
  model?: string | null;
  provider?: string | null;
  /** Rendered right after the name (e.g. an inline rename control) — must be phrasing content when inside a button. */
  nameSlot?: ReactNode;
  /** Lines up under the name (facts, app icons…). */
  children?: ReactNode;
}) {
  const extras = (meta ?? []).filter(Boolean) as string[];
  return (
    <span className="flex min-w-0 flex-1 items-start gap-3">
      <span className="shrink-0">{avatar}</span>
      <span className="block min-w-0 flex-1">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-sm font-semibold text-foreground">{name}</span>
          {nameSlot}
          <AIEntityStatusBadge status={status} />
          {badges}
        </span>
        <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">{kind}</span>
          {role ? (
            <>
              <span aria-hidden>·</span>
              <span className="truncate">{role}</span>
            </>
          ) : null}
          {extras.map((m) => (
            <span key={m} className="contents">
              <span aria-hidden>·</span>
              <span className="truncate">{m}</span>
            </span>
          ))}
          {model !== undefined ? (
            <>
              <span aria-hidden>·</span>
              <AIEntityModel model={model} provider={provider} />
            </>
          ) : null}
        </span>
        {children ? <span className="mt-2 block space-y-2">{children}</span> : null}
      </span>
    </span>
  );
}

export interface AIEntityFact {
  label: string;
  value: ReactNode;
  /** Dims the fact when it reads as "nothing yet" (0 tools, 0 apps…). */
  muted?: boolean;
}

/** One row of key numbers, same order and look for agents and coworkers. */
export function AIEntityFacts({ facts, className }: { facts: AIEntityFact[]; className?: string }) {
  return (
    <span className={cn('flex flex-wrap gap-x-4 gap-y-1 text-xs', className)}>
      {facts.map((f) => (
        <span key={f.label} className={cn('inline-flex items-baseline gap-1', f.muted && 'opacity-60')}>
          <span className="font-semibold tabular-nums text-foreground">{f.value}</span>
          <span className="text-muted-foreground">{f.label}</span>
        </span>
      ))}
    </span>
  );
}

/** The person who owns an entity: their avatar and name, or "Unassigned" when no one does. */
export function AIEntityOwner({ owner }: { owner?: { id?: string | null; name: string; avatarUrl?: string | null } | null }) {
  if (!owner?.name) {
    return <span className="text-muted-foreground">Unassigned owner</span>;
  }
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <UserAvatar name={owner.name} src={owner.avatarUrl ?? undefined} seed={owner.id ?? undefined} indicator={false} size="xs" />
      <span className="truncate font-semibold text-foreground">{owner.name}</span>
      <span className="text-muted-foreground">owner</span>
    </span>
  );
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many;
}
