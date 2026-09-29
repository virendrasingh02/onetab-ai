import {
  ChannelTabPolicy,
  ChannelVisibility,
  canChangeChannelVisibility,
  canDeleteChannel,
  canManageChannelMembers,
  canManageChannelTabs,
  resolveChannelTabs,
  type ChannelSummary,
} from '@org/types';
import {
  AppSelect,
  Badge,
  Button,
  confirm,
  ScrollArea,
  Switch,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  Archive,
  ArchiveRestore,
  ChevronRight,
  Hash,
  Headphones,
  Link2,
  Lock,
  Megaphone,
  MessageSquare,
  PanelsTopLeft,
  Trash2,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import {
  useArchiveChannel,
  useChannelPreferences,
  useDeleteChannel,
  useSetChannelVisibility,
  useUpdateChannel,
} from '../use-channels.js';
import { CHANNEL_TAB_META } from './channel-tabs.js';

export interface ChannelSettingsTabProps {
  channel: ChannelSummary;
  workspaceId: string | undefined;
  workspaceSlug: string;
  onStartHuddle: () => void;
  /** Opens the channel's posting-permissions dialog. */
  onOpenPosting?: () => void;
  onCustomizeTabs: () => void;
  /** After a delete succeeds — the page navigates off the dead channel. */
  onDeleted: () => void;
}

/**
 * The channel's settings, in the details panel: huddles, the tab strip and who
 * may change it, the viewer's own member-suggestion switch, posting
 * permissions, and the visibility / archive / delete actions.
 *
 * Every control is shown to whoever can use it and read-only (or absent) for
 * everyone else, from the same `@org/types` rules the API enforces.
 */
export function ChannelSettingsTab({
  channel,
  workspaceId,
  workspaceSlug,
  onStartHuddle,
  onOpenPosting,
  onCustomizeTabs,
  onDeleted,
}: ChannelSettingsTabProps) {
  const { role: workspaceRole } = useCurrentWorkspace();
  const viewer = {
    channelRole: channel.membership?.role ?? null,
    workspaceRole: workspaceRole ?? null,
  };
  const canManage = canManageChannelMembers(viewer);
  const isMember = channel.membership !== null;

  return (
    <ScrollArea className="min-h-0 flex-1" contentClassName="space-y-3 p-3">
      <HuddlesCard
        channel={channel}
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
        canManage={canManage}
        isMember={isMember}
        onStartHuddle={onStartHuddle}
      />

      <TabsCard
        channel={channel}
        workspaceId={workspaceId}
        canManage={canManage}
        canCustomize={canManageChannelTabs(channel.tabManagePolicy, viewer)}
        onCustomizeTabs={onCustomizeTabs}
      />

      {isMember ? (
        <MemberSuggestionsCard channel={channel} workspaceId={workspaceId} />
      ) : null}

      {canManage && onOpenPosting ? (
        <SettingsCard>
          <button
            type="button"
            onClick={onOpenPosting}
            className="gap-3 p-3 flex w-full items-center rounded-card text-left outline-none transition-colors hover:bg-accent/50 focus-visible:ring-1 focus-visible:ring-ring"
          >
            <Megaphone
              className="size-4 shrink-0 self-start mt-0.5 text-muted-foreground"
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">
                Posting permissions
              </span>
              <span className="block text-xs text-muted-foreground">
                {channel.mode === 'ANNOUNCEMENT'
                  ? 'Announcement — only admins and named people can post.'
                  : 'Standard — every member can post.'}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </SettingsCard>
      ) : null}

      <DangerZone
        channel={channel}
        workspaceId={workspaceId}
        viewer={viewer}
        canManage={canManage}
        onDeleted={onDeleted}
      />
    </ScrollArea>
  );
}

/* --------------------------------------------------------------- pieces --- */

function SettingsCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-card border border-border bg-surface-inset/40',
        className,
      )}
    >
      {children}
    </section>
  );
}

