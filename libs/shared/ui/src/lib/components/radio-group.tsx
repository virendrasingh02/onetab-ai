import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { cn } from '@org/utils';
import { useId, type ComponentProps, type ReactNode } from 'react';

export type RadioGroupProps = ComponentProps<typeof RadioGroupPrimitive.Root>;

export function RadioGroup({
  className,
  orientation = 'vertical',
  ...props
}: RadioGroupProps) {
  return (
    <RadioGroupPrimitive.Root
      orientation={orientation}
      className={cn(
        'grid gap-2',
        orientation === 'horizontal' && 'grid-flow-col auto-cols-max',
        className,
      )}
      {...props}
    />
  );
}

export interface RadioGroupItemProps
  extends Omit<ComponentProps<typeof RadioGroupPrimitive.Item>, 'children'> {
  value: string;
  label?: ReactNode;
  description?: ReactNode;
}

const itemClass = cn(
  'mt-0.5 size-4 flex shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface transition-colors',
  'hover:border-primary/70 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none',
  'data-[state=checked]:border-primary data-[state=checked]:bg-primary',
  'disabled:cursor-not-allowed',
);

const dotClass = 'size-1.5 rounded-full bg-primary-foreground';

export function RadioGroupItem({
  label,
  description,
  className,
  id: explicitId,
  ...props
}: RadioGroupItemProps) {
  const autoId = useId();
  const id = explicitId ?? autoId;

  return (
    <div className="gap-2.5 flex items-start">
      <RadioGroupPrimitive.Item
        id={id}
        className={cn(itemClass, className)}
        {...props}
      >
        <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
          <span className={dotClass} />
        </RadioGroupPrimitive.Indicator>
      </RadioGroupPrimitive.Item>
      {(label || description) && (
        <label
          htmlFor={id}
          className="gap-0.5 text-xs grid cursor-pointer leading-none select-none"
        >
          {label && <span className="font-medium text-foreground">{label}</span>}
          {description && (
            <span className="text-[11px] text-muted-foreground">
              {description}
            </span>
          )}
        </label>
      )}
    </div>
  );
}

export interface RadioCardItemProps
  extends Omit<ComponentProps<typeof RadioGroupPrimitive.Item>, 'children'> {
  value: string;
  heading: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
}

/** A whole-card radio option: the card itself is the Radix radio. */
export function RadioCardItem({
  heading,
  description,
  icon,
  className,
  ...props
}: RadioCardItemProps) {
  return (
    <RadioGroupPrimitive.Item
      className={cn(
        'group gap-2.5 p-3 flex w-full items-start rounded-lg border border-border bg-surface-raised text-left transition-colors',
        'hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none',
        'data-[state=checked]:border-primary data-[state=checked]:bg-primary/5',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    >
      <span className="min-w-0 flex-1">
        <span className="gap-1.5 text-sm font-medium flex items-center text-foreground">
          {icon && (
            <span className="[&>svg]:size-3.5 text-muted-foreground">
              {icon}
            </span>
          )}
          {heading}
        </span>
        {description && (
          <span className="mt-0.5 text-[11px] block text-muted-foreground">
            {description}
          </span>
        )}
      </span>
      <span
        aria-hidden="true"
        className="mt-0.5 size-4 flex shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface group-data-[state=checked]:border-primary group-data-[state=checked]:bg-primary"
      >
        <RadioGroupPrimitive.Indicator>
          <span className={dotClass} />
        </RadioGroupPrimitive.Indicator>
      </span>
    </RadioGroupPrimitive.Item>
  );
}
