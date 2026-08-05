import { Button, Hint, ScrollArea, SkeletonList } from '@org/ui';
import type { ChannelSummary } from '@org/types';
import { cn } from '@org/utils';
import { useChannelPreferences, useGroupedChannels } from '@org/web-channels';
import { ChevronDown, Hash, Lock, Plus, Star, Users, CheckSquare, FileText, Layout, Calendar, HardDrive, Activity, Sparkles, BookOpen, Image, Bot, Wrench, Workflow, Building2, Shield, ShieldAlert, Share2, UploadCloud, BarChart3, FileSpreadsheet, Gauge, Bug, HeartPulse } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

/**
 * Phase 11 has nine sibling screens, so this group is data-driven rather than
 * nine copies of the same NavLink.
 */
const ANALYTICS_LINKS = [
  { path: 'analytics', label: 'Dashboard', icon: BarChart3, tone: 'text-blue-400' },
  { path: 'analytics/reports', label: 'Reports', icon: FileSpreadsheet, tone: 'text-cyan-400' },
  { path: 'analytics/users', label: 'User Analytics', icon: Users, tone: 'text-purple-400' },
  { path: 'analytics/ai-usage', label: 'AI Usage', icon: Sparkles, tone: 'text-pink-400' },
  { path: 'analytics/workspace', label: 'Workspace Analytics', icon: Building2, tone: 'text-indigo-400' },
  { path: 'analytics/storage', label: 'Storage Analytics', icon: HardDrive, tone: 'text-emerald-400' },
  { path: 'analytics/performance', label: 'Performance', icon: Gauge, tone: 'text-amber-400' },
  { path: 'analytics/errors', label: 'Error Tracking', icon: Bug, tone: 'text-red-400' },
  { path: 'analytics/health', label: 'Health Dashboard', icon: HeartPulse, tone: 'text-emerald-400' },
] as const;

interface SectionProps {
  title: string;
  count: number;
  children: ReactNode;
  action?: ReactNode;
  defaultOpen?: boolean;
}

