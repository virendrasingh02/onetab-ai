import { memo, type HTMLAttributes } from 'react';
import { cn } from '@org/utils';
import { AIModelIcon } from './AIModelIcon.js';
import type { AIIconVariant } from './model-icon-map.js';
import { normalizeModel, type ModelInput } from './model-normalizer.js';

export type AIModelBadgeVariant = 'subtle' | 'compact' | 'outline' | 'filled' | 'ghost';

const VARIANT_STYLES: Record<AIModelBadgeVariant, string> = {
  subtle: 'bg-surface-raised border border-border/80 text-foreground hover:bg-accent/60',
  compact: 'bg-surface-inset border border-border/60 text-foreground text-[10px] py-0 px-1.5 h-5 gap-1',
  outline: 'border border-border text-foreground bg-transparent hover:bg-surface-raised',
  filled: 'bg-primary/10 border border-primary/20 text-primary font-medium hover:bg-primary/15',
  ghost: 'bg-transparent text-foreground hover:bg-accent/50',
};

/**
 * AIModelBadge
 * Reusable AI Model Badge with official LobeHub logo and normalized label.
 *
 * @param {string} modelId - Model ID
 * @param {string} [provider] - Provider key
 * @param {'subtle'|'compact'|'outline'|'filled'|'ghost'} [variant='subtle'] - Visual variant
 * @param {'color'|'mono'} [iconVariant='color'] - Icon style
 * @param {string} [className] - Optional Tailwind classes
 */
export interface AIModelBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  modelId?: ModelInput;
  model?: ModelInput;
  provider?: string | null;
  variant?: AIModelBadgeVariant;
  iconVariant?: AIIconVariant;
  showProvider?: boolean;
  /** `xs` is the dense size used inside cards and canvas nodes. */
  size?: 'xs' | 'sm';
}

export const AIModelBadge = memo(function AIModelBadge({
  modelId,
  model,
  provider,
  variant = 'subtle',
  iconVariant = 'color',
  showProvider = false,
  size = 'sm',
  className,
  ...props
}: AIModelBadgeProps) {
  const targetModel = modelId || model;
  const meta = normalizeModel(targetModel, provider ?? null);
  const isCompact = variant === 'compact' || size === 'xs';
  const iconSize = isCompact ? 12 : 14;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium leading-none select-none transition-colors',
        VARIANT_STYLES[variant] || VARIANT_STYLES.subtle,
        size === 'xs' && 'h-5 gap-1 px-1.5 py-0 text-[10px]',
        className
      )}
      {...props}
    >
      <AIModelIcon
        modelId={meta.canonicalId}
        provider={meta.providerId}
        variant={iconVariant}
        size={iconSize}
      />
      <span className="truncate">{meta.displayName}</span>
      {showProvider && (
        <span className="text-[10px] text-muted-foreground font-normal">
          · {meta.providerName}
        </span>
      )}
    </span>
  );
});

AIModelBadge.displayName = 'AIModelBadge';
