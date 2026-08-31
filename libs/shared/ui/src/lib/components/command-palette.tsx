import { cn } from '@org/utils';
import {
  ArrowRight,
  Calendar,
  CheckSquare,
  FileText,
  Plus,
  Search,
  Settings,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScrollArea } from './scroll-area.js';
import { Dialog, DialogContent, DialogTitle } from './dialog.js';
import { Kbd, KbdShortcut, useKeyboardShortcut } from './kbd.js';

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeholder?: string;
  /** Replaces the built-in command list entirely. */
  children?: ReactNode;
  /**
   * Workspace search results, rendered above the commands once the user has
   * typed. Receives the live query so the caller can run its own request —
   * this library stays presentational and never fetches.
   */
  renderResults?: (query: string) => ReactNode;
}

interface CommandItem {
  id: string;
  category: string;
  label: string;
  icon: ReactNode;
  shortcut?: string;
  action: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  placeholder = 'Type a command or search…',
  children,
  renderResults,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  const defaultCommands: CommandItem[] = [
    {
      id: 'tasks',
      category: 'Navigation',
      label: 'Go to Kanban Board / Tasks',
      icon: <CheckSquare className="size-4 text-accent-violet" />,
      shortcut: 'G T',
      action: () => {
        onOpenChange(false);
        navigate('tasks');
      },
    },
    {
      id: 'docs',
      category: 'Navigation',
      label: 'Go to Document Editor & Notes',
      icon: <FileText className="size-4 text-accent-green" />,
      shortcut: 'G D',
      action: () => {
        onOpenChange(false);
        navigate('docs');
      },
    },
    {
      id: 'whiteboards',
      category: 'Navigation',
      label: 'Open Whiteboard Canvas',
      icon: <Sparkles className="size-4 text-accent-cyan" />,
      action: () => {
        onOpenChange(false);
        navigate('whiteboards');
      },
    },
    {
      id: 'meetings',
      category: 'Navigation',
      label: 'Go to Meetings & Huddles',
      icon: <Calendar className="size-4 text-accent-blue" />,
      shortcut: 'G M',
      action: () => {
        onOpenChange(false);
        navigate('meetings');
      },
    },
    {
      id: 'schedule',
      category: 'Navigation',
      label: 'Go to Schedule & Calendar',
      icon: <Calendar className="size-4 text-accent-amber" />,
      shortcut: 'G C',
      action: () => {
        onOpenChange(false);
        navigate('schedule');
      },
    },
    {
      id: 'ai-chat',
      category: 'AI Workflows',
      label: 'Open AI Assistant Copilot',
      icon: <Sparkles className="size-4 text-accent-violet" />,
      shortcut: 'G A',
      action: () => {
        onOpenChange(false);
        navigate('ai-chat');
      },
    },
    {
      id: 'agents',
      category: 'AI Workflows',
      label: 'AI Agent Marketplace & Builder',
      icon: <Sparkles className="size-4 text-accent-green" />,
      action: () => {
        onOpenChange(false);
        navigate('agents');
      },
    },
    {
      id: 'automations',
      category: 'AI Workflows',
      label: 'Automations & Workflow Canvas',
      icon: <Zap className="size-4 text-accent-amber" />,
      shortcut: 'G W',
      action: () => {
        onOpenChange(false);
        navigate('automations');
      },
    },
    {
      id: 'integrations',
      category: 'Tools',
      label: 'Integration Hub & Connected Apps',
      icon: <Settings className="size-4 text-accent-blue" />,
      action: () => {
        onOpenChange(false);
        navigate('integrations');
      },
    },
    {
      id: 'members',
      category: 'Team',
      label: 'Team Directory & Member Presence',
      icon: <Users className="size-4 text-muted-foreground" />,
      action: () => {
        onOpenChange(false);
        navigate('members');
      },
    },
    {
      id: 'invitations',
      category: 'Team',
      label: 'Invite People & Shareable Links',
      icon: <Users className="size-4 text-primary" />,
      shortcut: 'I',
      action: () => {
        onOpenChange(false);
        navigate('invitations');
      },
    },
    {
      id: 'design-system',
      category: 'Design System',
      label: 'Open Design System Studio & Component Explorer',
      icon: <Sparkles className="size-4 text-primary" />,
      shortcut: 'G S',
      action: () => {
        onOpenChange(false);
        navigate('design-system');
      },
    },
    {
      id: 'new-channel',
      category: 'Create',
      label: 'Create New Channel',
      icon: <Plus className="size-4 text-accent-green" />,
      shortcut: 'N C',
      action: () => {
        onOpenChange(false);
        navigate('channels/new');
      },
    },
    {
      id: 'settings',
      category: 'Settings',
      label: 'Workspace & Profile Settings',
      icon: <Settings className="size-4 text-subtle" />,
      action: () => {
        onOpenChange(false);
        navigate('settings');
      },
    },
  ];

