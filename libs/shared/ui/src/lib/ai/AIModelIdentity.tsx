import { memo, type HTMLAttributes } from 'react';
import { cn } from '@org/utils';
import { AIModelIcon } from './AIModelIcon.js';
import type { AIIconVariant } from './model-icon-map.js';
import { normalizeModel, type ModelInput } from './model-normalizer.js';

/**
 * AIModelIdentity
 * Combined visual presentation of AI Model Identity (Icon + Name + Provider + Metadata)
 * Pixel-consistent, responsive, and adheres to shadcn/ui typography.
 */
export interface AIModelIdentityProps extends HTMLAttributes<HTMLDivElement> {
  modelId?: ModelInput;
  model?: ModelInput;
  provider?: string | null;
  variant?: AIIconVariant;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showProvider?: boolean;
  showCapabilities?: boolean;
  showContext?: boolean;
  showSpeed?: boolean;
  layout?: 'inline' | 'stacked';
  nameClassName?: string;
  metaClassName?: string;
}

export const AIModelIdentity = memo(function AIModelIdentity({
  modelId,
  model,
  provider,
  variant = 'color',
  size = 'sm', // 'xs' | 'sm' | 'md' | 'lg'
  showProvider = false,
  showCapabilities = false,
  showContext = false,
  showSpeed = false,
  layout = 'inline', // 'inline' | 'stacked'
  className,
  nameClassName,
  metaClassName,
  ...props
}: AIModelIdentityProps) {
  const targetModel = modelId || model;
  const meta = normalizeModel(targetModel, provider ?? null);

  const iconSizes: Record<string, number> = {
    xs: 14,
    sm: 16,
    md: 20,
    lg: 24,
  };

  const textSizes: Record<string, string> = {
    xs: 'text-xs',
    sm: 'text-xs',
    md: 'text-sm font-medium',
    lg: 'text-base font-semibold',
  };

  const iconDimension = iconSizes[size] || 16;
  const textClass = textSizes[size] || 'text-xs font-medium';

  // Format active capabilities
  const activeCaps: string[] = [];
  if (meta.capabilities?.reasoning) activeCaps.push('Reasoning');
  if (meta.capabilities?.vision) activeCaps.push('Vision');
  if (meta.capabilities?.toolCalling) activeCaps.push('Tools');
  if (meta.capabilities?.coding && !meta.capabilities?.reasoning)
    activeCaps.push('Code');

  if (layout === 'stacked') {
    return (
      <div
        className={cn('gap-2.5 min-w-0 flex items-start text-left', className)}
        {...props}
      >
        <div className="mt-0.5 shrink-0">
          <AIModelIcon
            modelId={meta.canonicalId}
            provider={meta.providerId}
            variant={variant}
            size={iconDimension}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              'font-semibold leading-tight truncate text-foreground',
              textClass,
              nameClassName,
            )}
          >
            {meta.displayName}
          </div>
          <div
            className={cn(
              'gap-1.5 mt-0.5 flex flex-wrap items-center text-meta text-muted-foreground',
              metaClassName,
            )}
          >
            <span>{meta.providerName}</span>
            {showContext &&
              meta.contextWindow &&
              meta.contextWindow !== 'N/A' && (
                <>
                  <span className="opacity-40">·</span>
                  <span>{meta.contextWindow}</span>
                </>
              )}
            {showCapabilities && activeCaps.length > 0 && (
              <>
                <span className="opacity-40">·</span>
                <span>{activeCaps.join(' · ')}</span>
              </>
            )}
            {showSpeed && meta.speed && (
              <>
                <span className="opacity-40">·</span>
                <span className="capitalize">{meta.speed}</span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'gap-1.5 min-w-0 inline-flex items-center text-left align-middle',
        className,
      )}
      {...props}
    >
      <AIModelIcon
        modelId={meta.canonicalId}
        provider={meta.providerId}
        variant={variant}
        size={iconDimension}
      />
      <span
        className={cn(
          'font-medium truncate text-foreground',
          textClass,
          nameClassName,
        )}
      >
        {meta.displayName}
      </span>
      {showProvider && (
        <span
          className={cn(
            'truncate text-meta text-muted-foreground',
            metaClassName,
          )}
        >
          ({meta.providerName})
        </span>
      )}
      {showContext && meta.contextWindow && meta.contextWindow !== 'N/A' && (
        <span className="px-1 py-0.5 rounded shrink-0 border border-border/40 bg-surface-raised font-mono text-2xs text-muted-foreground">
          {meta.contextWindow}
        </span>
      )}
      {showCapabilities && activeCaps.length > 0 && (
        <span className="sm:inline-block hidden truncate text-meta text-muted-foreground">
          · {activeCaps.slice(0, 2).join(' · ')}
        </span>
      )}
    </div>
  );
});

AIModelIdentity.displayName = 'AIModelIdentity';