function CardHeading({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="gap-2 flex min-h-5 items-center">
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <h3 className="min-w-0 flex-1 text-sm font-semibold text-foreground">
          {title}
        </h3>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- huddles --- */

function HuddlesCard({
  channel,
  workspaceId,
  workspaceSlug,
  canManage,
  isMember,
  onStartHuddle,
}: {
  channel: ChannelSummary;
  workspaceId: string | undefined;
  workspaceSlug: string;
  canManage: boolean;
  isMember: boolean;
  onStartHuddle: () => void;
}) {
  const update = useUpdateChannel(workspaceId);
  // Reflect the switch immediately rather than after the refetch lands.
  const enabled =
    update.isPending && update.variables?.input.huddlesEnabled !== undefined
      ? update.variables.input.huddlesEnabled
      : channel.huddlesEnabled;

  const setEnabled = (next: boolean) =>
    update.mutate(
      { channelId: channel.id, input: { huddlesEnabled: next } },
      {
        onSuccess: () =>
          toast.success(next ? 'Huddles turned on' : 'Huddles turned off'),
        onError: () => toast.error('Could not update huddle settings.'),
      },
    );

  const copyLink = () => {
    const url = `${window.location.origin}/w/${workspaceSlug}/c/${channel.slug}?huddle=join`;
    void navigator.clipboard?.writeText(url);
    toast.success('Huddle link copied', {
      description: 'Anyone in the channel who opens it joins the huddle.',
    });
  };

  return (
    <SettingsCard className="p-3 space-y-3">
      <CardHeading
        icon={Headphones}
        title="Huddles"
        description={
          enabled
            ? 'Members can start and join huddles in this channel.'
            : 'Huddles are turned off in this channel.'
        }
        action={
          canManage ? (
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              disabled={update.isPending}
              aria-label="Allow huddles in this channel"
            />
          ) : null
        }
      />

      {enabled && isMember ? (
        <div className="gap-2 flex flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onStartHuddle}
            className="h-7 gap-1.5 text-xs"
          >
            <Headphones className="size-3.5" />
            Start huddle
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copyLink}
            className="h-7 gap-1.5 text-xs"
          >
            <Link2 className="size-3.5" />
            Copy huddle link
          </Button>
        </div>
      ) : null}
    </SettingsCard>
  );
}

/* ----------------------------------------------------------------- tabs --- */

const TAB_POLICY_OPTIONS = [
  {
    value: ChannelTabPolicy.EVERYONE,
    label: 'Everyone in the channel',
  },
  {
    value: ChannelTabPolicy.MANAGERS,
    label: 'Channel managers only',
  },
];

function TabsCard({
  channel,
  workspaceId,
  canManage,
  canCustomize,
  onCustomizeTabs,
}: {
  channel: ChannelSummary;
  workspaceId: string | undefined;
  canManage: boolean;
  canCustomize: boolean;
  onCustomizeTabs: () => void;
}) {
  const update = useUpdateChannel(workspaceId);
  const policy =
    update.isPending && update.variables?.input.tabManagePolicy
      ? update.variables.input.tabManagePolicy
      : channel.tabManagePolicy;
  const tabs = resolveChannelTabs(channel.tabOrder, channel.hiddenTabs);
  const hiddenCount = tabs.filter((tab) => tab.hidden).length;

  return (
    <SettingsCard className="p-3 space-y-3">
      <CardHeading
        icon={PanelsTopLeft}
        title="Tabs"
        description="Choose who can add, remove and reorder this channel’s tabs."
      />

      <div className="space-y-2.5">
        <AppSelect
          size="sm"
          value={policy}
          onValueChange={(value) =>
            update.mutate(
              {
                channelId: channel.id,
                input: { tabManagePolicy: value as ChannelTabPolicy },
              },
              { onError: () => toast.error('Could not update tab permissions.') },
            )
          }
          options={TAB_POLICY_OPTIONS}
          disabled={!canManage || update.isPending}
          aria-label="Who can add, remove and reorder tabs"
        />

        {/* The strip as members see it, in order. */}
        <div className="gap-1 flex flex-wrap items-center">
          <Badge variant="outline" className="gap-1 text-[11px] font-medium">
            <MessageSquare className="size-3" />
            Messages
          </Badge>
          {tabs
            .filter((tab) => !tab.hidden)
            .map((tab) => {
              const meta = CHANNEL_TAB_META[tab.id];
              const Icon = meta.icon;
              return (
                <Badge
                  key={tab.id}
                  variant="outline"
                  className="gap-1 text-[11px] font-medium"
                >
                  <Icon className="size-3" />
                  {meta.label}
                </Badge>
              );
            })}
          {hiddenCount > 0 ? (
            <span className="text-[11px] text-muted-foreground">
              · {hiddenCount} hidden
            </span>
          ) : null}
        </div>

        {canCustomize ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCustomizeTabs}
            className="h-7 gap-1.5 text-xs"
          >
            <PanelsTopLeft className="size-3.5" />
            Customize tabs
          </Button>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Only channel managers can change the tabs here.
          </p>
        )}
      </div>
    </SettingsCard>
  );
}

/* --------------------------------------------------- member suggestions --- */

function MemberSuggestionsCard({
  channel,
  workspaceId,
}: {
  channel: ChannelSummary;
  workspaceId: string | undefined;
}) {
  const preferences = useChannelPreferences(workspaceId);
  const enabled =
    preferences.isPending &&
    preferences.variables?.input.memberSuggestions !== undefined
      ? preferences.variables.input.memberSuggestions
      : (channel.membership?.memberSuggestions ?? true);

  return (
    <SettingsCard className="p-3">
      <CardHeading
        icon={UserPlus}
        title="Channel member suggestions"
        description="Get suggestions to add people who aren’t in the channel when you @mention them. Only affects you."
        action={
          <Switch
            checked={enabled}
            onCheckedChange={(next) =>
              preferences.mutate({
                channelId: channel.id,
                input: { memberSuggestions: next },
              })
            }
            aria-label="Channel member suggestions"
          />
        }
      />
    </SettingsCard>
  );
}

