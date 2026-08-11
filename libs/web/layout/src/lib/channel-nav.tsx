import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Hint,
  ScrollArea,
  SkeletonList,
} from '@org/ui';
import type { ChannelSummary } from '@org/types';
import { cn } from '@org/utils';
import { useChannelPreferences, useGroupedChannels } from '@org/web-channels';
import {
  Activity,
  ArrowRight,
  Bot,
  ChevronRight,
  Clock,
  FileText,
  FolderKanban,
  HardDrive,
  Hash,
  Home,
  Inbox,
  Lock,
  MessagesSquare,
  MoreHorizontal,
  Package,
  Plus,
  Settings,
  Share2,
  Star,
  Users,
  Video,
  Workflow,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { SidebarFooterActions } from './create-menu.js';
import { DirectMessagesSection } from './direct-messages-section.js';
import { DocsTreeSection } from './docs-section.js';
import {
  navActionClass,
  navIconClass,
  navRowClass,
  NavRow,
  Section,
  type NavEntry,
} from './nav-primitives.js';
import { ProjectsTreeSection } from './projects-section.js';
import { usePromptDialog } from './use-prompt-dialog.js';

/** Shown directly — the destinations people reach for constantly. */
const MOST_USED_LINKS: readonly NavEntry[] = [
  { path: '', label: 'Home', icon: Home, end: true },
  { path: 'inbox', label: 'Inbox', icon: Inbox },
  { path: 'threads', label: 'Threads', icon: MessagesSquare },
  { path: 'meetings', label: 'Meetings', icon: Video },
];

/** Everything else, behind the "More" menu. */
const SECONDARY_LINKS: readonly NavEntry[] = [
  { path: 'pulse', label: 'Pulse', icon: Activity },
  { path: 'schedule', label: 'Schedule', icon: Clock },
  { path: 'tasks', label: 'Projects', icon: FolderKanban },
  { path: 'docs', label: 'Docs', icon: FileText },
  { path: 'directory', label: 'Team Directory', icon: Users },
  { path: 'files', label: 'Files', icon: HardDrive },
  { path: 'settings', label: 'Settings', icon: Settings },
];

const AGENTS_LINKS: readonly NavEntry[] = [
  { path: 'agents', label: 'Agent Directory', icon: Bot, end: true },
  { path: 'agents/builder', label: 'Agent Studio', icon: Bot },
  { path: 'agents/logs', label: 'Agent Logs', icon: HardDrive },
];

const APPS_LINKS: readonly NavEntry[] = [
  { path: 'integrations', label: 'App Directory', icon: Share2, end: true },
];

const AUTOMATION_LINKS: readonly NavEntry[] = [
  { path: 'automations', label: 'Workflows', icon: Workflow, end: true },
  { path: 'automations/builder', label: 'Workflow Builder', icon: Workflow },
  { path: 'automations/logs', label: 'Workflow Logs', icon: HardDrive },
];

const UPGRADE_DISMISSED_KEY = 'onetab_sidebar_upgrade_dismissed_v1';

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

function ChannelRow({
  channel,
  workspaceSlug,
  onToggleFavorite,
}: {
  channel: ChannelSummary;
  workspaceSlug: string;
  onToggleFavorite: (channel: ChannelSummary) => void;
}) {
  const isFavorite = channel.membership?.isFavorite ?? false;
  const Icon = channel.visibility === 'PRIVATE' ? Lock : Hash;

  return (
    <li className="group/row relative">
      <NavLink
        to={`/w/${workspaceSlug}/c/${channel.slug}`}
        className={({ isActive }) =>
          navRowClass(isActive, {
            /* Depth 1: channels live inside a section, like DMs and projects.
               They were rendering at depth 0, so they sat a level out of step
               with every other section list. */
            depth: 1,
            extra: cn('pr-8', channel.isArchived && 'opacity-65'),
          })
        }
      >
        <Icon className={navIconClass(1)} aria-hidden />
        <span className="flex-1 truncate">{channel.name}</span>
      </NavLink>

      {channel.membership ? (
        <Hint label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onToggleFavorite(channel)}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
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

/** Dismissible trial nudge. It used to be permanent, costing ~110px of the
 *  sidebar on every screen with no way to get rid of it. */
function UpgradeCard({ workspaceSlug }: { workspaceSlug: string }) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(UPGRADE_DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(UPGRADE_DISMISSED_KEY, '1');
    } catch {
      /* Preference only. */
    }
  };

  return (
    <div className="relative space-y-2 rounded-card border border-border/80 bg-accent/40 p-3 text-left">
      <Hint label="Dismiss">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={dismiss}
          aria-label="Dismiss upgrade notice"
          className="absolute top-1.5 right-1.5 size-5 p-0"
        >
          <X className="size-3" />
        </Button>
      </Hint>

      <div className="flex items-center gap-2.5 pr-6">
        <span className="relative shrink-0 text-warning" aria-hidden>
          <Package className="size-5" />
          <span className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-warning text-[9px] leading-none font-bold text-warning-foreground">
            !
          </span>
        </span>
        <span className="text-xs font-semibold tracking-tight text-foreground">
          2 days left to upgrade
        </span>
      </div>

      <p className="text-[11px] leading-snug text-muted-foreground">
        This workspace is out of free blocks for you and your team.
      </p>

      <NavLink
        to={`/w/${workspaceSlug}/members`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground transition-colors hover:text-primary"
      >
        <span>Manage members</span>
        <ArrowRight className="size-3.5" aria-hidden />
      </NavLink>
    </div>
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
  const navigate = useNavigate();
  const groups = useGroupedChannels(channels);
  const preferences = useChannelPreferences(workspaceId);
  const prompts = usePromptDialog();

  const toggleFavorite = useCallback(
    (channel: ChannelSummary) =>
      preferences.mutate({
        channelId: channel.id,
        input: { isFavorite: !channel.membership?.isFavorite },
      }),
    [preferences],
  );

  const startNewChat = useCallback(
    () => navigate(`/w/${workspaceSlug}/home`),
    [navigate, workspaceSlug],
  );

  /*
   * Ctrl/Cmd+O opens a new chat.
   *
   * Two fixes over the previous handler: it only listened for `ctrlKey`, so it
   * never fired on macOS, and it had no editable-target guard, so pressing it
   * while composing a message hijacked the keystroke and navigated away.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'o') return;

      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        /^(input|textarea|select)$/i.test(target?.tagName ?? '')
      ) {
        return;
      }

      event.preventDefault();
      startNewChat();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [startNewChat]);

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
      <ScrollArea className="scrollbar-subtle min-h-0 flex-1 px-2 pt-2">
        <div className="pb-4">
          <nav aria-label="Primary navigation" className="space-y-0.5">
            {MOST_USED_LINKS.map((entry) => (
              <NavRow key={entry.label} entry={entry} workspaceSlug={workspaceSlug} />
            ))}

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button className={navActionClass()} aria-label="More destinations">
                  <MoreHorizontal className={navIconClass(0)} aria-hidden />
                  <span className="flex-1 truncate">More</span>
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
                className="w-52"
              >
                {SECONDARY_LINKS.map((entry) => {
                  const Icon = entry.icon;
                  return (
                    <DropdownMenuItem key={entry.label} asChild className="gap-2.5 text-xs">
                      <NavLink
                        to={
                          entry.path
                            ? `/w/${workspaceSlug}/${entry.path}`
                            : `/w/${workspaceSlug}`
                        }
                        end={entry.end}
                      >
                        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
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
              emptyLabel="Star a channel to pin it here."
            >
              {groups.favorites.map((channel) => (
                <ChannelRow key={channel.id} channel={channel} {...rowProps} />
              ))}
            </Section>

            <Section
              title="Channels"
              count={groups.joined.length}
              emptyLabel="You have not joined any channels yet."
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
              <li>
                <button
                  onClick={onBrowseChannels}
                  className={navActionClass({ depth: 1 })}
                >
                  <Plus className={navIconClass(1)} aria-hidden />
                  <span className="flex-1 truncate">Browse channels</span>
                </button>
              </li>
            </Section>

            <DirectMessagesSection workspaceSlug={workspaceSlug} />

            <ProjectsTreeSection workspaceSlug={workspaceSlug} prompts={prompts} />

            <DocsTreeSection workspaceSlug={workspaceSlug} prompts={prompts} />

            <LinkSection
              title="AI Agents"
              links={AGENTS_LINKS}
              workspaceSlug={workspaceSlug}
              defaultOpen={false}
            />

            <LinkSection
              title="Apps"
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

      <div className="shrink-0 space-y-3 border-t border-border/60 bg-sidebar p-3">
        <UpgradeCard workspaceSlug={workspaceSlug} />
        <SidebarFooterActions
          workspaceSlug={workspaceSlug}
          onCreateChannel={onCreateChannel}
          onNewChat={startNewChat}
        />
      </div>

      {prompts.dialog}
    </div>
  );
}
