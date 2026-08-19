import type { RoomMember } from '@org/types';
import { Button, UserAvatar } from '@org/ui';
import { cn, formatDate } from '@org/utils';
import {
  Bookmark,
  Hash,
  Headphones,
  Lock,
  PenLine,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * A thing worth doing in a channel that has just been created.
 *
 * Each card is only offered when the host actually wired the action up, so an
 * empty channel never advertises a button that does nothing.
 */
interface WelcomeAction {
  key: string;
  label: string;
  description: string;
  icon: ReactNode;
  tint: string;
  onClick: () => void;
}

export interface ChannelWelcomeProps {
  channelName: string;
  isPrivate?: boolean;
  /** When the channel was created. Omitted for conversations with no start. */
  createdAt?: Date | string | number;
  createdByName?: string;
  /** The channel's description or topic, shown when one is set. */
  description?: string | null;
  members?: RoomMember[];
  memberCount?: number;

  onAddPeople?: () => void;
  onEditDescription?: () => void;
  onOpenCopilot?: () => void;
  onAddBookmark?: () => void;
  onStartHuddle?: () => void;

  className?: string;
}

/**
 * The head of a channel's timeline: what this channel is, and what to do next.
 *
 * It sits above the first message rather than replacing an empty state,
 * because the beginning of a channel does not stop being the beginning once
 * somebody says hello — scrolling all the way up should still explain where
 * you are. `MessageList` renders it only when there is no older history left
 * to load, so it never appears in the middle of a conversation.
 */
export function ChannelWelcome({
  channelName,
  isPrivate = false,
  createdAt,
  createdByName,
  description,
  members = [],
  memberCount,
  onAddPeople,
  onEditDescription,
  onOpenCopilot,
  onAddBookmark,
  onStartHuddle,
  className,
}: ChannelWelcomeProps) {
  const total = memberCount ?? members.length;

  const offered: (WelcomeAction | undefined)[] = [
    onAddPeople && {
      key: 'people',
      label: 'Add people',
      description: 'Invite teammates who should be in this conversation.',
      icon: <UserPlus className="size-4" />,
      tint: 'bg-primary/10 border-primary/30 text-primary-text',
      onClick: onAddPeople,
    },
    onEditDescription && {
      key: 'description',
      label: description ? 'Edit description' : 'Add a description',
      description: 'Say what this channel is for so newcomers can catch up.',
      icon: <PenLine className="size-4" />,
      tint: 'bg-info/10 border-info/30 text-info-text',
      onClick: onEditDescription,
    },
    onOpenCopilot && {
      key: 'copilot',
      label: 'Ask the AI copilot',
      description: 'Summarise, draft, and search this channel without leaving it.',
      icon: <Sparkles className="size-4" />,
      tint: 'bg-success/10 border-success/30 text-success-text',
      onClick: onOpenCopilot,
    },
    onAddBookmark && {
      key: 'bookmark',
      label: 'Pin a resource',
      description: 'Keep the docs and links this channel needs one click away.',
      icon: <Bookmark className="size-4" />,
      tint: 'bg-warning/10 border-warning/30 text-warning-text',
      onClick: onAddBookmark,
    },
    onStartHuddle && {
      key: 'huddle',
      label: 'Start a huddle',
      description: 'Talk it through when typing is taking too long.',
      icon: <Headphones className="size-4" />,
      tint: 'bg-accent border-border text-foreground',
      onClick: onStartHuddle,
    },
  ];

  const actions = offered.filter(
    (action): action is WelcomeAction => action !== undefined,
  );

  return (
    <section
      aria-label={`About the ${channelName} channel`}
      className={cn('px-4 pt-6 pb-4 sm:px-6', className)}
    >
      <div
        aria-hidden
        className="mb-3 flex size-12 items-center justify-center rounded-2xl border border-border bg-surface-raised text-foreground"
      >
        {isPrivate ? <Lock className="size-5" /> : <Hash className="size-5" />}
      </div>

      <h2 className="flex items-center gap-1.5 text-xl font-bold tracking-tight text-foreground">
        <span className="text-muted-foreground">{isPrivate ? '🔒' : '#'}</span>
        {channelName}
      </h2>

      <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted-foreground">
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
      </p>

      {description ? (
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-foreground">
          {description}
        </p>
      ) : null}

      {members.length > 0 || total > 0 ? (
        <div className="mt-3 flex items-center gap-2">
          <div className="flex -space-x-2">
            {members.slice(0, 5).map((member) => (
              <UserAvatar
                key={member.userId}
                name={member.displayName}
                src={member.avatarUrl}
                seed={member.userId}
                size="sm"
                className="ring-2 ring-background"
              />
            ))}
          </div>
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
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {actions.map((action) => (
            <li key={action.key}>
              <button
                type="button"
                onClick={action.onClick}
                className={cn(
                  'group flex h-full w-full flex-col gap-1.5 rounded-xl border p-3 text-left transition-all',
                  'hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  action.tint,
                )}
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-background/60">
                  {action.icon}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {action.label}
                </span>
                <span className="text-xs leading-relaxed text-muted-foreground">
                  {action.description}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-4 text-xs text-muted-foreground">
        Messages here support markdown, <span className="font-semibold">@</span>
        mentions, <span className="font-semibold">/</span>commands and{' '}
        <span className="font-semibold">:</span>emoji — start typing below.
      </p>
    </section>
  );
}
