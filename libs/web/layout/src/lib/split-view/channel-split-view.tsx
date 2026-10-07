import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Hint,
} from '@org/ui';
import {
  channelComposerLocks,
  channelPath,
  useCanManageChannel,
  useChannels,
} from '@org/web-channels';
import { ChannelChat } from '@org/web-chat';
import { ChevronDown, Hash, Lock, Maximize2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSplitViewStore, type SplitViewChannel } from './split-view-store.js';

export interface ChannelSplitViewProps {
  workspaceId: string;
  workspaceSlug: string;
  channel: SplitViewChannel;
}

/**
 * A second channel conversation beside the routed page ("Open in split view").
 *
 * It renders the same `ChannelChat` the channel page does, with the same
 * posting locks, and closes itself once the channel is no longer one the user
 * is in (left, archived, deleted) rather than show a conversation they can't
 * use.
 */
export function ChannelSplitView({
  workspaceId,
  workspaceSlug,
  channel: target,
}: ChannelSplitViewProps) {
  const navigate = useNavigate();
  const openSplit = useSplitViewStore((s) => s.open);
  const closeSplit = useSplitViewStore((s) => s.close);
  const channelsQuery = useChannels(workspaceId);
  // The conversation's own actions (search, huddle…) render into this header
  // instead of a second header inside the pane.
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);

  const joined = useMemo(
    () => (channelsQuery.data ?? []).filter((c) => c.membership && !c.isArchived),
    [channelsQuery.data],
  );
  const channel = joined.find((c) => c.id === target.id);
  const canManage = useCanManageChannel(channel);

  useEffect(() => {
    if (channelsQuery.isSuccess && !channel) closeSplit(workspaceId);
  }, [channelsQuery.isSuccess, channel, closeSplit, workspaceId]);

  const close = () => closeSplit(workspaceId);
  const Icon = channel?.visibility === 'PRIVATE' ? Lock : Hash;

  return (
    <section
      className="min-h-0 flex h-full flex-col overflow-hidden"
      aria-label={`Split view: #${channel?.name ?? target.name}`}
    >
      <header className="h-11 gap-1 px-2 flex shrink-0 items-center border-b border-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="min-w-0 gap-1.5 px-2 font-semibold"
              aria-label="Switch the split view channel"
            >
              <Icon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{channel?.name ?? target.name}</span>
              <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto">
            {joined.map((c) => {
              const ItemIcon = c.visibility === 'PRIVATE' ? Lock : Hash;
              return (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={c.id === target.id}
                  onSelect={() =>
                    openSplit(workspaceId, { id: c.id, slug: c.slug, name: c.name })
                  }
                  className="gap-2 text-xs"
                >
                  <ItemIcon className="size-3.5 text-muted-foreground" />
                  <span className="truncate">{c.name}</span>
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <div ref={setActionsSlot} className="ml-auto flex items-center" />

        <Hint label="Open as main view">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Open as main view"
            onClick={() => {
              navigate(channelPath(workspaceSlug, channel ?? target));
              close();
            }}
          >
            <Maximize2 className="size-3.5" />
          </Button>
        </Hint>
        <Hint label="Close split view">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close split view"
            onClick={close}
          >
            <X className="size-4" />
          </Button>
        </Hint>
      </header>

      <div className="min-h-0 flex flex-1 flex-col overflow-hidden">
        {channel ? (
          <ChannelChat
            // Remount per channel so drafts, scroll and threads don't bleed
            // from one conversation into the next.
            key={channel.id}
            channelId={channel.id}
            workspaceId={workspaceId}
            title={channel.name}
            subtitle={channel.topic ?? undefined}
            headerActionsSlot={actionsSlot}
            showMembers={false}
            canManageConversation={canManage}
            huddlesEnabled={channel.huddlesEnabled}
            memberSuggestions={channel.membership?.memberSuggestions}
            {...channelComposerLocks(channel)}
          />
        ) : null}
      </div>
    </section>
  );
}
