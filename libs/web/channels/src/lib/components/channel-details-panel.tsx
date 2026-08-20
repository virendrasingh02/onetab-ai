import type { ChannelMember, ChannelSummary } from '@org/types';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Hint,
  Input,
  ScrollArea,
  SkeletonList,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
  UserAvatar,
  usePromptDialog,
} from '@org/ui';
import { cn, formatDate } from '@org/utils';
import {
  Bell,
  BellOff,
  Blocks,
  ChevronDown,
  Copy,
  Hash,
  Headphones,
  Info,
  Link2,
  Lock,
  LogOut,
  Plus,
  Search,
  Settings,
  Star,
  Workflow,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useArchiveChannel,
  useChannelMemberMutations,
  useChannelMembers,
  useChannelPreferences,
} from '../use-channels.js';

export interface ChannelDetailsPanelProps {
  channel: ChannelSummary;
  /** Undefined only while the workspace is still resolving, as everywhere else. */
  workspaceId: string | undefined;
  workspaceSlug: string;
  currentUserId: string;
  /** Name of whoever created the channel, when they are still a member. */
  createdByName?: string;
  initialTab?: 'about' | 'members' | 'apps' | 'automations';
  onClose: () => void;
  onEditDetails: () => void;
  onAddPeople: () => void;
  onStartHuddle: () => void;
}

/**
 * Everything about a channel that is not its messages, in the right rail.
 *
 * This replaced a full-width "About" tab inside the channel, which showed four
 * fields and hid the conversation to do it. Here the same information sits
 * *beside* the conversation, and there is room for the things that were
 * previously scattered across a header dropdown — membership, notification
 * level, leaving, archiving.
 */
export function ChannelDetailsPanel({
  channel,
  workspaceId,
  workspaceSlug,
  currentUserId,
  createdByName,
  initialTab = 'about',
  onClose,
  onEditDetails,
  onAddPeople,
  onStartHuddle,
}: ChannelDetailsPanelProps) {
  const members = useChannelMembers(workspaceId, channel.id);
  const memberList = members.data ?? [];

  /*
   * Settings is a mode, not a tab. It is administration — archive, rename,
   * leave — which has nothing in common with the four tabs that describe the
   * channel, and putting it fifth in that row implied it did. It gets a toggle
   * beside the close button instead, the way a settings affordance usually sits.
   */
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'about' | 'members' | 'apps' | 'automations'
  >(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
    setShowSettings(false);
  }, [initialTab]);

  const ChannelIcon = channel.visibility === 'PRIVATE' ? Lock : Hash;

  return (
    <div className="min-h-0 flex h-full flex-col bg-surface text-foreground">
      <div className="px-3 pt-3 pb-2 gap-1 flex shrink-0 items-start justify-between">
        <h2 className="min-w-0 gap-1.5 text-base font-semibold tracking-tight flex flex-1 items-center">
          <ChannelIcon
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <span className="truncate">{channel.name}</span>
        </h2>

        <Hint
          label={showSettings ? 'Back to channel details' : 'Channel settings'}
        >
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowSettings((open) => !open)}
            aria-label="Channel settings"
            aria-pressed={showSettings}
            className={cn(
              '-mt-0.5 shrink-0',
              showSettings && 'bg-accent text-foreground',
            )}
          >
            <Settings className="size-4" />
          </Button>
        </Hint>

        <Hint label="Close panel">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close panel"
            className="-mt-0.5 shrink-0"
          >
            <X className="size-4" />
          </Button>
        </Hint>
      </div>

      <div className="px-3 pb-2.5 gap-1.5 flex shrink-0 flex-wrap items-center">
        <FavoriteMenu channel={channel} workspaceId={workspaceId} />
        <NotificationMenu
          channel={channel}
          workspaceId={workspaceId}
          workspaceSlug={workspaceSlug}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={onStartHuddle}
          className="h-7 gap-1.5 text-xs"
        >
          <Headphones className="size-3.5" />
          <span>Huddle</span>
        </Button>
      </div>

      {showSettings ? (
        <SettingsTab
          channel={channel}
          workspaceId={workspaceId}
          currentUserId={currentUserId}
          onEditDetails={onEditDetails}
        />
      ) : (
        <Tabs
          value={activeTab}
          onValueChange={(val) =>
            setActiveTab(
              val as 'about' | 'members' | 'apps' | 'automations',
            )
          }
          className="min-h-0 flex flex-1 flex-col"
        >
          <div className="px-3 shrink-0 scrollbar-none overflow-x-auto border-b border-border">
            <TabsList>
              <TabsTrigger value="about">About</TabsTrigger>
              <TabsTrigger value="members" className="gap-1.5">
                Members
                <span className="text-muted-foreground">
                  {memberList.length || channel.memberCount}
                </span>
              </TabsTrigger>
              <TabsTrigger value="apps">Agents &amp; apps</TabsTrigger>
              <TabsTrigger value="automations">Automations</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="about" className="min-h-0 flex flex-1 flex-col">
            <AboutTab
              channel={channel}
              workspaceId={workspaceId}
              currentUserId={currentUserId}
              createdByName={createdByName}
              onEditDetails={onEditDetails}
            />
          </TabsContent>

          <TabsContent value="members" className="min-h-0 flex flex-1 flex-col">
            <MembersTab
              members={memberList}
              isLoading={members.isLoading}
              onAddPeople={onAddPeople}
            />
          </TabsContent>

          <TabsContent value="apps" className="min-h-0 flex flex-1 flex-col">
            <LinkOutTab
              icon={Blocks}
              title="No agents or apps here yet"
              description="Agents and connected apps are set up for the whole workspace, then brought into a channel."
              actionLabel="Browse agents & apps"
              to={`/w/${workspaceSlug}/agents`}
            />
          </TabsContent>

          <TabsContent
            value="automations"
            className="min-h-0 flex flex-1 flex-col"
          >
            <LinkOutTab
              icon={Workflow}
              title="No automations here yet"
              description="Workflows run across the workspace. Build one and point its trigger at this channel."
              actionLabel="Open automations"
              to={`/w/${workspaceSlug}/automations`}
            />
          </TabsContent>
        </Tabs>
      )}

      <ChannelIdFooter channelId={channel.id} />
    </div>
  );
}

