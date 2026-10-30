import {
  Badge,
  Button,
  getAiEntityCover,
  LocalTime,
  Popover,
  PopoverContent,
  PopoverTrigger,
  PRESENCE_LABELS,
  PresenceDot,
  ScrollArea,
  toast,
  toPresenceStatus,
  UserAvatar,
  UserCover,
  useRightPanelStore,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Calendar,
  Crown,
  Link2,
  Mail,
  MessageSquare,
  Phone,
  Shield,
  ShieldCheck,
  UserRound,
  Video,
  Zap,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAiEntity } from './cards/agent-avatar-context.js';
import { EmployeeInfoSection } from './employee-info-section.js';
import {
  MEMBER_ROLE_LABELS,
  useMemberProfile,
  type MemberWorkspaceRole,
} from './member-profile-context.js';

/**
 * Owner / Admin / Guest pill from the workspace roster. Plain members get no
 * pill — the label would be noise on almost every card.
 */
function WorkspaceRoleBadge({
  role,
  className,
}: {
  role: MemberWorkspaceRole;
  className?: string;
}) {
  if (role === 'MEMBER') return null;
  const Icon =
    role === 'OWNER' ? Crown : role === 'ADMIN' ? ShieldCheck : UserRound;
  return (
    <span
      className={cn(
        'gap-1 px-1.5 py-0.5 font-semibold inline-flex items-center rounded-md border text-2xs whitespace-nowrap',
        role === 'OWNER' && 'border-warning/30 bg-warning/10 text-warning-text',
        role === 'ADMIN' && 'border-primary/30 bg-primary/10 text-primary-text',
        role === 'GUEST' && 'border-border bg-surface-inset text-muted-foreground',
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {MEMBER_ROLE_LABELS[role]}
    </span>
  );
}

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
  /** Non-person senders open their own rail profile (agent/app/coworker). */
  entityKind?: 'user' | 'agent' | 'app' | 'coworker';
  entityId?: string;
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
  bio,
  timezone,
  status = 'online',
  statusEmoji,
  statusText,
  entityKind,
  entityId,
  children,
  onSendDirectMessage,
  onStartCall: _onStartCall,
}: UserProfileCardProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const openProfilePanel = useRightPanelStore((s) => s.openProfile);
  // Real workspace role/title/zone from the roster; agents, apps and
  // coworkers aren't workspace members, so they never get a role pill.
  const member = useMemberProfile(
    !entityKind || entityKind === 'user' ? userId : undefined,
  );
  const resolvedTitle = title || member?.title || undefined;
  const resolvedTimezone = timezone ?? member?.timezone ?? undefined;
  const resolvedBio = (bio ?? member?.bio)?.trim() || undefined;
  // Agents and coworkers take their look from the live API identity, so the
  // card's avatar and cover match their rail profile (and follow edits).
  const isAiEntity = entityKind === 'agent' || entityKind === 'coworker';
  const liveEntity = useAiEntity(
    isAiEntity ? entityId : undefined,
    isAiEntity ? name : undefined,
  );
  const resolvedAvatarUrl = liveEntity?.avatarUrl || avatarUrl;

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

  const handle = `@${userId.replace(/^@/, '').split(':')[0]}`;

  /* Clicking a person always fills the right rail — there is no modal fallback. */
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    cancelHoverTimer();
    setPopoverOpen(false);
    openProfilePanel({
      entityKind,
      entityId,
      userId,
      name,
      avatarUrl: resolvedAvatarUrl,
      title: resolvedTitle,
      role: member ? MEMBER_ROLE_LABELS[member.role] : role,
      powerLevel,
      email: email ?? member?.email ?? undefined,
      joinedAt: joinedAt ?? member?.joinedAt ?? undefined,
      bio: resolvedBio,
      timezone: resolvedTimezone,
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
        // Stay fully on screen: flip to whichever side has room and keep the
        // card inside the viewport rather than letting it clip under headers.
        avoidCollisions
        collisionPadding={12}
        sticky="always"
        // The card arrives from a hover, not a deliberate open, so it must not
        // pull the caret out of whatever the user was typing in.
        onOpenAutoFocus={(e) => e.preventDefault()}
        onMouseEnter={cancelHoverTimer}
        onMouseLeave={() => scheduleHover(false, HOVER_CLOSE_DELAY_MS)}
        className="z-[100] w-80 max-w-[calc(100vw-1.5rem)] p-0 shadow-2xl overflow-hidden rounded-2xl border border-border bg-popover text-foreground"
      >
        {/* Header banner — an AI entity's identity colour (as on its rail
            profile), else the person's cover, else their avatar gradient */}
        {isAiEntity ? (
          <div
            className={cn(
              'h-20 w-full border-b border-border/60 bg-gradient-to-br',
              getAiEntityCover(
                name,
                resolvedAvatarUrl,
                liveEntity?.kind ?? (entityKind === 'coworker' ? 'coworker' : 'agent'),
              ),
            )}
          />
        ) : (
        <UserCover src={member?.coverUrl} seed={userId} className="h-20">
          <div className="top-2 right-2 gap-1 absolute flex">
            {/* Workspace role wins; the Matrix room power level is only a
                fallback for people outside this workspace's roster. */}
            {member ? null : powerLevel >= 100 ? (
              <span className="bg-black/40 px-2 py-0.5 font-bold text-white backdrop-blur-xs rounded-full text-2xs">
                👑 Admin
              </span>
            ) : powerLevel >= 50 ? (
              <span className="bg-black/40 px-2 py-0.5 font-bold text-white backdrop-blur-xs rounded-full text-2xs">
                🛡️ Mod
              </span>
            ) : null}
          </div>
        </UserCover>
        )}

        {/* User Avatar Row */}
        <div className="px-4 pb-3 pt-0 relative">
          <div className="-mt-10 mb-2 flex items-end">
            <UserAvatar
              name={name}
              src={resolvedAvatarUrl}
              seed={userId}
              size="xl"
              presence={status}
              statusEmoji={statusEmoji}
              statusText={statusText}
              className="size-20 rounded-full shadow-lg ring-1 ring-foreground/10"
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
            {resolvedTitle ? (
              <p className="text-xs font-medium text-foreground">
                {resolvedTitle}
              </p>
            ) : null}
            <p className="text-xs font-medium font-mono text-muted-foreground">
              {handle}
            </p>
            {member && member.role !== 'MEMBER' ? (
              <WorkspaceRoleBadge role={member.role} className="mt-1.5" />
            ) : null}
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

          {/* Local time (the full profile, with the bio, opens in the right rail). */}
          <div className="space-y-2 text-xs">

            {/* Local time — just the clock and the time, nothing else. */}
            <div className="gap-1.5 flex items-center text-muted-foreground">
              <LocalTime
                timezone={resolvedTimezone || 'UTC'}
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
  bio,
  timezone,
  status = 'online',
  statusEmoji,
  statusText,
  onSendDirectMessage,
  onStartCall,
  onStartVideoCall,
  profileLink,
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
  onStartVideoCall?: (userId: string) => void;
  /** Shareable link to this person's conversation; adds a Link action. */
  profileLink?: string;
}) {
  const handle = `@${userId.replace(/^@/, '').split(':')[0]}`;
  const isBotOrAgent = userId.startsWith('agent-') || userId.startsWith('app-');
  const member = useMemberProfile(isBotOrAgent ? undefined : userId);
  const roleLabel = member ? MEMBER_ROLE_LABELS[member.role] : role;
  const resolvedTitle = title || member?.title || undefined;
  const resolvedBio = (bio ?? member?.bio)?.trim() || undefined;
  const resolvedTimezone = timezone || member?.timezone || undefined;

  return (
    <div className="flex h-full flex-col bg-surface text-foreground">
      {/* Profile Details Content Body */}
      <ScrollArea
        className="min-h-0 relative flex-1"
        contentClassName="pb-6"
      >
        {/* Cover banner — the person's cover, else their avatar gradient */}
        <UserCover
          src={member?.coverUrl}
          seed={userId}
          className="h-24 shrink-0"
        />

        <div className="space-y-4 px-4">
          {/* Avatar & Presence */}
          <div className="-mt-12 flex items-end justify-between relative z-10">
          <UserAvatar
            name={name}
            src={avatarUrl}
            seed={userId}
            size="xl"
            presence={status}
            statusEmoji={statusEmoji}
            statusText={statusText}
            className="size-20 shadow-xl rounded-full ring-1 ring-foreground/10"
          />
        </div>

        {/* Action Buttons: Message, Audio Call, Video Call */}
        <div className="gap-2 pt-1 flex items-center flex-wrap">
          <Button
            size="sm"
            onClick={() => onSendDirectMessage?.(userId)}
            className="h-8 text-xs font-semibold px-3 gap-1.5 flex-1 min-w-[100px] rounded-md bg-foreground text-background shadow-xs hover:bg-foreground/85"
          >
            <MessageSquare className="size-3.5" />
            <span>Message</span>
          </Button>

          {!isBotOrAgent && (
            // Same joined-segment treatment as the conversation header's call control.
            <div className="inline-flex h-8 items-center overflow-hidden rounded-md border border-border bg-background shadow-xs transition-colors hover:border-foreground/20 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/40">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (onStartCall) {
                    onStartCall(userId);
                  } else {
                    onSendDirectMessage?.(userId);
                  }
                }}
                className="h-full gap-1.5 rounded-none px-3 text-xs font-medium focus-visible:ring-0"
                title="Start voice call"
                aria-label="Start voice call"
              >
                <Phone className="size-3.5" />
                <span>Call</span>
              </Button>
              <span aria-hidden className="h-4 w-px bg-border" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (onStartVideoCall) {
                    onStartVideoCall(userId);
                  } else if (onStartCall) {
                    onStartCall(userId);
                  } else {
                    onSendDirectMessage?.(userId);
                  }
                }}
                className="h-full gap-1.5 rounded-none px-3 text-xs font-medium focus-visible:ring-0"
                title="Start video call"
                aria-label="Start video call"
              >
                <Video className="size-3.5" />
                <span>Video</span>
              </Button>
              {profileLink ? (
                <>
                  <span aria-hidden className="h-4 w-px bg-border" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard?.writeText(profileLink).then(
                        () => toast.success('Link copied'),
                        () => toast.error('Could not copy the link.'),
                      );
                    }}
                    className="h-full gap-1.5 rounded-none px-3 text-xs font-medium focus-visible:ring-0"
                    title="Copy link"
                    aria-label="Copy link"
                  >
                    <Link2 className="size-3.5" />
                    <span>Link</span>
                  </Button>
                </>
              ) : null}
            </div>
          )}
        </div>

        {/* Name, Title, Handle & Status */}
        <div className="space-y-1">
          <div className="gap-2 flex items-center">
            <h2 className="text-lg font-extrabold tracking-tight text-foreground">
              {name}
            </h2>
            {member ? (
              <WorkspaceRoleBadge role={member.role} />
            ) : powerLevel >= 50 ? (
              <Badge
                variant="primary"
                className="bg-primary text-2xs text-primary-foreground"
              >
                {powerLevel >= 100 ? 'Admin' : 'Moderator'}
              </Badge>
            ) : null}
          </div>

          {resolvedTitle ? (
            <p className="text-xs font-semibold text-primary-text">
              {resolvedTitle}
            </p>
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
            timezone={resolvedTimezone || 'UTC'}
            icon
            className="font-medium text-foreground"
          />
          <span>local time</span>
        </div>

        {/* Bio & Details */}
        <div className="space-y-3 text-xs">
          {resolvedBio ? (
            <div className="p-3 space-y-1.5 rounded-xl border border-border bg-surface-inset/50">
              <p className="font-bold tracking-wider text-2xs text-muted-foreground uppercase">
                About Me
              </p>
              <p className="leading-relaxed text-foreground">{resolvedBio}</p>
            </div>
          ) : null}

          <div className="gap-2 grid grid-cols-2">
            <div className="p-2.5 rounded-xl border border-border bg-surface-inset/50">
              <div className="gap-1.5 font-bold tracking-wider flex items-center text-2xs text-muted-foreground uppercase">
                <Shield className="size-3 text-primary-text" />
                <span>Role</span>
              </div>
              <p className="mt-0.5 text-xs font-semibold text-foreground">
                {roleLabel}
              </p>
            </div>

            <div className="p-2.5 rounded-xl border border-border bg-surface-inset/50">
              <div className="gap-1.5 font-bold tracking-wider flex items-center text-2xs text-muted-foreground uppercase">
                <Zap className="size-3 text-warning-text" />
                <span>Power</span>
              </div>
              <p className="mt-0.5 text-xs font-semibold text-foreground">
                {powerLevel} / 100
              </p>
            </div>

            {email ? (
              <div className="p-2.5 col-span-2 rounded-xl border border-border bg-surface-inset/50">
                <div className="gap-1.5 font-bold tracking-wider flex items-center text-2xs text-muted-foreground uppercase">
                  <Mail className="size-3 text-success-text" />
                  <span>Email</span>
                </div>
                <p className="mt-0.5 text-xs font-semibold text-foreground">
                  {email}
                </p>
              </div>
            ) : null}

            <div className="p-2.5 col-span-2 rounded-xl border border-border bg-surface-inset/50">
              <div className="gap-1.5 font-bold tracking-wider flex items-center text-2xs text-muted-foreground uppercase">
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

        {/* Employee details the viewer is allowed to see (when the app provides them). */}
        {!isBotOrAgent && <EmployeeInfoSection userId={userId} />}
        </div>
      </ScrollArea>
    </div>
  );
}