/** Collapsible sidebar group. Collapse state is local and per-session. */
function Section({
  title,
  count,
  children,
  action,
  defaultOpen = true,
}: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;

  return (
    <section className="mb-3">
      <div className="group gap-1 px-2 flex items-center">
        <button
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="gap-1 rounded py-1 text-xs font-semibold tracking-wide flex flex-1 items-center text-sidebar-muted uppercase hover:text-sidebar-foreground"
        >
          <ChevronDown
            className={cn('size-3 transition-transform', !open && '-rotate-90')}
            aria-hidden
          />
          {title}
          <span className="ml-1 font-normal text-sidebar-muted/70">
            {count}
          </span>
        </button>
        {action}
      </div>
      {open ? <ul className="mt-0.5 space-y-px">{children}</ul> : null}
    </section>
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
          cn(
            'gap-1.5 py-1 pr-8 pl-2 text-sm flex items-center rounded-md transition-colors',
            'focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none',
            isActive
              ? 'font-medium bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-sidebar-foreground hover:bg-sidebar-accent/60',
            channel.isArchived && 'opacity-60',
          )
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
          <button
            onClick={() => onToggleFavorite(channel)}
            aria-label={
              isFavorite ? 'Remove from favorites' : 'Add to favorites'
            }
            aria-pressed={isFavorite}
            className={cn(
              'right-1.5 rounded p-0.5 absolute top-1/2 -translate-y-1/2 transition-opacity',
              'focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none',
              isFavorite
                ? 'text-warning opacity-100'
                : 'text-sidebar-muted opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100',
            )}
          >
            <Star className={cn('size-3', isFavorite && 'fill-current')} />
          </button>
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
    <ScrollArea className="scrollbar-subtle flex-1">
      <div className="px-1 py-2">
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

        <div className="mt-2 mb-3 px-1 space-y-px border-b border-sidebar-border pb-3">
          <div className="px-2 py-1 text-xs font-semibold tracking-wide text-sidebar-muted uppercase">
            Work Tools
          </div>
          <NavLink
            to={`/w/${workspaceSlug}/tasks`}
            className={({ isActive }) =>
              cn(
                'gap-1.5 py-1 px-2 text-sm flex items-center rounded-md transition-colors',
                isActive
                  ? 'font-medium bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
              )
            }
          >
            <CheckSquare className="size-3.5 shrink-0 text-blue-400" />
            <span>Tasks & Kanban</span>
          </NavLink>

          <NavLink
            to={`/w/${workspaceSlug}/docs`}
            className={({ isActive }) =>
              cn(
                'gap-1.5 py-1 px-2 text-sm flex items-center rounded-md transition-colors',
                isActive
                  ? 'font-medium bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
              )
            }
          >
            <FileText className="size-3.5 shrink-0 text-amber-400" />
            <span>Docs & Wiki</span>
          </NavLink>

          <NavLink
            to={`/w/${workspaceSlug}/whiteboard`}
            className={({ isActive }) =>
              cn(
                'gap-1.5 py-1 px-2 text-sm flex items-center rounded-md transition-colors',
                isActive
                  ? 'font-medium bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
              )
            }
          >
            <Layout className="size-3.5 shrink-0 text-purple-400" />
            <span>Whiteboard</span>
          </NavLink>

          <NavLink
            to={`/w/${workspaceSlug}/calendar`}
            className={({ isActive }) =>
              cn(
                'gap-1.5 py-1 px-2 text-sm flex items-center rounded-md transition-colors',
                isActive
                  ? 'font-medium bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
              )
            }
          >
            <Calendar className="size-3.5 shrink-0 text-emerald-400" />
            <span>Calendar</span>
          </NavLink>

          <NavLink
            to={`/w/${workspaceSlug}/files`}
            className={({ isActive }) =>
              cn(
                'gap-1.5 py-1 px-2 text-sm flex items-center rounded-md transition-colors',
                isActive
                  ? 'font-medium bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
              )
            }
          >
            <HardDrive className="size-3.5 shrink-0 text-cyan-400" />
            <span>Files</span>
          </NavLink>

          <NavLink
            to={`/w/${workspaceSlug}/timeline`}
            className={({ isActive }) =>
              cn(
                'gap-1.5 py-1 px-2 text-sm flex items-center rounded-md transition-colors',
                isActive
                  ? 'font-medium bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
              )
            }
          >
            <Activity className="size-3.5 shrink-0 text-rose-400" />
            <span>Timeline</span>
          </NavLink>
        </div>

        <div className="mt-2 mb-3 px-1 space-y-px border-b border-sidebar-border pb-3">
          <div className="px-2 py-1 text-xs font-semibold tracking-wide text-sidebar-muted uppercase">
            AI Platform
          </div>
          <NavLink
            to={`/w/${workspaceSlug}/ai-chat`}
            className={({ isActive }) =>
              cn(
                'gap-1.5 py-1 px-2 text-sm flex items-center rounded-md transition-colors',
                isActive
                  ? 'font-medium bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
              )
            }
          >
            <Sparkles className="size-3.5 shrink-0 text-purple-400" />
            <span>AI Workspace Chat</span>
          </NavLink>

          <NavLink
            to={`/w/${workspaceSlug}/prompts`}
            className={({ isActive }) =>
              cn(
                'gap-1.5 py-1 px-2 text-sm flex items-center rounded-md transition-colors',
                isActive
                  ? 'font-medium bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
              )
            }
          >
            <BookOpen className="size-3.5 shrink-0 text-blue-400" />
            <span>Prompt Library</span>
          </NavLink>

          <NavLink
            to={`/w/${workspaceSlug}/ai-images`}
            className={({ isActive }) =>
              cn(
                'gap-1.5 py-1 px-2 text-sm flex items-center rounded-md transition-colors',
                isActive
                  ? 'font-medium bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
              )
            }
          >
            <Image className="size-3.5 shrink-0 text-pink-400" />
            <span>AI Image Generator</span>
          </NavLink>
        </div>

        <div className="mt-2 mb-3 px-1 space-y-px border-b border-sidebar-border pb-3">
          <div className="px-2 py-1 text-xs font-semibold tracking-wide text-sidebar-muted uppercase">
            AI Agents Platform
          </div>
          <NavLink
            to={`/w/${workspaceSlug}/agents`}
            className={({ isActive }) =>
              cn(
                'gap-1.5 py-1 px-2 text-sm flex items-center rounded-md transition-colors',
                isActive
                  ? 'font-medium bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
              )
            }
          >
            <Bot className="size-3.5 shrink-0 text-emerald-400" />
            <span>Agent Marketplace</span>
          </NavLink>

          <NavLink
            to={`/w/${workspaceSlug}/agents/builder`}
            className={({ isActive }) =>
              cn(
                'gap-1.5 py-1 px-2 text-sm flex items-center rounded-md transition-colors',
                isActive
                  ? 'font-medium bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
              )
            }
          >
            <Wrench className="size-3.5 shrink-0 text-amber-400" />
            <span>Agent Builder</span>
          </NavLink>

          <NavLink
            to={`/w/${workspaceSlug}/agents/logs`}
            className={({ isActive }) =>
              cn(
                'gap-1.5 py-1 px-2 text-sm flex items-center rounded-md transition-colors',
                isActive
                  ? 'font-medium bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
              )
            }
          >
            <Activity className="size-3.5 shrink-0 text-purple-400" />
            <span>Agent Telemetry</span>
          </NavLink>
        </div>

        <div className="mt-2 mb-3 px-1 space-y-px border-b border-sidebar-border pb-3">
          <div className="px-2 py-1 text-xs font-semibold tracking-wide text-sidebar-muted uppercase">
            Workflow Automations
          </div>
          <NavLink
            to={`/w/${workspaceSlug}/automations`}
            className={({ isActive }) =>
              cn(
                'gap-1.5 py-1 px-2 text-sm flex items-center rounded-md transition-colors',
                isActive
                  ? 'font-medium bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
              )
            }
          >
            <Workflow className="size-3.5 shrink-0 text-amber-400" />
            <span>All Workflows</span>
          </NavLink>

          <NavLink
            to={`/w/${workspaceSlug}/automations/builder`}
            className={({ isActive }) =>
              cn(
                'gap-1.5 py-1 px-2 text-sm flex items-center rounded-md transition-colors',
                isActive
                  ? 'font-medium bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
              )
            }
          >
            <Wrench className="size-3.5 shrink-0 text-blue-400" />
            <span>Workflow Builder</span>
          </NavLink>

          <NavLink
            to={`/w/${workspaceSlug}/automations/logs`}
            className={({ isActive }) =>
              cn(
                'gap-1.5 py-1 px-2 text-sm flex items-center rounded-md transition-colors',
                isActive
                  ? 'font-medium bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
              )
            }
          >
            <Activity className="size-3.5 shrink-0 text-emerald-400" />
            <span>Execution Logs</span>
          </NavLink>
        </div>

        <div className="mt-2 mb-3 px-1 space-y-px border-b border-sidebar-border pb-3">
          <div className="px-2 py-1 text-xs font-semibold tracking-wide text-sidebar-muted uppercase">
            Enterprise Platform
          </div>
          <NavLink
            to={`/w/${workspaceSlug}/enterprise`}
            className={({ isActive }) =>
              cn(
                'gap-1.5 py-1 px-2 text-sm flex items-center rounded-md transition-colors',
                isActive
                  ? 'font-medium bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
              )
            }
          >
            <Building2 className="size-3.5 shrink-0 text-blue-400" />
            <span>Governance & Org</span>
          </NavLink>

          <NavLink
            to={`/w/${workspaceSlug}/enterprise/sso`}
            className={({ isActive }) =>
              cn(
                'gap-1.5 py-1 px-2 text-sm flex items-center rounded-md transition-colors',
                isActive
                  ? 'font-medium bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
              )
            }
          >
            <Shield className="size-3.5 shrink-0 text-emerald-400" />
            <span>SSO & SCIM Setup</span>
          </NavLink>

          <NavLink
            to={`/w/${workspaceSlug}/enterprise/audit-logs`}
            className={({ isActive }) =>
              cn(
                'gap-1.5 py-1 px-2 text-sm flex items-center rounded-md transition-colors',
                isActive
                  ? 'font-medium bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
              )
            }
          >
            <ShieldAlert className="size-3.5 shrink-0 text-purple-400" />
            <span>Audit Logs</span>
          </NavLink>
        </div>

        <div className="mt-2 mb-3 px-1 space-y-px border-b border-sidebar-border pb-3">
          <div className="px-2 py-1 text-xs font-semibold tracking-wide text-sidebar-muted uppercase">
            Integrations & Ecosystem
          </div>
          <NavLink
            to={`/w/${workspaceSlug}/integrations`}
            className={({ isActive }) =>
              cn(
                'gap-1.5 py-1 px-2 text-sm flex items-center rounded-md transition-colors',
                isActive
                  ? 'font-medium bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
              )
            }
          >
            <Share2 className="size-3.5 shrink-0 text-blue-400" />
            <span>Integration Hub (16)</span>
          </NavLink>

          <NavLink
            to={`/w/${workspaceSlug}/integrations/import`}
            className={({ isActive }) =>
              cn(
                'gap-1.5 py-1 px-2 text-sm flex items-center rounded-md transition-colors',
                isActive
                  ? 'font-medium bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
              )
            }
          >
            <UploadCloud className="size-3.5 shrink-0 text-cyan-400" />
            <span>Slack & Notion Import</span>
          </NavLink>
        </div>

        <div className="mt-2 mb-3 px-1 space-y-px border-b border-sidebar-border pb-3">
          <div className="px-2 py-1 text-xs font-semibold tracking-wide text-sidebar-muted uppercase">
            Analytics & Administration
          </div>
          {ANALYTICS_LINKS.map((link) => (
            <NavLink
              key={link.path}
              to={`/w/${workspaceSlug}/${link.path}`}
              // `end` so the dashboard link is not highlighted on every child route.
              end={link.path === 'analytics'}
              className={({ isActive }) =>
                cn(
                  'gap-1.5 py-1 px-2 text-sm flex items-center rounded-md transition-colors',
                  isActive
                    ? 'font-medium bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
                )
              }
            >
              <link.icon className={cn('size-3.5 shrink-0', link.tone)} />
              <span>{link.label}</span>
            </NavLink>
          ))}
        </div>

        <div className="mt-2 px-1 space-y-px">
          <Button
            variant="sidebar"
            size="sm"
            className="gap-1.5 font-normal w-full justify-start"
            onClick={onBrowseChannels}
            leadingIcon={<Users className="size-3.5" />}
          >
            Browse channels
          </Button>
          <Button
            variant="sidebar"
            size="sm"
            className="gap-1.5 font-normal w-full justify-start"
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
