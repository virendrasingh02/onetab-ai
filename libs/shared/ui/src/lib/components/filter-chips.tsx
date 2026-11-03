import { cn } from '@org/utils';
import type { ReactNode } from 'react';

export interface FilterChipOption<T extends string> {
  value: T;
  label: string;
  count?: number;
  icon?: ReactNode;
  /** `destructive` for a Trash-style filter. */
  tone?: 'destructive';
}

/** One-of-many filter shown as pills with counts (status, kind…). */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
}: {
  options: ReadonlyArray<FilterChipOption<T>>;
  value: T;
  onChange: (value: T) => void;
  'aria-label': string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap items-center gap-1">
      {options.map((o) => {
        const active = o.value === value;
        const destructive = o.tone === 'destructive';
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 [&_svg]:size-3.5',
              active
                ? destructive
                  ? 'bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/25'
                  : 'bg-primary/10 text-primary ring-1 ring-inset ring-primary/25'
                : 'text-muted-foreground hover:bg-surface-raised hover:text-foreground',
            )}
          >
            {o.icon}
            {o.label}
            {o.count !== undefined ? (
              <span
                className={cn(
                  'min-w-4 rounded px-1 text-center text-2xs tabular-nums',
                  active ? 'bg-current/10' : 'bg-muted text-muted-foreground',
                )}
              >
                {o.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
