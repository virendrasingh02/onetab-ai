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
  LogOut,
  Mail,
  MailOpen,
  Settings,
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
        id: 'notifications',
        group: 'notifications',
        label: 'Notifications',
        icon: levelIcon[level],
        hint: isMuted ? 'Muted' : CHANNEL_NOTIFICATION_LEVEL_LABELS[level],
        // Muting is the "nothing" level — one control, not a second menu item.
        // Picking an active level while muted is the unmute.
        children: (['all', 'mentions', 'nothing'] as const).map(
          (value): EntityAction => ({
            id: `notify-${value}`,
            label:
              value === 'nothing'
                ? 'Mute channel'
                : CHANNEL_NOTIFICATION_LEVEL_LABELS[value],
            description:
              value === 'nothing'
                ? 'Hide unread activity. Mentions still notify you.'
                : undefined,
            icon: levelIcon[value],
            shortcut: value === 'nothing' ? 'M' : undefined,
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

    // One entry: managers land in the editable dialog (name, topic,
    // description); everyone else gets the read-only about panel.
    (!!onOpenDetails || (canManage && (!!onEditDetails || !!onRename))) && {
      id: 'details',
      group: 'manage',
      label: canManage && (onEditDetails || onRename)
        ? 'Rename & edit details…'
        : 'Channel details',
      icon: Info,
      run:
        canManage && (onEditDetails || onRename)
          ? (onEditDetails ?? onRename)
          : () => onOpenDetails?.('about'),
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
