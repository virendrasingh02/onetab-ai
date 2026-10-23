import { Button } from '@org/ui';
import { cn } from '@org/utils';
import { Check, Loader2, Save } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

export interface SettingsNavItem {
  id: string;
  label: string;
  icon: ReactNode;
}

interface AgentSettingsLayoutProps {
  items: readonly SettingsNavItem[];
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  children: ReactNode;
}

/**
 * Settings frame: a sticky section index beside the content (chips on narrow
 * screens) that tracks the section in view, and a bottom bar that appears only
 * while there are unsaved changes — instead of a long form with a save button
 * parked at the very end.
 */
export function AgentSettingsLayout({ items, isDirty, isSaving, onSave, children }: AgentSettingsLayoutProps) {
  const [active, setActive] = useState(items[0]?.id ?? '');

  useEffect(() => {
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.set(entry.target.id, entry.boundingClientRect.top);
          else visible.delete(entry.target.id);
        }
        const first = items.find((item) => visible.has(item.id));
        if (first) setActive(first.id);
      },
      { rootMargin: '-80px 0px -60% 0px' },
    );
    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [items]);

  const jump = (id: string) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
      <nav
        aria-label="Settings sections"
        className="sticky top-0 z-10 -mx-1 flex gap-1 overflow-x-auto bg-background/90 px-1 py-2 backdrop-blur lg:top-4 lg:mx-0 lg:flex-col lg:self-start lg:overflow-visible lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
      >
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => jump(item.id)}
            aria-current={active === item.id ? 'true' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs font-medium transition-colors [&_svg]:size-3.5',
              active === item.id
                ? 'bg-primary/10 text-foreground'
                : 'text-muted-foreground hover:bg-surface-raised hover:text-foreground',
            )}
          >
            <span aria-hidden className={cn(active === item.id && 'text-primary')}>
              {item.icon}
            </span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="flex min-w-0 flex-col gap-5">
        {children}

        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-raised/95 px-4 py-2.5 shadow-lg backdrop-blur">
          <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status" aria-live="polite">
            {isDirty ? (
              <>
                <span className="size-2 rounded-full bg-warning" aria-hidden />
                You have unsaved changes
              </>
            ) : (
              <>
                <Check className="size-3.5 text-primary" aria-hidden />
                All changes saved
              </>
            )}
          </p>
          <Button size="sm" onClick={onSave} disabled={!isDirty || isSaving} className="gap-1.5 text-xs font-semibold">
            {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            {isSaving ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
