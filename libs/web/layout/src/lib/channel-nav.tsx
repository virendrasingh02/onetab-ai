import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Hint,
  ScrollArea,
  SkeletonList,
} from '@org/ui';
import type { ChannelSummary } from '@org/types';
import { cn } from '@org/utils';
import { useChannelPreferences, useGroupedChannels } from '@org/web-channels';
import {
  ChevronDown,
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
  Activity,
  Sparkles,
  BookOpen,
  Image,
  Bot,
  Wrench,
  Workflow,
  Building2,
  Share2,
  UploadCloud,
  BarChart3,
  FileSpreadsheet,
  type LucideIcon,
} from 'lucide-react';
import { type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

interface NavEntry {
  /** Workspace-relative path, e.g. `files` or `agents/builder`. */
  path: string;
  label: string;
  icon: LucideIcon;
  /** Accent utility for the icon, so groups stay scannable by colour. */
  tone: string;
  /** Match the path exactly — for links that are a parent of other routes. */
  end?: boolean;
}

/**
 * The everyday destinations, pinned above the channel list.
 *
 * These are the screens people reach for without thinking about which
 * "platform" they belong to, so they sit ungrouped at the very top.
 */
const PRIMARY_LINKS: readonly NavEntry[] = [
  { path: '', label: 'Home', icon: Home, tone: 'text-accent-blue', end: true },
  {
    path: 'ai-chat',
    label: 'AI Chat',
    icon: Sparkles,
    tone: 'text-accent-violet',
  },
  {
    path: 'dms',
    label: 'Direct Messages',
    icon: MessageSquare,
    tone: 'text-accent-cyan',
  },
  { path: 'activity', label: 'Activity', icon: Activity, tone: 'text-destructive' },
  { path: 'files', label: 'Files', icon: HardDrive, tone: 'text-accent-indigo' },
  { path: 'directory', label: 'Directory', icon: Users, tone: 'text-accent-pink' },
  {
    path: 'threads',
    label: 'Threads',
    icon: MessagesSquare,
    tone: 'text-warning',
  },
  { path: 'meetings', label: 'Meetings', icon: Video, tone: 'text-success' },
];

const WORK_TOOL_LINKS: readonly NavEntry[] = [
  {
    path: 'tasks',
    label: 'Tasks & Kanban',
    icon: CheckSquare,
    tone: 'text-accent-blue',
  },
  { path: 'docs', label: 'Docs & Wiki', icon: FileText, tone: 'text-warning' },
  {
    path: 'whiteboard',
    label: 'Whiteboard',
    icon: Layout,
    tone: 'text-accent-violet',
  },
  { path: 'calendar', label: 'Calendar', icon: Calendar, tone: 'text-success' },
];

const AI_PLATFORM_LINKS: readonly NavEntry[] = [
  {
    path: 'ai-chat',
    label: 'AI Workspace Chat',
    icon: Sparkles,
    tone: 'text-accent-violet',
  },
  {
    path: 'prompts',
    label: 'Prompt Library',
    icon: BookOpen,
    tone: 'text-accent-blue',
  },
  {
    path: 'ai-images',
    label: 'AI Image Generator',
    icon: Image,
    tone: 'text-accent-pink',
  },
];

const AGENT_LINKS: readonly NavEntry[] = [
  {
    path: 'agents',
    label: 'Agent Marketplace',
    icon: Bot,
    tone: 'text-success',
    end: true,
  },
  {
    path: 'agents/builder',
    label: 'Agent Builder',
    icon: Wrench,
    tone: 'text-warning',
  },
  {
    path: 'agents/logs',
    label: 'Agent Telemetry',
    icon: Activity,
    tone: 'text-accent-violet',
  },
];

const AUTOMATION_LINKS: readonly NavEntry[] = [
  {
    path: 'automations',
    label: 'All Workflows',
    icon: Workflow,
    tone: 'text-warning',
    end: true,
  },
  {
    path: 'automations/builder',
    label: 'Workflow Builder',
    icon: Wrench,
    tone: 'text-accent-blue',
  },
  {
    path: 'automations/logs',
    label: 'Execution Logs',
    icon: Activity,
    tone: 'text-success',
  },
];

const INTEGRATION_LINKS: readonly NavEntry[] = [
  {
    path: 'integrations',
    label: 'Integration Hub (16)',
    icon: Share2,
    tone: 'text-accent-blue',
    end: true,
  },
  {
    path: 'integrations/import',
    label: 'Slack & Notion Import',
    icon: UploadCloud,
    tone: 'text-accent-cyan',
  },
];

/**
 * The workspace-scoped analytics screens.
 *
 * They are one destination in the sidebar now — a dropdown that jumps straight
 * to a tab of the analytics screen, which carries the same set as a tab bar.
 *
 * The platform-operations screens that used to sit alongside these
 * (performance, error tracking, health) moved to the admin console — see
 * `@org/admin-analytics`. So did the enterprise and marketplace groups.
 */
const ANALYTICS_LINKS: readonly NavEntry[] = [
  {
    path: 'analytics',
    label: 'Dashboard',
    icon: BarChart3,
    tone: 'text-accent-blue',
    end: true,
  },
  {
    path: 'analytics/reports',
    label: 'Reports',
    icon: FileSpreadsheet,
    tone: 'text-accent-cyan',
  },
  {
    path: 'analytics/users',
    label: 'User Analytics',
    icon: Users,
    tone: 'text-accent-violet',
  },
  {
    path: 'analytics/ai-usage',
    label: 'AI Usage',
    icon: Sparkles,
    tone: 'text-accent-pink',
  },
  {
    path: 'analytics/workspace',
    label: 'Workspace Analytics',
    icon: Building2,
    tone: 'text-accent-indigo',
  },
  {
    path: 'analytics/storage',
    label: 'Storage Analytics',
    icon: HardDrive,
    tone: 'text-success',
  },
];

/** One row style for every navigable item in the rail. */
function navRowClass(isActive: boolean, extra?: string) {
  return cn(
    'gap-1.5 py-1 px-2 text-sm flex items-center rounded-md transition-colors',
    'focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none',
    isActive
      ? 'font-medium bg-sidebar-accent text-sidebar-accent-foreground'
      : 'text-sidebar-foreground hover:bg-sidebar-accent/60',
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
      // `end` so a parent link is not highlighted on every child route.
      end={entry.end}
      className={({ isActive }) => navRowClass(isActive)}
    >
      <Icon className={cn('size-3.5 shrink-0', entry.tone)} aria-hidden />
      <span className="truncate">{entry.label}</span>
    </NavLink>
  );
}

interface SectionProps {
  title: string;
  /** Rendered next to the title; `0` hides the section entirely. */
  count?: number;
  children: ReactNode;
  action?: ReactNode;
  defaultOpen?: boolean;
}

/**
 * Collapsible sidebar group, on Radix so the trigger/panel wiring (aria-*,
 * ids, keyboard) comes from the primitive. Collapse state is per-session.
 */
function Section({
  title,
  count,
  children,
  action,
  defaultOpen = true,
}: SectionProps) {
  if (count === 0) return null;

  return (
    <Collapsible defaultOpen={defaultOpen} className="mb-3" asChild>
      <section>
        <div className="group gap-1 px-2 flex items-center">
          <CollapsibleTrigger className="group/trigger gap-1 rounded py-1 text-xs font-semibold tracking-wide flex flex-1 items-center text-sidebar-muted uppercase hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring">
            <ChevronDown
              className="size-3 transition-transform group-data-[state=closed]/trigger:-rotate-90"
              aria-hidden
            />
            {title}
            {count === undefined ? null : (
              <span className="ml-1 font-normal text-sidebar-muted/70">
                {count}
              </span>
            )}
          </CollapsibleTrigger>
          {action}
        </div>

        <CollapsibleContent>
          <ul className="mt-0.5 space-y-px px-1">{children}</ul>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}

/** A collapsible group of static destinations. */
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
        <li key={entry.path}>
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
          navRowClass(isActive, cn('pr-8', channel.isArchived && 'opacity-60'))
        }
      >
        <Icon className="size-3.5 shrink-0 opacity-70" aria-hidden />
        <span className="truncate">{channel.name}</span>
        {channel.membership?.isMuted ? (
          <span className="sr-only">(muted)</span>
        ) : null}
      </NavLink>

      {/* Star reveals on hover, but stays visible once set. */}
      {channel.membership ? (
        <Hint label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
          <Button
            variant="sidebar"
            size="icon-sm"
            onClick={() => onToggleFavorite(channel)}
            aria-label={
              isFavorite ? 'Remove from favorites' : 'Add to favorites'
            }
            aria-pressed={isFavorite}
            className={cn(
              'right-1 size-6 absolute top-1/2 -translate-y-1/2 transition-opacity',
              isFavorite
                ? 'text-warning opacity-100'
                : 'text-sidebar-muted opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100',
            )}
          >
            <Star className={cn('size-3', isFavorite && 'fill-current')} />
          </Button>
        </Hint>
      ) : null}
    </li>
  );
}

