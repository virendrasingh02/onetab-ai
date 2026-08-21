import { cn } from '@org/utils';
import {
  createContext,
  useContext,
  useState,
  type ComponentProps,
} from 'react';
import { toggleVariants, type ToggleProps } from './toggle.js';

interface ToggleGroupContextValue {
  type: 'single' | 'multiple';
  value: string | string[];
  onItemClick: (val: string) => void;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'default' | 'outline' | 'subtle';
  disabled?: boolean;
}

const ToggleGroupContext = createContext<ToggleGroupContextValue | null>(null);

export interface ToggleGroupProps extends Omit<ComponentProps<'div'>, 'onChange'> {
  type?: 'single' | 'multiple';
  value?: string | string[];
  defaultValue?: string | string[];
  onValueChange?: (value: string | string[]) => void;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'default' | 'outline' | 'subtle';
  disabled?: boolean;
}

export function ToggleGroup({
  type = 'single',
  value: controlledValue,
  defaultValue = type === 'single' ? '' : [],
  onValueChange,
  size = 'md',
  variant = 'default',
  disabled = false,
  className,
  children,
  ...props
}: ToggleGroupProps) {
  const [internalValue, setInternalValue] = useState<string | string[]>(defaultValue);
  const value = controlledValue !== undefined ? controlledValue : internalValue;

  const onItemClick = (val: string) => {
    if (disabled) return;
    let next: string | string[];
    if (type === 'single') {
      next = value === val ? '' : val;
    } else {
      const arr = Array.isArray(value) ? value : [];
      next = arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
    }
    if (controlledValue === undefined) {
      setInternalValue(next);
    }
    onValueChange?.(next);
  };

  return (
    <ToggleGroupContext.Provider
      value={{
        type,
        value,
        onItemClick,
        size,
        variant,
        disabled,
      }}
    >
      <div
        role="group"
        className={cn(
          'inline-flex items-center gap-1 rounded-btn bg-surface p-0.5 border border-border',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </ToggleGroupContext.Provider>
  );
}

export interface ToggleGroupItemProps extends Omit<ToggleProps, 'value'> {
  value: string;
}

export function ToggleGroupItem({
  value,
  className,
  children,
  disabled: itemDisabled,
  ...props
}: ToggleGroupItemProps) {
  const context = useContext(ToggleGroupContext);
  if (!context) {
    throw new Error('ToggleGroupItem must be used inside ToggleGroup');
  }

  const { type, value: groupValue, onItemClick, size, variant, disabled: groupDisabled } = context;
  const isSelected =
    type === 'single'
      ? groupValue === value
      : Array.isArray(groupValue) && groupValue.includes(value);

  const disabled = itemDisabled || groupDisabled;

  return (
    <button
      type="button"
      role={type === 'single' ? 'radio' : 'checkbox'}
      aria-checked={isSelected}
      data-state={isSelected ? 'on' : 'off'}
      disabled={disabled}
      onClick={() => onItemClick(value)}
      className={cn(
        toggleVariants({ variant, size }),
        isSelected
          ? 'bg-surface-raised text-foreground font-semibold shadow-xs'
          : 'text-muted-foreground hover:text-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
