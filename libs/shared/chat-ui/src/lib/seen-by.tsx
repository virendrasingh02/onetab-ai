import type { MessageReader, RoomKind } from '@org/types';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
  SearchInput,
  SkeletonText,
  UserAvatar,
  useResolvedPresence,
} from '@org/ui';
import { cn } from '@org/utils';
import { CheckCheck } from 'lucide-react';
import { useMemo, useState } from 'react';

export interface SeenByProps {
  readers?: MessageReader[];
  /** Kind of conversation this message belongs to. */
  roomKind?: RoomKind;
  /** Whether the current viewer is the sender of this message. */
  isOwn?: boolean;
  /** Whether detailed reader data is currently being fetched or synced. */
  isLoading?: boolean;
  /**
   * @deprecated The trigger is always the compact "✓✓ Seen" label now; who
   * read it lives in the popover. Kept so existing callers still type-check.
   */
  variant?: 'auto' | 'compact' | 'avatars' | 'text';
  className?: string;
}

/**
 * Formats reader timestamp in a lightweight, localized format (e.g., "2:31 PM").
 */
export function formatReaderTime(ts: number): string {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

/**
 * The reader's seen time, or '' when only an upper bound is known — Matrix
 * keeps just each reader's latest receipt, so an older message they read
 * earlier has no exact time, and showing the later receipt time would be wrong.
 */
export function readerSeenTime(reader: MessageReader | undefined): string {
  if (!reader || reader.seenAtExact === false) return '';
  return formatReaderTime(reader.seenAt);
}

/** Row label: "2:31 PM" today, "Yesterday 2:31 PM", else "Nov 12, 2:31 PM". */
function readerSeenLabel(reader: MessageReader): string {
  if (reader.seenAtExact === false || !reader.seenAt) return '';
  const time = formatReaderTime(reader.seenAt);
  if (!time) return '';
  const seen = new Date(reader.seenAt);
  const today = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOf(today) - startOf(seen)) / 86_400_000);
  if (dayDiff <= 0) return time;
  if (dayDiff === 1) return `Yesterday ${time}`;
  try {
    const date = seen.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      ...(seen.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
    });
    return `${date}, ${time}`;
  } catch {
    return time;
  }
}

/** Show the filter field once the list is long enough to need it. */
const SEARCH_THRESHOLD = 8;

/**
 * Read receipt under the viewer's own message.
 *
 * The trigger is always a compact "✓✓ Seen" — no avatars or names inline, so
 * it never crowds the message. Clicking it opens the reader list: everyone who
 * has seen the message, most recent first, with presence and seen time.
 */
export function SeenBy({ readers = [], isLoading = false, className }: SeenByProps) {
  const [open, setOpen] = useState(false);

  if (isLoading) {
    return (
      <div
        className={cn('inline-flex items-center gap-1 py-0.5 text-xs text-muted-foreground', className)}
        aria-hidden="true"
      >
        <SkeletonText size="xs" className="w-10 h-3" />
      </div>
    );
  }

  if (!readers || readers.length === 0) return null;

  const readerCount = readers.length;
  const accessibleLabel =
    readerCount === 1
      ? `Seen by ${readers[0].displayName}${readerSeenTime(readers[0]) ? ` at ${readerSeenTime(readers[0])}` : ''}`
      : `Seen by ${readerCount} people: ${readers.map((r) => r.displayName).join(', ')}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={accessibleLabel}
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-1 -mx-1 py-0.5 text-xs font-medium text-muted-foreground transition-colors select-none',
            'hover:text-foreground hover:bg-accent/40 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring',
            open && 'text-foreground bg-accent/40',
            className,
          )}
        >
          <CheckCheck className="size-3.5 shrink-0 text-brand-text" aria-hidden="true" />
          <span>Seen</span>
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
 * The reader list: header with count, optional filter, then one row per
 * reader (avatar + presence, name, seen time), most recent first.
 */
export function SeenByPopoverContent({ readers }: { readers: MessageReader[] }) {
  const [query, setQuery] = useState('');
  const count = readers.length;

  const sorted = useMemo(
    () =>
      [...readers].sort((a, b) => {
        // Exact times first (newest on top); upper-bound-only readers after, by name.
        const ax = a.seenAtExact === false ? 0 : a.seenAt || 0;
        const bx = b.seenAtExact === false ? 0 : b.seenAt || 0;
        if (ax !== bx) return bx - ax;
        return a.displayName.localeCompare(b.displayName);
      }),
    [readers],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((r) => r.displayName.toLowerCase().includes(q));
  }, [sorted, query]);

  return (
    <div className="flex flex-col text-popover-foreground">
      <div className="flex items-center gap-1.5 px-3 py-2">
        <CheckCheck className="size-3.5 shrink-0 text-brand-text" aria-hidden="true" />
        <span className="text-xs font-medium text-muted-foreground">
          Seen by {count} {count === 1 ? 'person' : 'people'}
        </span>
      </div>

      {count > SEARCH_THRESHOLD && (
        <div className="px-2 pb-2">
          <SearchInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search people"
            className="h-7 text-xs"
          />
        </div>
      )}

      <div className="border-t border-border/80" />

      <ScrollArea className="max-h-64 overscroll-contain">
        <ul className="p-1" aria-label="People who have seen this message">
          {visible.map((reader) => (
            <ReaderItem key={reader.userId} reader={reader} />
          ))}
          {visible.length === 0 && (
            <li className="px-2 py-4 text-center text-xs text-muted-foreground">
              No one matches “{query.trim()}”
            </li>
          )}
        </ul>
      </ScrollArea>
    </div>
  );
}

function ReaderItem({ reader }: { reader: MessageReader }) {
  const livePresence = useResolvedPresence(reader.userId);
  const seenLabel = readerSeenLabel(reader);

  return (
    <li className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent/50">
      <UserAvatar
        name={reader.displayName}
        src={reader.avatarUrl}
        seed={reader.userId}
        presence={livePresence}
        size="xs"
        className="shrink-0"
      />
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
        {reader.displayName}
      </span>
      {seenLabel && (
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{seenLabel}</span>
      )}
    </li>
  );
}
