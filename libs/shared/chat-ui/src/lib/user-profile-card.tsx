import {
  Badge,
  Button,
  LocalTime,
  Popover,
  PopoverContent,
  PopoverTrigger,
  PRESENCE_LABELS,
  PresenceDot,
  ScrollArea,
  toPresenceStatus,
  UserAvatar,
  useRightPanelStore,
} from '@org/ui';
import {
  Calendar,
  Headphones,
  Mail,
  MessageSquare,
  Shield,
  Zap,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { getUserColor } from './indicators.js';

/**
 * How long the pointer has to rest on a name or avatar before the preview
 * appears. Opening on the bare `mouseenter` meant the card fired while someone
 * was only moving the pointer across a message list, so a scroll turned into a
 * string of cards popping open over the conversation.
 */
const HOVER_OPEN_DELAY_MS = 600;

/**
 * Grace period before the card closes on leave, so the pointer can cross the
 * gap between the trigger and the card without it vanishing mid-travel.
 */
const HOVER_CLOSE_DELAY_MS = 200;

export interface UserProfileCardProps {
  userId: string;
  name: string;
  avatarUrl?: string;
  title?: string;
  role?: string;
  powerLevel?: number;
  email?: string;
  joinedAt?: string | number;
  bio?: string;
  timezone?: string;
  status?: 'online' | 'unavailable' | 'offline' | 'away' | 'busy';
  statusEmoji?: string | null;
  statusText?: string | null;
  statusExpiresAt?: string | null;
  children: ReactNode;
  onSendDirectMessage?: (userId: string) => void;
  onStartCall?: (userId: string) => void;
}

export function UserProfileCard({
  userId,
  name,
  avatarUrl,
  title,
  role = 'Member',
  powerLevel = 0,
  email,
  joinedAt,
  bio = 'Software Engineer & Team Collaborator on OneTab AI.',
  timezone,
  status = 'online',
  statusEmoji,
  statusText,
  children,
  onSendDirectMessage,
  onStartCall: _onStartCall,
}: UserProfileCardProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const openProfilePanel = useRightPanelStore((s) => s.openProfile);

  /* One timer for both directions: any new intent cancels the pending one. */
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelHoverTimer = () => {
    if (hoverTimer.current === null) return;
    clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  };

  const scheduleHover = (open: boolean, delay: number) => {
    cancelHoverTimer();
    hoverTimer.current = setTimeout(() => {
      hoverTimer.current = null;
      setPopoverOpen(open);
    }, delay);
  };

  // A card left scheduled by a row that unmounts (scrolling, room switch)
  // would otherwise open over whatever replaced it.
  useEffect(() => cancelHoverTimer, []);

  const userColor = getUserColor(userId);
  const handle = `@${userId.replace(/^@/, '').split(':')[0]}`;

  /* Clicking a person always fills the right rail — there is no modal fallback. */
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    cancelHoverTimer();
    setPopoverOpen(false);
    openProfilePanel({
      userId,
      name,
      avatarUrl,
      title,
      role,
      powerLevel,
      email,
      joinedAt,
      bio,
      timezone,
      status:
        status === 'away' || status === 'busy' ? 'unavailable' : status,
      statusEmoji,
      statusText,
    });
  };

  return (
    /* Hover Popover Preview Card */
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <span
          onClick={handleClick}
          onMouseEnter={() => scheduleHover(true, HOVER_OPEN_DELAY_MS)}
          onMouseLeave={() => scheduleHover(false, HOVER_CLOSE_DELAY_MS)}
          className="inline-block cursor-pointer"
        >
          {children}
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        // The card arrives from a hover, not a deliberate open, so it must not
        // pull the caret out of whatever the user was typing in.
        onOpenAutoFocus={(e) => e.preventDefault()}
        onMouseEnter={cancelHoverTimer}
        onMouseLeave={() => scheduleHover(false, HOVER_CLOSE_DELAY_MS)}
        className="w-80 p-0 shadow-2xl overflow-hidden rounded-2xl border border-border bg-popover text-foreground"
      >
        {/* Header Banner Gradient */}
        <div
          style={{
            background: `linear-gradient(135deg, ${userColor} 0%, var(--surface-inset) 100%)`,
          }}
          className="h-20 relative w-full"
        >
          <div className="top-2 right-2 gap-1 absolute flex">
            {powerLevel >= 100 ? (
              <span className="bg-black/40 px-2 py-0.5 font-bold text-white backdrop-blur-xs rounded-full text-[10px]">
                👑 Admin
              </span>
            ) : powerLevel >= 50 ? (
              <span className="bg-black/40 px-2 py-0.5 font-bold text-white backdrop-blur-xs rounded-full text-[10px]">
                🛡️ Mod
              </span>
            ) : null}
          </div>
        </div>

        {/* User Avatar Row */}
        <div className="px-4 pb-3 pt-0 relative">
          <div className="-mt-10 mb-2 flex items-end">
            <UserAvatar
              name={name}
              src={avatarUrl}
              seed={userId}
              size="xl"
              presence={status}
              statusEmoji={statusEmoji}
              statusText={statusText}
              className="size-20 rounded-full shadow-lg ring-4 ring-popover"
            />
          </div>

          {/* Display Name & Handle */}
          <div className="space-y-0.5">
            <div className="gap-2 flex items-center">
              <h3 className="text-base font-extrabold tracking-tight text-foreground">
                {name}
              </h3>
              {statusEmoji && (
                <span
                  className="text-sm select-none"
                  title={statusText || undefined}
                >
                  {statusEmoji}
                </span>
              )}
            </div>
            <p className="text-xs font-medium font-mono text-muted-foreground">
              {handle}
            </p>
          </div>

          {/* Custom status banner */}
          {(statusText || statusEmoji) && (
            <div className="mt-2.5 gap-2 px-2.5 py-1.5 text-xs flex items-center rounded-lg border border-primary/20 bg-primary/5 text-foreground">
              <span className="text-base shrink-0">{statusEmoji || '💬'}</span>
              <span className="font-medium truncate">
                {statusText || 'Status set'}
              </span>
            </div>
          )}

          <hr className="my-3 border-border" />

          {/* Bio & Details */}
          <div className="space-y-2 text-xs">
            <div>
              <p className="font-bold tracking-wider text-[10px] text-muted-foreground uppercase">
                About Me
              </p>
              <p className="mt-0.5 leading-relaxed line-clamp-2 text-foreground">
                {bio}
              </p>
            </div>

            {/* Local time — just the clock and the time, nothing else. */}
            <div className="gap-1.5 flex items-center text-muted-foreground">
              <LocalTime
                timezone={timezone || 'UTC'}
                icon
                className="font-medium text-foreground"
              />
              <span>local time</span>
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="mt-4 gap-2 flex">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                cancelHoverTimer();
                setPopoverOpen(false);
                onSendDirectMessage?.(userId);
              }}
              className="text-xs font-semibold flex-1 border-border bg-surface text-foreground hover:bg-accent"
            >
              <MessageSquare className="mr-1.5 size-3.5 text-primary-text" />
              Send Message
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * User Profile Right Side Panel Component (Renders in right sidebar bar like threads)
 */
