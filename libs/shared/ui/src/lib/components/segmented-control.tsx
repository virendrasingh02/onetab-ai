import { cn } from '@org/utils';
import { useId } from 'react';

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
  /** Optional longer description for assistive technology. */
  hint?: string;
}

export interface SegmentedControlProps<T extends string | number> {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** Required: names the group for screen readers. */
  'aria-label': string;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * A compact exclusive choice — date ranges, view modes, filters.
 *
 * Built on native radio inputs rather than buttons so arrow-key navigation,
 * group semantics and form association come from the platform. The inputs are
 * visually hidden but remain focusable, and the visible label carries the
 * focus ring via `peer-focus-visible`.
 */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  size = 'md',
  className,
  'aria-label': ariaLabel,
}: SegmentedControlProps<T>) {
  const name = useId();

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'gap-0.5 p-0.5 inline-flex items-center rounded-lg border bg-surface-inset',
        className,
      )}
    >
      {options.map((option) => {
        const id = `${name}-${option.value}`;
        const selected = option.value === value;

        return (
          <div key={String(option.value)} className="contents">
            <input
              type="radio"
              id={id}
              name={name}
              className="peer sr-only"
              checked={selected}
              aria-describedby={option.hint ? `${id}-hint` : undefined}
              onChange={() => onChange(option.value)}
            />
            <label
              htmlFor={id}
              className={cn(
                'font-medium cursor-pointer rounded-md transition-colors duration-(--duration-fast)',
                'peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/40',
                size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
                selected
                  ? 'shadow-xs bg-background text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {option.label}
            </label>
            {option.hint ? (
              <span id={`${id}-hint`} className="sr-only">
                {option.hint}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
