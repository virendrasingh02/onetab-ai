import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MessagePreview } from '@org/chat-ui';
import type { BookmarkDto, CreateBookmarkInput } from '@org/types';
import {
  Badge,
  Button,
  EmptyState,
  Hint,
  Input,
  buildObjectActions,
  EntityContextMenu,
  ObjectActionMenu,
  Spinner,
  PageTabBar,
  Tabs,
  TabsTrigger,
  toast,
  UserAvatar,
} from '@org/ui';
import { cn, formatListTimestamp, formatRelative } from '@org/utils';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  Bookmark,
  BookmarkX,
  CheckSquare,
  FileText,
  MessageSquare,
  Paperclip,
  Search,
} from 'lucide-react';
import { useBookmarks, useBookmarkToggle } from './use-bookmarks.js';
import {
  MESSAGE_BOOKMARK_TYPE,
  bookmarkToSavedMessage,
  useLegacySavedMessagesImport,
} from './use-saved-messages.js';

type BookmarkFilter = 'all' | 'message' | 'task' | 'doc' | 'file';

const FILTERS: { key: BookmarkFilter; label: string }[] = [
  { key: 'all', label: 'All Items' },
  { key: 'message', label: 'Messages' },
  { key: 'task', label: 'Tasks' },
  { key: 'doc', label: 'Documents' },
  { key: 'file', label: 'Files' },
];

function getTypeIcon(type: string) {
  switch (type.toLowerCase()) {
    case 'task':
      return CheckSquare;
    case 'message':
      return MessageSquare;
    case 'doc':
      return FileText;
    case 'file':
      return Paperclip;
    default:
      return Bookmark;
  }
}

interface SavedItem {
  bookmark: BookmarkDto;
  type: string;
  title: string;
  snippet: string | null;
  /** Where the object lives — the conversation for a message. */
  context?: string;
  href?: string;
  /** When the object itself happened (a message's send time), else the save. */
  timestamp: number | string;
  sender?: { id?: string; name: string; avatarUrl?: string };
}

const TYPE_LABELS: Record<string, string> = {
  message: 'Message',
  task: 'Task',
  doc: 'Document',
  file: 'File',
};

/** Workspace-relative `href` from metadata, else the type's canonical link. */
function itemHref(
  bookmark: BookmarkDto,
  slug: string | undefined,
): string | undefined {
  if (!slug) return undefined;
  const stored = bookmark.metadata?.['href'];
  if (typeof stored === 'string' && stored) {
    return stored.startsWith('/') ? stored : `/w/${slug}/${stored}`;
  }
  const id = encodeURIComponent(bookmark.targetId);
  switch (bookmark.targetType) {
    case 'task':
      return `/w/${slug}/projects?taskId=${id}`;
    case 'doc':
      return `/w/${slug}/docs/${id}`;
    case 'file':
      return `/w/${slug}/files?file=${id}`;
    case MESSAGE_BOOKMARK_TYPE: {
      const channelSlug = bookmark.metadata?.['channelSlug'];
      return typeof channelSlug === 'string' && channelSlug
        ? `/w/${slug}/channels/${channelSlug}?msg=${id}`
        : undefined;
    }
    default:
      return undefined;
  }
}

function toSavedItem(
  bookmark: BookmarkDto,
  slug: string | undefined,
): SavedItem {
  const href = itemHref(bookmark, slug);
  if (bookmark.targetType === MESSAGE_BOOKMARK_TYPE) {
    const message = bookmarkToSavedMessage(bookmark);
    return {
      bookmark,
      type: MESSAGE_BOOKMARK_TYPE,
      title: message.senderName || bookmark.title,
      snippet: message.body || null,
      context: message.channelName
        ? message.channelSlug
          ? `#${message.channelName}`
          : message.channelName
        : undefined,
      href,
      timestamp: message.sentAt || bookmark.createdAt,
      sender: {
        id: message.senderId,
        name: message.senderName || 'Someone',
        avatarUrl: message.senderAvatarUrl,
      },
    };
  }
  return {
    bookmark,
    type: bookmark.targetType,
    title: bookmark.title,
    snippet: bookmark.snippet ?? null,
    href,
    timestamp: bookmark.createdAt,
  };
}

function toInput(bookmark: BookmarkDto): CreateBookmarkInput {
  return {
    targetType: bookmark.targetType,
    targetId: bookmark.targetId,
    title: bookmark.title,
    snippet: bookmark.snippet ?? null,
    tags: bookmark.tags,
    metadata: bookmark.metadata,
  };
}

