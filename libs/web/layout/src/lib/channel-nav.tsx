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
  Lock,
  MessagesSquare,
  Plus,
  Star,
  Users,
  Video,
  FileText,
  HardDrive,
  Bot,
  Workflow,
  Sparkles,
  UserPlus,
  Clock,
  Inbox,
  Share2,
  UploadCloud,
  MoreHorizontal,
  Home,
  FolderKanban,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

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
  { path: 'meetings', label: 'Meetings', icon: Video },
];

// Secondary Nav Items (Collapsible inside 'More' dropdown menu)
const SECONDARY_LINKS: readonly NavEntry[] = [
  { path: 'pulse', label: 'Pulse', icon: Activity },
  { path: 'schedule', label: 'Schedule', icon: Clock },
  { path: 'directory', label: 'Team Directory', icon: Users },
  { path: 'files', label: 'Files', icon: HardDrive },
];

const AGENTS_LINKS: readonly NavEntry[] = [
  { path: 'agents', label: 'Agent Directory', icon: Bot, end: true },
  { path: 'agents/builder', label: 'Agent Studio', icon: Bot },
  { path: 'agents/logs', label: 'Agent Logs', icon: HardDrive },
];

const APPS_LINKS: readonly NavEntry[] = [
  { path: 'integrations', label: 'App Directory', icon: Share2, end: true },
  { path: 'import-export', label: 'Import & Export', icon: UploadCloud },
];