/**
 * Analytics collapsed to a single rail entry: the menu picks a tab, and the
 * analytics screen renders that same set as its tab bar.
 */
function AnalyticsMenu({ workspaceSlug }: { workspaceSlug: string }) {
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="sidebar"
          size="sm"
          className="gap-1.5 px-2 font-normal w-full justify-start data-[state=open]:bg-sidebar-accent"
        >
          <BarChart3
            className="size-3.5 shrink-0 text-accent-blue"
            aria-hidden
          />
          <span>Analytics</span>
          <ChevronDown className="ml-auto size-3.5 opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="right" align="start" className="w-56">
        <DropdownMenuLabel>Analytics</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ANALYTICS_LINKS.map((entry) => (
          <DropdownMenuItem
            key={entry.path}
            onSelect={() => navigate(`/w/${workspaceSlug}/${entry.path}`)}
          >
            <entry.icon className={cn('size-4', entry.tone)} aria-hidden />
            {entry.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
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
    <ScrollArea className="scrollbar-subtle flex-1">
      <div className="px-1 py-2">
        <nav aria-label="Workspace" className="mb-3 px-1 pb-3 space-y-px border-b border-sidebar-border">
          {PRIMARY_LINKS.map((entry) => (
            <NavRow key={entry.label} entry={entry} workspaceSlug={workspaceSlug} />
          ))}
        </nav>

        <Section title="Favorites" count={groups.favorites.length}>
          {groups.favorites.map((channel) => (
            <ChannelRow key={channel.id} channel={channel} {...rowProps} />
          ))}
        </Section>

        <Section
          title="Channels"
          count={groups.joined.length}
          action={
            <Hint label="Create a channel">
              <Button
                variant="sidebar"
                size="icon-sm"
                onClick={onCreateChannel}
                aria-label="Create a channel"
                className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
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

        <Section
          title="Browse"
          count={groups.available.length}
          defaultOpen={false}
        >
          {groups.available.map((channel) => (
            <ChannelRow key={channel.id} channel={channel} {...rowProps} />
          ))}
        </Section>

        <Section
          title="Archived"
          count={groups.archived.length}
          defaultOpen={false}
        >
          {groups.archived.map((channel) => (
            <ChannelRow key={channel.id} channel={channel} {...rowProps} />
          ))}
        </Section>

        <div className="border-t border-sidebar-border pt-3">
          <LinkSection
            title="Work Tools"
            links={WORK_TOOL_LINKS}
            workspaceSlug={workspaceSlug}
          />
          <LinkSection
            title="AI Platform"
            links={AI_PLATFORM_LINKS}
            workspaceSlug={workspaceSlug}
            defaultOpen={false}
          />
          <LinkSection
            title="AI Agents Platform"
            links={AGENT_LINKS}
            workspaceSlug={workspaceSlug}
            defaultOpen={false}
          />
          <LinkSection
            title="Workflow Automations"
            links={AUTOMATION_LINKS}
            workspaceSlug={workspaceSlug}
            defaultOpen={false}
          />
          <LinkSection
            title="Integrations & Ecosystem"
            links={INTEGRATION_LINKS}
            workspaceSlug={workspaceSlug}
            defaultOpen={false}
          />
        </div>

        <div className="mt-1 px-1 pt-3 space-y-px border-t border-sidebar-border">
          <AnalyticsMenu workspaceSlug={workspaceSlug} />

          <Button
            variant="sidebar"
            size="sm"
            className="gap-1.5 px-2 font-normal w-full justify-start"
            onClick={onBrowseChannels}
            leadingIcon={<Users className="size-3.5" />}
          >
            Browse channels
          </Button>
          <Button
            variant="sidebar"
            size="sm"
            className="gap-1.5 px-2 font-normal w-full justify-start"
            onClick={onCreateChannel}
            leadingIcon={<Plus className="size-3.5" />}
          >
            Create channel
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}
