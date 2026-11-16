import { cn } from '@org/utils';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Check, ChevronsUpDown, Loader2, Plus, X } from 'lucide-react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Badge } from './badge.js';
import {
  menuCheckClasses,
  menuItemClasses,
  menuLabelClasses,
  menuSearchClasses,
  menuSearchInputClasses,
  menuListClasses,
  menuSurfaceBase,
} from './menu-styles.js';

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
  group?: string;
}

export interface ComboboxGroup {
  name: string;
  options: ComboboxOption[];
}

export interface ComboboxProps extends Omit<
  ComponentPropsWithoutRef<'div'>,
  'value' | 'defaultValue' | 'onChange'
> {
  options: ComboboxOption[];
  value?: string | string[];
  defaultValue?: string | string[];
  onChange?: (value: string | string[]) => void;
  multiple?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
  clearable?: boolean;
  allowCreate?: boolean;
  onCreateOption?: (query: string) => void;
  emptyText?: string;
  emptySlot?: ReactNode;
  maxSelectedBadges?: number;
  popoverClassName?: string;
  popoverWidth?: 'trigger' | 'auto' | number | string;
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  id?: string;
  name?: string;
}

export interface ComboboxRef {
  focus: () => void;
  open: () => void;
  close: () => void;
}

export const Combobox = forwardRef<ComboboxRef, ComboboxProps>(
  (
    {
      options: initialOptions,
      value: controlledValue,
      defaultValue = '',
      onChange,
      multiple = false,
      placeholder = 'Select option...',
      searchPlaceholder = 'Search...',
      disabled = false,
      loading = false,
      loadingText = 'Loading options...',
      clearable = true,
      allowCreate = false,
      onCreateOption,
      emptyText = 'No matching options',
      emptySlot,
      maxSelectedBadges = 3,
      className,
      popoverClassName,
      popoverWidth = 'trigger',
      align = 'start',
      sideOffset = 4,
      id: customId,
      name,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const comboboxId = customId || generatedId;
    const listboxId = `${comboboxId}-listbox`;

    const [uncontrolledValue, setUncontrolledValue] = useState<
      string | string[]
    >(defaultValue || (multiple ? [] : ''));
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
    const [options, setOptions] = useState<ComboboxOption[]>(initialOptions);

    const triggerRef = useRef<HTMLButtonElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const listboxRef = useRef<HTMLDivElement>(null);

    // Keep internal options in sync with external updates
    useEffect(() => {
      setOptions(initialOptions);
    }, [initialOptions]);

    const isControlled = controlledValue !== undefined;
    const value = isControlled ? controlledValue : uncontrolledValue;

    useImperativeHandle(ref, () => ({
      focus: () => triggerRef.current?.focus(),
      open: () => {
        if (!disabled) setIsOpen(true);
      },
      close: () => setIsOpen(false),
    }));

    // Filter options based on search query
    const filteredOptions = useMemo(() => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return options;
      return options.filter(
        (opt) =>
          opt.label.toLowerCase().includes(q) ||
          opt.value.toLowerCase().includes(q) ||
          (opt.description && opt.description.toLowerCase().includes(q)),
      );
    }, [options, searchQuery]);

    // Grouping
    const groupedOptions = useMemo(() => {
      const hasGroups = filteredOptions.some((opt) => opt.group);
      if (!hasGroups) return null;

      const groups: Record<string, ComboboxOption[]> = {};
      filteredOptions.forEach((opt) => {
        const groupName = opt.group || 'Other';
        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push(opt);
      });
      return groups;
    }, [filteredOptions]);

    const isSelected = useCallback(
      (val: string) => {
        if (multiple && Array.isArray(value)) {
          return value.includes(val);
        }
        return value === val;
      },
      [multiple, value],
    );

    // Reset highlighted index when filtered list changes
    useEffect(() => {
      if (filteredOptions.length > 0) {
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex(-1);
      }
    }, [filteredOptions]);

    // Auto-scroll highlighted item into view
    useEffect(() => {
      if (highlightedIndex >= 0 && listboxRef.current) {
        const highlightedEl = listboxRef.current.querySelector(
          `[data-option-index="${highlightedIndex}"]`,
        ) as HTMLElement | null;
        if (
          highlightedEl &&
          typeof highlightedEl.scrollIntoView === 'function'
        ) {
          highlightedEl.scrollIntoView({ block: 'nearest' });
        }
      }
    }, [highlightedIndex]);

    // Focus input on popover open
    const handleOpenChange = (open: boolean) => {
      if (disabled) return;
      setIsOpen(open);
      if (open) {
        setSearchQuery('');
        setTimeout(() => searchInputRef.current?.focus(), 20);
      }
    };

    const handleSelect = (val: string) => {
      if (multiple) {
        const arr = Array.isArray(value) ? value : [];
        const next = arr.includes(val)
          ? arr.filter((v) => v !== val)
          : [...arr, val];
        if (!isControlled) setUncontrolledValue(next);
        onChange?.(next);
      } else {
        if (!isControlled) setUncontrolledValue(val);
        onChange?.(val);
        setIsOpen(false);
        triggerRef.current?.focus();
      }
      setSearchQuery('');
    };

    const handleRemoveBadge = (e: React.MouseEvent, val: string) => {
      e.stopPropagation();
      e.preventDefault();
      if (multiple && Array.isArray(value)) {
        const next = value.filter((v) => v !== val);
        if (!isControlled) setUncontrolledValue(next);
        onChange?.(next);
      }
    };

    const handleClearAll = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const emptyVal = multiple ? [] : '';
      if (!isControlled) setUncontrolledValue(emptyVal);
      onChange?.(emptyVal);
    };

    const handleCreate = () => {
      const trimmed = searchQuery.trim();
      if (!trimmed) return;
      const newOption: ComboboxOption = {
        value: trimmed.toLowerCase().replace(/\s+/g, '-'),
        label: trimmed,
      };
      setOptions((prev) => [...prev, newOption]);
      onCreateOption?.(trimmed);
      handleSelect(newOption.value);
    };

    // Keyboard navigation in search input
    const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : 0,
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : Math.max(0, filteredOptions.length - 1),
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          const selected = filteredOptions[highlightedIndex];
          if (!selected.disabled) {
            handleSelect(selected.value);
          }
        } else if (allowCreate && searchQuery.trim()) {
          handleCreate();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        setHighlightedIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setHighlightedIndex(Math.max(0, filteredOptions.length - 1));
      }
    };

    // Trigger keyboard handler (when popover is closed)
    const handleTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;
      if (
        e.key === 'ArrowDown' ||
        e.key === 'ArrowUp' ||
        e.key === ' ' ||
        e.key === 'Enter'
      ) {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    // Resolve selection labels
    const selectedOptions = useMemo(() => {
      if (multiple && Array.isArray(value)) {
        return options.filter((o) => value.includes(o.value));
      }
      return options.find((o) => o.value === value) || null;
    }, [options, multiple, value]);

    const hasSelection = multiple
      ? Array.isArray(value) && value.length > 0
      : Boolean(value);

    // Option renderer helper
    const renderOptionItem = (opt: ComboboxOption, index: number) => {
      const checked = isSelected(opt.value);
      const isHighlighted = highlightedIndex === index;
      const optionId = `${comboboxId}-opt-${index}`;

      return (
        <button
          key={opt.value}
          id={optionId}
          data-option-index={index}
          role="option"
          aria-selected={checked}
          aria-disabled={opt.disabled}
          disabled={opt.disabled}
          type="button"
          tabIndex={-1}
          onClick={() => !opt.disabled && handleSelect(opt.value)}
          onMouseEnter={() => setHighlightedIndex(index)}
          className={cn(
            menuItemClasses,
            'w-full text-left',
            isHighlighted && 'bg-accent text-accent-foreground',
            opt.disabled && 'pointer-events-none cursor-not-allowed opacity-40',
          )}
        >
          {opt.icon && (
            <span className="size-4 [&_svg]:size-4 flex shrink-0 items-center justify-center text-muted-foreground">
              {opt.icon}
            </span>
          )}
          <div className="min-w-0 pr-2 flex-1">
            <div className="truncate">{opt.label}</div>
            {opt.description && (
              <div className="leading-normal truncate text-meta text-muted-foreground">
                {opt.description}
              </div>
            )}
          </div>
          {checked && (
            <Check
              className={cn(menuCheckClasses, 'ml-auto shrink-0')}
              aria-hidden="true"
            />
          )}
        </button>
      );
    };

    return (
      <div className={cn('relative w-full', className)} {...props}>
        <PopoverPrimitive.Root open={isOpen} onOpenChange={handleOpenChange}>
          {/* Hidden input for form submission */}
          {name && (
            <input
              type="hidden"
              name={name}
              value={Array.isArray(value) ? value.join(',') : value || ''}
            />
          )}

          {/* Trigger Button */}
          <PopoverPrimitive.Trigger asChild>
            <button
              ref={triggerRef}
              id={comboboxId}
              type="button"
              role="combobox"
              aria-expanded={isOpen}
              aria-haspopup="listbox"
              aria-controls={listboxId}
              aria-disabled={disabled}
              disabled={disabled}
              onKeyDown={handleTriggerKeyDown}
              className={cn(
                'min-h-8 gap-1.5 theme-fixed px-2.5 py-1 text-xs flex w-full cursor-pointer items-center justify-between rounded-input border border-input bg-field text-foreground',
                'text-left transition-colors duration-(--duration-fast) ease-standard outline-none',
                'hover:border-field-border focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25',
                disabled &&
                  'pointer-events-none cursor-not-allowed bg-surface-muted opacity-50',
              )}
            >
              <div className="gap-1 min-w-0 flex flex-1 flex-wrap items-center overflow-hidden">
                {multiple &&
                Array.isArray(selectedOptions) &&
                selectedOptions.length > 0 ? (
                  <>
                    {selectedOptions.slice(0, maxSelectedBadges).map((opt) => (
                      <Badge
                        key={opt.value}
                        variant="secondary"
                        className="h-5 px-1.5 font-normal gap-1 max-w-[140px] truncate text-meta"
                      >
                        {opt.icon && (
                          <span className="[&_svg]:size-3 shrink-0">
                            {opt.icon}
                          </span>
                        )}
                        <span className="truncate">{opt.label}</span>
                        {!disabled && (
                          <span
                            role="button"
                            tabIndex={0}
                            aria-label={`Remove ${opt.label}`}
                            onClick={(e) => handleRemoveBadge(e, opt.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                handleRemoveBadge(
                                  e as unknown as React.MouseEvent,
                                  opt.value,
                                );
                              }
                            }}
                            className="cursor-pointer rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                          >
                            <X className="size-3" />
                          </span>
                        )}
                      </Badge>
                    ))}
                    {selectedOptions.length > maxSelectedBadges && (
                      <Badge
                        variant="outline"
                        className="h-5 px-1.5 font-normal text-2xs"
                      >
                        +{selectedOptions.length - maxSelectedBadges} more
                      </Badge>
                    )}
                  </>
                ) : !multiple &&
                  selectedOptions &&
                  !Array.isArray(selectedOptions) ? (
                  <div className="gap-1.5 flex items-center truncate">
                    {selectedOptions.icon && (
                      <span className="[&_svg]:size-3.5 shrink-0 text-muted-foreground">
                        {selectedOptions.icon}
                      </span>
                    )}
                    <span className="truncate">{selectedOptions.label}</span>
                  </div>
                ) : (
                  <span className="truncate text-subtle select-none">
                    {placeholder}
                  </span>
                )}
              </div>

              <div className="gap-1 ml-1 flex shrink-0 items-center">
                {clearable && hasSelection && !disabled && (
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="Clear selection"
                    onClick={handleClearAll}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleClearAll(e as unknown as React.MouseEvent);
                      }
                    }}
                    className="p-0.5 cursor-pointer rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-3" />
                  </span>
                )}
                <ChevronsUpDown
                  className="size-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
            </button>
          </PopoverPrimitive.Trigger>

          {/* Popover Content */}
          <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
              align={align}
              sideOffset={sideOffset}
              collisionPadding={8}
              style={{
                width:
                  popoverWidth === 'trigger'
                    ? triggerRef.current?.offsetWidth || 'auto'
                    : popoverWidth,
              }}
              className={cn(
                menuSurfaceBase,
                'overflow-hidden max-h-(--radix-popover-content-available-height)',
                popoverClassName,
              )}
            >
              {/* Search box */}
              <div className={menuSearchClasses}>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder={searchPlaceholder}
                  aria-autocomplete="list"
                  aria-controls={listboxId}
                  aria-activedescendant={
                    highlightedIndex >= 0
                      ? `${comboboxId}-opt-${highlightedIndex}`
                      : undefined
                  }
                  className={menuSearchInputClasses}
                />
                {searchQuery && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setSearchQuery('')}
                    className="p-0.5 rounded-full text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>

              {/* Options listbox */}
              <div
                ref={listboxRef}
                id={listboxId}
                role="listbox"
                aria-label="Options"
                className={menuListClasses}
              >
                {loading ? (
                  <div className="gap-2 py-6 text-xs flex items-center justify-center text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin text-brand-text" />
                    <span>{loadingText}</span>
                  </div>
                ) : filteredOptions.length === 0 ? (
                  emptySlot ? (
                    emptySlot
                  ) : (
                    <div className="py-4 px-2 text-xs text-center text-subtle">
                      <p>{emptyText}</p>
                      {allowCreate && searchQuery.trim() && (
                        <button
                          type="button"
                          onClick={handleCreate}
                          className="mt-2 gap-1 text-xs font-medium inline-flex cursor-pointer items-center text-brand-text hover:underline"
                        >
                          <Plus className="size-3.5" />
                          <span>Create &ldquo;{searchQuery}&rdquo;</span>
                        </button>
                      )}
                    </div>
                  )
                ) : groupedOptions ? (
                  Object.entries(groupedOptions).map(
                    ([groupName, groupOpts]) => (
                      <div key={groupName} className="mb-1 last:mb-0">
                        <div className={menuLabelClasses}>
                          {groupName}
                        </div>
                        {groupOpts.map((opt) => {
                          const globalIndex = filteredOptions.indexOf(opt);
                          return renderOptionItem(opt, globalIndex);
                        })}
                      </div>
                    ),
                  )
                ) : (
                  filteredOptions.map((opt, index) =>
                    renderOptionItem(opt, index),
                  )
                )}
              </div>
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
      </div>
    );
  },
);

Combobox.displayName = 'Combobox';
