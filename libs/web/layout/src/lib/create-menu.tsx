import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Hint,
  Kbd,
  KbdShortcut,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Bot,
  FileText,
  FolderKanban,
  Hash,
  Headphones,
  Plus,
  SlidersHorizontal,
  Sparkles,
  SquarePen,
  UserPlus,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface CreateAction {
  label: string;
  description: string;
  icon: LucideIcon;
  /** Tailwind classes for the icon medallion. */
  tone: string;
  shortcut?: string;
  category: 'communicate' | 'work' | 'workspace';
  /** Path relative to the workspace root, or `null` for a custom handler. */
  path: string | null;
}

const CREATE_ACTIONS: readonly CreateAction[] = [
  {
    label: 'AI Chat',
    description: 'Start a session with AI Copilot',
    icon: Sparkles,
    tone: 'bg-accent-violet/15 border-accent-violet/30 text-accent-violet',
    shortcut: 'mod+o',
    category: 'communicate',
    path: 'home',
  },
  {
    label: 'Direct Message',
    description: 'Send a private message to a teammate',
    icon: SquarePen,
    tone: 'bg-accent-pink/15 border-accent-pink/30 text-accent-pink',
    shortcut: 'mod+n',
    category: 'communicate',
    path: 'dms',
  },
  {
    label: 'Channel',
    description: 'Create a topic or team channel',
    icon: Hash,
    tone: 'bg-muted border-border text-muted-foreground',
    category: 'communicate',
    path: null,
  },
  {
    label: 'Meeting',
    description: 'Start or schedule a video/audio chat',
    icon: Headphones,
    tone: 'bg-accent-green/15 border-accent-green/30 text-accent-green',
    category: 'communicate',
    path: 'meetings',
  },
  {
    label: 'Project Board',
    description: 'Track tasks & project boards',
    icon: FolderKanban,
    tone: 'bg-accent-amber/15 border-accent-amber/30 text-accent-amber',
    category: 'work',
    path: 'tasks',
  },
  {
    label: 'Doc & Note',
    description: 'Write collaborative documents & notes',
    icon: FileText,
    tone: 'bg-accent-blue/15 border-accent-blue/30 text-accent-blue',
    shortcut: 'mod+shift+n',
    category: 'work',
    path: 'docs',
  },
  {
    label: 'AI Agent',
    description: 'Build a custom autonomous agent',
    icon: Bot,
    tone: 'bg-accent-cyan/15 border-accent-cyan/30 text-accent-cyan',
    category: 'work',
    path: 'agents',
  },
  {
    label: 'Workflow',
    description: 'Automate tasks with the visual builder',
    icon: Workflow,
    tone: 'bg-accent-rose/15 border-accent-rose/30 text-accent-rose',
    category: 'work',
    path: 'automations',
  },
];

export interface SidebarFooterActionsProps {
  workspaceSlug: string;
  onCreateChannel: () => void;
  onOpenInvite?: () => void;
  onNewChat?: () => void;
  onOpenCustomizer?: () => void;
  isCollapsed?: boolean;
}

/**
 * Modern, responsive sidebar footer actions with quick create menu,
 * invite members trigger, customization shortcut, and collapsed rail support.
 */
