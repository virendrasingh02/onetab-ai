import type { ChannelSummary } from '@org/types';
import { Dialog, DialogContent, DialogTitle } from '@org/ui';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { channelPath } from '../channel-actions.js';
import { useCanManageChannel } from '../use-can-manage-channel.js';
import { useChannelMembers } from '../use-channels.js';
import { AddAppDialog } from './add-app-dialog.js';
import {
  ChannelDetailsPanel,
  type ChannelDetailsTab,
} from './channel-details-panel.js';
import {
  AddAgentToChannelDialog,
  AddPeopleDialog,
  ChannelPostingDialog,
  EditChannelDetailsDialog,
} from './channel-setup-dialogs.js';
import { CustomizeChannelTabsDialog } from './channel-tabs.js';

export interface ChannelDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: ChannelSummary;
  workspaceId: string;
  workspaceSlug: string;
  currentUserId: string;
  initialTab?: ChannelDetailsTab;
}

type ChildDialog = 'edit' | 'people' | 'posting' | 'tabs' | 'agent' | 'app';

/**
 * The channel details panel as a modal, for opening a channel's details from
 * somewhere other than the channel itself (the sidebar's channel menu).
 *
 * It hosts the same follow-up dialogs the channel page does, so every control
 * in the panel works here too. Starting a huddle needs the conversation on
 * screen, so it goes to the channel through its `?huddle=join` link.
 */
export function ChannelDetailsDialog({
  open,
  onOpenChange,
  channel,
  workspaceId,
  workspaceSlug,
  currentUserId,
  initialTab = 'about',
}: ChannelDetailsDialogProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const canManage = useCanManageChannel(channel);
  const [child, setChild] = useState<ChildDialog | null>(null);
  // Same query as the panel's roster, so this is a cache read.
  const members = useChannelMembers(workspaceId, channel.id);
  const path = channelPath(workspaceSlug, channel);

  const childProps = (which: ChildDialog) => ({
    open: child === which,
    onOpenChange: (isOpen: boolean) => {
      if (!isOpen) setChild(null);
    },
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="h-[640px] max-h-[88vh] w-full max-w-2xl overflow-hidden p-0 flex flex-col"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">#{channel.name} details</DialogTitle>
          <ChannelDetailsPanel
            channel={channel}
            workspaceId={workspaceId}
            workspaceSlug={workspaceSlug}
            currentUserId={currentUserId}
            initialTab={initialTab}
            onClose={() => onOpenChange(false)}
            onEditDetails={() => setChild('edit')}
            onAddPeople={() => setChild('people')}
            onAddAgent={() => setChild('agent')}
            onAddApp={() => setChild('app')}
            onOpenPosting={canManage ? () => setChild('posting') : undefined}
            onCustomizeTabs={() => setChild('tabs')}
            onStartHuddle={() => {
              onOpenChange(false);
              navigate(`${path}?huddle=join`);
            }}
            onChannelDeleted={() => {
              onOpenChange(false);
              if (location.pathname.startsWith(path)) {
                navigate(`/w/${workspaceSlug}`, { replace: true });
              }
            }}
          />
        </DialogContent>
      </Dialog>

      <EditChannelDetailsDialog
        {...childProps('edit')}
        workspaceId={workspaceId}
        channel={channel}
      />
      <AddPeopleDialog
        {...childProps('people')}
        workspaceId={workspaceId}
        channel={channel}
        existingMemberIds={(members.data ?? []).map((member) => member.user.id)}
      />
      <ChannelPostingDialog
        {...childProps('posting')}
        workspaceId={workspaceId}
        channel={channel}
      />
      <CustomizeChannelTabsDialog
        {...childProps('tabs')}
        workspaceId={workspaceId}
        channel={channel}
      />
      <AddAgentToChannelDialog {...childProps('agent')} channel={channel} />
      <AddAppDialog
        {...childProps('app')}
        channel={channel}
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
      />
    </>
  );
}
