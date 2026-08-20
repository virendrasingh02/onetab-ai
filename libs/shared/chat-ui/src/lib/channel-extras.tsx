import type { Message, RoomMember } from '@org/types';
import {
  Badge,
  Button,
  EmptyState,
  Hint,
  Input,
  ScrollArea,
  UserAvatar,
  useHuddleDockStore,
} from '@org/ui';
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
  X,
} from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

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
  onRemove?: (id: string) => void;
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
  onRemove,
  className,
}: BookmarksBarProps) {
  if (bookmarks.length === 0 && !onAdd) return null;

  return (
    <div
      className={cn(
        'min-h-9 py-1 gap-1.5 px-3 sm:px-4 flex shrink-0 scrollbar-none items-center overflow-x-auto border-b border-border bg-surface-muted/50',
        className,
      )}
    >
      {bookmarks.map((bookmark) => (
        <div
          key={bookmark.id}
          className={cn(
            'group px-2 py-1 text-xs shadow-xs duration-fast relative flex shrink-0 items-center rounded-md border border-border/70 bg-surface text-muted-foreground transition-all',
            'hover:border-border hover:bg-surface-raised hover:text-foreground',
          )}
        >
          <a
            href={bookmark.href}
            target="_blank"
            rel="noopener noreferrer"
            className="gap-1.5 flex items-center outline-none"
          >
            {bookmark.emoji ? (
              <span aria-hidden className="text-xs">
                {bookmark.emoji}
              </span>
            ) : (
              <Bookmark className="size-3 text-muted-foreground" />
            )}
            <span className="max-w-44 font-medium truncate">
              {bookmark.label}
            </span>
          </a>

          {onRemove ? (
            <button
              type="button"
              aria-label={`Remove bookmark ${bookmark.label}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRemove(bookmark.id);
              }}
              className="ml-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive focus:opacity-100"
            >
              <X className="size-3" />
            </button>
          ) : null}
        </div>
      ))}

      {onAdd ? (
        <Hint label="Add a bookmark">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Add a bookmark"
            onClick={onAdd}
            className="h-7 gap-1 px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
          >
            <Plus className="size-3.5" />
            <span className="text-[11px]">Add bookmark</span>
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
 * The live-audio dock shown while a huddle is running in the channel.
 *
 * It opens full-width across the bottom of the app, in the row below the
 * sidebar / conversation / right-rail columns that the notification bar also
 * lands in — so it takes its own space rather than covering the composer, and
 * stays put while you read another channel. It portals into `HuddleDock`,
 * which the shell publishes; with no dock around (a conversation embedded
 * somewhere else) it renders in place instead.
 *
 * The design is the huddle's own, not the notification bar's: a live call
 * earns the violet, the pinging badge and the call-control pill.
 *
 * It renders nothing until there is a huddle — the button that starts one
 * stays in the channel header.
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
  const dock = useHuddleDockStore((s) => s.slot);

  if (participants.length === 0 && !isJoined) return null;

  const bar = (
    <div
      className="gap-3 px-2 py-1.5 shadow-xs animate-in fade-in slide-in-from-bottom-2 relative flex flex-wrap items-center overflow-hidden rounded-xl border border-accent-violet/40 bg-linear-to-r from-accent-violet-soft via-card to-accent-violet-soft/60 transition-all duration-300"
      role="region"
      aria-label="Huddle"
    >
      {/* Live badge: the pinging ring is what says "a call is running" from
          across the screen, before you read a word of the bar. Same shape as
          the notification bar's bell badge — a live call is the same kind of
          claim on your attention. */}
      <div className="size-8 shadow-inner relative flex shrink-0 items-center justify-center rounded-lg bg-accent-violet/15 text-accent-violet">
        <Headphones className="size-4" aria-hidden />
        <span className="-top-1 -right-1 size-2.5 absolute flex">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-violet opacity-75" />
          <span className="size-2.5 relative inline-flex rounded-full bg-accent-violet" />
        </span>
      </div>

      <div className="gap-0.5 min-w-0 flex flex-col">
        <h4 className="text-sm font-medium tracking-tight leading-none text-foreground">
          Huddle
        </h4>
        <span className="text-[11px] leading-none text-muted-foreground">
          {isJoined ? 'You are in this huddle' : 'Live in this channel'}
        </span>
      </div>

      <div className="gap-2 ml-1 min-w-0 flex flex-1 items-center">
        <div className="-space-x-1.5 flex items-center">
          {participants.slice(0, 5).map((participant) => (
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

        <span className="text-xs truncate text-muted-foreground tabular-nums">
          {participants.length} in the huddle
        </span>
      </div>

      <div className="gap-2 flex shrink-0 items-center">
        {isJoined ? (
          <>
            {/* The call controls read as one instrument, so they share a
                single inset pill rather than floating loose on the bar. */}
            <div className="gap-0.5 p-0.5 flex items-center rounded-full border border-border/60 bg-background/80">
              <Hint label={isMuted ? 'Unmute' : 'Mute'}>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                  aria-pressed={isMuted}
                  onClick={onToggleMute}
                  className={cn(
                    'rounded-full',
                    isMuted ? 'text-destructive' : undefined,
                  )}
                >
                  {isMuted ? <MicOff /> : <Mic />}
                </Button>
              </Hint>
              <Hint label="Turn on video">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-full"
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
                  className="rounded-full"
                  aria-label="Share your screen"
                  onClick={onShareScreen}
                >
                  <MonitorUp />
                </Button>
              </Hint>
            </div>

            <Button
              variant="destructive"
              size="sm"
              className="h-8 gap-1.5 text-xs px-3 shadow-sm font-medium"
              onClick={onLeave}
              leadingIcon={<PhoneOff className="size-3.5" />}
            >
              Leave
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs px-3 shadow-sm font-medium"
            onClick={onJoin}
            leadingIcon={<Headphones className="size-3.5" />}
          >
            Join huddle
          </Button>
        )}
      </div>
    </div>
  );

  return dock ? createPortal(bar, dock) : bar;
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
function MessagePreview({
  message,
  onJump,
  action,
  meta,
}: MessagePreviewProps) {
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
          <span className="shrink-0 text-[10px] text-subtle">
            {formatListTimestamp(message.timestamp)}
          </span>
        </span>
        <span className="mt-0.5 text-xs line-clamp-2 block text-muted-foreground">
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
            className="gap-3 p-3 flex w-full items-start text-left transition-colors hover:bg-muted/50"
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
                <span className="shrink-0 text-[11px] text-subtle">
                  {formatListTimestamp(thread.root.timestamp)}
                </span>
                {thread.hasUnread ? (
                  <Badge variant="primary" className="ml-auto shrink-0">
                    New
                  </Badge>
                ) : null}
              </span>

              <span className="mt-0.5 text-sm line-clamp-2 block text-muted-foreground">
                {thread.root.body}
              </span>

              <span className="mt-1.5 gap-2 flex items-center">
                <span className="-space-x-1.5 flex items-center">
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
                <span className="text-xs font-medium text-primary-text">
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

      <ScrollArea className="min-h-0 flex-1">
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
      </ScrollArea>
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
      <span className="px-1.5 py-0.5 font-semibold tracking-wide rounded-full bg-destructive text-[10px] text-destructive-foreground uppercase">
        {label}
      </span>
    </div>
  );
}
