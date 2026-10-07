import {
  CHANNEL_NOTIFICATION_LEVEL_LABELS,
  channelNotificationLevel,
  isGeneralChannel,
  type ChannelNotificationLevel,
  type ChannelSummary,
} from '@org/types';
import { copyToClipboard, entityUrl, type EntityAction } from '@org/ui';
import {
  Archive,
  ArchiveRestore,
  AtSign,
  Bell,
  BellOff,
  Columns2,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Hash,
  Info,
  Link2,
  Lock,
  LogOut,
  Mail,
  MailOpen,
  Pencil,
  Settings,
  Settings2,
  Star,
  Users,
} from 'lucide-react';
import type { ChannelDetailsTab } from './components/channel-details-panel.js';

export interface BuildChannelActionsOptions {
  channel: ChannelSummary;
  workspaceSlug: string;
  /**
   * Channel admin, or a workspace member holding `manage_settings` — the
   * server's `assertCanManage`. See `useCanManageChannel`.
   */
  canManage: boolean;
  /** Flips "Mark as read" ⇄ "Mark as unread". */
  hasUnread?: boolean;
  /** Sidebar-only: the channel is filed under Inactive by hand. */
  isHidden?: boolean;
  /**
   * Host-specific organisation entries (the sidebar's priority and sections),
   * slotted in after the notification controls.
   */
  organizeActions?: EntityAction[];

  onOpen?: () => void;
  onOpenSplitView?: () => void;
  onOpenDetails?: (tab: ChannelDetailsTab) => void;
  onToggleFavorite?: () => void;
  onMarkRead?: () => void;
  onMarkUnread?: () => void;
  onSetNotificationLevel?: (level: ChannelNotificationLevel) => void;
  onToggleHidden?: () => void;
  onRename?: () => void;
  onEditDetails?: () => void;
  onAddPeople?: () => void;
  onSetArchived?: (archived: boolean) => unknown;
  onLeave?: () => unknown;
}

export function channelPath(workspaceSlug: string, channel: { slug: string }) {
  return `/w/${workspaceSlug}/c/${channel.slug}`;
}

/**
 * Prompt copy for a confirm step. Plain strings, so it fits both an
 * `EntityAction.confirm` and `usePromptDialog().confirmAction`.
 */
export interface ChannelConfirmCopy {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
}

/** The leave prompt, shared by every surface that offers "Leave channel". */
export function leaveChannelConfirm(channel: ChannelSummary): ChannelConfirmCopy {
  return {
    title: `Leave #${channel.name}?`,
    description:
      channel.visibility === 'PRIVATE'
        ? 'You’ll stop getting its messages and notifications. It’s private, so you’ll need to be re-invited to rejoin.'
        : 'You’ll stop getting its messages and notifications. You can rejoin from Browse channels at any time.',
    confirmLabel: 'Leave channel',
    destructive: true,
  };
}

export function archiveChannelConfirm(
  channel: ChannelSummary,
  archived: boolean,
): ChannelConfirmCopy {
  return archived
    ? {
        title: `Archive #${channel.name}?`,
        description:
          'The channel becomes read-only and leaves the sidebar. Its history is kept, and a workspace admin can unarchive it later.',
        confirmLabel: 'Archive channel',
        destructive: true,
      }
    : {
        title: `Unarchive #${channel.name}?`,
        description:
          'The channel becomes active again and reappears in the sidebar.',
        confirmLabel: 'Unarchive',
      };
}

/**
 * Opens the channel in its own browser window, reusing (and focusing) the one
 * already open for this channel rather than stacking duplicates.
 */
export function openChannelInNewWindow(
  workspaceSlug: string,
  channel: Pick<ChannelSummary, 'id' | 'slug'>,
): void {
  window
    .open(
      entityUrl(channelPath(workspaceSlug, channel)),
      `onetab-channel-${channel.id}`,
    )
    ?.focus();
}

/**
 * Everything that can be done to a channel from a menu — the sidebar row's
 * "⋯" and right-click menus, the Inactive list, anywhere else that lists
 * channels — as one `EntityAction` list.
 *
 * An entry only appears when its host passes the handler for it, so a surface
 * can never show a menu item that does nothing; management entries are also
 * hidden from people the API would refuse.
 */
