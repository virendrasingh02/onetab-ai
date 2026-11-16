import { useAuthenticatedMediaSrc } from '@org/hooks';
import { cn } from '@org/utils';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Check, X } from 'lucide-react';
import React, { useId, useMemo, useRef, useState, type ReactNode } from 'react';

export interface MultiSelectOption {
  value: string;
  label: string;
  subtitle?: string | null;
  description?: string | null;
  avatarUrl?: string | null;
  icon?: ReactNode;
  disabled?: boolean;
}

/**
 * A plain `<img>` here (rather than `@org/ui`'s own `Avatar`) so a caller can
 * pass any `avatarUrl` — including one resolved from Matrix, which is
 * authenticated media a bare `<img src>` cannot load on its own. Pulled into
 * its own component because the hook can't be called from inside the
 * `.map()` below.
 */
function OptionAvatarImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className: string;
}) {
  const resolvedSrc = useAuthenticatedMediaSrc(src);
  if (!resolvedSrc) return null;
  return <img src={resolvedSrc} alt={alt} className={className} />;
}

export interface MultiSelectProps {
  options: MultiSelectOption[];
  value?: string[];
  defaultValue?: string[];
  onChange?: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  label?: string;
  disabled?: boolean;
  maxSelectedChips?: number;
  className?: string;
  popoverClassName?: string;
  align?: 'start' | 'center' | 'end';
}

/**
 * Universal chip-based multi-select component matching modern UX patterns:
 * - Rounded surface input container with chips and inline search
 * - Rich option items with avatar/icon, title, subtitle/role, and right checkmarks
 */
