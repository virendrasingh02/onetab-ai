import { cn } from '@org/utils';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

/*
 * Status tints, from tokens rather than literals. The tinted variants keep the
 * status hue for text and border and wash it back for the fill — on a white
 * card a solid status block is far too loud for something this small, and the
 * previous fixed hexes were picked against a near-black surface.
 */
const badgeVariants = cva(
  [
    'inline-flex w-fit shrink-0 items-center justify-center gap-1',
    'rounded-sm border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap tracking-tight',
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-3",
  ],
  {
    variants: {
      variant: {
        neutral: 'border-border bg-surface-raised text-muted-foreground',
        primary: 'border-primary/25 bg-primary/10 text-primary-text',
        success: 'border-success/25 bg-success/10 text-success-text',
        warning: 'border-warning/30 bg-warning/12 text-warning-text',
        destructive:
          'border-destructive/25 bg-destructive/10 text-destructive-text',
        info: 'border-info/25 bg-info/10 text-info-text',
        outline: 'border-border-strong bg-transparent text-foreground',
        count:
          'min-w-4 rounded-[4px] border-transparent bg-destructive px-1 font-mono text-[10px] text-destructive-foreground tabular-nums',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export interface BadgeProps
  extends ComponentProps<'span'>,
    VariantProps<typeof badgeVariants> {
  asChild?: boolean;
}

export function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: BadgeProps) {
  const Comp = asChild ? Slot : 'span';
  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { badgeVariants };
