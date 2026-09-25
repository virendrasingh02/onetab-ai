import { cn, formatRelative } from '@org/utils';
import {
  AlertTriangle,
  Loader2,
  PlugZap,
  RefreshCw,
  Settings2,
  Unplug,
  Zap,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from './badge.js';
import { Button } from './button.js';
import { EmptyState } from './empty-state.js';
import { ErrorState } from './error-state.js';
import { Skeleton } from './skeleton.js';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip.js';

/**
 * The platform's connection model — integrations, AI providers, anything that
 * links the workspace to an outside account. Provider-specific status strings
 * (`CONNECTED`, `EXPIRED`, `REVOKED`…) are normalised once here so every
 * screen shows the same state the same way, and so an expired or failing
 * connection is never rendered as simply "not connected" with no way back.
 */
export type ConnectionState =
  | 'connected'
  | 'disconnected'
  | 'connecting'
  | 'reconnecting'
  | 'expired'
  | 'error'
  | 'disabled';

/** Maps a backend status (any casing) onto the shared model. */
export function toConnectionState(
  status: string | null | undefined,
): ConnectionState {
  switch ((status ?? '').toUpperCase()) {
    case 'CONNECTED':
    case 'ACTIVE':
      return 'connected';
    case 'CONNECTING':
    case 'PENDING':
      return 'connecting';
    case 'RECONNECTING':
      return 'reconnecting';
    case 'EXPIRED':
    case 'REVOKED':
      return 'expired';
    case 'ERROR':
    case 'FAILED':
      return 'error';
    case 'DISABLED':
      return 'disabled';
    default:
      return 'disconnected';
  }
}

/** True for states where the account link exists and needs attention. */
export function needsReconnect(state: ConnectionState): boolean {
  return state === 'expired' || state === 'error';
}

/** True for states where a Disconnect action makes sense. */
export function isLinked(state: ConnectionState): boolean {
  return state !== 'disconnected' && state !== 'disabled';
}

const STATE_META: Record<
  ConnectionState,
  {
    label: string;
    variant: 'success' | 'neutral' | 'info' | 'warning' | 'destructive' | 'outline';
    dot: string;
  }
> = {
  connected: { label: 'Connected', variant: 'success', dot: 'bg-success' },
  disconnected: { label: 'Not connected', variant: 'neutral', dot: 'bg-muted-foreground' },
  connecting: { label: 'Connecting…', variant: 'info', dot: 'bg-info animate-pulse' },
  reconnecting: { label: 'Reconnecting…', variant: 'info', dot: 'bg-info animate-pulse' },
  expired: { label: 'Expired', variant: 'warning', dot: 'bg-warning' },
  error: { label: 'Error', variant: 'destructive', dot: 'bg-destructive' },
  disabled: { label: 'Unavailable', variant: 'outline', dot: 'bg-subtle' },
};

export function ConnectionStatusBadge({
  state,
  label,
  className,
}: {
  state: ConnectionState;
  /** Overrides the default label, e.g. "Coming soon". */
  label?: string;
  className?: string;
}) {
  const meta = STATE_META[state];
  return (
    <Badge variant={meta.variant} className={cn('rounded-full', className)}>
      <span aria-hidden className={cn('size-1.5 rounded-full', meta.dot)} />
      {label ?? meta.label}
    </Badge>
  );
}

export interface ConnectionCardProps {
  name: string;
  description?: string;
  icon: ReactNode;
  state: ConnectionState;
  /** The linked account, e.g. an email address. */
  account?: string | null;
  lastSyncAt?: string | Date | null;
  errorMessage?: string | null;
  /** Granted scopes, shown as a compact count with the full list on hover. */
  permissions?: string[];
  /** Replaces the status badge label (e.g. "Coming soon" for `disabled`). */
  statusLabel?: string;
  /** False when the viewer may not connect apps; the reason is shown. */
  canConnect?: boolean;
  cannotConnectReason?: string;
  /** Set while a connect/disconnect request for this card is in flight. */
  busy?: boolean;
  onConnect?: () => void;
  onReconnect?: () => void;
  onDisconnect?: () => void;
  onSettings?: () => void;
  /** Extra icon actions for a connected card (open, sync, logs…). */
  actions?: ReactNode;
  className?: string;
}

/**
 * One connectable service. Owns the layout and the state → actions mapping
 * (Connect / Reconnect / Disconnect / Settings); callers supply the provider
 * specifics through callbacks, so a provider never needs its own card.
 */
export function ConnectionCard({
  name,
  description,
  icon,
  state,
  account,
  lastSyncAt,
  errorMessage,
  permissions,
  statusLabel,
  canConnect = true,
  cannotConnectReason,
  busy = false,
  onConnect,
  onReconnect,
  onDisconnect,
  onSettings,
  actions,
  className,
}: ConnectionCardProps) {
  const linked = isLinked(state);
  const pending = state === 'connecting' || state === 'reconnecting';
  const titleId = `connection-${name.replace(/\W+/g, '-').toLowerCase()}`;

  const connectButton = (
    <Button
      type="button"
      size="sm"
      onClick={onConnect}
      disabled={!canConnect || !onConnect}
      loading={busy}
      leadingIcon={busy ? undefined : <Zap />}
    >
      Connect
    </Button>
  );

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        'group p-5 gap-3 flex min-h-44 flex-col rounded-2xl border border-border bg-surface-inset shadow-xs transition-colors',
        state === 'disabled' ? 'opacity-60' : 'hover:border-border-strong',
        needsReconnect(state) && 'border-warning/40',
        className,
      )}
    >
      <div className="gap-3 flex items-start justify-between">
        <div className="min-w-0 gap-3 flex items-center">
          <div className="size-10 p-2 flex shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-foreground shadow-xs">
            {icon}
          </div>
          <div className="min-w-0">
            <h3 id={titleId} className="text-sm font-semibold truncate text-foreground">
              {name}
            </h3>
            <ConnectionStatusBadge state={state} label={statusLabel} className="mt-1" />
          </div>
        </div>
        {linked && actions ? <div className="gap-0.5 flex shrink-0 items-center">{actions}</div> : null}
      </div>

      {description ? (
        <p className="text-xs leading-relaxed line-clamp-2 text-muted-foreground">{description}</p>
      ) : null}

      {linked ? (
        <dl className="gap-x-3 gap-y-1 text-[11px] grid grid-cols-[auto_1fr] text-muted-foreground">
          {account ? (
            <>
              <dt>Account</dt>
              <dd className="truncate font-medium text-foreground">{account}</dd>
            </>
          ) : null}
          <dt>Last sync</dt>
          <dd className="text-foreground">{lastSyncAt ? formatRelative(lastSyncAt) : 'Never'}</dd>
          {permissions && permissions.length > 0 ? (
            <>
              <dt>Permissions</dt>
              <dd>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="rounded-sm text-foreground underline decoration-dotted underline-offset-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      {permissions.length} scope{permissions.length === 1 ? '' : 's'}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-72 break-words">
                    {permissions.join(', ')}
                  </TooltipContent>
                </Tooltip>
              </dd>
            </>
          ) : null}
        </dl>
      ) : null}

      {needsReconnect(state) ? (
        <p
          role="alert"
          className="gap-1.5 text-[11px] flex items-start rounded-md border border-warning/30 bg-warning/10 px-2 py-1.5 text-warning-text"
        >
          <AlertTriangle aria-hidden className="size-3.5 mt-px shrink-0" />
          <span>
            {errorMessage ||
              (state === 'expired'
                ? 'Access expired. Reconnect to resume syncing.'
                : 'The last sync failed. Reconnect or check settings.')}
          </span>
        </p>
      ) : null}

      <div className="mt-auto gap-2 pt-1 flex flex-wrap items-center">
        {state === 'disabled' ? (
          <span className="text-xs font-medium text-muted-foreground">Not yet available</span>
        ) : pending ? (
          <Button type="button" size="sm" variant="outline" disabled leadingIcon={<Loader2 className="animate-spin" />}>
            {STATE_META[state].label}
          </Button>
        ) : needsReconnect(state) ? (
          <Button
            type="button"
            size="sm"
            onClick={onReconnect ?? onConnect}
            disabled={!canConnect}
            loading={busy}
            leadingIcon={busy ? undefined : <RefreshCw />}
          >
            Reconnect
          </Button>
        ) : linked ? null : canConnect ? (
          connectButton
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              {/* A disabled button fires no pointer events; the span carries the tooltip. */}
              <span tabIndex={0} className="rounded-btn focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                {connectButton}
              </span>
            </TooltipTrigger>
            <TooltipContent>{cannotConnectReason ?? 'You do not have permission to connect apps.'}</TooltipContent>
          </Tooltip>
        )}

        {linked && onSettings ? (
          <Button type="button" size="sm" variant="ghost" onClick={onSettings} leadingIcon={<Settings2 />}>
            Settings
          </Button>
        ) : null}

        {linked && onDisconnect ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={onDisconnect}
            disabled={busy}
            leadingIcon={<Unplug />}
          >
            Disconnect
          </Button>
        ) : null}
      </div>
    </article>
  );
}

export interface ConnectionListProps {
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  /** e.g. a "Connect application" button. */
  emptyAction?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Responsive grid of `ConnectionCard`s with loading / error / empty states. */
export function ConnectionList({
  isLoading = false,
  error,
  onRetry,
  isEmpty = false,
  emptyTitle = 'No connected applications',
  emptyDescription = 'Connect an app to bring its data into your workspace.',
  emptyAction,
  className,
  children,
}: ConnectionListProps) {
  if (isLoading) {
    return (
      <div role="status" aria-label="Loading connections" className={cn('gap-4 md:grid-cols-2 lg:grid-cols-3 grid grid-cols-1', className)}>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-44 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Connections failed to load"
        description={error instanceof Error ? error.message : 'Please try again.'}
        onRetry={onRetry}
      />
    );
  }

  if (isEmpty) {
    return (
      <EmptyState
        icon={<PlugZap />}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <div className={cn('gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3 grid grid-cols-1', className)}>
      {children}
    </div>
  );
}
