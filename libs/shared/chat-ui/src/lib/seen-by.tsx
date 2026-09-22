import type { MessageReader, RoomKind } from '@org/types';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
  SkeletonAvatar,
  SkeletonText,
  UserAvatar,
  UserAvatarGroup,
  useResolvedPresence,
} from '@org/ui';
import { cn } from '@org/utils';
import { CheckCheck } from 'lucide-react';
import { useState, useTransition, type KeyboardEvent } from 'react';

export interface SeenByProps {
  readers?: MessageReader[];
  /** Kind of conversation this message belongs to. */
  roomKind?: RoomKind;
  /** Whether the current viewer is the sender of this message. */
  isOwn?: boolean;
  /** Whether detailed reader data is currently being fetched or synced. */
  isLoading?: boolean;
  /** Presentation variant: 'auto' adapts based on screen size and reader count. */
  variant?: 'auto' | 'compact' | 'avatars' | 'text';
  className?: string;
}

/**
 * Formats reader timestamp in a lightweight, localized format (e.g., "2:31 PM").
 */
export function formatReaderTime(ts: number): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

/**
 * Slack-style Seen By / Read Receipt component.
 *
 * Supports:
 * - Direct Messages: "Seen" or "Seen 2:31 PM" with checkmark indication.
 * - Group DMs & Channels: "Seen by Alex, Sarah", "Seen by 3", or avatar stack.
 * - Keyboard-accessible popover with presence, avatar, reader name, and time.
 * - Graceful fallback / skeleton states.
 */
export function SeenBy({
  readers = [],
  roomKind = 'channel',
  isOwn = false,
  isLoading = false,
  variant = 'auto',
  className,
}: SeenByProps) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  if (isLoading) {
    return (
      <div
        className={cn('inline-flex items-center gap-1.5 py-0.5 text-xs text-muted-foreground', className)}
        aria-hidden="true"
      >
        <SkeletonAvatar size="xs" shape="circle" className="size-3.5" />
        <SkeletonText size="xs" className="w-12 h-3" />
      </div>
    );
  }

  if (!readers || readers.length === 0) {
    // For sent messages with no external readers yet, optionally show single check or nothing
    if (isOwn) {
      return null;
    }
    return null;
  }

  const readerCount = readers.length;
  const isDirect = roomKind === 'direct';

  // 1. Direct Message representation
  if (isDirect) {
    const firstReader = readers[0];
    const timeLabel = firstReader ? formatReaderTime(firstReader.seenAt) : '';
    const labelText = timeLabel ? `Seen ${timeLabel}` : 'Seen';

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={firstReader ? `Seen by ${firstReader.displayName} at ${timeLabel}` : 'Seen'}
            className={cn(
              'group/seen inline-flex items-center gap-1 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring rounded',
              className,
            )}
          >
            <CheckCheck className="size-3 text-primary shrink-0" aria-hidden="true" />
            <span>{labelText}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="top"
          sideOffset={6}
          className="w-64 p-0 shadow-overlay border-border"
        >
          <SeenByPopoverContent readers={readers} />
        </PopoverContent>
      </Popover>
    );
  }

  // 2. Channels & Group DMs representation
  // Text label logic
  const summaryText =
    variant === 'compact'
      ? `Seen by ${readerCount}`
      : readerCount === 1
        ? `Seen by ${readers[0].displayName}`
        : readerCount === 2
          ? `Seen by ${readers[0].displayName}, ${readers[1].displayName}`
          : readerCount === 3
            ? `Seen by ${readers[0].displayName}, ${readers[1].displayName} +1`
            : `Seen by ${readerCount}`;

  const avatarUsers = readers.slice(0, 3).map((r) => ({
    id: r.userId,
    name: r.displayName,
    displayName: r.displayName,
    avatarUrl: r.avatarUrl,
  }));

  const accessibleLabel = `Seen by ${readerCount} ${readerCount === 1 ? 'person' : 'people'}: ${readers
    .map((r) => r.displayName)
    .join(', ')}`;

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      startTransition(() => setOpen((prev) => !prev));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={accessibleLabel}
          onKeyDown={handleKeyDown}
          className={cn(
            'group/seen inline-flex items-center gap-1.5 py-0.5 px-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent/40 rounded-md focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring select-none cursor-pointer',
            className,
          )}
        >
          {variant !== 'text' && (
            <UserAvatarGroup
              users={avatarUsers}
              max={3}
              size="xs"
              className="shrink-0 -space-x-1"
            />
          )}
          <span className="truncate max-w-[180px] sm:max-w-none">{summaryText}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        sideOffset={6}
        className="w-72 p-0 shadow-overlay border-border"
      >
        <SeenByPopoverContent readers={readers} />
      </PopoverContent>
    </Popover>
  );
}

/**
 * Popover content displaying full reader list with presence, avatar, name, and seen time.
 */
export function SeenByPopoverContent({ readers }: { readers: MessageReader[] }) {
  const [showAll, setShowAll] = useState(false);
  const count = readers.length;
  const initialLimit = 25;
  const visibleReaders = showAll ? readers : readers.slice(0, initialLimit);
  const hasMore = count > initialLimit && !showAll;

  return (
    <div className="flex flex-col text-popover-foreground">
      <div className="px-3 py-2 border-b border-border/80 flex items-center justify-between">
        <span className="text-xs font-semibold">
          Seen by {count} {count === 1 ? 'person' : 'people'}
        </span>
      </div>

      <ScrollArea className="max-h-60 overflow-y-auto overscroll-contain">
        <div className="p-1 space-y-0.5">
          {visibleReaders.map((reader) => (
            <ReaderItem key={reader.userId} reader={reader} />
          ))}

          {hasMore && (
            <div className="p-1 text-center">
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="w-full py-1 text-xs font-medium text-primary hover:underline"
              >
                View all {count} readers
              </button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ReaderItem({ reader }: { reader: MessageReader }) {
  const livePresence = useResolvedPresence(reader.userId);
  const timeStr = formatReaderTime(reader.seenAt);

  return (
    <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-accent/50 transition-colors">
      <UserAvatar
        name={reader.displayName}
        src={reader.avatarUrl}
        seed={reader.userId}
        presence={livePresence}
        size="xs"
        className="shrink-0 size-6"
      />
      <div className="flex flex-1 items-baseline justify-between gap-2 min-w-0">
        <span className="text-xs font-medium truncate text-foreground">
          {reader.displayName}
        </span>
        {timeStr && (
          <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
            {timeStr}
          </span>
        )}
      </div>
    </div>
  );
}
