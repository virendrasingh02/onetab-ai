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
    <div
      className={cn(
        emptyStateVariants({ size }),
        'rounded-card border border-border bg-card p-8',
        className,
      )}
      {...props}
    >
      {icon ? (
        <div
          aria-hidden
          className="mb-2 flex size-10 items-center justify-center rounded-btn border border-border bg-surface-raised text-muted-foreground [&_svg]:size-4"
        >
          {icon}
        </div>
      ) : null}
      <p className="text-xs font-semibold tracking-tight text-foreground">{title}</p>
      {description ? (
        <p className="max-w-xs text-xs leading-relaxed text-balance text-muted-foreground">
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
