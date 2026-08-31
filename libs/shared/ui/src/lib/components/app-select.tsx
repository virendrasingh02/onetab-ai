import { cn } from '@org/utils';
import type { ReactNode } from 'react';
import { Combobox, type ComboboxOption } from './combobox.js';
import { Spinner } from './loading-state.js';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from './select.js';

export interface AppSelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

export interface AppSelectGroup {
  label: string;
  options: AppSelectOption[];
}

export interface AppSelectProps {
  /** Controlled value. Omit for uncontrolled usage (see `defaultValue`). */
  value?: string;
  /** Initial value when uncontrolled. */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Flat options, or grouped options (`{ label, options }[]`). */
  options: AppSelectOption[] | AppSelectGroup[];
  placeholder?: string;
  /**
   * Renders the searchable `Combobox` instead of the plain listbox. Use for
   * large lists (people, projects, channels…); leave off for short ones
   * (status, priority) where a filter box is noise.
   */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Shown when the (filtered) option list is empty. */
  emptyText?: string;
  disabled?: boolean;
  /** Async option loading — trigger shows a spinner and is not interactive. */
  loading?: boolean;
  /** Trigger height, forwarded to the listbox path only. */
  size?: 'sm' | 'md';
  className?: string;
  id?: string;
  'aria-label'?: string;
  /** Emits a hidden input so the value posts with a native `<form>`. */
  name?: string;
}

function isGrouped(
  options: AppSelectOption[] | AppSelectGroup[],
): options is AppSelectGroup[] {
  return options.length > 0 && 'options' in options[0];
}

function flatten(
  options: AppSelectOption[] | AppSelectGroup[],
): AppSelectOption[] {
  return isGrouped(options)
    ? options.flatMap((group) => group.options)
    : options;
}

/**
 * One select for the whole app. Wraps the existing `Select` (short lists) and
 * `Combobox` (searchable, `searchable` prop) behind a single `options`-driven
 * API so call sites stop hand-rolling trigger + content markup. `Select` and
 * `Combobox` stay available for the cases that need their lower-level control.
 */
export function AppSelect({
  value,
  defaultValue,
  onValueChange,
  options,
  placeholder = 'Select an option',
  searchable = false,
  searchPlaceholder = 'Search…',
  emptyText = 'No results found.',
  disabled = false,
  loading = false,
  size = 'md',
  className,
  id,
  'aria-label': ariaLabel,
  name,
}: AppSelectProps) {
  const flatOptions = flatten(options);

  // Loading looks the same in both modes: a disabled, spinner-filled trigger.
  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger
          size={size}
          id={id}
          aria-label={ariaLabel}
          aria-busy
          className={cn('w-full', className)}
        >
          <span className="flex items-center gap-2 text-subtle">
            <Spinner className="size-3.5" />
            Loading…
          </span>
        </SelectTrigger>
      </Select>
    );
  }

  if (searchable) {
    const comboOptions: ComboboxOption[] = flatOptions.map((opt) => ({
      value: opt.value,
      label: opt.label,
      description:
        typeof opt.description === 'string' ? opt.description : undefined,
      icon: opt.icon,
      disabled: opt.disabled,
    }));

    return (
      <>
        <Combobox
          options={comboOptions}
          value={value}
          defaultValue={defaultValue}
          onChange={(next) => onValueChange?.(next as string)}
          placeholder={placeholder}
          searchPlaceholder={searchPlaceholder}
          emptyText={emptyText}
          disabled={disabled}
          className={className}
        />
        {name ? (
          <input type="hidden" name={name} value={value ?? defaultValue ?? ''} />
        ) : null}
      </>
    );
  }

  return (
    <Select
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
      name={name}
    >
      <SelectTrigger
        size={size}
        id={id}
        aria-label={ariaLabel}
        className={cn('w-full', className)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {flatOptions.length === 0 ? (
          <div className="px-2 py-4 text-center text-xs text-subtle">
            {emptyText}
          </div>
        ) : isGrouped(options) ? (
          options.map((group) => (
            <SelectGroup key={group.label}>
              <SelectLabel>{group.label}</SelectLabel>
              {group.options.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  disabled={opt.disabled}
                >
                  <span className="flex items-center gap-2">
                    {opt.icon}
                    {opt.label}
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          ))
        ) : (
          options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
              <span className="flex items-center gap-2">
                {opt.icon}
                {opt.label}
              </span>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
