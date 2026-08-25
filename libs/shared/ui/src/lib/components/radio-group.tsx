import { cn } from '@org/utils';
import {
  createContext,
  useContext,
  useId,
  type ComponentProps,
  type ReactNode,
} from 'react';

interface RadioGroupContextValue {
  name: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

export interface RadioGroupProps extends Omit<ComponentProps<'div'>, 'onChange'> {
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  orientation?: 'horizontal' | 'vertical';
}

export function RadioGroup({
  name: explicitName,
  value,
  defaultValue: _defaultValue,
  onValueChange,
  disabled = false,
  orientation = 'vertical',
  className,
  children,
  ...props
}: RadioGroupProps) {
  const generatedName = useId();
  const name = explicitName ?? generatedName;

  return (
    <RadioGroupContext.Provider
      value={{
        name,
        value,
        onChange: onValueChange,
        disabled,
      }}
    >
      <div
        role="radiogroup"
        aria-orientation={orientation}
        className={cn(
          'grid gap-2',
          orientation === 'horizontal' ? 'grid-flow-col auto-cols-max' : 'grid-flow-row',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

export interface RadioGroupItemProps extends Omit<ComponentProps<'input'>, 'type'> {
  value: string;
  label?: ReactNode;
  description?: ReactNode;
}

export function RadioGroupItem({
  value,
  label,
  description,
  disabled: itemDisabled,
  className,
  id: explicitId,
  ...props
}: RadioGroupItemProps) {
  const context = useContext(RadioGroupContext);
  const autoId = useId();
  const id = explicitId ?? autoId;
  const disabled = itemDisabled || context?.disabled;
  const isChecked = context?.value === value;

  return (
    <div className={cn('flex items-start gap-2.5 cursor-pointer', disabled && 'cursor-not-allowed opacity-60')}>
      <div className="relative flex items-center justify-center pt-0.5">
        <input
          type="radio"
          id={id}
          name={context?.name}
          value={value}
          checked={isChecked}
          disabled={disabled}
          onChange={() => context?.onChange?.(value)}
          className="peer sr-only"
          {...props}
        />
        <div
          aria-hidden="true"
          className={cn(
            'size-4 rounded-full border border-border-strong bg-surface transition-all duration-(--duration-fast)',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-ring/40 peer-focus-visible:border-ring',
            'peer-checked:border-primary peer-checked:bg-primary',
            'hover:border-primary/70',
            className,
          )}
        >
          <div
            className={cn(
              'size-1.5 rounded-full bg-primary-foreground m-auto transition-transform duration-75 mt-[4px]',
              isChecked ? 'scale-100' : 'scale-0',
            )}
          />
        </div>
      </div>
      {(label || description) && (
        <label htmlFor={id} className="grid gap-0.5 text-xs select-none cursor-pointer leading-none">
          {label && <span className="font-medium text-foreground">{label}</span>}
          {description && <span className="text-muted-foreground text-[11px]">{description}</span>}
        </label>
      )}
    </div>
  );
}
