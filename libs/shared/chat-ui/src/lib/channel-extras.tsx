import type { Message, RoomMember } from '@org/types';
import { Badge, Button, EmptyState, Hint, Input, UserAvatar } from '@org/ui';
import { cn, formatListTimestamp, formatRelative } from '@org/utils';
import {
  Bookmark,
  BookmarkX,
  Headphones,
  Mic,
  MicOff,
  MonitorUp,
  MessagesSquare,
  PhoneOff,
  Pin,
  PinOff,
  Plus,
  Search,
  Video,
} from 'lucide-react';
import { useMemo, type ReactNode } from 'react';

/* --- channel bookmarks ---------------------------------------------------- */

export interface ChannelBookmark {
  id: string;
  label: string;
  href: string;
  /** Shown before the label; a channel's own shorthand for the link. */
  emoji?: string;
}

export interface BookmarksBarProps {
  bookmarks: ChannelBookmark[];
  onAdd?: () => void;
  className?: string;
}

/**
 * The strip of pinned links under a channel header.
 *
 * It scrolls rather than wraps: a second row would push the conversation down
 * on every channel that collects more than a few links, and the bar is a
 * shortcut, not content the reader has to see all of at once.
 */
export function BookmarksBar({
  bookmarks,
  onAdd,
  className,
}: BookmarksBarProps) {
  if (bookmarks.length === 0 && !onAdd) return null;

  return (
    <div
      className={cn(
        'scrollbar-none h-9 gap-1 px-3 sm:px-4 flex shrink-0 items-center overflow-x-auto border-b border-border',
        className,
      )}
    >
      {bookmarks.map((bookmark) => (
        <a
          key={bookmark.id}
          href={bookmark.href}
          className={cn(
            'gap-1.5 px-2 py-1 text-xs flex shrink-0 items-center rounded-md text-muted-foreground transition-colors',
            'hover:bg-muted hover:text-foreground',
          )}
        >
          {bookmark.emoji ? <span aria-hidden>{bookmark.emoji}</span> : null}
          <span className="max-w-40 truncate">{bookmark.label}</span>
        </a>
      ))}

      {onAdd ? (
        <Hint label="Add a bookmark">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Add a bookmark"
            onClick={onAdd}
            className="shrink-0"
          >
            <Plus />
          </Button>
        </Hint>
      ) : null}
    </div>
  );
}

/* --- huddle --------------------------------------------------------------- */

export interface HuddleBarProps {
  participants: RoomMember[];
  /** True when the reader has joined; drives controls versus the join button. */
  isJoined: boolean;
  isMuted?: boolean;
  onJoin?: () => void;
  onLeave?: () => void;
  onToggleMute?: () => void;
  onShareScreen?: () => void;
  onStartVideo?: () => void;
}

/**
 * The live-audio strip shown while a huddle is running in the channel.
 *
 * Rendered above the timeline rather than as a floating window: a huddle is
 * part of the channel's state, and a reader scrolling history should still see
 * that one is happening.
 */
export function HuddleBar({
  participants,
  isJoined,
  isMuted = false,
  onJoin,
  onLeave,
  onToggleMute,
  onShareScreen,
  onStartVideo,
}: HuddleBarProps) {
  if (participants.length === 0 && !isJoined) return null;

  return (
    <div className="h-11 gap-2 px-3 sm:px-4 flex shrink-0 items-center border-b border-border bg-accent-violet-soft">
      <Headphones className="size-4 shrink-0 text-accent-violet" aria-hidden />

      <span className="text-xs font-medium shrink-0 text-foreground">
        Huddle
      </span>

      <div className="flex items-center -space-x-1.5">
        {participants.slice(0, 4).map((participant) => (
          <UserAvatar
            key={participant.userId}
            name={participant.displayName}
            src={participant.avatarUrl}
            seed={participant.userId}
            size="xs"
            className="ring-2 ring-background"
          />
        ))}
      </div>

      <span className="text-xs tabular-nums truncate text-muted-foreground">
        {participants.length} in the huddle
      </span>

      <div className="ml-auto gap-1 flex shrink-0 items-center">
        {isJoined ? (
          <>
            <Hint label={isMuted ? 'Unmute' : 'Mute'}>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                aria-pressed={isMuted}
                onClick={onToggleMute}
                className={isMuted ? 'text-destructive' : undefined}
              >
                {isMuted ? <MicOff /> : <Mic />}
              </Button>
            </Hint>
            <Hint label="Turn on video">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Turn on video"
                onClick={onStartVideo}
              >
                <Video />
              </Button>
            </Hint>
            <Hint label="Share your screen">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Share your screen"
                onClick={onShareScreen}
              >
                <MonitorUp />
              </Button>
            </Hint>
            <Button
              variant="destructive"
              size="sm"
              onClick={onLeave}
              leadingIcon={<PhoneOff className="size-3.5" />}
            >
              Leave
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={onJoin}>
            Join
          </Button>
        )}
      </div>
    </div>
  );
}