export function buildChannelActions(
  options: BuildChannelActionsOptions,
): EntityAction[] {
  const {
    channel,
    workspaceSlug,
    canManage,
    hasUnread = false,
    isHidden = false,
    organizeActions = [],
    onOpen,
    onOpenSplitView,
    onOpenDetails,
    onToggleFavorite,
    onMarkRead,
    onMarkUnread,
    onSetNotificationLevel,
    onToggleHidden,
    onRename,
    onEditDetails,
    onAddPeople,
    onSetArchived,
    onLeave,
  } = options;

  const path = channelPath(workspaceSlug, channel);
  const isFavorite = channel.membership?.isFavorite ?? false;
  const level = channelNotificationLevel(channel.membership);
  const isMuted = level === 'nothing';
  const isGeneral = isGeneralChannel(channel);
  const isMember = !!channel.membership;

  const levelIcon: Record<ChannelNotificationLevel, EntityAction['icon']> = {
    all: Bell,
    mentions: AtSign,
    nothing: BellOff,
  };

  const actions: (EntityAction | false | undefined)[] = [
    !!onOpen && {
      id: 'open',
      group: 'open',
      label: 'Open channel',
      icon: channel.visibility === 'PRIVATE' ? Lock : Hash,
      run: onOpen,
    },
    !!onOpenSplitView && {
      id: 'split-view',
      group: 'open',
      label: 'Open in split view',
      icon: Columns2,
      run: onOpenSplitView,
    },
    {
      id: 'new-window',
      group: 'open',
      label: 'Open in new window',
      icon: ExternalLink,
      run: () => openChannelInNewWindow(workspaceSlug, channel),
    },

    hasUnread
      ? !!onMarkRead && {
          id: 'mark-read',
          group: 'state',
          label: 'Mark as read',
          icon: MailOpen,
          shortcut: 'R',
          run: onMarkRead,
        }
      : !!onMarkUnread && {
          id: 'mark-unread',
          group: 'state',
          label: 'Mark as unread',
          icon: Mail,
          shortcut: 'U',
          run: onMarkUnread,
          successMessage: `#${channel.name} marked as unread`,
        },
    !!onToggleFavorite &&
      isMember && {
        id: 'favorite',
        group: 'state',
        label: isFavorite ? 'Unstar channel' : 'Star channel',
        icon: Star,
        shortcut: 'F',
        run: onToggleFavorite,
      },

    !!onSetNotificationLevel &&
      isMember && {
        id: 'mute',
        group: 'notifications',
        label: isMuted ? 'Unmute channel' : 'Mute channel',
        icon: isMuted ? Bell : BellOff,
        shortcut: 'M',
        description: isMuted
          ? undefined
          : 'Hide unread activity. Mentions still notify you.',
        // Unmuting returns to whatever level sat under the mute.
        run: () =>
          onSetNotificationLevel(
            isMuted
              ? channel.membership?.mentionsOnly
                ? 'mentions'
                : 'all'
              : 'nothing',
          ),
      },
    !!onSetNotificationLevel &&
      isMember && {
        id: 'notifications',
        group: 'notifications',
        label: 'Notifications',
        icon: levelIcon[level],
        hint: CHANNEL_NOTIFICATION_LEVEL_LABELS[level],
        children: (['all', 'mentions', 'nothing'] as const).map(
          (value): EntityAction => ({
            id: `notify-${value}`,
            label: CHANNEL_NOTIFICATION_LEVEL_LABELS[value],
            icon: levelIcon[value],
            checked: level === value,
            run: () => onSetNotificationLevel(value),
          }),
        ),
      },
    !!onToggleHidden && {
      id: 'hide',
      group: 'notifications',
      label: isHidden ? 'Show in sidebar' : 'Hide from sidebar',
      icon: isHidden ? Eye : EyeOff,
      description: isHidden
        ? undefined
        : 'Moves it under Inactive. You stay a member.',
      run: onToggleHidden,
    },

    ...organizeActions,

    {
      id: 'copy',
      group: 'share',
      label: 'Copy',
      icon: Copy,
      children: [
        {
          id: 'copy-link',
          label: 'Copy link',
          icon: Link2,
          shortcut: 'C',
          run: () => copyToClipboard(entityUrl(path)),
        },
        {
          id: 'copy-name',
          label: 'Copy name',
          icon: Hash,
          run: () => copyToClipboard(`#${channel.name}`, 'Channel name'),
        },
        {
          id: 'copy-id',
          label: 'Copy channel ID',
          icon: Copy,
          run: () => copyToClipboard(channel.id, 'Channel ID'),
        },
      ],
    },

    !!onOpenDetails && {
      id: 'details',
      group: 'manage',
      label: 'Channel details',
      icon: Info,
      run: () => onOpenDetails('about'),
    },
    !!onRename && {
      id: 'rename',
      group: 'manage',
      label: 'Rename…',
      icon: Pencil,
      hidden: !canManage,
      run: onRename,
    },
    !!onEditDetails && {
      id: 'edit-details',
      group: 'manage',
      label: 'Edit channel details…',
      icon: Settings2,
      hidden: !canManage,
      run: onEditDetails,
    },
    !!onAddPeople && {
      id: 'add-people',
      group: 'manage',
      label: 'Add people…',
      icon: Users,
      hidden: !canManage,
      run: onAddPeople,
    },
    !!onOpenDetails &&
      isMember && {
        id: 'settings',
        group: 'manage',
        label: 'Channel settings…',
        icon: Settings,
        run: () => onOpenDetails('settings'),
      },

    !!onSetArchived && {
      id: 'archive',
      group: 'danger',
      label: channel.isArchived ? 'Unarchive channel…' : 'Archive channel…',
      icon: channel.isArchived ? ArchiveRestore : Archive,
      destructive: !channel.isArchived,
      hidden: !canManage || isGeneral,
      confirm: archiveChannelConfirm(channel, !channel.isArchived),
      run: () => onSetArchived(!channel.isArchived),
    },
    !!onLeave && {
      id: 'leave',
      group: 'danger',
      label: 'Leave channel…',
      icon: LogOut,
      destructive: true,
      hidden: !isMember || isGeneral,
      confirm: leaveChannelConfirm(channel),
      run: onLeave,
    },
  ];

  return actions.filter((action): action is EntityAction => !!action);
}