const AUTOMATION_LINKS: readonly NavEntry[] = [
  { path: 'automations', label: 'Workflows', icon: Workflow, end: true },
  { path: 'automations/builder', label: 'Workflow Builder', icon: Workflow },
  { path: 'automations/logs', label: 'Workflow Logs', icon: HardDrive },
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

function ProjectsTreeSection({ workspaceSlug }: { workspaceSlug: string }) {
  const location = useLocation();

  const [projects] = useState(() => {
    try {
      const saved = localStorage.getItem('onetab_project_boards_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return [
      { id: 'proj_product', name: 'Q3 Product & Release', color: 'violet' },
      { id: 'proj_design', name: 'Website & UI Redesign', color: 'blue' },
      { id: 'proj_api', name: 'AI & Vector Pipeline', color: 'emerald' },
    ];
  });

  return (
    <Section
      title="Projects"
      defaultOpen={true}
      action={
        <Hint label="New Project">
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            aria-label="New Project"
            className="size-5 hover:bg-accent p-0"
          >
            <NavLink to={`/w/${workspaceSlug}/tasks?newProject=true`}>
              <Plus className="size-3.5" />
            </NavLink>
          </Button>
        </Hint>
      }
    >
      <li>
        <NavLink
          to={`/w/${workspaceSlug}/tasks?view=projects`}
          className={({ isActive }) =>
            navRowClass(isActive && location.search.includes('view=projects'))
          }
        >
          <FolderKanban className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="flex-1 truncate font-medium">All Projects</span>
        </NavLink>
      </li>

      {projects.map((proj) => {
        const projTo = `/w/${workspaceSlug}/tasks?project=${proj.id}`;
        const isSelected = location.pathname.includes('/tasks') && location.search.includes(`project=${proj.id}`);

        return (
          <li key={proj.id}>
            <NavLink
              to={projTo}
              className={navRowClass(isSelected, 'pl-6 text-[12px]')}
            >
              <span
                className={cn(
                  'size-2 rounded-full shrink-0',
                  proj.color === 'violet' && 'bg-violet-500',
                  proj.color === 'blue' && 'bg-blue-500',
                  proj.color === 'emerald' && 'bg-emerald-500',
                  proj.color === 'amber' && 'bg-amber-500',
                  proj.color === 'rose' && 'bg-rose-500',
                  proj.color === 'cyan' && 'bg-cyan-500',
                )}
              />
              <span className="flex-1 truncate">{proj.name}</span>
            </NavLink>
          </li>
        );
      })}
    </Section>
  );
}

function DocsTreeSection({ workspaceSlug }: { workspaceSlug: string }) {
  const location = useLocation();

  const [docs] = useState(() => {
    try {
      const saved = localStorage.getItem('onetab_docs_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return [
      { id: 'doc_arch', title: 'Workspace Architecture' },
      { id: 'doc_design', title: 'Design System Tokens' },
      { id: 'doc_ollama', title: 'Ollama Vector RAG' },
      { id: 'doc_security', title: 'API Security Scope' },
    ];
  });

  return (
    <Section
      title="Docs"
      defaultOpen={true}
      action={
        <Hint label="New Document">
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            aria-label="New Document"
            className="size-5 hover:bg-accent p-0"
          >
            <NavLink to={`/w/${workspaceSlug}/docs?newDoc=true`}>
              <Plus className="size-3.5" />
            </NavLink>
          </Button>
        </Hint>
      }
    >
      <li>
        <NavLink
          to={`/w/${workspaceSlug}/docs?view=all`}
          className={({ isActive }) =>
            navRowClass(isActive && location.search.includes('view=all'))
          }
        >
          <FileText className="size-4 shrink-0 text-accent-blue" aria-hidden />
          <span className="flex-1 truncate font-medium">All Docs</span>
        </NavLink>
      </li>

      {docs.map((docItem) => {
        const docTo = `/w/${workspaceSlug}/docs?doc=${docItem.id}`;
        const isSelected = location.pathname.includes('/docs') && location.search.includes(`doc=${docItem.id}`);

        return (
          <li key={docItem.id}>
            <NavLink
              to={docTo}
              className={navRowClass(isSelected, 'pl-6 text-[12px]')}
            >
              <FileText className="size-3 shrink-0 text-subtle" aria-hidden />
              <span className="flex-1 truncate">{docItem.title}</span>
            </NavLink>
          </li>
        );
      })}
    </Section>
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

interface DMItem {
  id: string;
  name: string;
  avatarUrl?: string;
  status: 'online' | 'away' | 'dnd' | 'offline';
  unreadCount?: number;
  isAi?: boolean;
}

const SLACK_DMS: DMItem[] = [
  {
    id: 'dm_ai',
    name: 'AI Workspace Copilot',
    status: 'online',
    isAi: true,
  },
  {
    id: 'dm_alex',
    name: 'Alex Morgan',
    status: 'online',
    unreadCount: 2,
  },
  {
    id: 'dm_sarah',
    name: 'Sarah Chen',
    status: 'away',
  },
  {
    id: 'dm_david',
    name: 'David Miller',
    status: 'offline',
    unreadCount: 1,
  },
];

function DirectMessagesSection({ workspaceSlug }: { workspaceSlug: string }) {
  return (
    <Section
      title="Direct Messages"
      count={SLACK_DMS.length}
      defaultOpen={true}
      action={
        <Hint label="New Direct Message">
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            aria-label="New Direct Message"
            className="size-5 hover:bg-accent p-0"
          >
            <NavLink to={`/w/${workspaceSlug}/dms`}>
              <Plus className="size-3.5" />
            </NavLink>
          </Button>
        </Hint>
      }
    >
      {SLACK_DMS.map((dm) => (
        <li key={dm.id}>
          <NavLink
            to={`/w/${workspaceSlug}/dms`}
            className={({ isActive }) =>
              navRowClass(
                isActive,
                'gap-2.5 py-1 px-2.5 text-xs hover:bg-accent/60',
              )
            }
          >
            {/* Slack Avatar & Presence Indicator */}
            <div className="relative flex size-5 shrink-0 items-center justify-center">
              {dm.isAi ? (
                <div className="flex size-5 items-center justify-center rounded-md bg-primary/20 text-primary">
                  <Sparkles className="size-3" />
                </div>
              ) : dm.avatarUrl ? (
                <img
                  src={dm.avatarUrl}
                  alt={dm.name}
                  className="size-5 rounded-md object-cover"
                />
              ) : (
                <div className="flex size-5 items-center justify-center rounded-md bg-secondary text-[10px] font-bold text-foreground">
                  {dm.name.charAt(0)}
                </div>
              )}

              {/* Slack Presence Indicator Dot */}
              <span
                className={cn(
                  'absolute -bottom-0.5 -right-0.5 size-2 rounded-full border-2 border-sidebar',
                  dm.status === 'online' && 'bg-emerald-500',
                  dm.status === 'away' && 'bg-amber-500',
                  dm.status === 'dnd' && 'bg-rose-500',
                  dm.status === 'offline' && 'bg-zinc-500/60',
                )}
              />
            </div>

            <span
              className={cn(
                'flex-1 truncate text-xs',
                dm.unreadCount ? 'font-semibold text-foreground' : 'text-muted-foreground',
              )}
            >
              {dm.name}
            </span>

            {dm.unreadCount ? (
              <Badge variant="count" className="ml-auto text-[10px] px-1.5 py-0">
                {dm.unreadCount}
              </Badge>
            ) : null}
          </NavLink>
        </li>
      ))}

      {/* Slack Add Teammates Action Link */}
      <li className="pt-1">
        <NavLink
          to={`/w/${workspaceSlug}/members`}
          className="flex items-center gap-2 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md transition-colors"
        >
          <div className="flex size-4 items-center justify-center rounded-md border border-dashed border-border text-subtle">
            <Plus className="size-3" />
          </div>
          <span className="text-xs">Add teammates</span>
        </NavLink>
      </li>
    </Section>
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

            {/* More Dropdown Menu */}
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    'group flex w-full items-center gap-2.5 rounded-btn py-1.5 pr-2 pl-3 text-[13px]',
                    'text-muted-foreground transition-colors duration-(--duration-fast) ease-standard',
                    'hover:bg-accent hover:text-foreground',
                    'outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  )}
                  aria-label="More menu"
                >
                  <MoreHorizontal className="size-4 shrink-0" aria-hidden />
                  <span className="flex-1 truncate text-left">
                    More
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
                className="w-52 p-1 z-50 bg-[#111113] border-[#27272A] shadow-xl rounded-xl"
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
                      className="text-xs flex items-center gap-2.5 cursor-pointer py-2 px-2.5 rounded-md hover:bg-[#1E1F23] focus:bg-[#1E1F23] text-[#FAFAFA] font-medium"
                    >
                      <NavLink to={to} end={entry.end}>
                        <Icon className="size-4 text-[#A1A1AA] shrink-0" aria-hidden />
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
              title="Favorites"
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

            {/* Direct Messages Section right after Channels */}
            <DirectMessagesSection workspaceSlug={workspaceSlug} />

            <ProjectsTreeSection workspaceSlug={workspaceSlug} />

            <DocsTreeSection workspaceSlug={workspaceSlug} />

            <LinkSection
              title="AI Agents"
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
            <span>Getting Started</span>
            <span className="text-subtle tabular-nums">2/6</span>
          </button>
          {/*
            The default `surface-inset` track is the same value as the sidebar
            background, so the trough needs a visible fill of its own here.
          */}
          <Progress
            value={33}
            size="sm"
            label="Getting Started"
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
          <span>Invite Members</span>
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
