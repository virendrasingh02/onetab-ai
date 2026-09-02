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

export interface EmptyStateProps
  extends ComponentProps<'div'>, VariantProps<typeof emptyStateVariants> {
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Primary call to action; render a <Button>. */
  action?: ReactNode;
  /** Secondary affordance, e.g. a docs link or secondary button. */
  secondaryAction?: ReactNode;
  /** Hide the layered card graphic if needed */
  hideGraphic?: boolean;
}

/**
 * Visual layered card stack graphic matching the modern dark empty state reference design.
 */
function EmptyStateGraphic({ icon }: { icon?: ReactNode }) {
  return (
    <div className="relative mb-5 flex items-center justify-center" aria-hidden>
      {/* Stack Layer 1 (topmost back) */}
      <div className="absolute -top-3 w-36 sm:w-44 h-12 rounded-t-xl bg-zinc-900/30 border-t border-x border-zinc-800/40 shadow-xs pointer-events-none" />
      {/* Stack Layer 2 (middle back) */}
      <div className="absolute -top-1.5 w-42 sm:w-50 h-14 rounded-t-xl bg-zinc-900/60 border-t border-x border-zinc-800/70 shadow-xs pointer-events-none" />
      {/* Front Card Container */}
      <div className="relative z-10 w-48 sm:w-56 h-18 sm:h-20 rounded-xl bg-[#121214] border border-zinc-800 shadow-2xl p-3 flex items-center gap-3">
        {/* Left icon / thumbnail block */}
        <div className="size-10 sm:size-11 rounded-lg bg-zinc-850 border border-zinc-700/60 flex items-center justify-center text-zinc-400 shrink-0 shadow-inner">
          {icon ? (
            <div className="[&_svg]:size-5 [&_svg]:text-zinc-300 flex items-center justify-center">
              {icon}
            </div>
          ) : (
            <div className="size-4.5 rounded-xs bg-zinc-700/60" />
          )}
        </div>
        {/* Right skeleton placeholder lines */}
        <div className="flex flex-col gap-1.5 min-w-0 flex-1">
          <div className="h-2.5 w-3/4 bg-zinc-700/60 rounded-full" />
          <div className="h-2 w-1/2 bg-zinc-800/80 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * Shown when a collection or view is legitimately empty.
 * Styled in dark minimalist aesthetic with layered cards graphic, clean typography, and action buttons.
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
  return (
    <div
      className={cn(emptyStateVariants({ size }), className)}
      {...props}
    >
      {!hideGraphic ? (
        <EmptyStateGraphic icon={icon} />
      ) : icon ? (
        <div
          aria-hidden
          className="mb-3 size-10 [&_svg]:size-5 flex items-center justify-center rounded-xl border border-zinc-800 bg-[#121214] text-zinc-400"
        >
          {icon}
        </div>
      ) : null}

      <h3 className="text-base sm:text-lg font-bold tracking-tight text-white text-center">
        {title}
      </h3>

      {description ? (
        <p className="max-w-sm sm:max-w-md text-xs sm:text-sm leading-relaxed text-zinc-400 mt-1.5 text-center font-normal">
          {description}
        </p>
      ) : null}

      {action || secondaryAction ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
