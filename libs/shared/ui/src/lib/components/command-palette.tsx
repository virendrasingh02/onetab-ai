import { cn } from '@org/utils';
import { CornerDownLeft, Search } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogTitle } from './dialog.js';
import { EmptyState } from './empty-state.js';

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeholder?: string;
  /** Rendered below the input. Left open for the search feature to fill. */
  children?: ReactNode;
}

/**
 * Command palette shell.
 *
 * Phase 2 ships the surface, shortcut handling and empty state; result
 * providers (channels, members, files, actions) plug in via `children` once
 * the search backend exists.
 */
export function CommandPalette({
  open,
  onOpenChange,
  placeholder = 'Search channels, people and files…',
  children,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');

  // Reset between openings so a stale query never flashes on reopen.
  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className="top-[18%] max-w-xl translate-y-0 overflow-hidden p-0"
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>

        <div className="flex items-center gap-2 border-b px-4">
          <Search className="text-muted-foreground size-4 shrink-0" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className={cn(
              'placeholder:text-muted-foreground h-12 w-full bg-transparent text-sm outline-none',
            )}
          />
          <kbd className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 font-mono text-[10px]">
            ESC
          </kbd>
        </div>

        <div className="max-h-[22rem] overflow-y-auto p-2">
          {children ?? (
            <EmptyState
              size="sm"
              icon={<Search />}
              title={query ? 'No results' : 'Search across your workspace'}
              description={
                query
                  ? `Nothing matched “${query}”.`
                  : 'Jump to a channel, find a teammate, or open a file.'
              }
            />
          )}
        </div>

        <div className="text-muted-foreground flex items-center gap-3 border-t px-4 py-2 text-[11px]">
          <span className="flex items-center gap-1">
            <CornerDownLeft className="size-3" aria-hidden /> to select
          </span>
          <span>↑↓ to navigate</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Registers the global palette shortcut (⌘K / Ctrl-K).
 * Returns the open state so a trigger button can reflect it.
 */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((previous) => !previous);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return { open, setOpen };
}