export function SavedView() {
  const navigate = useNavigate();
  const { workspaceId, slug: workspaceSlug } = useCurrentWorkspace();
  const [activeFilter, setActiveFilter] = useState<BookmarkFilter>('all');
  const [query, setQuery] = useState('');
  // `?item=<targetId>` — "View Saved" on a chat message lands here on it.
  const [searchParams, setSearchParams] = useSearchParams();
  const focusId = searchParams.get('item');
  const [flashId, setFlashId] = useState<string | null>(null);

  // Saves from before bookmarks lived on the server are uploaded once.
  useLegacySavedMessagesImport();

  const {
    data: bookmarks = [],
    isLoading,
    isError,
    refetch,
  } = useBookmarks(workspaceId);
  const { toggle } = useBookmarkToggle(workspaceId);

  const allItems = useMemo(
    () => bookmarks.map((b) => toSavedItem(b, workspaceSlug)),
    [bookmarks, workspaceSlug],
  );

  const searchedItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return allItems;
    return allItems.filter((item) =>
      [item.title, item.snippet, item.context, ...item.bookmark.tags]
        .filter(Boolean)
        .some((text) => (text as string).toLowerCase().includes(needle)),
    );
  }, [allItems, query]);

  const counts = useMemo(() => {
    const byType: Record<string, number> = { all: searchedItems.length };
    for (const item of searchedItems)
      byType[item.type] = (byType[item.type] ?? 0) + 1;
    return byType;
  }, [searchedItems]);

  const filteredItems = useMemo(
    () =>
      activeFilter === 'all'
        ? searchedItems
        : searchedItems.filter((item) => item.type === activeFilter),
    [searchedItems, activeFilter],
  );

  useEffect(() => {
    if (!focusId || isLoading) return;
    const hit = allItems.some((item) => item.bookmark.targetId === focusId);
    if (hit) {
      setActiveFilter('all');
      setQuery('');
      setFlashId(focusId);
      requestAnimationFrame(() => {
        document
          .querySelector(`[data-saved-id="${CSS.escape(focusId)}"]`)
          ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
    }
    // Consume the param so a refresh or a later save doesn't jump again.
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('item');
        return next;
      },
      { replace: true },
    );
  }, [focusId, isLoading, allItems, setSearchParams]);

  useEffect(() => {
    if (!flashId) return;
    const timer = window.setTimeout(() => setFlashId(null), 2400);
    return () => window.clearTimeout(timer);
  }, [flashId]);

  const handleRemove = (item: SavedItem) => {
    const input = toInput(item.bookmark);
    void toggle(input, true);
    toast.success('Removed from saved', {
      action: { label: 'Undo', onClick: () => void toggle(input, false) },
    });
  };

  return (
    <div className="min-h-0 flex flex-1 flex-col bg-background text-foreground">
      {/* Header */}
      <div className="top-0 backdrop-blur-md sticky z-20 shrink-0 bg-background/95">
        <div className="gap-2.5 px-3 sm:px-6 pt-2 pb-1 min-h-11 flex flex-wrap items-center justify-between">
          <div className="min-w-0 gap-2 flex items-center">
            <Bookmark
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <h2 className="text-base font-medium truncate tracking-[-0.01em] text-foreground">
              Saved
            </h2>
            <Badge variant="outline" className="px-1.5 py-0 h-5 text-[11px]">
              {allItems.length}
            </Badge>
          </div>

          {allItems.length > 0 && (
            <div className="sm:w-64 w-full">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search saved items"
                aria-label="Search saved items"
                prefix={<Search className="size-3.5" />}
                className="h-8 text-xs"
              />
            </div>
          )}
        </div>
      </div>

      {/* Filters — the same tab strip every sidebar page uses. */}
      <Tabs
        value={activeFilter}
        onValueChange={(value) => setActiveFilter(value as BookmarkFilter)}
      >
        <PageTabBar>
          {FILTERS.map((tab) => (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              count={counts[tab.key] ? counts[tab.key] : undefined}
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </PageTabBar>
      </Tabs>

      {/* Content Area */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div>
          {isLoading ? (
            <div className="h-48 flex items-center justify-center">
              <Spinner className="size-6 text-brand-text" />
            </div>
          ) : isError ? (
            <EmptyState
              icon={<Bookmark className="size-8 text-muted-foreground" />}
              title="Couldn't load saved items"
              description="Check your connection and try again."
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void refetch()}
                >
                  Retry
                </Button>
              }
            />
          ) : filteredItems.length === 0 ? (
            <EmptyState
              icon={<Bookmark className="size-8 text-muted-foreground" />}
              title={
                query.trim()
                  ? 'No matches'
                  : activeFilter === 'all'
                    ? 'Nothing saved yet'
                    : `No saved ${FILTERS.find((f) => f.key === activeFilter)?.label.toLowerCase()}`
              }
              description={
                query.trim()
                  ? 'Try a different search.'
                  : 'Save messages, tasks, documents, or files to come back to them here. Only you can see your saved items.'
              }
            />
          ) : (
            <ul className="divide-y divide-border border-b border-border">
              {filteredItems.map((item) => {
                const ItemIcon = getTypeIcon(item.type);
                const isMessage = item.type === MESSAGE_BOOKMARK_TYPE;
                const open = item.href
                  ? () => navigate(item.href as string)
                  : undefined;
                const target = {
                  type: item.type,
                  id: item.bookmark.targetId,
                  title: item.title,
                  href: item.href,
                };
                return (
                  <li
                    key={`${item.type}-${item.bookmark.targetId}`}
                    data-saved-id={item.bookmark.targetId}
                  >
                    <EntityContextMenu
                      actions={() =>
                        buildObjectActions(target, {
                          isBookmarked: true,
                          onBookmarkToggle: () => handleRemove(item),
                          onOpen: (href) => navigate(href),
                        })
                      }
                      scope={`${item.type}:${item.bookmark.targetId}`}
                      entityType={item.type}
                      entity={item}
                      label={item.title}
                    >
                      <div
                        role={open ? 'link' : undefined}
                        tabIndex={open ? 0 : undefined}
                        aria-label={open ? `Open ${item.title}` : undefined}
                        onClick={open}
                        onKeyDown={(event) => {
                          if (
                            open &&
                            event.key === 'Enter' &&
                            event.target === event.currentTarget
                          ) {
                            open();
                          }
                        }}
                        className={cn(
                          'group gap-3 px-3 sm:px-6 py-3 relative flex items-start transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none',
                          open && 'cursor-pointer',
                          flashId === item.bookmark.targetId && 'message-flash',
                        )}
                      >
                        {item.sender ? (
                          <UserAvatar
                            name={item.sender.name}
                            src={item.sender.avatarUrl}
                            seed={item.sender.id}
                            size="md"
                            className="mt-0.5 shrink-0"
                          />
                        ) : (
                          <div className="size-8 mt-0.5 flex shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand-text">
                            <ItemIcon className="size-4" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          {isMessage ? (
                            <p className="text-sm leading-relaxed line-clamp-2 break-words text-foreground">
                              {item.snippet ? (
                                <MessagePreview text={item.snippet} />
                              ) : (
                                <span className="text-muted-foreground italic">
                                  Attachment
                                </span>
                              )}
                            </p>
                          ) : (
                            <>
                              <p className="text-sm font-medium truncate text-foreground">
                                {item.title}
                              </p>
                              {item.snippet && (
                                <p className="mt-0.5 text-sm line-clamp-1 text-muted-foreground">
                                  <MessagePreview text={item.snippet} />
                                </p>
                              )}
                            </>
                          )}

                          <div className="mt-1 gap-x-2 gap-y-0.5 text-xs flex flex-wrap items-center text-muted-foreground">
                            <span className="min-w-0 truncate">
                              {isMessage ? (
                                <>
                                  <span className="font-medium text-foreground/80">
                                    {item.sender?.name}
                                  </span>
                                  {item.context && <> in {item.context}</>}
                                </>
                              ) : (
                                (TYPE_LABELS[item.type] ?? item.type)
                              )}
                            </span>
                            <span aria-hidden className="h-3 w-px bg-border" />
                            <time
                              dateTime={new Date(item.timestamp).toISOString()}
                              title={`Saved ${formatRelative(item.bookmark.createdAt)}`}
                            >
                              {formatListTimestamp(item.timestamp)}
                            </time>
                            {item.bookmark.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded px-1.5 py-0.5 bg-muted text-[10px]"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Floating actions, Slack-style, on hover/focus. */}
                        <div
                          onClick={(event) => event.stopPropagation()}
                          className="top-2 right-3 sm:right-6 gap-0.5 p-0.5 absolute flex items-center rounded-md border border-border bg-popover opacity-0 shadow-sm transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 has-[[data-state=open]]:opacity-100"
                        >
                          <Hint label="Remove from saved">
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-label={`Remove ${item.title} from saved`}
                              onClick={() => handleRemove(item)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <BookmarkX className="size-3.5" />
                            </Button>
                          </Hint>
                          <ObjectActionMenu
                            target={target}
                            isBookmarked={true}
                            onBookmarkToggle={() => handleRemove(item)}
                            onOpen={(href) => navigate(href)}
                          />
                        </div>
                      </div>
                    </EntityContextMenu>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