/* --- message preview rows ------------------------------------------------- */

interface MessagePreviewProps {
  message: Message;
  onJump?: () => void;
  /** Trailing control, e.g. unpin or unsave. */
  action?: ReactNode;
  meta?: ReactNode;
}

/**
 * A message rendered small, for the side panels that list messages rather than
 * host them: pins, saved items, search results.
 */
function MessagePreview({ message, onJump, action, meta }: MessagePreviewProps) {
  return (
    <li className="group/preview gap-2.5 px-3 py-2.5 flex items-start border-b border-border last:border-0 hover:bg-muted/50">
      <UserAvatar
        name={message.senderName}
        src={message.senderAvatarUrl}
        seed={message.senderId}
        size="sm"
      />

      <button
        type="button"
        onClick={onJump}
        className="min-w-0 flex-1 text-left"
      >
        <span className="gap-2 flex items-baseline">
          <span className="text-xs font-semibold truncate">
            {message.senderName}
          </span>
          <span className="text-[10px] shrink-0 text-subtle">
            {formatListTimestamp(message.timestamp)}
          </span>
        </span>
        <span className="mt-0.5 block text-xs line-clamp-2 text-muted-foreground">
          {message.isRedacted ? 'This message was deleted.' : message.body}
        </span>
        {meta}
      </button>

      {action ? (
        <span className="shrink-0 opacity-0 transition-opacity group-focus-within/preview:opacity-100 group-hover/preview:opacity-100">
          {action}
        </span>
      ) : null}
    </li>
  );
}

/* --- pinned & saved panels ------------------------------------------------ */

export interface PinnedPanelProps {
  messages: Message[];
  onJump?: (messageId: string) => void;
  onUnpin?: (messageId: string) => void;
}

export function PinnedPanel({ messages, onJump, onUnpin }: PinnedPanelProps) {
  if (messages.length === 0) {
    return (
      <EmptyState
        size="sm"
        icon={<Pin />}
        title="Nothing pinned"
        description="Pin a message to keep it at the top of this channel for everyone."
      />
    );
  }

  return (
    <ul>
      {messages.map((message) => (
        <MessagePreview
          key={message.id}
          message={message}
          onJump={() => onJump?.(message.id)}
          action={
            onUnpin ? (
              <Hint label="Unpin">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Unpin message from ${message.senderName}`}
                  onClick={() => onUnpin(message.id)}
                >
                  <PinOff />
                </Button>
              </Hint>
            ) : null
          }
        />
      ))}
    </ul>
  );
}

export interface SavedPanelProps {
  messages: Message[];
  onJump?: (messageId: string) => void;
  onRemove?: (messageId: string) => void;
}

/** "Saved for later" — the reader's private shortlist, not a channel-wide pin. */
export function SavedPanel({ messages, onJump, onRemove }: SavedPanelProps) {
  if (messages.length === 0) {
    return (
      <EmptyState
        size="sm"
        icon={<Bookmark />}
        title="Nothing saved"
        description="Save a message to come back to it. Only you can see your saved items."
      />
    );
  }

  return (
    <ul>
      {messages.map((message) => (
        <MessagePreview
          key={message.id}
          message={message}
          onJump={() => onJump?.(message.id)}
          action={
            onRemove ? (
              <Hint label="Remove from saved">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove message from ${message.senderName} from saved`}
                  onClick={() => onRemove(message.id)}
                >
                  <BookmarkX />
                </Button>
              </Hint>
            ) : null
          }
        />
      ))}
    </ul>
  );
}

/* --- thread list ---------------------------------------------------------- */

export interface ThreadSummaryItem {
  root: Message;
  replyCount: number;
  participants: RoomMember[];
  lastReplyAt: number;
  hasUnread: boolean;
}

