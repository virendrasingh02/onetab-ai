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
  const [uncontrolledValue, setUncontrolledValue] = useState<string[]>(defaultValue);
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
      const subMatch = (opt.subtitle || opt.description || '').toLowerCase().includes(q);
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

  const activePlaceholder = query ? '' : (searchPlaceholder || placeholder);

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
              'min-h-[42px] w-full px-2.5 py-1.5 rounded-xl border border-border bg-surface-raised flex flex-wrap items-center gap-1.5 cursor-text transition-colors',
              'hover:border-border-strong focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/25',
              open && 'border-primary ring-1 ring-primary/25',
              disabled && 'opacity-50 cursor-not-allowed pointer-events-none bg-muted/40',
            )}
          >
            <div
              role="group"
              aria-label="Selected options"
              className="flex flex-wrap items-center gap-1.5"
            >
              {visibleChips.map((opt) => (
                <span
                  key={opt.value}
                  className="inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full bg-surface border border-border/80 text-xs font-medium text-foreground shadow-2xs transition-all hover:bg-accent/40"
                >
                  {opt.avatarUrl ? (
                    <img
                      src={opt.avatarUrl}
                      alt={opt.label}
                      className="size-5 rounded-full object-cover shrink-0"
                    />
                  ) : opt.icon ? (
                    <span className="size-5 rounded-full bg-muted flex items-center justify-center text-[10px] shrink-0 text-muted-foreground">
                      {opt.icon}
                    </span>
                  ) : null}
                  <span className="truncate max-w-[140px] text-xs font-medium">
                    {opt.label}
                  </span>
                  {!disabled && (
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label={`Remove ${opt.label}`}
                      onClick={(e) => removeOption(e, opt.value)}
                      className="text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-full p-0.5 transition-colors cursor-pointer"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </span>
              ))}

              {remainingCount > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface border border-border text-[11px] font-medium text-muted-foreground">
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
                if (e.key === 'Backspace' && !query && selectedOptions.length > 0) {
                  const last = selectedOptions[selectedOptions.length - 1];
                  if (last) {
                    toggleOption(last.value);
                  }
                } else if (e.key === 'Escape') {
                  setOpen(false);
                }
              }}
              className="flex-1 min-w-[120px] bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none border-none p-0 focus:ring-0"
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
              'z-50 w-72 sm:w-80 p-1.5 rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl space-y-0.5 select-none outline-none',
              popoverClassName,
            )}
          >
            <div className="max-h-64 overflow-y-auto space-y-0.5 py-0.5 scrollbar-subtle">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-muted-foreground">
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
                        'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left cursor-pointer transition-colors duration-150 outline-none',
                        isSelected
                          ? 'bg-accent/40 text-foreground hover:bg-accent/70'
                          : 'text-foreground/90 hover:bg-accent/60',
                        opt.disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {opt.avatarUrl ? (
                          <img
                            src={opt.avatarUrl}
                            alt={opt.label}
                            className="size-8 rounded-full object-cover shrink-0"
                          />
                        ) : opt.icon ? (
                          <span className="size-8 rounded-full bg-muted/60 flex items-center justify-center shrink-0 text-muted-foreground [&_svg]:size-4">
                            {opt.icon}
                          </span>
                        ) : null}

                        <div className="min-w-0 flex-1">
                          <span className="block text-xs truncate font-semibold text-foreground leading-tight">
                            {opt.label}
                          </span>
                          {subtitle && (
                            <span className="block text-[11px] truncate text-muted-foreground mt-0.5 leading-tight font-normal">
                              {subtitle}
                            </span>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <Check className="size-4 text-foreground shrink-0 stroke-[2.5] ml-2" />
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