/* ----------------------------------------------------------- header bits --- */

function FavoriteMenu({
  channel,
  workspaceId,
}: {
  channel: ChannelSummary;
  workspaceId: string | undefined;
}) {
  const preferences = useChannelPreferences(workspaceId);
  const isFavorite = channel.membership?.isFavorite ?? false;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label="Favorite options"
          className="h-7 gap-1 px-2 text-xs"
        >
          <Star
            className={cn(
              'size-3.5',
              isFavorite && 'fill-current text-accent-amber',
            )}
          />
          <ChevronDown className="size-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem
          className="gap-2 text-xs"
          onSelect={() =>
            preferences.mutate({
              channelId: channel.id,
              input: { isFavorite: !isFavorite },
            })
          }
        >
          <Star
            className={cn(
              'size-3.5',
              isFavorite && 'fill-current text-accent-amber',
            )}
          />
          <span>
            {isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The channel's notification level.
 *
 * Two levels, not three. Slack's middle option — "just @mentions" for this one
 * channel — has nothing behind it here: mentions-only is a *workspace* setting
 * in our notification preferences, and a per-channel version would need a
 * column that does not exist. Offering it would have meant a control that
 * silently did nothing, so the menu links to the real setting instead.
 */
function NotificationMenu({
  channel,
  workspaceId,
  workspaceSlug,
}: {
  channel: ChannelSummary;
  workspaceId: string | undefined;
  workspaceSlug: string;
}) {
  const preferences = useChannelPreferences(workspaceId);
  const isMuted = channel.membership?.isMuted ?? false;

  const setMuted = (muted: boolean) =>
    preferences.mutate({ channelId: channel.id, input: { isMuted: muted } });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
        >
          {isMuted ? (
            <BellOff className="size-3.5 text-muted-foreground" />
          ) : (
            <Bell className="size-3.5" />
          )}
          <span>{isMuted ? 'Muted' : 'All new messages'}</span>
          <ChevronDown className="size-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="tracking-wide text-[11px] text-subtle uppercase">
          Notify me about
        </DropdownMenuLabel>

        <DropdownMenuCheckboxItem
          checked={!isMuted}
          onSelect={() => setMuted(false)}
          className="text-xs"
        >
          All new messages
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={isMuted}
          onSelect={() => setMuted(true)}
          className="text-xs"
        >
          Nothing
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="gap-2 text-xs">
          <Link to={`/w/${workspaceSlug}/settings`}>
            <Settings className="size-3.5" />
            <span>Notification preferences</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ----------------------------------------------------------------- about --- */

function AboutTab({
  channel,
  workspaceId,
  currentUserId,
  createdByName,
  onEditDetails,
}: {
  channel: ChannelSummary;
  workspaceId: string | undefined;
  currentUserId: string;
  createdByName?: string;
  onEditDetails: () => void;
}) {
  return (
    <ScrollArea className="min-h-0 flex-1" contentClassName="space-y-3 p-3">
      {/* One bordered card of divided rows, so the fields read as one object
          rather than five loose paragraphs in a narrow column. */}
      <div className="divide-y divide-border rounded-card border border-border bg-surface-inset/40">
        <DetailRow label="Topic" onEdit={onEditDetails}>
          {channel.topic ? (
            <LinkifiedText text={channel.topic} />
          ) : (
            <span className="text-muted-foreground">Add a topic</span>
          )}
        </DetailRow>

        <DetailRow label="Description" onEdit={onEditDetails}>
          {channel.description ? (
            <LinkifiedText text={channel.description} />
          ) : (
            <span className="text-muted-foreground">Add a description</span>
          )}
        </DetailRow>

        <DetailRow
          label="Managed by"
          hint="Channel managers can rename the channel, edit its details and archive it."
        >
          <span className="text-muted-foreground">
            Got questions? Ask an Admin to add a Channel Manager to help things
            run smoothly.
          </span>
        </DetailRow>

        <DetailRow label="Created by">
          {createdByName ? `${createdByName} on ` : 'Created on '}
          {formatDate(channel.createdAt)}
        </DetailRow>

        <div className="p-3">
          <LeaveChannelButton
            channel={channel}
            workspaceId={workspaceId}
            currentUserId={currentUserId}
          />
        </div>
      </div>
    </ScrollArea>
  );
}

function DetailRow({
  label,
  hint,
  onEdit,
  children,
}: {
  label: string;
  hint?: string;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="p-3 space-y-1">
      <div className="gap-2 flex items-center justify-between">
        <span className="gap-1 text-sm font-semibold flex items-center text-foreground">
          {label}
          {hint ? (
            <Hint label={hint}>
              <Info className="size-3.5 text-muted-foreground" aria-hidden />
            </Hint>
          ) : null}
        </span>

        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="text-xs font-medium rounded-sm text-primary outline-none hover:underline focus-visible:ring-1 focus-visible:ring-ring"
          >
            Edit
          </button>
        ) : null}
      </div>

      <p className="text-sm leading-relaxed break-words text-foreground">
        {children}
      </p>
    </div>
  );
}

/**
 * Renders a field that is often just a pasted URL — a meeting link in the
 * topic, most commonly — as a link rather than as unclickable text.
 */
function LinkifiedText({ text }: { text: string }) {
  const parts = useMemo(() => text.split(/(https?:\/\/\S+)/g), [text]);

  return (
    <>
      {parts.map((part, index) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-primary hover:underline"
          >
            {part}
          </a>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

function LeaveChannelButton({
  channel,
  workspaceId,
  currentUserId,
}: {
  channel: ChannelSummary;
  workspaceId: string | undefined;
  currentUserId: string;
}) {
  const { remove } = useChannelMemberMutations(workspaceId);
  const prompts = usePromptDialog();

  if (!channel.membership) return null;

  const leave = async () => {
    const confirmed = await prompts.confirmAction({
      title: `Leave #${channel.name}?`,
      description:
        'You will stop receiving messages from this channel. You can rejoin later if it is public.',
      confirmLabel: 'Leave channel',
      destructive: true,
    });
    if (!confirmed) return;

    remove.mutate(
      { channelId: channel.id, userId: currentUserId },
      {
        onSuccess: () => toast.success(`Left #${channel.name}`),
        onError: () => toast.error('Could not leave the channel.'),
      },
    );
  };

  return (
    <button
      type="button"
      onClick={() => void leave()}
      disabled={remove.isPending}
      className="text-sm font-medium rounded-sm text-destructive outline-none hover:underline focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60"
    >
      Leave channel
    </button>
  );
}

/* --------------------------------------------------------------- members --- */

function MembersTab({
  members,
  isLoading,
  onAddPeople,
}: {
  members: ChannelMember[];
  isLoading: boolean;
  onAddPeople: () => void;
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((member) =>
      (member.user.displayName ?? member.user.name)
        .toLowerCase()
        .includes(needle),
    );
  }, [members, query]);

  return (
    <div className="min-h-0 flex flex-1 flex-col">
      <div className="p-3 gap-2 space-y-2 shrink-0">
        <div className="relative">
          <Search className="size-3.5 left-2.5 absolute top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find members"
            aria-label="Find members"
            className="h-8 pl-8 text-xs"
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onAddPeople}
          className="h-8 gap-1.5 text-xs w-full"
        >
          <Plus className="size-3.5" />
          <span>Add people</span>
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1" contentClassName="px-3 pb-3">
        {isLoading ? (
          <SkeletonList rows={5} />
        ) : filtered.length === 0 ? (
          <EmptyState
            size="sm"
            title={query ? 'No one matches' : 'No members yet'}
            description={
              query
                ? 'Try a different name.'
                : 'Add people so they can read and post here.'
            }
          />
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((member) => (
              <li
                key={member.id}
                className="gap-2.5 px-2 py-1.5 flex items-center rounded-btn hover:bg-accent/60"
              >
                <UserAvatar
                  name={member.user.displayName ?? member.user.name}
                  src={member.user.avatarUrl ?? undefined}
                  seed={member.user.id}
                  size="xs"
                />
                <span className="min-w-0 text-xs font-medium flex-1 truncate">
                  {member.user.displayName ?? member.user.name}
                </span>
                {member.role === 'ADMIN' ? (
                  <Badge variant="neutral" className="text-[10px]">
                    Admin
                  </Badge>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}

/* -------------------------------------------------------------- settings --- */

function SettingsTab({
  channel,
  workspaceId,
  currentUserId,
  onEditDetails,
}: {
  channel: ChannelSummary;
  workspaceId: string | undefined;
  currentUserId: string;
  onEditDetails: () => void;
}) {
  const archive = useArchiveChannel(workspaceId);
  const prompts = usePromptDialog();

  const toggleArchive = async () => {
    const confirmed = await prompts.confirmAction({
      title: channel.isArchived
        ? `Unarchive #${channel.name}?`
        : `Archive #${channel.name}?`,
      description: channel.isArchived
        ? 'The channel becomes active again and reappears in the sidebar.'
        : 'The channel becomes read-only and leaves the sidebar. Its history is kept.',
      confirmLabel: channel.isArchived ? 'Unarchive' : 'Archive',
      destructive: !channel.isArchived,
    });
    if (!confirmed) return;

    archive.mutate({ channelId: channel.id, archived: !channel.isArchived });
  };

  return (
    <ScrollArea className="min-h-0 flex-1" contentClassName="p-3 space-y-2">
      <SettingRow
        icon={Settings}
        label="Edit channel details"
        description="Name, topic and description"
        onClick={onEditDetails}
      />

      <SettingRow
        icon={Link2}
        label="Copy channel link"
        description="Share this channel with a teammate"
        onClick={() => {
          void navigator.clipboard?.writeText(window.location.href);
          toast.success('Link copied');
        }}
      />

      <SettingRow
        icon={channel.isArchived ? Bell : BellOff}
        label={channel.isArchived ? 'Unarchive channel' : 'Archive channel'}
        description={
          channel.isArchived
            ? 'Make the channel active again'
            : 'Keep the history, close the conversation'
        }
        onClick={() => void toggleArchive()}
      />

      <div className="pt-1">
        <LeaveChannelRow
          channel={channel}
          workspaceId={workspaceId}
          currentUserId={currentUserId}
        />
      </div>
    </ScrollArea>
  );
}

function SettingRow({
  icon: Icon,
  label,
  description,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'gap-2.5 p-2.5 flex w-full items-start rounded-card border border-border bg-surface-inset/40 text-left',
        'transition-colors duration-(--duration-fast) ease-standard hover:bg-accent/50',
        'outline-none focus-visible:ring-1 focus-visible:ring-ring',
      )}
    >
      <Icon
        className="size-4 mt-0.5 shrink-0 text-muted-foreground"
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="text-xs font-medium block text-foreground">
          {label}
        </span>
        <span className="block text-[11px] text-muted-foreground">
          {description}
        </span>
      </span>
    </button>
  );
}

function LeaveChannelRow({
  channel,
  workspaceId,
  currentUserId,
}: {
  channel: ChannelSummary;
  workspaceId: string | undefined;
  currentUserId: string;
}) {
  if (!channel.membership) return null;

  return (
    <div className="p-2.5 gap-2.5 flex items-start rounded-card border border-destructive/30 bg-destructive/5">
      <LogOut className="size-4 mt-0.5 shrink-0 text-destructive" aria-hidden />
      <div className="min-w-0 space-y-1 flex-1">
        <p className="text-xs font-medium text-foreground">
          Leave this channel
        </p>
        <LeaveChannelButton
          channel={channel}
          workspaceId={workspaceId}
          currentUserId={currentUserId}
        />
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- misc --- */

function LinkOutTab({
  icon: Icon,
  title,
  description,
  actionLabel,
  to,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
  to: string;
}) {
  return (
    <div className="p-4 grid flex-1 place-items-center">
      <EmptyState
        size="sm"
        icon={<Icon />}
        title={title}
        description={description}
        action={
          <Button asChild variant="outline" size="sm">
            <Link to={to}>{actionLabel}</Link>
          </Button>
        }
      />
    </div>
  );
}

function ChannelIdFooter({ channelId }: { channelId: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="px-3 py-2 shrink-0 border-t border-border">
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(channelId);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="gap-1.5 flex max-w-full items-center rounded-sm text-[11px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
      >
        <span className="truncate">Channel ID: {channelId}</span>
        <Copy className="size-3 shrink-0" aria-hidden />
        <span className="sr-only">
          {copied ? 'Channel ID copied' : 'Copy channel ID'}
        </span>
      </button>
    </div>
  );
}
