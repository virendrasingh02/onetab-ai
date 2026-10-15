import { Button, Hint } from '@org/ui';
import { channelPath, ChannelPage, useChannels } from '@org/web-channels';
import { Maximize2, X } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DirectMessagesPage } from '../direct-messages-page.js';
import { useSplitViewStore, type SplitViewTarget } from './split-view-store.js';

export interface ChannelSplitViewProps {
  workspaceId: string;
  workspaceSlug: string;
  channel: SplitViewTarget;
}

/**
 * A second conversation beside the routed page ("Open in split view") — a
 * channel, a direct message or a group DM.
 *
 * It is the real page for that conversation — same header, tabs, composer and
 * actions — so both panes look and behave identically. Only the header's
 * trailing controls differ (expand / close). There is deliberately no switcher:
 * pick the conversation from the sidebar. A channel pane closes when the
 * channel is no longer one the user is in.
 */
export function ChannelSplitView({
  workspaceId,
  workspaceSlug,
  channel: target,
}: ChannelSplitViewProps) {
  const navigate = useNavigate();
  const closeSplit = useSplitViewStore((s) => s.close);
  const channelsQuery = useChannels(workspaceId);
  const channelTarget = 'slug' in target ? target : undefined;
  const close = () => closeSplit(workspaceId);

  const isChannel = !!channelTarget;

  const channel = useMemo(
    () =>
      isChannel
        ? (channelsQuery.data ?? []).find(
            (c) => c.id === target.id && c.membership && !c.isArchived,
          )
        : undefined,
    [channelsQuery.data, isChannel, target.id],
  );

  useEffect(() => {
    if (isChannel && channelsQuery.isSuccess && !channel) {
      closeSplit(workspaceId);
    }
  }, [isChannel, channelsQuery.isSuccess, channel, closeSplit, workspaceId]);

  const mainViewPath = () => {
    if (target.kind === 'dm') return `/w/${workspaceSlug}/dms/${target.id}`;
    if (target.kind === 'group') {
      return `/w/${workspaceSlug}/dms?room=${target.id}`;
    }
    return channelPath(workspaceSlug, channel ?? channelTarget ?? { slug: '' });
  };

  const headerEnd = (
    <>
      <Hint label="Open as main view">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Open as main view"
          onClick={() => {
            navigate(mainViewPath());
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
    </>
  );

  return (
    <section
      className="min-h-0 flex h-full flex-col overflow-hidden"
      aria-label={`Split view: ${isChannel ? '#' : ''}${channel?.name ?? target.name}`}
    >
      {target.kind === 'dm' ? (
        <DirectMessagesPage
          key={target.id}
          peerId={target.id}
          headerEnd={headerEnd}
        />
      ) : target.kind === 'group' ? (
        <DirectMessagesPage
          key={target.id}
          roomId={target.id}
          headerEnd={headerEnd}
        />
      ) : channelTarget ? (
        <ChannelPage
          // Remount per channel so drafts, scroll and threads don't bleed over.
          key={target.id}
          channelSlug={channelTarget.slug}
          headerEnd={headerEnd}
        />
      ) : null}
    </section>
  );
}
