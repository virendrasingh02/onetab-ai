import { cn } from '@org/utils';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

/*
 * Every colour here is a palette token, never a literal. The variants used to
 * be hard-coded to a dark ramp (#16171A surfaces, #FAFAFA text), so in the
 * light theme — now the default — every button rendered as a dark slab on a
 * white page and ignored the theme switch entirely.
 *
 * `outline` and `ghost` deliberately carry `text-foreground`/`text-muted-
 * foreground` rather than a fixed near-white: on a white card the label has to
 * be ink, and only the token knows which way round the theme currently is.
 */
const buttonVariants = cva(
  [
    'gap-2 inline-flex items-center justify-center whitespace-nowrap',
    'text-xs font-medium rounded-btn',
    'transition-colors duration-(--duration-fast) ease-standard',
    'outline-none focus-visible:ring-2 focus-visible:ring-ring/55',
    'disabled:pointer-events-none disabled:opacity-50',
    "[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary:
          'shadow-xs bg-primary text-primary-foreground hover:bg-primary-hover active:scale-[0.98]',
        secondary:
          'bg-surface-raised text-foreground hover:bg-selected active:scale-[0.98]',
        /*
         * A hairline border plus the panel fill, not a transparent cut-out:
         * against the grey app chrome a transparent "outline" button
         * disappeared into the background it sat on.
         */
        outline:
          'shadow-xs border border-border-strong bg-surface text-foreground hover:bg-accent',
        ghost: 'text-muted-foreground hover:bg-accent hover:text-foreground',
        subtle:
          'bg-surface-raised text-muted-foreground hover:bg-selected hover:text-foreground',
        destructive:
          'shadow-xs bg-destructive text-destructive-foreground hover:bg-destructive/90 active:scale-[0.98]',
        link: 'text-primary underline-offset-4 hover:underline',
        sidebar:
          'text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring/50',
      },
      size: {
        sm: 'h-7 px-2.5 text-xs',
        md: 'h-8 px-3 text-xs',
        lg: 'h-9 px-4 text-sm',
        icon: 'size-8',
        'icon-sm': 'size-7',
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

  // `asChild` forwards to a single child, so the spinner/icon wrappers here
  // would produce multiple children and break Slot. Pass content through.
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
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : leadingIcon}
      {children}
      {!loading && trailingIcon}
    </button>
  );
}

export { buttonVariants };
