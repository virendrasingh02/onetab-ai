import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Hint,
  ScrollArea,
  SkeletonList,
} from '@org/ui';
import type { ChannelSummary } from '@org/types';
import { cn } from '@org/utils';
import { useChannelPreferences, useGroupedChannels } from '@org/web-channels';
import {
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
  Search,
  UserPlus,
  Zap,
  Clock,
  Inbox,
  Send,
  Share2,
  UploadCloud,
  FileSpreadsheet,
  type LucideIcon,
} from 'lucide-react';
import { type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

interface NavEntry {
  path: string;
  label: string;
  icon: LucideIcon;
  tone?: string;
  badge?: string | number;
  badgeColor?: string;
  hasChevronRight?: boolean;
  end?: boolean;
}

const PRIMARY_LINKS: readonly NavEntry[] = [
  { path: '', label: 'Home', icon: Home, tone: 'text-zinc-700 dark:text-zinc-300', end: true },
  {
    path: 'activity',
    label: 'Unreads',
    icon: Inbox,
    tone: 'text-emerald-600 dark:text-emerald-400',
    badge: '3',
    badgeColor: 'bg-emerald-600 text-white',
  },
  {
    path: 'threads',
    label: 'Threads',
    icon: MessagesSquare,
    tone: 'text-indigo-600 dark:text-indigo-400',
  },
  {
    path: 'meetings',
    label: 'Huddles & Calls',
    icon: Video,
    tone: 'text-emerald-500',
  },
  {
    path: 'docs',
    label: 'Drafts & sent',
    icon: Send,
    tone: 'text-blue-500',
  },
  {
    path: 'directory',
    label: 'Directories',
    icon: Users,
    tone: 'text-purple-500',
  },
  {
    path: 'dms',
    label: 'Direct Messages',
    icon: MessageSquare,
    tone: 'text-cyan-500',
  },
  {
    path: 'activity',
    label: 'Activity',
    icon: Bell,
    tone: 'text-amber-500',
    badge: '1',
    badgeColor: 'bg-blue-600 text-white',
  },
  {
    path: 'files',
    label: 'Files',
    icon: HardDrive,
    tone: 'text-indigo-500',
  },
];

const EXTERNAL_LINKS: readonly NavEntry[] = [
  { path: 'integrations', label: 'Integration Hub', icon: Share2, tone: 'text-blue-500' },
  { path: 'integrations/import', label: 'Slack & Notion Import', icon: UploadCloud, tone: 'text-cyan-500' },
];

const WORK_TOOL_LINKS: readonly NavEntry[] = [
  { path: 'tasks', label: 'Tasks & Kanban', icon: CheckSquare, tone: 'text-blue-500' },
  { path: 'docs', label: 'Docs & Wiki', icon: FileText, tone: 'text-amber-500' },
  { path: 'whiteboard', label: 'Whiteboard', icon: Layout, tone: 'text-purple-500' },
  { path: 'calendar', label: 'Calendar', icon: Calendar, tone: 'text-emerald-500' },
];

const AI_PLATFORM_LINKS: readonly NavEntry[] = [
  { path: 'ai-chat', label: 'AI Workspace Chat (Slackbot)', icon: Sparkles, tone: 'text-purple-500' },
  { path: 'prompts', label: 'Prompt Library', icon: BookOpen, tone: 'text-blue-500' },
  { path: 'ai-images', label: 'AI Image Generator', icon: Image, tone: 'text-pink-500' },
  { path: 'agents', label: 'Agent Marketplace', icon: Bot, tone: 'text-emerald-500' },
];

const AUTOMATION_LINKS: readonly NavEntry[] = [
  { path: 'automations', label: 'All Workflows', icon: Workflow, tone: 'text-amber-500', end: true },
  { path: 'automations/builder', label: 'Workflow Builder', icon: Workflow, tone: 'text-blue-500' },
  { path: 'automations/logs', label: 'Execution Logs', icon: HardDrive, tone: 'text-emerald-500' },
];

const ANALYTICS_LINKS: readonly NavEntry[] = [
  { path: 'analytics', label: 'Dashboard', icon: BarChart3, tone: 'text-blue-500', end: true },
  { path: 'analytics/reports', label: 'Reports', icon: FileSpreadsheet, tone: 'text-cyan-500' },
  { path: 'analytics/users', label: 'User Analytics', icon: Users, tone: 'text-purple-500' },
  { path: 'analytics/ai-usage', label: 'AI Usage', icon: Sparkles, tone: 'text-pink-500' },
];

function navRowClass(isActive: boolean, extra?: string) {
  return cn(
    'gap-2.5 py-1.5 px-2.5 text-[13px] flex items-center rounded-lg font-medium transition-colors duration-150 group',
    'focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:outline-none',
    isActive
      ? 'bg-zinc-200/80 text-zinc-900 font-semibold dark:bg-zinc-800 dark:text-zinc-100'
      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100',
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
      <Icon className={cn('size-4 shrink-0', entry.tone)} aria-hidden />
      <span className="truncate flex-1">{entry.label}</span>
      {entry.badge ? (
        <span
          className={cn(
            'px-1.5 py-0.2 text-[10px] font-bold rounded-full min-w-4 text-center leading-none',
            entry.badgeColor || 'bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200',
          )}
        >
          {entry.badge}
        </span>
      ) : null}
      {entry.hasChevronRight ? (
        <ChevronRight className="size-3.5 text-zinc-400 opacity-60 group-hover:opacity-100 transition-opacity ml-auto" />
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
    <Collapsible defaultOpen={defaultOpen} className="mb-1" asChild>
      <section>
        <div className="group gap-1 px-2.5 py-1 flex items-center">
          <CollapsibleTrigger className="group/trigger gap-1 rounded text-xs font-normal flex flex-1 items-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
            <ChevronDown
              className="size-3.5 transition-transform duration-150 group-data-[state=closed]/trigger:-rotate-90 text-zinc-400 shrink-0"
              aria-hidden
            />
            <span className="font-semibold text-xs text-zinc-600 dark:text-zinc-300">{title}</span>
            {count === undefined ? null : (
              <span className="ml-1 text-[11px] font-normal text-zinc-400 dark:text-zinc-500">
                {count}
              </span>
            )}
          </CollapsibleTrigger>
          {action}
        </div>

        <CollapsibleContent>
          <ul className="mt-0.5 space-y-0.5 px-0.5">{children}</ul>
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
          navRowClass(isActive, cn('pr-8', channel.isArchived && 'opacity-60'))
        }
      >
        <Icon className="size-3.5 shrink-0 text-zinc-400" aria-hidden />
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
              'right-1 size-6 absolute top-1/2 -translate-y-1/2 transition-opacity p-0',
              isFavorite
                ? 'text-amber-500 opacity-100'
                : 'text-zinc-400 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100',
            )}
          >
            <Star className={cn('size-3', isFavorite && 'fill-current')} />
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
  onOpenSearch?: () => void;
}

export function ChannelNav({
  workspaceId,
  workspaceSlug,
  channels,
  isLoading,
  onCreateChannel,
  onBrowseChannels,
  onOpenSearch,
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
    <div className="flex flex-col h-full min-h-0">
      {/* Quick Actions Search Bar */}
      <div className="px-2 pt-1 pb-2">
        <button
          onClick={onOpenSearch}
          className={cn(
            'w-full gap-2 px-2.5 py-1.5 text-xs flex items-center justify-between rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 text-zinc-600 dark:text-zinc-400 shadow-2xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors',
            'focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:outline-none',
          )}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="size-4 rounded flex items-center justify-center text-zinc-500 font-bold text-[11px]">
              Q
            </span>
            <span className="font-medium truncate text-zinc-700 dark:text-zinc-300">Find a conversation...</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <kbd className="rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 text-[9px] font-mono font-medium text-zinc-500 dark:text-zinc-400">
              CTRL K
            </kbd>
            <Search className="size-3 text-zinc-400 ml-0.5" />
            <Zap className="size-3 text-amber-500 fill-amber-500" />
          </div>
        </button>
      </div>

      <ScrollArea className="scrollbar-subtle flex-1 px-1.5">
        <div className="space-y-1 pb-4">
          {/* Primary Nav Links */}
          <nav aria-label="Primary navigation" className="space-y-0.5">
            {PRIMARY_LINKS.map((entry) => (
              <NavRow key={entry.label} entry={entry} workspaceSlug={workspaceSlug} />
            ))}
          </nav>

          <div className="pt-2 space-y-1 border-t border-zinc-200/60 dark:border-zinc-800/60 mt-2">
            <Section title="Starred" count={groups.favorites.length} defaultOpen={true}>
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
                    className="size-5 p-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
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
              title="External connections"
              links={EXTERNAL_LINKS}
              workspaceSlug={workspaceSlug}
              defaultOpen={false}
            />

            <LinkSection
              title="Work Tools"
              links={WORK_TOOL_LINKS}
              workspaceSlug={workspaceSlug}
              defaultOpen={false}
            />

            <LinkSection
              title="AI Platform"
              links={AI_PLATFORM_LINKS}
              workspaceSlug={workspaceSlug}
              defaultOpen={false}
            />

            <LinkSection
              title="Automations"
              links={AUTOMATION_LINKS}
              workspaceSlug={workspaceSlug}
              defaultOpen={false}
            />

            <LinkSection
              title="Analytics"
              links={ANALYTICS_LINKS}
              workspaceSlug={workspaceSlug}
              defaultOpen={false}
            />
          </div>
        </div>
      </ScrollArea>

      {/* Sidebar Footer Section */}
      <div className="p-2.5 border-t border-zinc-200/80 dark:border-zinc-800/80 space-y-2 bg-zinc-50/50 dark:bg-zinc-900/30 shrink-0">
        {/* Getting started progress pill */}
        <button className="w-full px-2.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80 transition-colors flex items-center justify-between text-xs font-semibold text-zinc-800 dark:text-zinc-200">
          <span>Getting started</span>
          <span className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 px-1.5 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-700">
            2/6
          </span>
        </button>

        {/* Invite team members button */}
        <button
          onClick={onBrowseChannels}
          className="w-full px-2 py-1 flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
        >
          <UserPlus className="size-4 text-zinc-500 shrink-0" />
          <span>Invite team members</span>
        </button>

        {/* Trial Status Footer */}
        <div className="flex items-center justify-between pt-1 gap-1">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400 min-w-0">
            <Clock className="size-3.5 shrink-0" />
            <span className="truncate">5 days left on trial</span>
          </div>
          <button className="px-2.5 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-2xs shrink-0">
            Keep Pro
          </button>
        </div>
      </div>
    </div>
  );
}