export function UserProfileRightPanel({
  userId,
  name,
  avatarUrl,
  title,
  role = 'Member',
  powerLevel = 0,
  email,
  joinedAt,
  bio = 'Software Engineer & Team Collaborator on OneTab AI.',
  timezone,
  status = 'online',
  statusEmoji,
  statusText,
  onSendDirectMessage,
  onStartCall,
}: {
  userId: string;
  name: string;
  avatarUrl?: string;
  title?: string;
  role?: string;
  powerLevel?: number;
  email?: string;
  joinedAt?: string | number;
  bio?: string;
  timezone?: string;
  status?: 'online' | 'unavailable' | 'offline';
  statusEmoji?: string | null;
  statusText?: string | null;
  onSendDirectMessage?: (userId: string) => void;
  onStartCall?: (userId: string) => void;
}) {
  const userColor = getUserColor(userId);
  const handle = `@${userId.replace(/^@/, '').split(':')[0]}`;

  return (
    <div className="flex h-full flex-col bg-surface text-foreground">
      {/* Cover Header Banner */}
      <div
        style={{
          background: `linear-gradient(135deg, ${userColor} 0%, var(--surface-inset) 100%)`,
        }}
        className="h-24 relative w-full"
      />

      {/* Profile Details Content Body */}
      <ScrollArea
        className="min-h-0 px-4 relative flex-1"
        contentClassName="space-y-4 p-4"
      >
        {/* Avatar & Presence */}
        <div className="-mt-12 flex items-end justify-between">
          <UserAvatar
            name={name}
            src={avatarUrl}
            seed={userId}
            size="xl"
            presence={status}
            statusEmoji={statusEmoji}
            statusText={statusText}
            className="size-20 shadow-2xl rounded-full ring-4 ring-surface"
          />
        </div>

        {/* Action Buttons: Message & Call/Huddle */}
        <div className="gap-2 pt-1 flex items-center">
          <Button
            size="sm"
            onClick={() => onSendDirectMessage?.(userId)}
            className="text-xs font-bold px-3 py-2 gap-1.5 flex-1 rounded-xl bg-primary text-primary-foreground shadow-md hover:bg-primary-hover"
          >
            <MessageSquare className="size-3.5" />
            <span>Message</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (onStartCall) {
                onStartCall(userId);
              } else {
                onSendDirectMessage?.(userId);
              }
            }}
            className="text-xs font-semibold px-3 py-2 gap-1.5 flex-1 rounded-xl border-border bg-surface shadow-xs hover:bg-accent"
          >
            <Headphones className="size-3.5" />
            <span>Huddle / Call</span>
          </Button>
        </div>

        {/* Name, Title, Handle & Status */}
        <div className="space-y-1">
          <div className="gap-2 flex items-center">
            <h2 className="text-lg font-extrabold tracking-tight text-foreground">
              {name}
            </h2>
            {powerLevel >= 50 ? (
              <Badge
                variant="primary"
                className="bg-primary text-[10px] text-primary-foreground"
              >
                {powerLevel >= 100 ? 'Admin' : 'Moderator'}
              </Badge>
            ) : null}
          </div>

          {title ? (
            <p className="text-xs font-semibold text-primary-text">{title}</p>
          ) : null}

          <div className="gap-2 text-xs flex items-center">
            <span className="font-mono text-muted-foreground">{handle}</span>
            <span className="text-border">·</span>
            <div className="gap-1.5 flex items-center">
              <PresenceDot presence={status} hint={false} />
              <span className="font-medium text-muted-foreground">
                {PRESENCE_LABELS[toPresenceStatus(status)]}
              </span>
            </div>
          </div>
        </div>

        {/* Custom Status Banner */}
        {(statusText || statusEmoji) && (
          <div className="gap-2 px-3 py-2 text-xs flex items-center rounded-xl border border-primary/20 bg-primary/5 text-foreground">
            <span className="text-base shrink-0">{statusEmoji || '💬'}</span>
            <span className="font-medium truncate">
              {statusText || 'Status set'}
            </span>
          </div>
        )}

        <hr className="border-border" />

        {/* Local time — just the clock and the time, nothing else. */}
        <div className="gap-1.5 flex items-center text-xs text-muted-foreground">
          <LocalTime
            timezone={timezone || 'UTC'}
            icon
            className="font-medium text-foreground"
          />
          <span>local time</span>
        </div>

        {/* Bio & Details */}
        <div className="space-y-3 text-xs">
          <div className="p-3 space-y-1.5 rounded-xl border border-border bg-surface-inset/50">
            <p className="font-bold tracking-wider text-[10px] text-muted-foreground uppercase">
              About Me
            </p>
            <p className="leading-relaxed text-foreground">{bio}</p>
          </div>

          <div className="gap-2 grid grid-cols-2">
            <div className="p-2.5 rounded-xl border border-border bg-surface-inset/50">
              <div className="gap-1.5 font-bold tracking-wider flex items-center text-[10px] text-muted-foreground uppercase">
                <Shield className="size-3 text-primary-text" />
                <span>Role</span>
              </div>
              <p className="mt-0.5 text-xs font-semibold text-foreground">
                {role}
              </p>
            </div>

            <div className="p-2.5 rounded-xl border border-border bg-surface-inset/50">
              <div className="gap-1.5 font-bold tracking-wider flex items-center text-[10px] text-muted-foreground uppercase">
                <Zap className="size-3 text-warning-text" />
                <span>Power</span>
              </div>
              <p className="mt-0.5 text-xs font-semibold text-foreground">
                {powerLevel} / 100
              </p>
            </div>

            {email ? (
              <div className="p-2.5 col-span-2 rounded-xl border border-border bg-surface-inset/50">
                <div className="gap-1.5 font-bold tracking-wider flex items-center text-[10px] text-muted-foreground uppercase">
                  <Mail className="size-3 text-success-text" />
                  <span>Email</span>
                </div>
                <p className="mt-0.5 text-xs font-semibold text-foreground">
                  {email}
                </p>
              </div>
            ) : null}

            <div className="p-2.5 col-span-2 rounded-xl border border-border bg-surface-inset/50">
              <div className="gap-1.5 font-bold tracking-wider flex items-center text-[10px] text-muted-foreground uppercase">
                <Calendar className="size-3 text-accent-blue" />
                <span>Member Joined</span>
              </div>
              <p className="mt-0.5 text-xs font-semibold text-foreground">
                {joinedAt
                  ? new Date(joinedAt).toLocaleDateString()
                  : 'Workspace Member'}
              </p>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
