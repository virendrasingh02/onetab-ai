import { cn } from '@org/utils';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

const badgeVariants = cva(
  [
    'inline-flex w-fit shrink-0 items-center justify-center gap-1',
    'rounded-[6px] border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap tracking-tight',
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-3",
  ],
  {
    variants: {
      variant: {
        neutral: 'bg-[#16171A] text-[#A1A1AA] border-[#27272A]',
        primary: 'bg-[#6E56CF]/15 text-[#7C6AF5] border-[#6E56CF]/30',
        success: 'bg-[#30A46C]/15 text-[#30A46C] border-[#30A46C]/30',
        warning: 'bg-[#FFB224]/15 text-[#FFB224] border-[#FFB224]/30',
        destructive: 'bg-[#E5484D]/15 text-[#E5484D] border-[#E5484D]/30',
        info: 'bg-[#3E63DD]/15 text-[#3E63DD] border-[#3E63DD]/30',
        outline: 'text-[#FAFAFA] border-[#27272A] bg-transparent',
        count:
          'bg-[#E5484D] text-[#FAFAFA] min-w-4 rounded-[4px] border-transparent px-1 font-mono text-[10px] tabular-nums',
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
