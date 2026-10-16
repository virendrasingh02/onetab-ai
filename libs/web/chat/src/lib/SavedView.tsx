import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BookmarkDto, CreateBookmarkInput } from '@org/types';
import {
  Badge,
  Button,
  Card,
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
} from '@org/ui';
import { formatRelative } from '@org/utils';
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
}

/** Workspace-relative `href` from metadata, else the type's canonical link. */
function itemHref(bookmark: BookmarkDto, slug: string | undefined): string | undefined {
  if (!slug) return undefined;
  const stored = bookmark.metadata?.['href'];
  if (typeof stored === 'string' && stored) {
    return stored.startsWith('/') ? stored : `/w/${slug}/${stored}`;
  }
  const id = encodeURIComponent(bookmark.targetId);
  switch (bookmark.targetType) {
    case 'task':
      return `/w/${slug}/tasks?taskId=${id}`;
    case 'doc':
      return `/w/${slug}/docs/${id}`;
    case 'file':
      return `/w/${slug}/files?file=${id}`;
    case MESSAGE_BOOKMARK_TYPE: {
      const channelSlug = bookmark.metadata?.['channelSlug'];
      return typeof channelSlug === 'string' && channelSlug
        ? `/w/${slug}/c/${channelSlug}?msg=${id}`
        : undefined;
    }
    default:
      return undefined;
  }
}

function toSavedItem(bookmark: BookmarkDto, slug: string | undefined): SavedItem {
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
    };
  }
  return {
    bookmark,
    type: bookmark.targetType,
    title: bookmark.title,
    snippet: bookmark.snippet ?? null,
    href,
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
    for (const item of searchedItems) byType[item.type] = (byType[item.type] ?? 0) + 1;
    return byType;
  }, [searchedItems]);

  const filteredItems = useMemo(
    () =>
      activeFilter === 'all'
        ? searchedItems
        : searchedItems.filter((item) => item.type === activeFilter),
    [searchedItems, activeFilter],
  );

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
            <h2 className="text-base font-semibold tracking-tight truncate text-foreground">
              Saved Items
            </h2>
            <Badge variant="outline" className="px-1.5 py-0 h-5 text-[11px]">
              {allItems.length}
            </Badge>
          </div>

          {allItems.length > 0 && (
            <div className="w-full sm:w-64">
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
      <div className="min-h-0 p-3 sm:p-6 flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          {isLoading ? (
            <div className="h-48 flex items-center justify-center">
              <Spinner className="size-6 text-primary" />
            </div>
          ) : isError ? (
            <EmptyState
              icon={<Bookmark className="size-8 text-muted-foreground" />}
              title="Couldn't load saved items"
              description="Check your connection and try again."
              action={
                <Button size="sm" variant="outline" onClick={() => void refetch()}>
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
            <ul className="space-y-2.5">
              {filteredItems.map((item) => {
                const ItemIcon = getTypeIcon(item.type);
                const target = {
                  type: item.type,
                  id: item.bookmark.targetId,
                  title: item.title,
                  href: item.href,
                };
                return (
                  <li key={`${item.type}-${item.bookmark.targetId}`}>
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
                      <Card className="p-4 gap-4 group flex items-start justify-between bg-card transition-colors hover:border-border-strong">
                        <div className="gap-3 min-w-0 flex flex-1 items-start">
                          <div className="size-8 mt-0.5 flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <ItemIcon className="size-4" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="gap-2 flex flex-wrap items-center">
                              {item.href ? (
                                <button
                                  type="button"
                                  onClick={() => navigate(item.href as string)}
                                  className="text-xs sm:text-sm font-semibold text-left text-foreground hover:text-primary hover:underline"
                                >
                                  {item.title}
                                </button>
                              ) : (
                                <span className="text-xs sm:text-sm font-semibold text-foreground">
                                  {item.title}
                                </span>
                              )}
                              {item.context && (
                                <span className="text-xs text-muted-foreground">
                                  in {item.context}
                                </span>
                              )}
                              <Badge
                                variant="outline"
                                className="px-1 py-0 h-4.5 text-[10px] uppercase"
                              >
                                {item.type}
                              </Badge>
                              <span className="font-mono text-[11px] text-muted-foreground">
                                · saved {formatRelative(item.bookmark.createdAt)}
                              </span>
                            </div>

                            {item.snippet && (
                              <p className="mt-2 text-xs sm:text-sm leading-relaxed line-clamp-3 whitespace-pre-wrap text-muted-foreground">
                                {item.snippet}
                              </p>
                            )}

                            {item.bookmark.tags.length > 0 && (
                              <div className="mt-2 gap-1 flex flex-wrap">
                                {item.bookmark.tags.map((tag) => (
                                  <span
                                    key={tag}
                                    className="rounded px-1.5 py-0.5 bg-muted text-[10px] text-muted-foreground"
                                  >
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="gap-1 flex shrink-0 items-center">
                          <ObjectActionMenu
                            target={target}
                            isBookmarked={true}
                            onBookmarkToggle={() => handleRemove(item)}
                            onOpen={(href) => navigate(href)}
                          />

                          <Hint label="Remove from saved">
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-label={`Remove ${item.title} from saved`}
                              onClick={() => handleRemove(item)}
                              className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
                            >
                              <BookmarkX className="size-3.5" />
                            </Button>
                          </Hint>
                        </div>
                      </Card>
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
