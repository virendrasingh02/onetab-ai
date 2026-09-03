import type { RoomMember } from '@org/types';
import {
  Badge,
  Button,
  UserAvatar,
  UserAvatarGroup,
  type PresenceInput,
} from '@org/ui';
import { cn, formatDate } from '@org/utils';
import {
  ArrowRight,
  Blocks,
  Bookmark,
  Bot,
  Hash,
  Headphones,
  Lock,
  PenLine,
  Sparkles,
  UserPlus,
  UserRound,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';

/** Which sort of conversation the welcome block introduces. */
export type ConversationWelcomeKind = 'channel' | 'direct' | 'group' | 'self';

/**
 * A thing worth doing at the top of a conversation that has just started.
 *
 * Each card is only offered when the host actually wired the action up, so an
 * empty conversation never advertises a button that does nothing.
 */
interface WelcomeAction {
  key: string;
  label: string;
  description: string;
  icon: ReactNode;
  /** Tailwind text-colour class for the icon glyph. */
  iconColor: string;
  onClick: () => void;
}

/** The other party in a `direct` / `self` conversation. */
export interface ChannelWelcomePeer {
  name: string;
  /** Stable id — used as the avatar seed and, for people, the presence key. */
  userId?: string;
  avatarUrl?: string | null;
  /** Any presence spelling; `UserAvatar` normalises it. */
  presence?: string | null;
  /**
   * `'agent'` / `'app'` draw a badge beside the name and suppress the
   * person-only actions (huddle, profile).
   */
  kind?: 'person' | 'agent' | 'app';
  /** A short line under the name — a role, a model, an app category. */
  role?: string | null;
  /** Custom avatar element, for agents / apps that render their own. */
  avatarNode?: ReactNode;
}

export interface ChannelWelcomeProps {
  /**
   * Which sort of conversation this is. Defaults to `'channel'`, so the
   * existing channel call site needs no change.
   */
  kind?: ConversationWelcomeKind;

  /** The conversation's name — channel, group, or (as a fallback) the peer. */
  channelName: string;
  isPrivate?: boolean;
  /** When the channel was created. Omitted for conversations with no start. */
  createdAt?: Date | string | number;
  createdByName?: string;
  /** The channel's description or topic, shown when one is set. */
  description?: string | null;
  members?: RoomMember[];
  memberCount?: number;

  /** The other party, for `direct` / `self` conversations. */
  peer?: ChannelWelcomePeer;

  onAddPeople?: () => void;
  onEditDescription?: () => void;
  onOpenCopilot?: () => void;
  onAddBookmark?: () => void;
  onStartHuddle?: () => void;
  /** Opens the peer's profile in the right rail — `direct` conversations only. */
  onViewProfile?: () => void;

  className?: string;
}

/**
 * The head of a conversation's timeline: what this place is, and what to do next.
 *
 * It sits above the first message rather than replacing an empty state,
 * because the beginning of a conversation does not stop being the beginning
 * once somebody says hello — scrolling all the way up should still explain
 * where you are. `MessageList` renders it only when there is no older history
 * left to load, so it never appears in the middle of a conversation.
 *
 * One block serves every kind of conversation: a public or private channel, a
 * group DM, a one-to-one DM (with a person, an AI agent, or a connected app),
 * and the note-to-self conversation. The header, the opening sentence and the
 * offered actions all follow from {@link ConversationWelcomeKind}.
 */
export function ChannelWelcome({
  kind = 'channel',
  channelName,
  isPrivate = false,
  createdAt,
  createdByName,
  description,
  members = [],
  memberCount,
  peer,
  onAddPeople,
  onEditDescription,
  onOpenCopilot,
  onAddBookmark,
  onStartHuddle,
  onViewProfile,
  className,
}: ChannelWelcomeProps) {
  const total = memberCount ?? members.length;
  const isConversation = kind === 'direct' || kind === 'self';
  const peerKind = peer?.kind ?? 'person';
  const isPersonPeer = kind === 'direct' && peerKind === 'person';
  const displayName = isConversation ? (peer?.name ?? channelName) : channelName;

  const offered: (WelcomeAction | false | undefined)[] = [
    onAddPeople &&
      (kind === 'channel' || kind === 'group') && {
        key: 'people',
        label: 'Add people',
        description:
          kind === 'group'
            ? 'Bring more teammates into this conversation.'
            : 'Invite teammates who should be in this channel.',
        icon: <UserPlus className="size-4" />,
        iconColor: 'text-primary-text',
        onClick: onAddPeople,
      },
    onEditDescription &&
      kind === 'channel' && {
        key: 'description',
        label: description ? 'Edit description' : 'Add a description',
        description: 'Say what this channel is for so newcomers can catch up.',
        icon: <PenLine className="size-4" />,
        iconColor: 'text-info-text',
        onClick: onEditDescription,
      },
    onOpenCopilot &&
      kind === 'channel' && {
        key: 'copilot',
        label: 'Ask the AI copilot',
        description:
          'Summarise, draft, and search this channel without leaving it.',
        icon: <Sparkles className="size-4" />,
        iconColor: 'text-success-text',
        onClick: onOpenCopilot,
      },
    onAddBookmark &&
      kind === 'channel' && {
        key: 'bookmark',
        label: 'Pin a resource',
        description: 'Keep the docs and links this channel needs one click away.',
        icon: <Bookmark className="size-4" />,
        iconColor: 'text-warning-text',
        onClick: onAddBookmark,
      },
    onViewProfile &&
      isPersonPeer && {
        key: 'profile',
        label: 'View profile',
        description: `See ${displayName}'s role, local time, and shared channels.`,
        icon: <UserRound className="size-4" />,
        iconColor: 'text-info-text',
        onClick: onViewProfile,
      },
    onStartHuddle &&
      (kind === 'channel' || kind === 'group' || isPersonPeer) && {
        key: 'huddle',
        label: 'Start a huddle',
        description:
          kind === 'direct'
            ? 'Jump on a quick call when typing is slower than talking.'
            : 'Talk it through when typing is taking too long.',
        icon: <Headphones className="size-4" />,
        iconColor: 'text-foreground',
        onClick: onStartHuddle,
      },
  ];

  const actions = offered.filter(
    (action): action is WelcomeAction => Boolean(action),
  );

  const intro: ReactNode = (() => {
    if (kind === 'self') {
      return 'This is your space. Draft messages, keep notes, and save links where only you can find them.';
    }
    if (kind === 'group') {
      return (
        <>
          This is the very beginning of the{' '}
          <span className="font-semibold text-foreground">{channelName}</span>{' '}
          group conversation.
        </>
      );
    }
    if (kind === 'direct') {
      if (peerKind === 'agent') {
        return (
          <>
            This is the start of your conversation with{' '}
            <span className="font-semibold text-foreground">{displayName}</span>.
            It’s an AI agent — it replies here automatically.
          </>
        );
      }
      if (peerKind === 'app') {
        return (
          <>
            This is the start of your conversation with{' '}
            <span className="font-semibold text-foreground">{displayName}</span>.
            Messages and commands here go to the connected app.
          </>
        );
      }
      return (
        <>
          This is the very beginning of your direct message history with{' '}
          <span className="font-semibold text-foreground">{displayName}</span>.
        </>
      );
    }
    return (
      <>
        {createdByName ? (
          <>
            <span className="font-semibold text-foreground">{createdByName}</span>{' '}
            created this channel
          </>
        ) : (
          'This channel was created'
        )}
        {createdAt ? ` on ${formatDate(createdAt)}` : ''}. This is the very
        beginning of the{' '}
        <span className="font-semibold text-foreground">
          {isPrivate ? '' : '#'}
          {channelName}
        </span>{' '}
        channel.
      </>
    );
  })();

  const context: { icon: ReactNode; text: string } | null = (() => {
    if (kind === 'self') {
      return {
        icon: <Lock className="size-3.5" />,
        text: 'Private to you, synced across your devices.',
      };
    }
    if (kind === 'direct') {
      if (peerKind === 'agent') {
        return {
          icon: <Bot className="size-3.5" />,
          text: 'Only you and this agent can see these messages.',
        };
      }
      if (peerKind === 'app') {
        return {
          icon: <Blocks className="size-3.5" />,
          text: 'Only you and this app can see these messages.',
        };
      }
      return {
        icon: <Lock className="size-3.5" />,
        text: `Only you and ${displayName} are here — nothing is shared with anyone else.`,
      };
    }
    if (kind === 'group') {
      return {
        icon: <Users className="size-3.5" />,
        text: 'Everyone added to this group can see its full history.',
      };
    }
    if (isPrivate) {
      return {
        icon: <Lock className="size-3.5" />,
        text: 'Private channel — only invited members can find it or read along.',
      };
    }
    return null;
  })();

  const header =
    kind === 'channel' ? (
      <div className="gap-3.5 flex items-center">
        <span
          aria-hidden
          className="size-12 flex shrink-0 items-center justify-center rounded-2xl border border-border bg-surface-raised text-foreground"
        >
          {isPrivate ? <Lock className="size-5" /> : <Hash className="size-5" />}
        </span>
        <h2 className="min-w-0 truncate text-lg font-semibold tracking-tight text-foreground">
          {channelName}
        </h2>
      </div>
    ) : kind === 'group' ? (
      <div className="gap-3.5 flex items-center">
        {members.length > 0 ? (
          <UserAvatarGroup
            size="lg"
            max={3}
            users={members.slice(0, 4).map((member) => ({
              id: member.userId,
              name: member.displayName,
              avatarUrl: member.avatarUrl,
            }))}
          />
        ) : (
          <span
            aria-hidden
            className="size-12 flex shrink-0 items-center justify-center rounded-2xl border border-border bg-surface-raised text-foreground"
          >
            <Users className="size-5" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold tracking-tight text-foreground">
            {channelName}
          </h2>
          {total > 0 ? (
            <p className="text-sm text-muted-foreground">
              {total === 1 ? '1 member' : `${total} members`}
            </p>
          ) : null}
        </div>
      </div>
    ) : (
      <div className="gap-3.5 flex items-center">
        {peer?.avatarNode ?? (
          <UserAvatar
            size="xl"
            name={displayName}
            src={peer?.avatarUrl}
            seed={peer?.userId ?? displayName}
            presence={
              kind === 'self'
                ? undefined
                : (peer?.presence as PresenceInput | null | undefined)
            }
            indicator={kind !== 'self' && peerKind === 'person'}
          />
        )}
        <div className="min-w-0">
          <div className="gap-2 flex items-center">
            <h2 className="truncate text-lg font-semibold tracking-tight text-foreground">
              {displayName}
            </h2>
            {peerKind === 'agent' ? (
              <Badge
                variant="primary"
                className="gap-1 py-0 h-4 font-bold tracking-wider text-[9px] uppercase"
              >
                <Bot className="size-2.5" />
                <span>AI Agent</span>
              </Badge>
            ) : peerKind === 'app' ? (
              <Badge
                variant="neutral"
                className="gap-1 py-0 h-4 font-bold tracking-wider text-[9px] uppercase"
              >
                <Blocks className="size-2.5" />
                <span>App</span>
              </Badge>
            ) : null}
          </div>
          {peer?.role ? (
            <p className="truncate text-sm text-muted-foreground">{peer.role}</p>
          ) : kind === 'self' ? (
            <p className="text-sm text-muted-foreground">Just you</p>
          ) : null}
        </div>
      </div>
    );

  return (
    <section
      aria-label={
        isConversation
          ? `About your conversation with ${displayName}`
          : `About the ${channelName} ${kind === 'group' ? 'group' : 'channel'}`
      }
      className={cn('px-4 pt-8 pb-5 sm:px-6', className)}
    >
      <div className="max-w-2xl">
        {header}

        <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">
          {intro}
        </p>

        {description ? (
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-foreground">
            {description}
          </p>
        ) : null}

        {context ? (
          <p className="mt-3 gap-1.5 px-2.5 py-1.5 text-xs inline-flex items-center rounded-lg border border-border bg-surface-muted text-muted-foreground [&_svg]:shrink-0 [&_svg]:text-muted-foreground">
            {context.icon}
            <span>{context.text}</span>
          </p>
        ) : null}

        {(kind === 'channel' || kind === 'group') &&
        (members.length > 0 || total > 0) ? (
          <div className="mt-4 gap-2 flex flex-wrap items-center">
            {members.length > 0 ? (
              <div className="-space-x-2 flex">
                {members.slice(0, 5).map((member) => (
                  <UserAvatar
                    key={member.userId}
                    name={member.displayName}
                    src={member.avatarUrl}
                    seed={member.userId}
                    size="sm"
                    indicator={false}
                    className="ring-2 ring-background"
                  />
                ))}
              </div>
            ) : null}
            <span className="text-xs text-muted-foreground">
              {total === 1 ? '1 member' : `${total} members`}
            </span>
            {onAddPeople ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onAddPeople}
                leadingIcon={<UserPlus />}
              >
                Add people
              </Button>
            ) : null}
          </div>
        ) : null}

        {actions.length > 0 ? (
          <ul className="mt-5 gap-2 sm:grid-cols-2 grid">
            {actions.map((action) => (
              <li key={action.key}>
                <button
                  type="button"
                  onClick={action.onClick}
                  className={cn(
                    'group gap-3 px-3 py-2.5 flex h-full w-full items-start rounded-xl border border-border bg-surface text-left transition-colors',
                    'hover:border-border-strong hover:bg-surface-raised focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'size-9 flex shrink-0 items-center justify-center rounded-lg border border-border bg-surface-raised',
                      action.iconColor,
                    )}
                  >
                    {action.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-[13px] font-medium block text-foreground">
                      {action.label}
                    </span>
                    <span className="mt-0.5 text-xs leading-relaxed block text-muted-foreground">
                      {action.description}
                    </span>
                  </span>
                  <ArrowRight
                    aria-hidden
                    className="mt-1 size-3.5 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-muted-foreground"
                  />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <p className="mt-5 pt-3 text-xs border-t border-border/60 text-muted-foreground">
          Messages support{' '}
          <span className="font-semibold text-foreground/80">**markdown**</span>,{' '}
          <span className="font-semibold text-foreground/80">@mentions</span>,{' '}
          <span className="font-semibold text-foreground/80">/commands</span> and{' '}
          <span className="font-semibold text-foreground/80">:emoji:</span> —
          start typing below.
        </p>
      </div>
    </section>
  );
}
