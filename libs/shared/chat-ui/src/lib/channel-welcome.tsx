import type { RoomMember } from '@org/types';
import {
  Button,
  UserAvatar,
  UserAvatarGroup,
  type PresenceInput,
} from '@org/ui';
import { cn, formatDate } from '@org/utils';
import { EntityKindBadge } from './entity-kind-badge.js';
import {
  ArrowRight,
  Blocks,
  Bookmark,
  Bot,
  Globe,
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
import { UserProfileCard } from './user-profile-card.js';

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
  tone: WelcomeTone;
  onClick: () => void;
}

type WelcomeTone = 'primary' | 'info' | 'success' | 'warning' | 'neutral';

/** Tinted icon tile per tone. */
const TONE_TILE: Record<WelcomeTone, string> = {
  primary: 'bg-primary/10 text-primary-text ring-primary/15',
  info: 'bg-info/10 text-info-text ring-info/15',
  success: 'bg-success/10 text-success-text ring-success/15',
  warning: 'bg-warning/10 text-warning-text ring-warning/15',
  neutral: 'bg-surface-muted text-foreground ring-border',
};

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
  kind?: 'person' | 'agent' | 'coworker' | 'app';
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
  /**
   * The creator's identity. When given, their name opens the profile card
   * (hover preview, click for the right rail) instead of being plain text.
   */
  createdBy?: {
    userId: string;
    avatarUrl?: string | null;
    email?: string;
    title?: string | null;
  };
  /** The channel's description or topic, shown when one is set. */
  description?: string | null;
  /**
   * A configured first message for this conversation — overrides the
   * generated opening sentence below when set. Falls back to the per-kind
   * default copy when absent.
   */
  welcomeMessage?: string | null;
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
  createdBy,
  description,
  welcomeMessage,
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
  const displayName = isConversation
    ? (peer?.name ?? channelName)
    : channelName;

  // The member strip carries its own "Add people" button, so the card would
  // only duplicate it there.
  const showMemberStrip =
    (kind === 'channel' || kind === 'group') &&
    (members.length > 0 || total > 0);

  const offered: (WelcomeAction | false | undefined)[] = [
    onAddPeople &&
      !showMemberStrip &&
      (kind === 'channel' || kind === 'group') && {
        key: 'people',
        label: 'Add people',
        description:
          kind === 'group'
            ? 'Bring more teammates into this conversation.'
            : 'Invite teammates who should be in this channel.',
        icon: <UserPlus className="size-4" />,
        tone: 'info',
        onClick: onAddPeople,
      },
    // Once a description exists it is edited inline, beside the text.
    onEditDescription &&
      kind === 'channel' &&
      !description && {
        key: 'description',
        label: 'Add a description',
        description: 'Say what this channel is for so newcomers can catch up.',
        icon: <PenLine className="size-4" />,
        tone: 'neutral',
        onClick: onEditDescription,
      },
    onOpenCopilot &&
      kind === 'channel' && {
        key: 'copilot',
        label: 'Ask the AI copilot',
        description:
          'Summarise, draft, and search this channel without leaving it.',
        icon: <Sparkles className="size-4" />,
        tone: 'primary',
        onClick: onOpenCopilot,
      },
    onAddBookmark &&
      kind === 'channel' && {
        key: 'bookmark',
        label: 'Pin a resource',
        description:
          'Keep the docs and links this channel needs one click away.',
        icon: <Bookmark className="size-4" />,
        tone: 'warning',
        onClick: onAddBookmark,
      },
    onViewProfile &&
      isPersonPeer && {
        key: 'profile',
        label: 'View profile',
        description: `See ${displayName}'s role, local time, and shared channels.`,
        icon: <UserRound className="size-4" />,
        tone: 'info',
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
        tone: 'success',
        onClick: onStartHuddle,
      },
  ];

  const actions = offered.filter((action): action is WelcomeAction =>
    Boolean(action),
  );

  const intro: ReactNode = (() => {
    if (welcomeMessage?.trim()) {
      return welcomeMessage.trim();
    }
    if (kind === 'self') {
      return 'This is your space. Draft messages, keep notes, and save links where only you can find them.';
    }
    if (kind === 'group') {
      const memberNames = members.map((m) => m.displayName || m.userId);
      const othersFormatted =
        memberNames.length === 0
          ? null
          : memberNames.length <= 3
            ? memberNames.join(', ')
            : `${memberNames.slice(0, 3).join(', ')} and ${memberNames.length - 3} ${
                memberNames.length - 3 === 1 ? 'other' : 'others'
              }`;

      return (
        <>
          This is the beginning of your conversation with{' '}
          <span className="font-semibold text-foreground">
            {othersFormatted || channelName}
          </span>
          . Start a conversation below.
        </>
      );
    }
    if (kind === 'direct') {
      if (peerKind === 'agent' || peerKind === 'coworker') {
        return (
          <>
            This is the start of your conversation with{' '}
            <span className="font-semibold text-foreground">{displayName}</span>
            . It’s an AI {peerKind === 'coworker' ? 'coworker' : 'agent'} — it replies here automatically.
          </>
        );
      }
      if (peerKind === 'app') {
        return (
          <>
            This is the start of your conversation with{' '}
            <span className="font-semibold text-foreground">{displayName}</span>
            . Messages and commands here go to the connected app.
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
    // Who created it and when lives in the header's meta line.
    return (
      <>
        This is the very beginning of{' '}
        <span className="font-semibold text-foreground">
          {isPrivate ? '' : '#'}
          {channelName}
        </span>
        . Share updates, ask questions, and keep everyone in the loop.
      </>
    );
  })();

  const creator: ReactNode = createdByName ? (
    createdBy ? (
      <UserProfileCard
        userId={createdBy.userId}
        name={createdByName}
        avatarUrl={createdBy.avatarUrl ?? undefined}
        email={createdBy.email}
        title={createdBy.title ?? undefined}
      >
        <button
          type="button"
          className="rounded-sm font-medium text-foreground underline-offset-2 transition-colors hover:text-primary-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-text"
        >
          {createdByName}
        </button>
      </UserProfileCard>
    ) : (
      <span className="font-medium text-foreground">{createdByName}</span>
    )
  ) : null;

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
      <div className="gap-4 flex items-center">
        <span
          aria-hidden
          className="size-14 flex shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary-text ring-1 ring-primary/15 ring-inset"
        >
          {isPrivate ? (
            <Lock className="size-6" />
          ) : (
            <Hash className="size-6" />
          )}
        </span>
        <div className="min-w-0">
          <div className="gap-2 flex items-center">
            <h2 className="min-w-0 text-xl font-semibold tracking-tight truncate text-foreground">
              {channelName}
            </h2>
            <span className="gap-1 px-2 py-0.5 font-medium inline-flex shrink-0 items-center rounded-full border border-border text-[11px] text-muted-foreground [&_svg]:size-3">
              {isPrivate ? <Lock /> : <Globe />}
              {isPrivate ? 'Private' : 'Public'}
            </span>
          </div>
          {creator || createdAt ? (
            <p className="mt-0.5 text-xs truncate text-muted-foreground">
              {creator ? <>Created by {creator}</> : 'Created'}
              {createdAt ? (
                <>
                  <span aria-hidden className="mx-1.5 text-muted-foreground/50">
                    ·
                  </span>
                  {formatDate(createdAt)}
                </>
              ) : null}
            </p>
          ) : null}
        </div>
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
          <h2 className="text-lg font-semibold tracking-tight truncate text-foreground">
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
            <h2 className="text-lg font-semibold tracking-tight truncate text-foreground">
              {displayName}
            </h2>
            {peerKind === 'agent' ? (
              <EntityKindBadge kind="agent" icon={<Bot className="size-2.5" />} />
            ) : peerKind === 'app' ? (
              <EntityKindBadge kind="app" icon={<Blocks className="size-2.5" />} />
            ) : null}
          </div>
          {peer?.role ? (
            <p className="text-sm truncate text-muted-foreground">
              {peer.role}
            </p>
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
      <div className="max-w-4xl">
        {header}

        <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted-foreground">
          {intro}
        </p>

        {description ? (
          <div className="group/desc mt-3 max-w-prose gap-2 py-0.5 pl-3 flex items-start border-l-2 border-primary/30">
            <p className="min-w-0 text-sm leading-relaxed flex-1 text-foreground">
              {description}
            </p>
            {onEditDescription && kind === 'channel' ? (
              <button
                type="button"
                onClick={onEditDescription}
                aria-label="Edit description"
                title="Edit description"
                className="size-6 group-hover/desc:opacity-100 flex shrink-0 items-center justify-center rounded-md text-muted-foreground transition-opacity sm:opacity-0 hover:bg-surface-muted hover:text-foreground focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
              >
                <PenLine className="size-3.5" />
              </button>
            ) : null}
          </div>
        ) : null}

        {context ? (
          <p className="mt-3 gap-1.5 px-2.5 py-1.5 text-xs inline-flex items-center rounded-lg border border-border bg-surface-muted text-muted-foreground [&_svg]:shrink-0 [&_svg]:text-muted-foreground">
            {context.icon}
            <span>{context.text}</span>
          </p>
        ) : null}

        {showMemberStrip ? (
          <div className="mt-4 gap-3 flex flex-wrap items-center">
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
            <span className="text-xs font-medium text-muted-foreground">
              {total === 1 ? '1 member' : `${total} members`}
            </span>
            {onAddPeople ? (
              <>
                <span aria-hidden className="h-4 w-px bg-border" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onAddPeople}
                  leadingIcon={<UserPlus />}
                >
                  Add people
                </Button>
              </>
            ) : null}
          </div>
        ) : null}

        {actions.length > 0 ? (
          <div className="mt-6 max-w-2xl">
            <h3 className="mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Get started
            </h3>
            <ul className="gap-2 sm:grid-cols-2 grid">
              {actions.map((action) => (
                <li key={action.key}>
                  <button
                    type="button"
                    onClick={action.onClick}
                    className={cn(
                      'group gap-3 p-3 flex h-full w-full items-center rounded-xl border border-border bg-surface text-left transition-all',
                      'hover:-translate-y-px hover:border-border-strong hover:bg-surface-raised hover:shadow-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'size-9 flex shrink-0 items-center justify-center rounded-lg ring-1 ring-inset',
                        TONE_TILE[action.tone],
                      )}
                    >
                      {action.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-medium block text-[13px] text-foreground">
                        {action.label}
                      </span>
                      <span className="mt-0.5 text-xs leading-snug line-clamp-2 block text-muted-foreground">
                        {action.description}
                      </span>
                    </span>
                    <ArrowRight
                      aria-hidden
                      className="size-3.5 group-hover:translate-x-0.5 shrink-0 text-muted-foreground/30 transition-all group-hover:text-muted-foreground"
                    />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
