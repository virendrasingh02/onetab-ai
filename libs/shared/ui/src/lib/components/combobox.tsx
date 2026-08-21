import { cn } from '@org/utils';
import { Check, ChevronsUpDown, Plus, Search, X } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Badge } from './badge.js';

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value?: string | string[];
  defaultValue?: string | string[];
  onChange?: (value: string | string[]) => void;
  multiple?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  allowCreate?: boolean;
  onCreateOption?: (query: string) => void;
  className?: string;
  emptyText?: string;
}

export function Combobox({
  options: initialOptions,
  value: controlledValue,
  defaultValue = '',
  onChange,
  multiple = false,
  placeholder = 'Select option...',
  searchPlaceholder = 'Search...',
  disabled = false,
  allowCreate = false,
  onCreateOption,
  className,
  emptyText = 'No matching options',
}: ComboboxProps) {
  const [internalValue, setInternalValue] = useState<string | string[]>(defaultValue);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [options, setOptions] = useState<ComboboxOption[]>(initialOptions);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOptions(initialOptions);
  }, [initialOptions]);

  const value = controlledValue !== undefined ? controlledValue : internalValue;

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener('click', handleOutsideClick);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [isOpen]);

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    opt.value.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (opt.description && opt.description.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const isSelected = (val: string) => {
    if (multiple && Array.isArray(value)) {
      return value.includes(val);
    }
    return value === val;
  };

  const handleSelect = (val: string) => {
    if (multiple) {
      const arr = Array.isArray(value) ? value : [];
      const next = arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
      if (controlledValue === undefined) setInternalValue(next);
      onChange?.(next);
    } else {
      const next = val;
      if (controlledValue === undefined) setInternalValue(next);
      onChange?.(next);
      setIsOpen(false);
    }
    setSearchQuery('');
  };

  const handleRemoveBadge = (e: React.MouseEvent, val: string) => {
    e.stopPropagation();
    if (multiple && Array.isArray(value)) {
      const next = value.filter((v) => v !== val);
      if (controlledValue === undefined) setInternalValue(next);
      onChange?.(next);
    }
  };

  const handleCreate = () => {
    if (!searchQuery.trim()) return;
    const newOption: ComboboxOption = {
      value: searchQuery.toLowerCase().replace(/\s+/g, '-'),
      label: searchQuery.trim(),
    };
    setOptions((prev) => [...prev, newOption]);
    onCreateOption?.(searchQuery.trim());
    handleSelect(newOption.value);
    setSearchQuery('');
  };

  const selectedLabels = multiple && Array.isArray(value)
    ? options.filter((o) => value.includes(o.value))
    : options.find((o) => o.value === value);

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      {/* Trigger Button */}
      <div
        role="combobox"
        aria-expanded={isOpen}
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
            e.preventDefault();
            setIsOpen(true);
          }
        }}
        className={cn(
          'flex min-h-8 w-full items-center justify-between gap-1.5 rounded-input border border-input bg-surface px-2.5 py-1 text-xs text-foreground cursor-pointer shadow-xs',
          'transition-colors duration-(--duration-fast) outline-none',
          'hover:border-border-strong focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25',
          disabled && 'pointer-events-none opacity-50 bg-surface-muted cursor-not-allowed',
        )}
      >
        <div className="flex flex-wrap items-center gap-1 overflow-hidden">
          {multiple && Array.isArray(value) && value.length > 0 ? (
            (selectedLabels as ComboboxOption[]).map((opt) => (
              <Badge
                key={opt.value}
                variant="secondary"
                className="h-5 px-1.5 text-[11px] font-normal gap-1"
              >
                {opt.icon}
                <span>{opt.label}</span>
                <button
                  type="button"
                  onClick={(e) => handleRemoveBadge(e, opt.value)}
                  className="rounded-full hover:bg-foreground/10 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))
          ) : !multiple && selectedLabels ? (
            <div className="flex items-center gap-1.5 truncate">
              {(selectedLabels as ComboboxOption).icon}
              <span className="truncate">{(selectedLabels as ComboboxOption).label}</span>
            </div>
          ) : (
            <span className="text-subtle select-none">{placeholder}</span>
          )}
        </div>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground ml-1" />
      </div>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          className={cn(
            'absolute left-0 top-full z-50 mt-1 w-full rounded-popup border border-border bg-popover p-1 shadow-overlay text-popover-foreground',
            'animate-in fade-in-80 zoom-in-95 duration-100',
          )}
        >
          {/* Search box */}
          <div className="flex items-center border-b border-border px-2 pb-1.5 pt-1">
            <Search className="mr-2 size-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="flex h-6 w-full rounded-none bg-transparent text-xs text-foreground placeholder:text-subtle outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Options list */}
          <div className="max-h-60 overflow-y-auto py-1 scrollbar-subtle">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-subtle">
                <p>{emptyText}</p>
                {allowCreate && searchQuery.trim() && (
                  <button
                    type="button"
                    onClick={handleCreate}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                  >
                    <Plus className="size-3.5" />
                    Create &ldquo;{searchQuery}&rdquo;
                  </button>
                )}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const checked = isSelected(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none transition-colors duration-(--duration-fast)',
                      'hover:bg-accent hover:text-accent-foreground text-left',
                      checked && 'bg-surface-raised font-medium text-foreground',
                      opt.disabled && 'pointer-events-none opacity-50',
                    )}
                  >
                    {opt.icon && <span className="mr-2 shrink-0">{opt.icon}</span>}
                    <div className="flex-1 truncate">
                      <div>{opt.label}</div>
                      {opt.description && (
                        <div className="text-[11px] text-muted-foreground truncate">{opt.description}</div>
                      )}
                    </div>
                    {checked && <Check className="ml-2 size-3.5 text-primary shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
