import { cn } from '@org/utils';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'rounded-[8px] text-xs font-medium',
    'transition-all duration-[120ms] ease-out',
    'outline-none focus-visible:ring-1 focus-visible:ring-primary/60',
    'disabled:pointer-events-none disabled:opacity-40',
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary:
          'bg-[#6E56CF] text-[#FAFAFA] hover:bg-[#7C6AF5] active:scale-[0.98]',
        secondary:
          'bg-[#16171A] text-[#A1A1AA] hover:bg-[#1E1F23] hover:text-[#FAFAFA] active:scale-[0.98]',
        outline:
          'border border-[#27272A] bg-transparent text-[#FAFAFA] hover:bg-[#1E1F23]',
        ghost:
          'text-[#A1A1AA] hover:bg-[#1E1F23] hover:text-[#FAFAFA]',
        subtle:
          'bg-[#16171A] text-[#A1A1AA] hover:bg-[#1E1F23] hover:text-[#FAFAFA]',
        destructive:
          'bg-[#E5484D] text-[#FAFAFA] hover:bg-[#E5484D]/90 active:scale-[0.98]',
        link: 'text-[#6E56CF] underline-offset-4 hover:underline',
        sidebar:
          'text-[#A1A1AA] hover:bg-[#1E1F23] hover:text-[#FAFAFA] focus-visible:ring-primary/40',
      },
      size: {
        sm: 'h-[28px] px-2.5 text-xs',
        md: 'h-[34px] px-[12px] text-xs',
        lg: 'h-[38px] px-4 text-sm',
        icon: 'size-[34px]',
        'icon-sm': 'size-[28px]',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends ComponentProps<'button'>,
    VariantProps<typeof buttonVariants> {
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