export interface ThreadListPanelProps {
  threads: ThreadSummaryItem[];
  onOpen?: (rootId: string) => void;
  emptyDescription?: string;
}

/** Every thread in the channel, newest activity first. */
export function ThreadListPanel({
  threads,
  onOpen,
  emptyDescription = 'Replies to a message are grouped into a thread and collected here.',
}: ThreadListPanelProps) {
  const ordered = useMemo(
    () => [...threads].sort((a, b) => b.lastReplyAt - a.lastReplyAt),
    [threads],
  );

  if (ordered.length === 0) {
    return (
      <EmptyState
        icon={<MessagesSquare />}
        title="No threads yet"
        description={emptyDescription}
      />
    );
  }

  return (
    <ul className="divide-y divide-border">
      {ordered.map((thread) => (
        <li key={thread.root.id}>
          <button
            type="button"
            onClick={() => onOpen?.(thread.root.id)}
            className="gap-3 p-3 w-full text-left flex items-start transition-colors hover:bg-muted/50"
          >
            <UserAvatar
              name={thread.root.senderName}
              src={thread.root.senderAvatarUrl}
              seed={thread.root.senderId}
              size="sm"
            />

            <span className="min-w-0 flex-1">
              <span className="gap-2 flex items-baseline">
                <span className="text-sm font-semibold truncate">
                  {thread.root.senderName}
                </span>
                <span className="text-[11px] shrink-0 text-subtle">
                  {formatListTimestamp(thread.root.timestamp)}
                </span>
                {thread.hasUnread ? (
                  <Badge variant="primary" className="ml-auto shrink-0">
                    New
                  </Badge>
                ) : null}
              </span>

              <span className="mt-0.5 block text-sm line-clamp-2 text-muted-foreground">
                {thread.root.body}
              </span>

              <span className="mt-1.5 gap-2 flex items-center">
                <span className="flex items-center -space-x-1.5">
                  {thread.participants.slice(0, 3).map((participant) => (
                    <UserAvatar
                      key={participant.userId}
                      name={participant.displayName}
                      src={participant.avatarUrl}
                      seed={participant.userId}
                      size="xs"
                      className="ring-2 ring-background"
                    />
                  ))}
                </span>
                <span className="text-xs font-medium text-primary">
                  {thread.replyCount}{' '}
                  {thread.replyCount === 1 ? 'reply' : 'replies'}
                </span>
                <span className="text-xs text-subtle">
                  last reply {formatRelative(thread.lastReplyAt)}
                </span>
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/* --- in-conversation search ----------------------------------------------- */

export interface ConversationSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  results: Message[];
  onJump?: (messageId: string) => void;
}

/**
 * Search scoped to the open conversation.
 *
 * Matching happens in the caller so this stays presentational — which also
 * means it works over an in-memory timeline today and over a server-side index
 * later, without changing here.
 */
export function ConversationSearch({
  query,
  onQueryChange,
  results,
  onJump,
}: ConversationSearchProps) {
  return (
    <div className="min-h-0 flex h-full flex-col">
      <div className="p-3 shrink-0 border-b border-border">
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search this conversation"
          aria-label="Search this conversation"
          leadingIcon={<Search />}
        />
      </div>

      <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto">
        {query.trim().length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground">
            Type to search the messages loaded in this conversation.
          </p>
        ) : results.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<Search />}
            title="No matches"
            description={`Nothing in this conversation matches “${query}”.`}
          />
        ) : (
          <>
            <p className="px-3 py-2 text-xs text-muted-foreground">
              {results.length} {results.length === 1 ? 'result' : 'results'}
            </p>
            <ul>
              {results.map((message) => (
                <MessagePreview
                  key={message.id}
                  message={message}
                  onJump={() => onJump?.(message.id)}
                />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

/* --- unread marker -------------------------------------------------------- */

/**
 * The "new messages" line.
 *
 * It sits where reading stopped, not where the newest message is, so returning
 * to a busy channel shows what was missed rather than only the latest thing
 * said.
 */
export function UnreadDivider({ label = 'New' }: { label?: string }) {
  return (
    <div
      className="gap-2 px-4 py-1 flex items-center"
      role="separator"
      aria-label={`${label} messages below`}
    >
      <span className="h-px flex-1 bg-destructive" aria-hidden />
      <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full uppercase tracking-wide bg-destructive text-destructive-foreground">
        {label}
      </span>
    </div>
  );
}
