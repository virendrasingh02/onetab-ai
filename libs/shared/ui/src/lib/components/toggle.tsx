import { cn } from '@org/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

export const toggleVariants = cva(
  'inline-flex items-center justify-center rounded-btn text-xs font-medium transition-colors duration-(--duration-fast) outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground data-[state=on]:bg-surface-raised data-[state=on]:text-foreground data-[state=on]:shadow-xs',
        outline: 'border border-border bg-transparent hover:bg-accent hover:text-foreground data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary',
        subtle: 'bg-surface-raised text-muted-foreground hover:bg-selected data-[state=on]:bg-primary data-[state=on]:text-primary-foreground',
      },
      size: {
        xs: 'h-6 px-2 text-[11px] [&_svg]:size-3.5',
        sm: 'h-7 px-2.5 text-xs [&_svg]:size-4',
        md: 'h-8 px-3 text-xs [&_svg]:size-4',
        lg: 'h-9 px-4 text-sm [&_svg]:size-4.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

export interface ToggleProps
  extends Omit<ComponentProps<'button'>, 'onChange'>,
    VariantProps<typeof toggleVariants> {
  pressed?: boolean;
  defaultPressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
}

export function Toggle({
  className,
  variant,
  size,
  pressed: controlledPressed,
  defaultPressed = false,
  onPressedChange,
  onClick,
  ...props
}: ToggleProps) {
  const isControlled = controlledPressed !== undefined;
  const isPressed = isControlled ? controlledPressed : defaultPressed;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    onPressedChange?.(!isPressed);
  };

  return (
    <button
      type="button"
      aria-pressed={isPressed}
      data-state={isPressed ? 'on' : 'off'}
      className={cn(toggleVariants({ variant, size }), className)}
      onClick={handleClick}
      {...props}
    />
  );
}