export function SidebarFooterActions({
  workspaceSlug,
  onCreateChannel,
  onOpenInvite,
  onNewChat,
  onOpenCustomizer,
  isCollapsed = false,
}: SidebarFooterActionsProps) {
  const navigate = useNavigate();

  // Keyboard shortcut listener for 'I' (Invite members). Registered
  // unconditionally so hook order is stable across the collapsed/expanded
  // early returns below; the body no-ops when there is no invite handler.
  useEffect(() => {
    if (!onOpenInvite) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'i' || e.key === 'I') {
        const target = e.target as HTMLElement | null;
        const isInput =
          target?.tagName === 'INPUT' ||
          target?.tagName === 'TEXTAREA' ||
          target?.isContentEditable;
        if (!isInput && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          onOpenInvite();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenInvite]);

  const run = (action: CreateAction) => {
    if (action.path === null) {
      onCreateChannel();
      return;
    }
    if (action.label === 'AI Chat') {
      if (onNewChat) {
        onNewChat();
      } else {
        navigate(`/w/${workspaceSlug}/home`);
      }
      return;
    }
    navigate(`/w/${workspaceSlug}/${action.path}`);
  };

  const communicateActions = CREATE_ACTIONS.filter(
    (a) => a.category === 'communicate',
  );
  const workActions = CREATE_ACTIONS.filter((a) => a.category === 'work');

  // --- Collapsed Sidebar View (Clean vertical action buttons with tooltips) ---
  if (isCollapsed) {
    return (
      <div className="pt-2 pb-1 gap-1.5 px-1 flex w-full shrink-0 flex-col items-center border-t border-border/70">
        <Hint side="right" label="Invite members (I)">
          <button
            type="button"
            onClick={onOpenInvite}
            aria-label="Invite members (I)"
            className="size-9 flex cursor-pointer items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors duration-150 outline-none hover:bg-primary hover:text-primary-foreground focus-visible:ring-1 focus-visible:ring-ring"
          >
            <UserPlus className="size-4" />
          </button>
        </Hint>

        <DropdownMenu>
          <Hint side="right" label="Create new...">
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Create new item"
                className="size-9 flex items-center justify-center rounded-xl text-muted-foreground transition-colors duration-150 outline-none hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
              >
                <Plus className="size-4" />
              </button>
            </DropdownMenuTrigger>
          </Hint>

          <DropdownMenuContent
            align="start"
            side="right"
            sideOffset={8}
            className="w-80 p-1.5 shadow-xl border border-border bg-popover"
          >
            <DropdownMenuLabel className="px-2.5 py-1 font-semibold tracking-wider text-[11px] text-muted-foreground uppercase">
              Communicate
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              {communicateActions.map((action) => {
                const Icon = action.icon;
                return (
                  <DropdownMenuItem
                    key={action.label}
                    onSelect={() => run(action)}
                    className="gap-3 px-2.5 py-2 flex cursor-pointer items-center"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'size-8 flex shrink-0 items-center justify-center rounded-lg border',
                        action.tone,
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="gap-2 flex items-center justify-between">
                        <span className="text-xs font-medium text-foreground">
                          {action.label}
                        </span>
                        {action.shortcut ? (
                          <KbdShortcut
                            shortcut={action.shortcut}
                            size="xs"
                            variant="muted"
                          />
                        ) : null}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {action.description}
                      </span>
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>

            <DropdownMenuSeparator className="my-1" />

            <DropdownMenuLabel className="px-2.5 py-1 font-semibold tracking-wider text-[11px] text-muted-foreground uppercase">
              Work & Tools
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              {workActions.map((action) => {
                const Icon = action.icon;
                return (
                  <DropdownMenuItem
                    key={action.label}
                    onSelect={() => run(action)}
                    className="gap-3 px-2.5 py-2 flex cursor-pointer items-center"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'size-8 flex shrink-0 items-center justify-center rounded-lg border',
                        action.tone,
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="gap-2 flex items-center justify-between">
                        <span className="text-xs font-medium text-foreground">
                          {action.label}
                        </span>
                        {action.shortcut ? (
                          <KbdShortcut
                            shortcut={action.shortcut}
                            size="xs"
                            variant="muted"
                          />
                        ) : null}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {action.description}
                      </span>
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>

            <DropdownMenuSeparator className="my-1" />

            <DropdownMenuItem
              onSelect={() => navigate(`/w/${workspaceSlug}/directory`)}
              className="gap-3 px-2.5 py-2 flex cursor-pointer items-center"
            >
              <span
                aria-hidden
                className="size-8 flex shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground"
              >
                <UserPlus className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-xs font-medium block text-foreground">
                  Invite Teammates
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  Add members to this workspace
                </span>
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {onOpenCustomizer && (
          <Hint side="right" label="Customize sidebar">
            <button
              type="button"
              onClick={onOpenCustomizer}
              aria-label="Customize sidebar"
              className="size-9 flex items-center justify-center rounded-xl text-muted-foreground transition-colors duration-150 outline-none hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
            >
              <SlidersHorizontal className="size-4" />
            </button>
          </Hint>
        )}
      </div>
    );
  }

  // --- Expanded Sidebar Footer View (Refined Card UX) ---
  return (
    <div className="gap-1.5 flex w-full items-center">
      {/* Primary Invite Members Button */}
      <button
        type="button"
        onClick={onOpenInvite}
        className={cn(
          'group/invite-btn gap-2 px-2.5 py-1.5 flex flex-1 items-center justify-between',
          'rounded-lg border border-border/70 bg-surface-raised/80 hover:border-primary/30 hover:bg-primary/10',
          'text-xs font-medium text-foreground transition-all duration-150 ease-standard',
          'cursor-pointer outline-none select-none focus-visible:ring-1 focus-visible:ring-ring',
        )}
      >
        <span className="gap-2 flex items-center truncate">
          <UserPlus
            className="size-3.5 shrink-0 text-primary transition-colors group-hover/invite-btn:text-primary"
            aria-hidden
          />
          <span className="truncate">Invite members</span>
        </span>
        <Kbd size="xs" variant="muted">
          I
        </Kbd>
      </button>

      {/* Quick Create Dropdown Button */}
      <DropdownMenu>
        <Hint label="Create new item">
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'size-8 flex shrink-0 items-center justify-center rounded-lg border border-border/70',
                'bg-surface-raised/80 text-muted-foreground hover:border-border hover:bg-accent/80 hover:text-foreground',
                'cursor-pointer transition-all duration-150 ease-standard outline-none select-none focus-visible:ring-1 focus-visible:ring-ring',
              )}
              aria-label="Create new item"
            >
              <Plus className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
        </Hint>

        <DropdownMenuContent
          align="end"
          side="top"
          sideOffset={8}
          className="w-80 p-1.5 shadow-xl border border-border bg-popover"
        >
          <DropdownMenuLabel className="px-2.5 py-1 font-semibold tracking-wider text-[11px] text-muted-foreground uppercase">
            Communicate
          </DropdownMenuLabel>
          <DropdownMenuGroup>
            {communicateActions.map((action) => {
              const Icon = action.icon;
              return (
                <DropdownMenuItem
                  key={action.label}
                  onSelect={() => run(action)}
                  className="gap-3 px-2.5 py-2 flex cursor-pointer items-center"
                >
                  <span
                    aria-hidden
                    className={cn(
                      'size-8 flex shrink-0 items-center justify-center rounded-lg border',
                      action.tone,
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="gap-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">
                        {action.label}
                      </span>
                      {action.shortcut ? (
                        <KbdShortcut
                          shortcut={action.shortcut}
                          size="xs"
                          variant="muted"
                        />
                      ) : null}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {action.description}
                    </span>
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>

          <DropdownMenuSeparator className="my-1" />

          <DropdownMenuLabel className="px-2.5 py-1 font-semibold tracking-wider text-[11px] text-muted-foreground uppercase">
            Work & Tools
          </DropdownMenuLabel>
          <DropdownMenuGroup>
            {workActions.map((action) => {
              const Icon = action.icon;
              return (
                <DropdownMenuItem
                  key={action.label}
                  onSelect={() => run(action)}
                  className="gap-3 px-2.5 py-2 flex cursor-pointer items-center"
                >
                  <span
                    aria-hidden
                    className={cn(
                      'size-8 flex shrink-0 items-center justify-center rounded-lg border',
                      action.tone,
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="gap-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">
                        {action.label}
                      </span>
                      {action.shortcut ? (
                        <KbdShortcut
                          shortcut={action.shortcut}
                          size="xs"
                          variant="muted"
                        />
                      ) : null}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {action.description}
                    </span>
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>

          <DropdownMenuSeparator className="my-1" />

          <DropdownMenuItem
            onSelect={() => {
              if (onOpenInvite) {
                onOpenInvite();
              } else {
                navigate(`/w/${workspaceSlug}/invitations`);
              }
            }}
            className="gap-3 px-2.5 py-2 flex cursor-pointer items-center"
          >
            <span
              aria-hidden
              className="size-8 flex shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary"
            >
              <UserPlus className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-xs font-medium block text-foreground">
                Invite Teammates
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                Add members or share invite links
              </span>
            </span>
          </DropdownMenuItem>

          {onOpenCustomizer && (
            <>
              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuItem
                onSelect={onOpenCustomizer}
                className="gap-3 px-2.5 py-2 flex cursor-pointer items-center"
              >
                <span
                  aria-hidden
                  className="size-8 flex shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground"
                >
                  <SlidersHorizontal className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-xs font-medium block text-foreground">
                    Customize Sidebar
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    Reorder and toggle navigation items
                  </span>
                </span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Customize Sidebar Quick Button */}
      {onOpenCustomizer && (
        <Hint label="Customize navigation">
          <button
            type="button"
            onClick={onOpenCustomizer}
            className={cn(
              'size-8 flex shrink-0 items-center justify-center rounded-lg border border-border/70',
              'bg-surface-raised/80 text-muted-foreground hover:border-border hover:bg-accent/80 hover:text-foreground',
              'cursor-pointer transition-all duration-150 ease-standard outline-none select-none focus-visible:ring-1 focus-visible:ring-ring',
            )}
            aria-label="Customize sidebar navigation"
          >
            <SlidersHorizontal className="size-3.5" />
          </button>
        </Hint>
      )}
    </div>
  );
}
