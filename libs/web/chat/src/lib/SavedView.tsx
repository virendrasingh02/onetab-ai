import { Badge, Button, EmptyState, Hint, Panel, UserAvatar } from '@org/ui';
import { formatRelative } from '@org/utils';
import { Bookmark, BookmarkX, Hash, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { useSavedMessagesStore } from './use-saved-messages.js';

/**
 * Everything the reader has put aside, across every conversation.
 *
 * "Saved for later" used to be an icon in the channel header opening a panel
 * scoped to that one channel — which meant the list only existed while you were
 * standing in the room it belonged to, and there was no way to answer "what did
 * I save?" without walking every channel. It is a sidebar destination now, for
 * the same reason Inbox and Threads are.
 */
export function SavedView() {
  const saved = useSavedMessagesStore((s) => s.saved);
  const remove = useSavedMessagesStore((s) => s.remove);
  const clear = useSavedMessagesStore((s) => s.clear);

  const ordered = useMemo(
    () => [...saved].sort((a, b) => b.savedAt - a.savedAt),
    [saved],
  );

  return (
    <Panel
      title="Saved"
      subtitle="Messages you kept for later, newest first."
      flush
      actions={
        ordered.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={clear}
            className="gap-1.5 text-xs"
          >
            <Trash2 className="size-3.5" />
            <span>Clear all</span>
          </Button>
        ) : null
      }
    >
      {ordered.length === 0 ? (
        <EmptyState
          icon={<Bookmark />}
          title="Nothing saved yet"
          description="Hover a message and choose “Save for later” to keep it here."
        />
      ) : (
        <ul className="divide-y divide-border">
          {ordered.map((entry) => (
            <li
              key={entry.id}
              className="group gap-3 p-4 flex items-start hover:bg-muted/50"
            >
              <UserAvatar
                name={entry.senderName}
                src={entry.senderAvatarUrl}
                seed={entry.senderName}
              />

              <div className="min-w-0 flex-1">
                <div className="gap-2 flex flex-wrap items-center">
                  <Badge variant="outline">
                    <Hash aria-hidden />
                    {entry.channelName}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    saved{' '}
                    {formatRelative(new Date(entry.savedAt).toISOString())}
                  </span>
                </div>

                {/*
                  The stored copy, not a live read: see `use-saved-messages` for
                  why saving takes a snapshot. An edit after the fact will not
                  show here, which is the trade for a list that works outside
                  the room — and outside an encrypted one at all.
                */}
                <p className="mt-1.5 text-sm line-clamp-4 whitespace-pre-wrap text-foreground">
                  {entry.body}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {entry.senderName} ·{' '}
                  {formatRelative(new Date(entry.sentAt).toISOString())}
                </p>
              </div>

              <Hint label="Remove from saved">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove message from ${entry.senderName} from saved`}
                  onClick={() => remove(entry.id)}
                  className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <BookmarkX className="size-4" />
                </Button>
              </Hint>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
