import { cn } from '@org/utils';
import { Search, X } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Input } from './input.js';

export interface SearchInputProps extends Omit<
  ComponentProps<'input'>,
  'value' | 'onChange' | 'type'
> {
  value: string;
  onValueChange: (value: string) => void;
  /** Names the field for assistive tech. Falls back to the placeholder. */
  label?: string;
  /** Classes for the positioning wrapper — this is where width belongs. */
  wrapperClassName?: string;
}

/**
 * The filter field that sits above a list.
 *
 * Every list screen had built its own: some used `Input` with a leading icon,
 * some a bare `<input>` with hand-positioned decoration, and only one offered
 * a way to clear the query — so "how do I get back to the full list?" had a
 * different answer on each screen. The shared version always clears, by button
 * or by Escape, and the button is only in the tab order when there is
 * something to clear.
 *
 * `type="search"` rather than `text`: it gets the right on-screen keyboard on
 * mobile and the right announcement from screen readers. The browser's own
 * clear affordance is suppressed in the theme so it cannot sit next to ours.
 */
export function SearchInput({
  value,
  onValueChange,
  label,
  placeholder = 'Search',
  className,
  wrapperClassName,
  onKeyDown,
  ...props
}: SearchInputProps) {
  const accessibleName = label ?? placeholder;

  return (
    <Input
      {...props}
      type="search"
      wrapperClassName={wrapperClassName}
      value={value}
      placeholder={placeholder}
      aria-label={accessibleName}
      onChange={(event) => onValueChange(event.target.value)}
      onKeyDown={(event) => {
        // Escape clears rather than blurring — matches the command palette.
        if (event.key === 'Escape' && value) {
          event.preventDefault();
          onValueChange('');
        }
        onKeyDown?.(event);
      }}
      className={cn('pr-8', className)}
      leadingIcon={<Search />}
      trailingSlot={
        value ? (
          <button
            type="button"
            onClick={() => onValueChange('')}
            aria-label={`Clear ${accessibleName.toLowerCase()}`}
            className={cn(
              'size-5 flex items-center justify-center rounded-btn',
              'text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
              'outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
            )}
          >
            <X className="size-3.5" />
          </button>
        ) : null
      }
    />
  );
}
