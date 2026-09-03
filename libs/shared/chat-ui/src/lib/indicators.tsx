import type { ConnectionStatus, PresenceState, RoomMember } from '@org/types';
import { Badge, ScrollArea, UserAvatar } from '@org/ui';
import { cn } from '@org/utils';
import { Loader2, ShieldCheck, WifiOff } from 'lucide-react';
import { UserProfileCard } from './user-profile-card.js';

/**
 * The per-author colour ramp, drawn from the design system's categorical
 * accents rather than from raw Tailwind hexes.
 *
 * These are read as CSS variables because the values land in inline `style`
 * gradients, not in class names. Going through the tokens means an author's
 * colour is picked from the same ten hues a chart legend uses, and it re-tunes
 * with the theme instead of staying at full saturation on the light canvas.
 */
const USER_COLORS = [
  'var(--accent-rose)',
  'var(--accent-pink)',
  'var(--accent-violet)',
  'var(--accent-indigo)',
  'var(--accent-blue)',
  'var(--accent-cyan)',
  'var(--accent-teal)',
  'var(--accent-green)',
  'var(--accent-amber)',
  'var(--accent-orange)',
];

export function getUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % USER_COLORS.length;
  return USER_COLORS[index];
}

export interface TypingIndicatorProps {
  names: string[];
  className?: string;
}

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
          : 'bg-warning/15 text-warning-text',
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
  const admins = members.filter((member) => member.powerLevel >= 50);
  const others = members.filter((member) => member.powerLevel < 50);

  const renderGroup = (label: string, group: RoomMember[]) =>
    group.length === 0 ? null : (
      <section key={label}>
        <p className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {label} — {group.length}
        </p>
        <ul>
          {group.map((member) => (
            <li key={member.userId}>
              <UserProfileCard
                userId={member.userId}
                name={member.displayName}
                avatarUrl={member.avatarUrl}
                powerLevel={member.powerLevel}
                status={presenceOf ? presenceOf(member.userId) : 'online'}
              >
                <div
                  onClick={() => onSelect?.(member)}
                  className="gap-2.5 px-3 py-1.5 flex w-full items-center text-left hover:bg-accent/50 rounded-md transition-colors cursor-pointer"
                >
                  <UserAvatar
                    name={member.displayName}
                    seed={member.userId}
                    src={member.avatarUrl}
                    size="sm"
                    presence={presenceOf ? presenceOf(member.userId) : undefined}
                  />
                  <span className="min-w-0 text-sm font-semibold text-foreground flex-1 truncate">
                    {member.displayName}
                  </span>
                  {member.powerLevel >= 100 ? (
                    <Badge variant="primary">Admin</Badge>
                  ) : null}
                </div>
              </UserProfileCard>
            </li>
          ))}
        </ul>
      </section>
    );

  return (
    <ScrollArea className={cn('h-full', className)}>
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
