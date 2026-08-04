import type { ConnectionStatus, PresenceState, RoomMember } from '@org/types';
import { Badge, ScrollArea, UserAvatar } from '@org/ui';
import { cn } from '@org/utils';
import { Loader2, ShieldCheck, WifiOff } from 'lucide-react';

const PRESENCE_STYLES: Record<PresenceState, string> = {
  online: 'bg-success',
  unavailable: 'bg-warning',
  offline: 'bg-muted-foreground',
};

const PRESENCE_LABELS: Record<PresenceState, string> = {
  online: 'Online',
  unavailable: 'Away',
  offline: 'Offline',
};

export function PresenceBadge({
  state,
  className,
  showLabel = false,
}: {
  state: PresenceState;
  className?: string;
  showLabel?: boolean;
}) {
  return (
    <span className={cn('gap-1.5 inline-flex items-center', className)}>
      <span
        className={cn('size-2 rounded-full', PRESENCE_STYLES[state])}
        role="img"
        aria-label={PRESENCE_LABELS[state]}
      />
      {showLabel ? (
        <span className="text-xs text-muted-foreground">
          {PRESENCE_LABELS[state]}
        </span>
      ) : null}
    </span>
  );
}

export interface TypingIndicatorProps {
  names: string[];
  className?: string;
}

/**
 * "Alice is typing…"
 *
 * Reserves its row height even when idle, so the message list does not shift
 * every time someone starts and stops typing.
 */
export function TypingIndicator({ names, className }: TypingIndicatorProps) {
  const label =
    names.length === 0
      ? ''
      : names.length === 1
        ? `${names[0]} is typing…`
        : names.length === 2
          ? `${names[0]} and ${names[1]} are typing…`
          : `${names.length} people are typing…`;

  return (
    <div
      aria-live="polite"
      className={cn(
        'h-5 gap-1.5 px-4 text-xs flex items-center text-muted-foreground',
        className,
      )}
    >
      {names.length > 0 ? (
        <>
          <span className="gap-0.5 flex" aria-hidden>
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className="size-1 animate-bounce rounded-full bg-muted-foreground"
                style={{ animationDelay: `${dot * 120}ms` }}
              />
            ))}
          </span>
          {label}
        </>
      ) : null}
    </div>
  );
}

export interface ConnectionBannerProps {
  status: ConnectionStatus;
}

/** Shown only when the connection is not healthy. */
export function ConnectionBanner({ status }: ConnectionBannerProps) {
  if (status.state === 'connected' || status.state === 'disconnected') {
    return null;
  }

  const isError = status.state === 'error' || status.state === 'expired';

  return (
    <div
      role="status"
      className={cn(
        'gap-2 px-4 py-1.5 text-xs flex items-center justify-center',
        isError
          ? 'bg-destructive/10 text-destructive'
          : 'bg-warning/15 text-warning-foreground',
      )}
    >
      {isError ? (
        <WifiOff className="size-3.5" aria-hidden />
      ) : (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      )}
      {status.state === 'expired'
        ? 'Your chat session expired. Reload to sign in again.'
        : status.state === 'reconnecting'
          ? 'Reconnecting…'
          : status.state === 'syncing'
            ? 'Syncing messages…'
            : (status.error ?? 'Connecting…')}
    </div>
  );
}

export interface MemberListProps {
  members: RoomMember[];
  presenceOf?: (userId: string) => PresenceState;
  onSelect?: (member: RoomMember) => void;
  className?: string;
}

export function MemberList({
  members,
  presenceOf,
  onSelect,
  className,
}: MemberListProps) {
  // Power level 100 is admin, 50 moderator — the Matrix convention.
  const admins = members.filter((member) => member.powerLevel >= 50);
  const others = members.filter((member) => member.powerLevel < 50);

  const renderGroup = (label: string, group: RoomMember[]) =>
    group.length === 0 ? null : (
      <section key={label}>
        <p className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
          {label} — {group.length}
        </p>
        <ul>
          {group.map((member) => (
            <li key={member.userId}>
              <button
                onClick={() => onSelect?.(member)}
                className="gap-2.5 px-3 py-1.5 flex w-full items-center text-left hover:bg-muted"
              >
                <UserAvatar
                  name={member.displayName}
                  seed={member.userId}
                  src={member.avatarUrl}
                  size="sm"
                />
                <span className="min-w-0 text-sm flex-1 truncate">
                  {member.displayName}
                </span>
                {member.powerLevel >= 100 ? (
                  <Badge variant="primary">Admin</Badge>
                ) : null}
                {presenceOf ? (
                  <PresenceBadge state={presenceOf(member.userId)} />
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </section>
    );

  return (
    <ScrollArea className={cn('scrollbar-subtle h-full', className)}>
      <div className="py-2">
        {renderGroup('Admins & moderators', admins)}
        {renderGroup('Members', others)}
      </div>
    </ScrollArea>
  );
}

export function EncryptionBadge({ verified }: { verified: boolean }) {
  return (
    <Badge variant={verified ? 'success' : 'warning'}>
      <ShieldCheck />
      {verified ? 'Verified' : 'Unverified device'}
    </Badge>
  );
}
