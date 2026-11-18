import { cn } from '@org/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps, ReactNode } from 'react';

const emptyStateVariants = cva(
  'flex flex-col items-center justify-center text-center select-none',
  {
    variants: {
      size: {
        sm: 'py-6 px-4',
        md: 'py-10 px-6',
        lg: 'py-16 px-8',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

type EmptyStateSize = NonNullable<VariantProps<typeof emptyStateVariants>['size']>;

export interface EmptyStateProps
  extends ComponentProps<'div'>, VariantProps<typeof emptyStateVariants> {
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Primary call to action; render a <Button>. */
  action?: ReactNode;
  /** Secondary affordance, e.g. a docs link or secondary button. */
  secondaryAction?: ReactNode;
  /** Drop the decorative rings and show only a plain icon tile. */
  hideGraphic?: boolean;
}

const tileSize: Record<EmptyStateSize, string> = {
  sm: 'size-10 rounded-xl [&_svg]:size-4.5',
  md: 'size-14 rounded-2xl [&_svg]:size-6',
  lg: 'size-16 rounded-2xl [&_svg]:size-7',
};

const titleSize: Record<EmptyStateSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

/**
 * Icon medallion shown above the title: a raised tile holding the icon, set
 * inside two faint concentric rings with a soft glow. Built only from theme
 * tokens so it follows light / dark and every workspace palette.
 */
function EmptyStateGraphic({
  icon,
  size,
  plain,
}: {
  icon?: ReactNode;
  size: EmptyStateSize;
  plain: boolean;
}) {
  const tile = (
    <div
      className={cn(
        'relative z-10 flex shrink-0 items-center justify-center border border-border bg-card text-muted-foreground shadow-sm',
        'bg-linear-to-b from-card to-surface-muted',
        tileSize[size],
      )}
    >
      {icon ?? <div className="size-2/5 rounded-md bg-muted-foreground/25" />}
    </div>
  );

  if (plain || size === 'sm') {
    return (
      <div aria-hidden className={size === 'sm' ? 'mb-3' : 'mb-4'}>
        {tile}
      </div>
    );
  }

  const lg = size === 'lg';
  return (
    <div
      aria-hidden
      className={cn(
        'relative mb-5 flex items-center justify-center',
        lg ? 'size-36' : 'size-28',
      )}
    >
      {/* soft glow */}
      <div className="absolute inset-4 rounded-full bg-primary/8 blur-xl" />
      {/* outer ring */}
      <div className="absolute inset-0 rounded-full border border-dashed border-border" />
      {/* inner ring */}
      <div
        className={cn(
          'absolute rounded-full border border-border bg-surface-muted/60',
          lg ? 'inset-5' : 'inset-4',
        )}
      />
      {tile}
    </div>
  );
}

/**
 * Shown when a collection or view is legitimately empty.
 * Icon medallion on top, then title, description and actions — all
 * theme-aware, so it reads correctly in light and dark.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  size,
  hideGraphic = false,
  className,
  ...props
}: EmptyStateProps) {
  const s: EmptyStateSize = size ?? 'md';
  return (
    <div
      role="region"
      aria-label={title}
      className={cn(emptyStateVariants({ size }), className)}
      {...props}
    >
      {hideGraphic && !icon ? null : (
        <EmptyStateGraphic icon={icon} size={s} plain={hideGraphic} />
      )}

      <h3
        className={cn(
          'font-semibold tracking-tight text-foreground text-balance',
          titleSize[s],
        )}
      >
        {title}
      </h3>

      {description ? (
        <p
          className={cn(
            'mt-1.5 max-w-sm leading-relaxed text-muted-foreground text-pretty',
            s === 'sm' ? 'text-xs' : 'text-sm',
          )}
        >
          {description}
        </p>
      ) : null}

      {action || secondaryAction ? (
        <div
          className={cn(
            'flex flex-wrap items-center justify-center gap-2',
            s === 'sm' ? 'mt-4' : 'mt-5',
          )}
        >
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
