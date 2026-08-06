import {
  Badge,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Hint,
  Progress,
  ScrollArea,
  SkeletonList,
} from '@org/ui';
import type { ChannelSummary } from '@org/types';
import { cn } from '@org/utils';
import { useChannelPreferences, useGroupedChannels } from '@org/web-channels';
import {
  Activity,
  ChevronDown,
  ChevronRight,
  Hash,
  Home,
  Lock,
  MessageSquare,
  MessagesSquare,
  Plus,
  Star,
  Users,
  Video,
  CheckSquare,
  FileText,
  Layout,
  Calendar,
  HardDrive,
  Sparkles,
  BookOpen,
  Image,
  Bot,
  Workflow,
  BarChart3,
  Bell,
  UserPlus,
  Clock,
  Inbox,
  Send,
  Share2,
  UploadCloud,
  FileSpreadsheet,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

interface NavEntry {
  path: string;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
  end?: boolean;
}

// Most Used / Essential Nav Items (Shown directly)
const MOST_USED_LINKS: readonly NavEntry[] = [
  { path: '', label: 'Home', icon: Home, end: true },
  { path: 'inbox', label: 'Inbox', icon: Inbox },
  { path: 'threads', label: 'Threads', icon: MessagesSquare },
  { path: 'meetings', label: 'Huddles & Calls', icon: Video },
  { path: 'dms', label: 'Direct Messages', icon: MessageSquare },
  { path: 'pulse', label: 'Pulse', icon: Activity },
];

// Secondary Nav Items (Collapsible inside 'More options')
const SECONDARY_LINKS: readonly NavEntry[] = [
  { path: 'schedule', label: 'Schedule', icon: Clock },
  { path: 'directory', label: 'Directories', icon: Users },
  { path: 'files', label: 'Files', icon: HardDrive },
];

const WORK_TOOL_LINKS: readonly NavEntry[] = [
  { path: 'tasks', label: 'Tasks', icon: CheckSquare },
  { path: 'notes', label: 'Notes', icon: FileText },
];

const AI_PLATFORM_LINKS: readonly NavEntry[] = [
  { path: 'ai-chat', label: 'AI Workspace Chat', icon: Sparkles },
];

const AGENTS_LINKS: readonly NavEntry[] = [
  { path: 'agents', label: 'Agent Marketplace', icon: Bot, end: true },
  { path: 'agents/builder', label: 'Agent Builder', icon: Bot },
  { path: 'agents/logs', label: 'Agent Monitoring', icon: HardDrive },
];

const APPS_LINKS: readonly NavEntry[] = [
  { path: 'integrations', label: 'Apps Catalog', icon: Share2, end: true },
  { path: 'import-export', label: 'Import Export', icon: UploadCloud },
];

const AUTOMATION_LINKS: readonly NavEntry[] = [
  { path: 'automations', label: 'All Workflows', icon: Workflow, end: true },
  { path: 'automations/builder', label: 'Workflow Builder', icon: Workflow },
  { path: 'automations/logs', label: 'Execution Logs', icon: HardDrive },
];

/**
 * One nav row. The active indicator is a 2px pseudo-element rather than a real
 * border so switching rows never reflows the list by a pixel.
 */
function navRowClass(isActive: boolean, extra?: string) {
  return cn(
    'group relative flex items-center gap-2.5 rounded-btn py-1.5 pr-2 pl-3 text-[13px]',
    'transition-colors duration-(--duration-fast) ease-standard',
    'outline-none focus-visible:ring-1 focus-visible:ring-ring',
    'before:absolute before:top-1/2 before:left-0 before:h-4 before:w-0.5',
    'before:-translate-y-1/2 before:rounded-full before:bg-primary',
    'before:transition-opacity before:duration-(--duration-fast)',
    isActive
      ? 'bg-selected font-medium text-foreground before:opacity-100'
      : 'text-muted-foreground hover:bg-accent hover:text-foreground before:opacity-0',
    extra,
  );
}

function NavRow({
  entry,
  workspaceSlug,
}: {
  entry: NavEntry;
  workspaceSlug: string;
}) {
  const Icon = entry.icon;
  const to = entry.path
    ? `/w/${workspaceSlug}/${entry.path}`
    : `/w/${workspaceSlug}`;

  return (
    <NavLink
      to={to}
      end={entry.end}
      className={({ isActive }) => navRowClass(isActive)}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="flex-1 truncate">{entry.label}</span>
      {entry.badge ? (
        <Badge variant="count" aria-label={`${entry.badge} unread`}>
          {entry.badge}
        </Badge>
      ) : null}
    </NavLink>
  );
}

interface SectionProps {
  title: string;
  count?: number;
  children: ReactNode;
  action?: ReactNode;
  defaultOpen?: boolean;
}

function Section({
  title,
  count,
  children,
  action,
  defaultOpen = true,
}: SectionProps) {
  if (count === 0) return null;

  return (
    <Collapsible defaultOpen={defaultOpen} className="mt-3 mb-1" asChild>
      <section>
        <div className="group flex select-none items-center gap-1.5 px-3 py-1">
          <CollapsibleTrigger
            className={cn(
              'group/trigger flex flex-1 items-center gap-1.5 rounded-md',
              'text-[11px] font-medium tracking-wide text-subtle uppercase',
              'transition-colors duration-(--duration-fast) hover:text-muted-foreground',
              'outline-none focus-visible:ring-1 focus-visible:ring-ring',
            )}
          >
            <ChevronDown
              className="size-3.5 shrink-0 transition-transform duration-(--duration-fast) group-data-[state=closed]/trigger:-rotate-90"
              aria-hidden
            />
            <span>{title}</span>
            {count === undefined ? null : (
              <span className="text-subtle tabular-nums">{count}</span>
            )}
          </CollapsibleTrigger>
          {action}
        </div>

        <CollapsibleContent>
          <ul className="mt-0.5 space-y-0.5 px-1">{children}</ul>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}

function LinkSection({
  title,
  links,
  workspaceSlug,
  defaultOpen = true,
}: {
  title: string;
  links: readonly NavEntry[];
  workspaceSlug: string;
  defaultOpen?: boolean;
}) {
  return (
    <Section title={title} defaultOpen={defaultOpen}>
      {links.map((entry) => (
        <li key={entry.label}>
          <NavRow entry={entry} workspaceSlug={workspaceSlug} />
        </li>
      ))}
    </Section>
  );
}

interface ChannelRowProps {
  channel: ChannelSummary;
  workspaceSlug: string;
  onToggleFavorite: (channel: ChannelSummary) => void;
}

function ChannelRow({
  channel,
  workspaceSlug,
  onToggleFavorite,
}: ChannelRowProps) {
  const isFavorite = channel.membership?.isFavorite ?? false;
  const Icon = channel.visibility === 'PRIVATE' ? Lock : Hash;

  return (
    <li className="group/row relative">
      <NavLink
        to={`/w/${workspaceSlug}/c/${channel.slug}`}
        className={({ isActive }) =>
          navRowClass(isActive, cn('pr-8', channel.isArchived && 'opacity-65'))
        }
      >
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className="truncate">{channel.name}</span>
      </NavLink>

      {channel.membership ? (
        <Hint label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onToggleFavorite(channel)}
            aria-label={
              isFavorite ? 'Remove from favorites' : 'Add to favorites'
            }
            aria-pressed={isFavorite}
            className={cn(
              'absolute top-1/2 right-1.5 size-5 -translate-y-1/2 p-0',
              isFavorite
                ? 'text-warning opacity-100'
                : 'opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100',
            )}
          >
            <Star className={cn('size-3.5', isFavorite && 'fill-current')} />
          </Button>
        </Hint>
      ) : null}
    </li>
  );
}

export interface ChannelNavProps {
  workspaceId: string;
  workspaceSlug: string;
  channels: ChannelSummary[] | undefined;
  isLoading: boolean;
  onCreateChannel: () => void;
  onBrowseChannels: () => void;
}

export function ChannelNav({
  workspaceId,
  workspaceSlug,
  channels,
  isLoading,
  onCreateChannel,
  onBrowseChannels,
}: ChannelNavProps) {
  const groups = useGroupedChannels(channels);
  const preferences = useChannelPreferences(workspaceId);

  const toggleFavorite = (channel: ChannelSummary) =>
    preferences.mutate({
      channelId: channel.id,
      input: { isFavorite: !channel.membership?.isFavorite },
    });

  if (isLoading) {
    return (
      <div className="px-3 py-2">
        <SkeletonList rows={6} className="gap-2" />
      </div>
    );
  }

  const rowProps = { workspaceSlug, onToggleFavorite: toggleFavorite };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ScrollArea className="scrollbar-subtle flex-1 px-2 pt-2">
        <div className="pb-4">
          {/* Primary Nav Links (Most Used) */}
          <nav aria-label="Primary navigation" className="space-y-0.5">
            {MOST_USED_LINKS.map((entry) => (
              <NavRow
                key={entry.label}
                entry={entry}
                workspaceSlug={workspaceSlug}
              />
            ))}

            {/* More Options Dropdown Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    'group flex w-full items-center gap-2.5 rounded-btn py-1.5 pr-2 pl-3 text-[13px]',
                    'text-muted-foreground transition-colors duration-(--duration-fast) ease-standard',
                    'hover:bg-accent hover:text-foreground',
                    'outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  )}
                  aria-label="More options menu"
                >
                  <MoreHorizontal className="size-4 shrink-0" aria-hidden />
                  <span className="flex-1 truncate text-left">
                    More options
                  </span>
                  <ChevronRight
                    className="size-3.5 text-subtle transition-transform duration-(--duration-fast) group-data-[state=open]:rotate-90"
                    aria-hidden
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                side="right"
                sideOffset={8}
                className="w-56 p-1.5"
              >
                {SECONDARY_LINKS.map((entry) => {
                  const Icon = entry.icon;
                  const to = entry.path
                    ? `/w/${workspaceSlug}/${entry.path}`
                    : `/w/${workspaceSlug}`;
                  return (
                    <DropdownMenuItem
                      key={entry.label}
                      asChild
                      className="text-xs flex items-center gap-2.5 cursor-pointer py-1.5"
                    >
                      <NavLink to={to} end={entry.end}>
                        <Icon className="size-4 text-muted-foreground shrink-0" aria-hidden />
                        <span className="flex-1 truncate">{entry.label}</span>
                      </NavLink>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          <div className="mt-3 border-t border-border pt-2">
            <Section
              title="Starred"
              count={groups.favorites.length}
              defaultOpen={true}
            >
              {groups.favorites.map((channel) => (
                <ChannelRow key={channel.id} channel={channel} {...rowProps} />
              ))}
            </Section>

            <Section
              title="Channels"
              count={groups.joined.length}
              defaultOpen={true}
              action={
                <Hint label="Create a channel">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={onCreateChannel}
                    aria-label="Create a channel"
                    className="size-5 p-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </Hint>
              }
            >
              {groups.joined.map((channel) => (
                <ChannelRow key={channel.id} channel={channel} {...rowProps} />
              ))}
            </Section>

            <LinkSection
              title="Work Tools"
              links={WORK_TOOL_LINKS}
              workspaceSlug={workspaceSlug}
              defaultOpen={true}
            />

            <LinkSection
              title="AI Platform"
              links={AI_PLATFORM_LINKS}
              workspaceSlug={workspaceSlug}
              defaultOpen={false}
            />

            <LinkSection
              title="Agent Marketplace"
              links={AGENTS_LINKS}
              workspaceSlug={workspaceSlug}
              defaultOpen={false}
            />

            <LinkSection
              title="Apps & Integrations"
              links={APPS_LINKS}
              workspaceSlug={workspaceSlug}
              defaultOpen={false}
            />

            <LinkSection
              title="Automations"
              links={AUTOMATION_LINKS}
              workspaceSlug={workspaceSlug}
              defaultOpen={false}
            />
          </div>
        </div>
      </ScrollArea>

      {/* Sidebar Footer Section */}
      <div className="shrink-0 space-y-1 border-t border-border p-2">
        {/*
          The meter sits beside the button rather than inside it: `<button>`
          only admits phrasing content, and Progress renders a div.
        */}
        <div className="px-3 py-2">
          <button
            onClick={onBrowseChannels}
            className={cn(
              'flex w-full items-center justify-between gap-2 text-xs',
              'text-muted-foreground transition-colors duration-(--duration-fast) ease-standard',
              'hover:text-foreground',
              'outline-none focus-visible:ring-1 focus-visible:ring-ring',
            )}
          >
            <span>Getting started</span>
            <span className="text-subtle tabular-nums">2/6</span>
          </button>
          {/*
            The default `surface-inset` track is the same value as the sidebar
            background, so the trough needs a visible fill of its own here.
          */}
          <Progress
            value={33}
            size="sm"
            label="Getting started"
            className="mt-2 bg-border"
          />
        </div>

        <button
          onClick={onBrowseChannels}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-btn px-3 py-1.5 text-xs',
            'text-muted-foreground transition-colors duration-(--duration-fast) ease-standard',
            'hover:bg-accent hover:text-foreground',
            'outline-none focus-visible:ring-1 focus-visible:ring-ring',
          )}
        >
          <UserPlus className="size-4 shrink-0" aria-hidden />
          <span>Invite team members</span>
        </button>

        <div className="flex items-center justify-between gap-2 px-3 pt-1">
          <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-subtle">
            <Clock className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">5 days left on trial</span>
          </span>
          <Button size="sm" className="shrink-0">
            Keep Pro
          </Button>
        </div>
      </div>
    </div>
  );
}
