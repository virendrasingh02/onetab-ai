import {
  Badge,
  Button,
  Input,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@org/ui';
import {
  CheckSquare,
  FileText,
  MessagesSquare,
  Plus,
  Search,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { ChannelGroup } from './channel-group.js';
import { EntityList } from './entity-list.js';
import { EntityPreviewDrawer } from './entity-preview-drawer.js';
import type {
  ChannelEntityGroup,
  ChatAppEntity,
  EntityActionHandlers,
  EntityKind,
} from './types.js';

type EntityFilter = 'all' | EntityKind;

/**
 * The "Kanban / Tasks" tab carries the value `card` but has to match both
 * board cards and standalone tasks, which arrive with distinct `kind`s.
 */
function matchesKind(kind: EntityKind, filter: EntityFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'card') return kind === 'card' || kind === 'task';
  return kind === filter;
}

export interface ChatEntityManagerProps {
  entities: ChatAppEntity[];
  groups?: ChannelEntityGroup[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  channelName?: string;
  handlers?: EntityActionHandlers;
  onCreateTask?: () => void;
  onCreateDoc?: () => void;
  className?: string;
}

export function ChatEntityManager({
  entities,
  groups,
  isLoading = false,
  error = null,
  onRetry,
  channelName,
  handlers,
  onCreateTask,
  onCreateDoc,
  className,
}: ChatEntityManagerProps) {
  const [filter, setFilter] = useState<EntityFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewEntity, setPreviewEntity] = useState<ChatAppEntity | null>(null);

  const filteredEntities = useMemo(() => {
    let result = entities.filter((e) => matchesKind(e.kind, filter));
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q) ||
          e.channelName?.toLowerCase().includes(q) ||
          e.status?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [entities, filter, searchQuery]);

  const channelGroups = useMemo(() => {
    if (groups && groups.length > 0) {
      return groups
        .map((g) => ({
          ...g,
          entities: g.entities.filter((e) => {
            const q = searchQuery.trim().toLowerCase();
            const matchesQuery =
              !q ||
              e.title.toLowerCase().includes(q) ||
              e.description?.toLowerCase().includes(q);
            return matchesKind(e.kind, filter) && matchesQuery;
          }),
        }))
        .filter((g) => g.entities.length > 0);
    }

    // Auto-group flat entities by channel if multiple channels are present
    const map = new Map<string, ChannelEntityGroup>();
    for (const e of filteredEntities) {
      const cId = e.channelId || 'general';
      let group = map.get(cId);
      if (!group) {
        group = {
          channelId: cId,
          channelName: e.channelName || 'General',
          channelSlug: e.channelSlug || 'general',
          entities: [],
        };
        map.set(cId, group);
      }
      group.entities.push(e);
    }
    return Array.from(map.values());
  }, [groups, filteredEntities, filter, searchQuery]);

  const customHandlers: EntityActionHandlers = useMemo(
    () => ({
      ...handlers,
      onPreview: (entity) => {
        setPreviewEntity(entity);
        handlers?.onPreview?.(entity);
      },
    }),
    [handlers],
  );

  const counts = useMemo(() => {
    return {
      all: entities.length,
      card: entities.filter((e) => e.kind === 'card' || e.kind === 'task').length,
      document: entities.filter((e) => e.kind === 'document').length,
      thread: entities.filter((e) => e.kind === 'thread').length,
      project: entities.filter((e) => e.kind === 'project').length,
    };
  }, [entities]);

  return (
    <div className={className ?? 'space-y-4'}>
      {/* Top Toolbar: Filter Tabs & Search */}
      <div className="gap-2.5 pb-2 flex flex-wrap items-center justify-between border-b border-border/60">
        <div className="gap-2 flex items-center flex-wrap">
          <Tabs
            value={filter}
            onValueChange={(val) => setFilter(val as EntityFilter)}
            className="h-7"
          >
            <TabsList className="h-7 p-0.5">
              <TabsTrigger value="all" className="h-6 px-2.5 text-xs gap-1">
                <span>All</span>
                <Badge variant="neutral" className="px-1 py-0 h-3.5 text-[9px]">
                  {counts.all}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="card" className="h-6 px-2.5 text-xs gap-1">
                <CheckSquare className="size-3" />
                <span>Kanban / Tasks</span>
                {counts.card > 0 && (
                  <Badge variant="neutral" className="px-1 py-0 h-3.5 text-[9px]">
                    {counts.card}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="document" className="h-6 px-2.5 text-xs gap-1">
                <FileText className="size-3" />
                <span>Docs</span>
                {counts.document > 0 && (
                  <Badge variant="neutral" className="px-1 py-0 h-3.5 text-[9px]">
                    {counts.document}
                  </Badge>
                )}
              </TabsTrigger>
              {counts.thread > 0 && (
                <TabsTrigger value="thread" className="h-6 px-2.5 text-xs gap-1">
                  <MessagesSquare className="size-3" />
                  <span>Threads</span>
                  <Badge variant="neutral" className="px-1 py-0 h-3.5 text-[9px]">
                    {counts.thread}
                  </Badge>
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>
        </div>

        {/* Search Input & Create Actions */}
        <div className="gap-2 flex items-center">
          <div className="relative w-44 sm:w-56">
            <Search className="size-3.5 left-2.5 top-1/2 -translate-y-1/2 absolute text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter app data…"
              className="h-7 pl-8 text-xs bg-surface"
            />
          </div>

          {onCreateTask && (
            <Button
              size="sm"
              onClick={onCreateTask}
              className="h-7 text-xs gap-1.5 px-2.5"
            >
              <Plus className="size-3" />
              <span className="hidden sm:inline">New Task</span>
            </Button>
          )}

          {onCreateDoc && (
            <Button
              size="sm"
              variant="outline"
              onClick={onCreateDoc}
              className="h-7 text-xs gap-1.5 px-2.5"
            >
              <Plus className="size-3" />
              <span className="hidden sm:inline">New Doc</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {channelName || channelGroups.length <= 1 ? (
        <EntityList
          items={filteredEntities}
          isLoading={isLoading}
          error={error}
          onRetry={onRetry}
          handlers={customHandlers}
          showChannelBadge={!channelName}
          emptyTitle={
            filter === 'all'
              ? 'No app data in this channel'
              : `No ${filter}s found`
          }
          emptyDescription="Create cards, documents, or tasks to organize work in this channel."
          emptyAction={
            onCreateTask ? (
              <Button size="sm" onClick={onCreateTask} className="gap-1.5">
                <Plus className="size-3.5" />
                <span>Create first task</span>
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-6">
          {channelGroups.map((group) => (
            <ChannelGroup
              key={group.channelId}
              group={group}
              handlers={customHandlers}
            />
          ))}
        </div>
      )}

      {/* In-Chat Preview Modal */}
      <EntityPreviewDrawer
        entity={previewEntity}
        open={Boolean(previewEntity)}
        onOpenChange={(open) => {
          if (!open) setPreviewEntity(null);
        }}
        handlers={customHandlers}
      />
    </div>
  );
}