/* ----------------------------------------------------------- danger zone --- */

function DangerZone({
  channel,
  workspaceId,
  viewer,
  canManage,
  onDeleted,
}: {
  channel: ChannelSummary;
  workspaceId: string | undefined;
  viewer: Parameters<typeof canDeleteChannel>[0];
  canManage: boolean;
  onDeleted: () => void;
}) {
  const visibility = useSetChannelVisibility(workspaceId);
  const archive = useArchiveChannel(workspaceId);
  const remove = useDeleteChannel(workspaceId);

  const isGeneral = channel.slug === 'general';
  const isPrivate = channel.visibility === ChannelVisibility.PRIVATE;
  const target = isPrivate ? ChannelVisibility.PUBLIC : ChannelVisibility.PRIVATE;
  const canSwitchVisibility =
    !isGeneral && canChangeChannelVisibility(target, viewer);
  const canArchive = canManage && !isGeneral;
  const canDelete = !isGeneral && canDeleteChannel(viewer);

  if (!canSwitchVisibility && !canArchive && !canDelete) return null;

  const switchVisibility = async () => {
    const ok = await confirm(
      target === ChannelVisibility.PUBLIC
        ? {
            title: `Make #${channel.name} public?`,
            description:
              'Everyone in the workspace will be able to find and join it, and read its entire history — including everything posted while it was private.',
            confirmLabel: 'Make public',
            requireText: channel.name,
          }
        : {
            title: `Make #${channel.name} private?`,
            description:
              'Only current members will see it. People who aren’t members won’t be able to find or join it unless they’re added. A workspace admin can make it public again.',
            confirmLabel: 'Make private',
          },
    );
    if (ok) visibility.mutate({ channelId: channel.id, visibility: target });
  };

  const toggleArchive = async () => {
    if (channel.isArchived) {
      archive.mutate({ channelId: channel.id, archived: false });
      return;
    }
    const ok = await confirm({
      title: `Archive #${channel.name} for everyone?`,
      description:
        'The channel becomes read-only and leaves everyone’s sidebar. Its history is kept, and it can be unarchived later.',
      confirmLabel: 'Archive channel',
      destructive: true,
    });
    if (ok) archive.mutate({ channelId: channel.id, archived: true });
  };

  const deleteChannel = async () => {
    const ok = await confirm({
      title: `Delete #${channel.name}?`,
      description:
        'This permanently deletes the channel and its messages for everyone. It can’t be undone.',
      body: (
        <p className="text-xs text-muted-foreground">
          Files shared here stay in the workspace’s Files. To keep the history
          instead, archive the channel.
        </p>
      ),
      confirmLabel: 'Delete channel',
      destructive: true,
      requireText: channel.name,
    });
    if (!ok) return;
    remove.mutate(channel.id, {
      onSuccess: () => {
        toast.success(`#${channel.name} was deleted`);
        onDeleted();
      },
    });
  };

  return (
    <SettingsCard className="divide-y divide-border overflow-hidden">
      {canSwitchVisibility ? (
        <DangerRow
          icon={isPrivate ? Hash : Lock}
          label={isPrivate ? 'Change to a public channel' : 'Change to a private channel'}
          onClick={() => void switchVisibility()}
          disabled={visibility.isPending}
        />
      ) : null}
      {canArchive ? (
        <DangerRow
          icon={channel.isArchived ? ArchiveRestore : Archive}
          label={
            channel.isArchived ? 'Unarchive channel' : 'Archive channel for everyone'
          }
          tone={channel.isArchived ? 'default' : 'destructive'}
          onClick={() => void toggleArchive()}
          disabled={archive.isPending}
        />
      ) : null}
      {canDelete ? (
        <DangerRow
          icon={Trash2}
          label="Delete this channel"
          tone="destructive"
          onClick={() => void deleteChannel()}
          disabled={remove.isPending}
        />
      ) : null}
    </SettingsCard>
  );
}

function DangerRow({
  icon: Icon,
  label,
  tone = 'default',
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  tone?: 'default' | 'destructive';
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'gap-3 px-3 py-2.5 flex w-full items-center text-left text-sm font-medium outline-none transition-colors focus-visible:bg-accent/60 disabled:opacity-60',
        tone === 'destructive'
          ? 'text-destructive hover:bg-destructive/10'
          : 'text-foreground hover:bg-accent/50',
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {label}
    </button>
  );
}
