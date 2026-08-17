import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Hint,
  ScrollArea,
  SkeletonList,
  usePromptDialog,
} from '@org/ui';
import type { ChannelSummary } from '@org/types';
import { cn } from '@org/utils';
import { useChannelPreferences, useGroupedChannels } from '@org/web-channels';
import {
  Activity,
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
  Plus,
  Settings,
  Star,
  Users,
  Video,
} from 'lucide-react';
import { useCallback, useEffect } from 'react';
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
import {
  AgentsSection,
  AppsSection,
  WorkflowsSection,
} from './resource-sections.js';


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

/*
 * A billing nudge used to live here: "2 days left to upgrade — this workspace
 * is out of free blocks", with a warning badge and a dismiss button that
 * remembered itself in localStorage.
 *
 * None of it was real. The countdown was a literal, the quota claim was a
 * literal, and there is no billing state anywhere in the app to derive either
 * from — so every workspace, on every plan, was told it had two days left
 * forever. A permanent false alarm trains people to ignore the one place the
 * sidebar has to raise an alarm. It comes back when there is a subscription to
 * read, and then it can say something true.
 */

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
                side="bottom"
                sideOffset={4}
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

            <AgentsSection workspaceSlug={workspaceSlug} />

            <AppsSection workspaceSlug={workspaceSlug} />

            <WorkflowsSection workspaceSlug={workspaceSlug} />
          </div>
        </div>
      </ScrollArea>

      <div className="shrink-0 border-t border-border/60 bg-transparent p-3">
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
