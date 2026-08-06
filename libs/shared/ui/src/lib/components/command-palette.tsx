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
import { Dialog, DialogContent, DialogTitle } from './dialog.js';

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeholder?: string;
  children?: ReactNode;
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
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  const defaultCommands: CommandItem[] = [
    {
      id: 'tasks',
      category: 'Navigation',
      label: 'Go to Kanban Board / Tasks',
      icon: <CheckSquare className="size-4 text-[#6E56CF]" />,
      shortcut: 'G T',
      action: () => {
        onOpenChange(false);
        navigate('tasks');
      },
    },
    {
      id: 'docs',
      category: 'Navigation',
      label: 'Go to Document Editor',
      icon: <FileText className="size-4 text-[#30A46C]" />,
      shortcut: 'G D',
      action: () => {
        onOpenChange(false);
        navigate('docs');
      },
    },
    {
      id: 'ai-chat',
      category: 'AI Workflows',
      label: 'Open AI Assistant',
      icon: <Sparkles className="size-4 text-[#6E56CF]" />,
      shortcut: 'G A',
      action: () => {
        onOpenChange(false);
        navigate('ai-chat');
      },
    },
    {
      id: 'automations',
      category: 'AI Workflows',
      label: 'Automations & Workflows',
      icon: <Zap className="size-4 text-[#FFB224]" />,
      shortcut: 'G W',
      action: () => {
        onOpenChange(false);
        navigate('automations');
      },
    },
    {
      id: 'calendar',
      category: 'Navigation',
      label: 'Calendar & Schedule',
      icon: <Calendar className="size-4 text-[#3E63DD]" />,
      shortcut: 'G C',
      action: () => {
        onOpenChange(false);
        navigate('calendar');
      },
    },
    {
      id: 'members',
      category: 'Team',
      label: 'Team Directory & Members',
      icon: <Users className="size-4 text-[#A1A1AA]" />,
      action: () => {
        onOpenChange(false);
        navigate('members');
      },
    },
    {
      id: 'new-channel',
      category: 'Create',
      label: 'Create New Channel',
      icon: <Plus className="size-4 text-[#30A46C]" />,
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
      icon: <Settings className="size-4 text-[#71717A]" />,
      shortcut: 'G S',
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
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % (filtered.length || 1));
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
        className="top-[16%] max-w-xl translate-y-0 overflow-hidden p-0 border-[#27272A] bg-[#111113]"
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>

        <div className="flex items-center gap-2.5 border-b border-[#27272A] px-4 py-1">
          <Search className="size-4 shrink-0 text-[#71717A]" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            aria-label={placeholder}
            className="h-11 w-full bg-transparent text-xs text-[#FAFAFA] placeholder:text-[#71717A] outline-none"
          />
          <kbd className="rounded-[6px] border border-[#27272A] bg-[#16171A] px-1.5 py-0.5 font-mono text-[10px] text-[#A1A1AA]">
            ESC
          </kbd>
        </div>

        <div className="max-h-[24rem] overflow-y-auto p-1.5 scrollbar-subtle">
          {children ? (
            children
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#71717A]">
              No commands found matching "{query}"
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {filtered.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={item.id}
                    onClick={() => item.action()}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-[6px] px-3 py-2 text-xs transition-colors duration-[120ms]',
                      isSelected
                        ? 'bg-[#1E1F23] text-[#FAFAFA]'
                        : 'text-[#A1A1AA] hover:bg-[#1E1F23]/60 hover:text-[#FAFAFA]',
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      {item.icon}
                      <span className="font-medium">{item.label}</span>
                      <span className="text-[10px] text-[#71717A] font-mono">
                        · {item.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.shortcut ? (
                        <kbd className="rounded bg-[#16171A] px-1.5 py-0.5 font-mono text-[10px] text-[#71717A] border border-[#27272A]">
                          {item.shortcut}
                        </kbd>
                      ) : null}
                      {isSelected ? (
                        <ArrowRight className="size-3 text-[#6E56CF]" />
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[#27272A] bg-[#09090B] px-4 py-2 text-[11px] text-[#71717A]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-[#16171A] px-1 py-0.5 font-mono text-[9px] border border-[#27272A]">↵</kbd> select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-[#16171A] px-1 py-0.5 font-mono text-[9px] border border-[#27272A]">↑↓</kbd> navigate
            </span>
          </div>
          <span className="flex items-center gap-1 text-[#6E56CF]">
            <Sparkles className="size-3" /> Linear AI enabled
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isInput =
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(
          (event.target as HTMLElement)?.tagName,
        ) || (event.target as HTMLElement)?.isContentEditable;

      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((prev) => !prev);
      } else if (event.key === '/' && !isInput) {
        event.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return { open, setOpen };
}
