import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Hint,
  ObjectActionMenu,
  Spinner,
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
  Trash2,
} from 'lucide-react';
import { useBookmarks, useBookmarkMutations } from './use-bookmarks.js';
import { useSavedMessagesStore } from './use-saved-messages.js';

type BookmarkFilter = 'all' | 'message' | 'task' | 'doc' | 'file';

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

export function SavedView() {
  const navigate = useNavigate();
  const { workspaceId, slug: workspaceSlug } = useCurrentWorkspace();

  const [activeFilter, setActiveFilter] = useState<BookmarkFilter>('all');

  // Server bookmarks
  const {
    data: bookmarks = [],
    isLoading: isBookmarksLoading,
  } = useBookmarks(workspaceId);
  const { removeBookmark } = useBookmarkMutations(workspaceId);

  // Local legacy saved messages
  const legacySaved = useSavedMessagesStore((s) => s.saved);
  const removeLegacy = useSavedMessagesStore((s) => s.remove);
  const clearLegacy = useSavedMessagesStore((s) => s.clear);

  // Combine bookmarks and legacy items
  const allItems = useMemo(() => {
    const serverItems = bookmarks.map((b) => ({
      id: b.id,
      isLegacy: false,
      targetType: b.targetType,
      targetId: b.targetId,
      title: b.title,
      snippet: b.snippet,
      tags: b.tags,
      timestamp: b.createdAt,
      href:
        b.targetType === 'task'
          ? `/w/${workspaceSlug}/tasks/${b.targetId}`
          : b.targetType === 'doc'
            ? `/w/${workspaceSlug}/docs/${b.targetId}`
            : b.targetType === 'message'
              ? `/w/${workspaceSlug}/threads/${b.targetId}`
              : undefined,
    }));

    // Add legacy messages that are not already in server bookmarks
    const serverMessageIds = new Set(
      bookmarks.filter((b) => b.targetType === 'message').map((b) => b.targetId),
    );

    const legacyItems = legacySaved
      .filter((m) => !serverMessageIds.has(m.id))
      .map((m) => ({
        id: m.id,
        isLegacy: true,
        targetType: 'message',
        targetId: m.id,
        title: `Message from ${m.senderName} in #${m.channelName}`,
        snippet: m.body,
        tags: [m.channelName],
        timestamp: new Date(m.savedAt).toISOString(),
        href: m.channelSlug
          ? `/w/${workspaceSlug}/channel/${m.channelSlug}`
          : `/w/${workspaceSlug}/dms/${m.roomId}`,
      }));

    return [...serverItems, ...legacyItems].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [bookmarks, legacySaved, workspaceSlug]);

  const filteredItems = useMemo(() => {
    if (activeFilter === 'all') return allItems;
    return allItems.filter(
      (item) => item.targetType.toLowerCase() === activeFilter.toLowerCase(),
    );
  }, [allItems, activeFilter]);

  const handleRemove = async (item: (typeof allItems)[0]) => {
    if (item.isLegacy) {
      removeLegacy(item.id);
    } else {
      await removeBookmark(item.id);
    }
  };

  const filterTabs: { key: BookmarkFilter; label: string; count?: number }[] = [
    { key: 'all', label: 'All Items', count: allItems.length },
    {
      key: 'message',
      label: 'Messages',
      count: allItems.filter((i) => i.targetType === 'message').length,
    },
    {
      key: 'task',
      label: 'Tasks',
      count: allItems.filter((i) => i.targetType === 'task').length,
    },
    {
      key: 'doc',
      label: 'Documents',
      count: allItems.filter((i) => i.targetType === 'doc').length,
    },
    {
      key: 'file',
      label: 'Files',
      count: allItems.filter((i) => i.targetType === 'file').length,
    },
  ];

  return (
    <div className="min-h-0 flex flex-1 flex-col bg-background text-foreground">
      {/* Header */}
      <div className="top-0 backdrop-blur-md sticky z-20 shrink-0 border-b border-border bg-background/95">
        <div className="gap-2.5 px-3 sm:px-6 py-2 min-h-12 flex flex-wrap items-center justify-between">
          <div className="min-w-0 gap-2 flex items-center">
            <Bookmark className="size-4 shrink-0 text-primary" aria-hidden />
            <h2 className="text-sm font-semibold tracking-tight truncate text-foreground">
              Saved Bookmarks
            </h2>
            <Badge variant="outline" className="text-[11px] px-1.5 py-0 h-5">
              {allItems.length}
            </Badge>
          </div>

          {legacySaved.length > 0 && (
            <div className="gap-2 flex items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={clearLegacy}
                className="h-7 text-xs gap-1.5"
              >
                <Trash2 className="size-3.5 text-muted-foreground" />
                <span>Clear Local Cache</span>
              </Button>
            </div>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 px-3 sm:px-6 pb-2 overflow-x-auto">
          {filterTabs.map((tab) => {
            const isActive = activeFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveFilter(tab.key)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                      isActive
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-background text-muted-foreground'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="min-h-0 p-3 sm:p-6 flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          {isBookmarksLoading && allItems.length === 0 ? (
            <div className="flex h-48 items-center justify-center">
              <Spinner className="size-6 text-primary" />
            </div>
          ) : filteredItems.length === 0 ? (
            <EmptyState
              icon={<Bookmark className="size-8 text-muted-foreground" />}
              title={
                activeFilter === 'all'
                  ? 'Nothing saved yet'
                  : `No saved ${activeFilter}s`
              }
              description="Save messages, tasks, documents, or files for later to quickly access them here across the entire workspace."
            />
          ) : (
            <ul className="space-y-2.5">
              {filteredItems.map((item) => {
                const ItemIcon = getTypeIcon(item.targetType);
                return (
                  <li key={`${item.targetType}-${item.id}`}>
                    <Card className="p-4 gap-4 group flex items-start justify-between bg-card transition-colors hover:border-border-strong">
                      <div className="gap-3 min-w-0 flex flex-1 items-start">
                        <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                          <ItemIcon className="size-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="gap-2 flex flex-wrap items-center">
                            <span
                              onClick={() => {
                                if (item.href) navigate(item.href);
                              }}
                              className={`text-xs sm:text-sm font-semibold text-foreground ${
                                item.href
                                  ? 'cursor-pointer hover:text-primary hover:underline'
                                  : ''
                              }`}
                            >
                              {item.title}
                            </span>
                            <Badge
                              variant="outline"
                              className="uppercase text-[10px] px-1 py-0 h-4.5"
                            >
                              {item.targetType}
                            </Badge>
                            <span className="font-mono text-[11px] text-muted-foreground">
                              · saved{' '}
                              {formatRelative(
                                new Date(item.timestamp).toISOString(),
                              )}
                            </span>
                          </div>

                          {item.snippet && (
                            <p className="mt-2 text-xs sm:text-sm leading-relaxed line-clamp-3 whitespace-pre-wrap text-muted-foreground">
                              {item.snippet}
                            </p>
                          )}

                          {item.tags && item.tags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {item.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <ObjectActionMenu
                          target={{
                            type: item.targetType,
                            id: item.targetId,
                            title: item.title,
                            href: item.href,
                          }}
                          isBookmarked={true}
                          onBookmarkToggle={() => handleRemove(item)}
                        />

                        <Hint label="Remove bookmark">
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
