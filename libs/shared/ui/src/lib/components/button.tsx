import { cn } from '@org/utils';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

/*
 * Every colour here is a palette token, never a literal.
 */
const buttonVariants = cva(
  [
    'gap-2 inline-flex items-center justify-center whitespace-nowrap',
    'text-xs font-medium rounded-btn',
    'transition-all duration-(--duration-fast) ease-standard',
    'outline-none focus-visible:ring-2 focus-visible:ring-ring/55',
    'cursor-pointer select-none disabled:pointer-events-none disabled:opacity-50',
    "[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary:
          'bg-foreground text-background shadow-xs hover:bg-foreground/85 active:scale-[0.98]',
        default:
          'bg-foreground text-background shadow-xs hover:bg-foreground/85 active:scale-[0.98]',
        // White, bordered — the companion to `primary` (see the channel drawer).
        secondary:
          'border border-border bg-surface text-foreground shadow-xs hover:border-border-strong hover:bg-accent active:scale-[0.98]',
        outline:
          'border border-border bg-surface text-foreground shadow-xs hover:border-border-strong hover:bg-accent',
        ghost: 'text-muted-foreground hover:bg-accent hover:text-foreground',
        subtle:
          'bg-surface-raised text-muted-foreground hover:bg-selected hover:text-foreground',
        destructive:
          'bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 active:scale-[0.98]',
        success:
          'bg-success text-success-foreground shadow-xs hover:bg-success/90 active:scale-[0.98]',
        warning:
          'bg-warning text-warning-foreground shadow-xs hover:bg-warning/90 active:scale-[0.98]',
        link: 'p-0 font-normal h-auto text-primary underline-offset-4 hover:underline',
        sidebar:
          'text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring/50',
      },
      size: {
        xs: "h-6 px-2 gap-1.5 [&_svg:not([class*='size-'])]:size-3.5 rounded-sm text-meta",
        sm: 'h-7 px-2.5 text-xs',
        md: 'h-8 px-3 text-xs',
        lg: 'h-9 px-4 text-sm',
        xl: 'h-10 px-5 text-sm font-semibold',
        icon: 'size-8 p-0',
        'icon-xs':
          "size-6 p-0 [&_svg:not([class*='size-'])]:size-3.5 rounded-sm",
        'icon-sm': 'size-7 p-0',
        'icon-lg': 'size-9 p-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  /** Render as the single child element instead of a `<button>`. */
  asChild?: boolean;
  /** Shows a spinner and blocks interaction. */
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  leadingIcon,
  trailingIcon,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';

  if (asChild) {
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {children}
      </Comp>
    );
  }

  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading ? 'true' : undefined}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="animate-spin" aria-hidden="true" />
          <span className="sr-only">Loading…</span>
        </>
      ) : (
        leadingIcon
      )}
      {children}
      {!loading && trailingIcon}
    </button>
  );
}

export interface IconButtonProps extends ButtonProps {
  'aria-label': string;
  icon?: ReactNode;
}

export function IconButton({
  icon,
  children,
  size = 'icon',
  variant = 'ghost',
  className,
  ...props
}: IconButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      className={cn('shrink-0', className)}
      {...props}
    >
      {icon || children}
    </Button>
  );
}

export interface ButtonGroupProps extends ComponentProps<'div'> {
  attached?: boolean;
}

export function ButtonGroup({
  className,
  attached = true,
  children,
  ...props
}: ButtonGroupProps) {
  return (
    <div
      role="group"
      className={cn(
        'inline-flex items-center',
        attached
          ? '[&>*:not(:first-child)]:-ml-[1px] [&>*:not(:first-child)]:rounded-l-none [&>*:not(:last-child)]:rounded-r-none'
          : 'gap-1.5',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { buttonVariants };
