import { cn } from '@org/utils';
import { useId, type ReactNode } from 'react';

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
  icon?: ReactNode;
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
  /** `fill` shares the full width equally; `tiles` also stacks each icon over its label. */
  layout?: 'inline' | 'fill' | 'tiles';
  disabled?: boolean;
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
  layout = 'inline',
  disabled = false,
  className,
  'aria-label': ariaLabel,
}: SegmentedControlProps<T>) {
  const name = useId();

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'gap-0.5 p-0.5 relative rounded-lg border bg-surface-inset',
        layout === 'inline'
          ? 'inline-flex items-center'
          : 'grid w-full auto-cols-fr grid-flow-col',
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
              disabled={disabled}
              aria-describedby={option.hint ? `${id}-hint` : undefined}
              onChange={() => onChange(option.value)}
            />
            <label
              htmlFor={id}
              className={cn(
                'font-medium rounded-md transition-colors duration-(--duration-fast)',
                'peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/40',
                size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
                layout !== 'inline' &&
                  'gap-1.5 min-w-0 [&_svg]:size-3.5 flex items-center justify-center text-center [&_svg]:shrink-0',
                layout === 'tiles' &&
                  'gap-1 px-1 py-1.5 [&_svg]:size-4 flex-col',
                disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                selected
                  ? 'bg-background text-foreground shadow-xs'
                  : cn(
                      'text-muted-foreground',
                      !disabled && 'hover:text-foreground',
                    ),
              )}
            >
              {option.icon}
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