  const filtered = defaultCommands.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(query.toLowerCase()) ||
      cmd.category.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(
        (prev) => (prev - 1 + filtered.length) % (filtered.length || 1),
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className="max-w-xl translate-y-0 p-0 top-[16%] overflow-hidden"
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>

        <div className="gap-2.5 px-4 py-1 flex items-center border-b border-border">
          <Search className="size-4 shrink-0 text-subtle" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            aria-label={placeholder}
            className="h-11 text-xs w-full bg-transparent text-foreground outline-none placeholder:text-subtle"
          />
          <Kbd size="xs" variant="muted">
            ESC
          </Kbd>
        </div>

        <ScrollArea className="max-h-96" contentClassName="p-1.5">
          {/*
            Results first: once someone has typed, the thing they are looking
            for is far more likely to be a channel or a document than one of
            the eight static navigation commands.
          */}
          {renderResults && query ? (
            <div className="mb-2 pb-2 border-b border-border">
              {renderResults(query)}
            </div>
          ) : null}

          {children ? (
            children
          ) : filtered.length === 0 ? (
            renderResults && query ? null : (
              <div className="p-8 text-xs text-center text-subtle">
                No commands found matching "{query}"
              </div>
            )
          ) : (
            <div className="gap-0.5 flex flex-col">
              {filtered.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={item.id}
                    onClick={() => item.action()}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={cn(
                      'px-3 py-2 text-xs flex w-full items-center justify-between rounded-btn',
                      'transition-colors duration-(--duration-fast) ease-standard',
                      isSelected
                        ? 'bg-accent text-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <div className="gap-2.5 flex items-center">
                      {item.icon}
                      <span className="font-medium">{item.label}</span>
                      <span className="font-mono text-[10px] text-subtle">
                        · {item.category}
                      </span>
                    </div>
                    <div className="gap-2 flex items-center">
                      {item.shortcut ? (
                        <KbdShortcut shortcut={item.shortcut} size="xs" variant="muted" />
                      ) : null}
                      {isSelected ? (
                        <ArrowRight className="size-3 text-primary" />
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="px-4 py-2 flex items-center justify-between border-t border-border bg-surface-muted text-[11px] text-subtle">
          <div className="gap-3 flex items-center">
            <span className="gap-1 flex items-center">
              <Kbd size="xs" variant="default">
                ↵
              </Kbd>{' '}
              select
            </span>
            <span className="gap-1 flex items-center">
              <Kbd size="xs" variant="default">
                ↑↓
              </Kbd>{' '}
              navigate
            </span>
          </div>
          <span className="gap-1 flex items-center text-primary-text">
            <Sparkles className="size-3" /> Linear AI enabled
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useKeyboardShortcut(
    'mod+k',
    () => {
      setOpen((prev) => !prev);
    },
    { enableOnInput: true },
  );

  useKeyboardShortcut(
    '/',
    () => {
      setOpen(true);
    },
    { enableOnInput: false },
  );

  return { open, setOpen };
}