export function MultiSelect({
  options,
  value: controlledValue,
  defaultValue = [],
  onChange,
  placeholder = 'Add items...',
  searchPlaceholder,
  label = 'Select options',
  disabled = false,
  maxSelectedChips,
  className,
  popoverClassName,
  align = 'start',
}: MultiSelectProps) {
  const [uncontrolledValue, setUncontrolledValue] =
    useState<string[]>(defaultValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolledValue;

  const selectedOptions = useMemo(() => {
    const map = new Map(options.map((opt) => [opt.value, opt]));
    return value
      .map((val) => map.get(val))
      .filter((opt): opt is MultiSelectOption => Boolean(opt));
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => {
      const labelMatch = opt.label.toLowerCase().includes(q);
      const subMatch = (opt.subtitle || opt.description || '')
        .toLowerCase()
        .includes(q);
      const valMatch = opt.value.toLowerCase().includes(q);
      return labelMatch || subMatch || valMatch;
    });
  }, [options, query]);

  const toggleOption = (val: string) => {
    const isSelected = value.includes(val);
    const next = isSelected ? value.filter((v) => v !== val) : [...value, val];
    if (!isControlled) setUncontrolledValue(next);
    onChange?.(next);
    setQuery('');
  };

  const removeOption = (e: React.MouseEvent, val: string) => {
    e.stopPropagation();
    e.preventDefault();
    const next = value.filter((v) => v !== val);
    if (!isControlled) setUncontrolledValue(next);
    onChange?.(next);
  };

  const visibleChips = maxSelectedChips
    ? selectedOptions.slice(0, maxSelectedChips)
    : selectedOptions;
  const remainingCount = maxSelectedChips
    ? Math.max(0, selectedOptions.length - maxSelectedChips)
    : 0;

  const activePlaceholder = query ? '' : searchPlaceholder || placeholder;

  return (
    <div className={cn('relative w-full', className)}>
      <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
        <PopoverPrimitive.Anchor asChild>
          <div
            role="button"
            tabIndex={0}
            aria-label={label}
            aria-expanded={open}
            onClick={() => {
              if (!disabled) {
                setOpen(true);
                inputRef.current?.focus();
              }
            }}
            className={cn(
              'px-2.5 py-1.5 gap-1.5 flex min-h-[42px] w-full cursor-text flex-wrap items-center rounded-xl border border-border bg-surface-raised transition-colors',
              'focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/25 hover:border-field-border',
              open && 'border-brand ring-1 ring-brand/25',
              disabled &&
                'pointer-events-none cursor-not-allowed bg-muted/40 opacity-50',
            )}
          >
            <div
              role="group"
              aria-label="Selected options"
              className="gap-1.5 flex flex-wrap items-center"
            >
              {visibleChips.map((opt) => (
                <span
                  key={opt.value}
                  className="gap-1.5 pl-1 pr-2 py-0.5 text-xs font-medium shadow-2xs inline-flex items-center rounded-full border border-border/80 bg-surface text-foreground transition-all hover:bg-accent/40"
                >
                  {opt.avatarUrl ? (
                    <OptionAvatarImage
                      src={opt.avatarUrl}
                      alt={opt.label}
                      className="size-5 shrink-0 rounded-full object-cover"
                    />
                  ) : opt.icon ? (
                    <span className="size-5 flex shrink-0 items-center justify-center rounded-full bg-muted text-2xs text-muted-foreground">
                      {opt.icon}
                    </span>
                  ) : null}
                  <span className="text-xs font-medium max-w-[140px] truncate">
                    {opt.label}
                  </span>
                  {!disabled && (
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label={`Remove ${opt.label}`}
                      onClick={(e) => removeOption(e, opt.value)}
                      className="p-0.5 cursor-pointer rounded-full text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </span>
              ))}

              {remainingCount > 0 && (
                <span className="px-2 py-0.5 font-medium inline-flex items-center rounded-full border border-border bg-surface text-meta text-muted-foreground">
                  +{remainingCount} more
                </span>
              )}
            </div>

            <input
              ref={inputRef}
              id={id}
              type="text"
              value={query}
              disabled={disabled}
              placeholder={activePlaceholder}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!open) setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => {
                if (
                  e.key === 'Backspace' &&
                  !query &&
                  selectedOptions.length > 0
                ) {
                  const last = selectedOptions[selectedOptions.length - 1];
                  if (last) {
                    toggleOption(last.value);
                  }
                } else if (e.key === 'Escape') {
                  setOpen(false);
                }
              }}
              className="text-xs p-0 min-w-[120px] flex-1 border-none bg-transparent text-foreground outline-none placeholder:text-muted-foreground focus:ring-0"
            />
          </div>
        </PopoverPrimitive.Anchor>

        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align={align}
            sideOffset={6}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
            className={cn(
              'w-72 sm:w-80 p-1.5 shadow-2xl space-y-0.5 z-50 rounded-2xl border border-border bg-popover text-popover-foreground outline-none select-none',
              popoverClassName,
            )}
          >
            <div className="max-h-64 space-y-0.5 py-0.5 scrollbar-subtle overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-4 text-xs text-center text-muted-foreground">
                  No options found
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = value.includes(opt.value);
                  const subtitle = opt.subtitle || opt.description || null;

                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={opt.disabled}
                      onClick={() => !opt.disabled && toggleOption(opt.value)}
                      className={cn(
                        'px-3 py-2 text-xs flex w-full cursor-pointer items-center justify-between rounded-xl text-left transition-colors duration-150 outline-none',
                        isSelected
                          ? 'bg-accent/40 text-foreground hover:bg-accent/70'
                          : 'text-foreground/90 hover:bg-accent/60',
                        opt.disabled &&
                          'pointer-events-none cursor-not-allowed opacity-50',
                      )}
                    >
                      <div className="gap-3 min-w-0 flex flex-1 items-center">
                        {opt.avatarUrl ? (
                          <OptionAvatarImage
                            src={opt.avatarUrl}
                            alt={opt.label}
                            className="size-8 shrink-0 rounded-full object-cover"
                          />
                        ) : opt.icon ? (
                          <span className="size-8 [&_svg]:size-4 flex shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
                            {opt.icon}
                          </span>
                        ) : null}

                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-semibold leading-tight block truncate text-foreground">
                            {opt.label}
                          </span>
                          {subtitle && (
                            <span className="mt-0.5 leading-tight font-normal block truncate text-meta text-muted-foreground">
                              {subtitle}
                            </span>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <Check className="size-4 ml-2 shrink-0 stroke-[2.5] text-foreground" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </div>
  );
}
