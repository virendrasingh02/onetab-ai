import { Eye } from 'lucide-react';
import type { KeyboardEvent, ReactNode } from 'react';
import { cn } from '@org/utils';
import { SystemEventTimestamp } from './cards/system-event-card.js';
import { CHAT_ROW } from './chat-row.js';

export interface PrivateNoticeRowProps {
  /** Full sentence for screen readers, announced when the row appears. */
  ariaLabel: string;
  /** A 40px avatar, in the message avatar column. */
  avatar: ReactNode;
  name: string;
  /** Sits after the name, e.g. the entity kind badge. */
  badge?: ReactNode;
  timestamp: number;
  /** Buttons under the body. */
  actions: ReactNode;
  /** Escape dismisses the row. */
  onDismiss: () => void;
  className?: string;
  children: ReactNode;
}

/**
 * A client-only timeline row: laid out exactly like a message, with an
 * "Only visible to you" label above it in the spot "Saved for later" uses.
 */
export function PrivateNoticeRow({
  ariaLabel,
  avatar,
  name,
  badge,
  timestamp,
  actions,
  onDismiss,
  className,
  children,
}: PrivateNoticeRowProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onDismiss();
    }
  };

  return (
    <section
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={cn(
        'gap-x-4 pt-2.5 pb-1 relative flex flex-wrap',
        'animate-in fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none',
        CHAT_ROW,
        className,
      )}
    >
      <div className="mb-1 gap-x-4 flex basis-full items-center">
        <span aria-hidden className="w-10 shrink-0" />
        <span className="gap-1 font-semibold inline-flex items-center text-xs text-muted-foreground">
          <Eye className="size-3 shrink-0" aria-hidden />
          Only visible to you
        </span>
      </div>

      <div className="w-10 shrink-0">{avatar}</div>

      <div className="min-w-0 flex-1">
        <header className="gap-2 flex items-baseline">
          <span className="font-bold text-message text-foreground">{name}</span>
          {badge}
          <SystemEventTimestamp timestamp={timestamp} />
        </header>
        {children}
        <div className="mt-2 gap-1.5 flex flex-wrap items-center">{actions}</div>
      </div>
    </section>
  );
}
