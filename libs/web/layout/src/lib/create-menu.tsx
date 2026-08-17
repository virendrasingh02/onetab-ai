import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
  SquarePen,
  Sparkles,
  UserPlus,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CreateAction {
  label: string;
  description: string;
  icon: LucideIcon;
  /** Tailwind classes for the icon medallion. */
  tone: string;
  shortcut?: string;
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
    path: 'home',
  },
  {
    label: 'Direct Message',
    description: 'Send a private message to a teammate',
    icon: SquarePen,
    tone: 'bg-accent-pink/15 border-accent-pink/30 text-accent-pink',
    shortcut: 'Ctrl+N',
    // Was wired to `onCreateChannel` — it opened the create-*channel* form.
    path: 'dms',
  },
  {
    label: 'Channel',
    description: 'Create a topic or team channel',
    icon: Hash,
    tone: 'bg-muted border-border text-muted-foreground',
    path: null,
  },
  {
    label: 'Project Board',
    description: 'Track tasks & project boards',
    icon: FolderKanban,
    tone: 'bg-accent-amber/15 border-accent-amber/30 text-accent-amber',
    path: 'tasks',
  },
  {
    label: 'AI Agent',
    description: 'Build a custom autonomous agent',
    icon: Bot,
    tone: 'bg-accent-cyan/15 border-accent-cyan/30 text-accent-cyan',
    path: 'agents?tab=all',
  },
  {
    label: 'Workflow',
    description: 'Automate tasks with the visual builder',
    icon: Workflow,
    tone: 'bg-accent-rose/15 border-accent-rose/30 text-accent-rose',
    path: 'automations?tab=all',
  },
  {
    label: 'Doc & Note',
    description: 'Write collaborative documents & notes',
    icon: FileText,
    tone: 'bg-accent-blue/15 border-accent-blue/30 text-accent-blue',
    shortcut: 'Ctrl+Shift+N',
    path: 'docs',
  },
  {
    label: 'Meeting',
    description: 'Start or schedule a video/audio chat',
    icon: Headphones,
    tone: 'bg-accent-green/15 border-accent-green/30 text-accent-green',
    path: 'meetings',
  },
];

export interface SidebarFooterActionsProps {
  workspaceSlug: string;
  onCreateChannel: () => void;
  onNewChat: () => void;
}

/**
 * The pinned footer: a primary "New chat" button plus the create menu.
 *
 * Every medallion here used to be a raw Tailwind palette colour
 * (`bg-violet-500/15`, `text-cyan-400`, …) which ignored the theme entirely and
 * did not respond to light mode. They now resolve through the accent tokens.
 */
export function SidebarFooterActions({
  workspaceSlug,
  onCreateChannel,
  onNewChat,
}: SidebarFooterActionsProps) {
  const navigate = useNavigate();

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

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onNewChat}
        className={cn(
          // `rounded-btn`, not `rounded-full`: these two were the only pills in
          // a sidebar built entirely on the button radius token.
          'flex flex-1 items-center justify-between gap-2 rounded-btn border border-border/60',
          'bg-secondary/80 px-3 py-2 text-xs font-medium text-secondary-foreground',
          'transition-colors duration-(--duration-fast) ease-standard hover:bg-secondary',
          'outline-none focus-visible:ring-1 focus-visible:ring-ring',
        )}
      >
        <span className="flex items-center gap-2">
          {/* Was a hand-inlined 14-line <svg>; lucide already ships this. */}
          <MessageCircle className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>New chat</span>
        </span>
        <kbd className="rounded border border-border/40 bg-background/70 px-1.5 py-0.5 font-sans text-[10px] tabular-nums text-muted-foreground">
          Ctrl+O
        </kbd>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex size-8.5 shrink-0 items-center justify-center rounded-btn border border-border/60',
              'bg-secondary/80 text-muted-foreground',
              'transition-colors duration-(--duration-fast) ease-standard',
              'hover:bg-secondary hover:text-foreground',
              'outline-none focus-visible:ring-1 focus-visible:ring-ring',
            )}
            aria-label="Create new item"
          >
            <Plus className="size-4" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          side="top"
          sideOffset={8}
          className="w-80 p-1.5"
        >
          <DropdownMenuLabel className="px-2.5 py-1.5 text-[11px] font-medium tracking-wide text-subtle uppercase">
            Create
          </DropdownMenuLabel>

          {CREATE_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <DropdownMenuItem
                key={action.label}
                onSelect={() => run(action)}
                className="flex items-center gap-3 px-2.5 py-2"
              >
                <span
                  aria-hidden
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full border',
                    action.tone,
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-foreground">
                      {action.label}
                    </span>
                    {action.shortcut ? (
                      <kbd className="rounded border border-border/40 bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
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

          <DropdownMenuSeparator className="my-1" />

          <DropdownMenuItem
            onSelect={() => navigate(`/w/${workspaceSlug}/directory`)}
            className="flex items-center gap-3 px-2.5 py-2"
          >
            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center text-muted-foreground"
            >
              <UserPlus className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-foreground">
                Invite Teammates
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                Add members to this workspace
              </span>
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
