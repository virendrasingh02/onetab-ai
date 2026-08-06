import { cn } from '@org/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps, ReactNode } from 'react';

const emptyStateVariants = cva(
  'flex flex-col items-center justify-center text-center',
  {
    variants: {
      size: {
        sm: 'gap-2 px-4 py-8',
        md: 'gap-3 px-6 py-12',
        lg: 'gap-4 px-8 py-20',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

export interface EmptyStateProps
  extends ComponentProps<'div'>,
    VariantProps<typeof emptyStateVariants> {
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Primary call to action; render a <Button>. */
  action?: ReactNode;
  /** Secondary affordance, e.g. a docs link. */
  secondaryAction?: ReactNode;
}

/**
 * Shown when a collection is legitimately empty — not while loading and not
 * after a failure. Use LoadingState and ErrorState for those.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  size,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div className={cn(emptyStateVariants({ size }), 'rounded-[10px] border border-[#27272A] bg-[#111113] p-8', className)} {...props}>
      {icon ? (
        <div
          aria-hidden
          className="bg-[#16171A] text-[#A1A1AA] border border-[#27272A] mb-2 flex size-10 items-center justify-center rounded-[8px] [&_svg]:size-4"
        >
          {icon}
        </div>
      ) : null}
      <p className="text-[#FAFAFA] text-xs font-semibold tracking-tight">{title}</p>
      {description ? (
        <p className="text-[#71717A] max-w-xs text-xs text-balance leading-relaxed">
          {description}
        </p>
      ) : null}
      {action || secondaryAction ? (
        <div className="mt-3 flex items-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
