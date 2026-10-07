import { memo, type HTMLAttributes } from 'react';
import { cn } from '@org/utils';
import { AIProviderIcon } from './AIProviderIcon.js';
import type { AIIconVariant } from './model-icon-map.js';
import { normalizeProvider } from './model-normalizer.js';

export type AIProviderBadgeVariant = 'subtle' | 'compact' | 'outline' | 'filled';

const VARIANT_STYLES: Record<AIProviderBadgeVariant, string> = {
  subtle: 'bg-surface-raised border border-border/80 text-foreground',
  compact: 'bg-surface-inset border border-border/60 text-foreground text-[10px] py-0 px-1.5 h-5 gap-1',
  outline: 'border border-border text-foreground bg-transparent',
  filled: 'bg-primary/10 border border-primary/20 text-primary font-medium',
};

/**
 * AIProviderBadge
 * Reusable AI Provider Badge with official LobeHub logo and normalized label.
 */
export interface AIProviderBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  provider?: string | null;
  providerId?: string | null;
  variant?: AIProviderBadgeVariant;
  iconVariant?: AIIconVariant;
}

export const AIProviderBadge = memo(function AIProviderBadge({
  provider,
  providerId,
  variant = 'subtle',
  iconVariant = 'color',
  className,
  ...props
}: AIProviderBadgeProps) {
  const targetProvider = provider || providerId;
  const { name } = normalizeProvider(targetProvider);
  const isCompact = variant === 'compact';
  const iconSize = isCompact ? 12 : 14;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium leading-none select-none transition-colors',
        VARIANT_STYLES[variant] || VARIANT_STYLES.subtle,
        className
      )}
      {...props}
    >
      <AIProviderIcon
        provider={targetProvider}
        variant={iconVariant}
        size={iconSize}
      />
      <span className="truncate">{name}</span>
    </span>
  );
});

AIProviderBadge.displayName = 'AIProviderBadge';
