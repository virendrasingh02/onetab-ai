import { Badge, Button, Card, EmptyState, Hint, UserAvatar } from '@org/ui';
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
    <div className="min-h-0 flex flex-1 flex-col">
      {/* Channel-style Header (Inbox & Threads style) */}
      <div className="top-0 backdrop-blur-md sticky z-20 shrink-0 border-b border-border bg-background/95">
        <div className="gap-2.5 px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between">
          <div className="min-w-0 gap-2 flex items-center">
            <div className="min-w-0 gap-1.5 flex items-center">
              <Bookmark
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <h2 className="text-sm font-semibold tracking-tight truncate text-foreground">
                Saved items
              </h2>
              {/* <Badge
                variant={ordered.length > 0 ? 'primary' : 'neutral'}
                className="text-[11px] px-1.5 py-0 h-4.5"
              >
                {ordered.length > 0 ? `${ordered.length} saved` : '0 saved'}
              </Badge> */}
            </div>

            {/* <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

            <p className="hidden min-w-0 max-w-[48ch] truncate text-xs text-muted-foreground sm:block">
              Messages and items you kept for later, newest first
            </p> */}
          </div>

          <div className="gap-2 flex items-center">
            {ordered.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={clear}
                className="h-7 text-xs gap-1.5"
              >
                <Trash2 className="size-3.5" />
                <span>Clear all</span>
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="min-h-0 p-3 sm:p-6 flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          {ordered.length === 0 ? (
            <EmptyState
              icon={<Bookmark />}
              title="Nothing saved yet"
              description="Hover a message and choose “Save for later” to keep it here."
            />
          ) : (
            <ul className="space-y-2.5">
              {ordered.map((entry) => (
                <li key={entry.id}>
                  <Card className="p-4 gap-4 group flex items-start justify-between bg-surface transition-colors hover:border-border-strong">
                    <div className="gap-3 min-w-0 flex flex-1 items-start">
                      <UserAvatar
                        name={entry.senderName}
                        src={entry.senderAvatarUrl}
                        seed={entry.senderId ?? entry.senderName}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="gap-2 flex flex-wrap items-center">
                          <span className="text-xs font-semibold text-foreground">
                            {entry.senderName}
                          </span>
                          <Badge
                            variant="outline"
                            className="gap-1 py-0 h-5 text-[11px]"
                          >
                            <Hash className="size-3" aria-hidden />
                            {entry.channelName}
                          </Badge>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            · saved{' '}
                            {formatRelative(
                              new Date(entry.savedAt).toISOString(),
                            )}
                          </span>
                        </div>

                        <p className="mt-2 text-xs sm:text-sm leading-relaxed line-clamp-4 whitespace-pre-wrap text-foreground">
                          {entry.body}
                        </p>
                        <p className="mt-1.5 font-mono text-[10px] text-subtle">
                          Sent{' '}
                          {formatRelative(new Date(entry.sentAt).toISOString())}
                        </p>
                      </div>
                    </div>

                    <Hint label="Remove from saved">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove message from ${entry.senderName} from saved`}
                        onClick={() => remove(entry.id)}
                        className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
                      >
                        <BookmarkX className="size-4" />
                      </Button>
                    </Hint>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
