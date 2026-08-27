import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Hint,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Bot,
  FileText,
  FolderKanban,
  Hash,
  Headphones,
  MessageCircle,
  Plus,
  SlidersHorizontal,
  Sparkles,
  SquarePen,
  UserPlus,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { useMemo } from 'react';
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
    shortcut: 'Ctrl+O',
    category: 'communicate',
    path: 'home',
  },
  {
    label: 'Direct Message',
    description: 'Send a private message to a teammate',
    icon: SquarePen,
    tone: 'bg-accent-pink/15 border-accent-pink/30 text-accent-pink',
    shortcut: 'Ctrl+N',
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
    shortcut: 'Ctrl+Shift+N',
    category: 'work',
    path: 'docs',
  },
  {
    label: 'AI Agent',
    description: 'Build a custom autonomous agent',
    icon: Bot,
    tone: 'bg-accent-cyan/15 border-accent-cyan/30 text-accent-cyan',
    category: 'work',
    path: 'agents?tab=all',
  },
  {
    label: 'Workflow',
    description: 'Automate tasks with the visual builder',
    icon: Workflow,
    tone: 'bg-accent-rose/15 border-accent-rose/30 text-accent-rose',
    category: 'work',
    path: 'automations?tab=all',
  },
];

export interface SidebarFooterActionsProps {
  workspaceSlug: string;
  onCreateChannel: () => void;
  onNewChat: () => void;
  onOpenCustomizer?: () => void;
  isCollapsed?: boolean;
}

/**
 * Modern, responsive sidebar footer actions with quick create menu,
 * new chat trigger, customization shortcut, and collapsed rail support.
 */
export function SidebarFooterActions({
  workspaceSlug,
  onCreateChannel,
  onNewChat,
  onOpenCustomizer,
  isCollapsed = false,
}: SidebarFooterActionsProps) {
  const navigate = useNavigate();

  const isMac = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
  }, []);

  const shortcutLabel = isMac ? '⌘O' : 'Ctrl+O';

  const run = (action: CreateAction) => {
    if (action.path === null) {
      onCreateChannel();
      return;
    }
    if (action.label === 'AI Chat') {
      onNewChat();
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
      <div className="pt-2 pb-1 border-t border-border/70 flex flex-col items-center gap-1.5 shrink-0 w-full px-1">
        <Hint side="right" label={`New chat (${shortcutLabel})`}>
          <button
            type="button"
            onClick={onNewChat}
            aria-label={`New chat (${shortcutLabel})`}
            className="size-9 flex items-center justify-center rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors duration-150 outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <MessageCircle className="size-4" />
          </button>
        </Hint>

        <DropdownMenu>
          <Hint side="right" label="Create new...">
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Create new item"
                className="size-9 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-colors duration-150 outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
            <DropdownMenuLabel className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Communicate
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              {communicateActions.map((action) => {
                const Icon = action.icon;
                return (
                  <DropdownMenuItem
                    key={action.label}
                    onSelect={() => run(action)}
                    className="gap-3 px-2.5 py-2 flex items-center cursor-pointer"
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
                          <kbd className="rounded px-1.5 py-0.5 border border-border/50 bg-muted/60 font-mono text-[10px] text-muted-foreground">
                            {action.shortcut}
                          </kbd>
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

            <DropdownMenuLabel className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Work & Tools
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              {workActions.map((action) => {
                const Icon = action.icon;
                return (
                  <DropdownMenuItem
                    key={action.label}
                    onSelect={() => run(action)}
                    className="gap-3 px-2.5 py-2 flex items-center cursor-pointer"
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
                          <kbd className="rounded px-1.5 py-0.5 border border-border/50 bg-muted/60 font-mono text-[10px] text-muted-foreground">
                            {action.shortcut}
                          </kbd>
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
              className="gap-3 px-2.5 py-2 flex items-center cursor-pointer"
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
              className="size-9 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-colors duration-150 outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
    <div className="gap-1.5 flex items-center">
      {/* Primary New Chat Button with Shortcut Badge */}
      <button
        type="button"
        onClick={onNewChat}
        className={cn(
          'group/new-chat gap-2 px-2.5 py-1.5 flex flex-1 items-center justify-between',
          'rounded-lg border border-border/70 bg-surface-raised/80 hover:bg-accent/80 hover:border-border',
          'text-xs font-medium text-foreground transition-all duration-150 ease-standard',
          'cursor-pointer outline-none select-none focus-visible:ring-1 focus-visible:ring-ring',
        )}
      >
        <span className="gap-2 flex items-center truncate">
          <MessageCircle
            className="size-3.5 shrink-0 text-muted-foreground group-hover/new-chat:text-foreground transition-colors"
            aria-hidden
          />
          <span className="truncate">New chat</span>
        </span>
        <kbd className="rounded px-1.5 py-0.5 border border-border/50 bg-background/80 font-sans text-[10px] text-muted-foreground tabular-nums select-none">
          {shortcutLabel}
        </kbd>
      </button>

      {/* Quick Create Dropdown Button */}
      <DropdownMenu>
        <Hint label="Create new item">
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'size-8 flex shrink-0 items-center justify-center rounded-lg border border-border/70',
                'bg-surface-raised/80 text-muted-foreground hover:bg-accent/80 hover:text-foreground hover:border-border',
                'transition-all duration-150 ease-standard cursor-pointer outline-none select-none focus-visible:ring-1 focus-visible:ring-ring',
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
          <DropdownMenuLabel className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Communicate
          </DropdownMenuLabel>
          <DropdownMenuGroup>
            {communicateActions.map((action) => {
              const Icon = action.icon;
              return (
                <DropdownMenuItem
                  key={action.label}
                  onSelect={() => run(action)}
                  className="gap-3 px-2.5 py-2 flex items-center cursor-pointer"
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
                        <kbd className="rounded px-1.5 py-0.5 border border-border/50 bg-muted/60 font-mono text-[10px] text-muted-foreground">
                          {action.shortcut}
                        </kbd>
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

          <DropdownMenuLabel className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Work & Tools
          </DropdownMenuLabel>
          <DropdownMenuGroup>
            {workActions.map((action) => {
              const Icon = action.icon;
              return (
                <DropdownMenuItem
                  key={action.label}
                  onSelect={() => run(action)}
                  className="gap-3 px-2.5 py-2 flex items-center cursor-pointer"
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
                        <kbd className="rounded px-1.5 py-0.5 border border-border/50 bg-muted/60 font-mono text-[10px] text-muted-foreground">
                          {action.shortcut}
                        </kbd>
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
            className="gap-3 px-2.5 py-2 flex items-center cursor-pointer"
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

          {onOpenCustomizer && (
            <>
              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuItem
                onSelect={onOpenCustomizer}
                className="gap-3 px-2.5 py-2 flex items-center cursor-pointer"
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
              'bg-surface-raised/80 text-muted-foreground hover:bg-accent/80 hover:text-foreground hover:border-border',
              'transition-all duration-150 ease-standard cursor-pointer outline-none select-none focus-visible:ring-1 focus-visible:ring-ring',
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
