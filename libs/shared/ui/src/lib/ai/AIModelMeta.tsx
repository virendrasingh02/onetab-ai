import { memo } from 'react';
import { cn } from '@org/utils';
import { normalizeModel, type ModelInput } from './model-normalizer.js';

/**
 * AIModelMeta
 * Renders badges / chips for model specs (Context Window, Reasoning, Vision, Speed, Cost)
 */
export interface AIModelMetaProps {
  modelId?: ModelInput;
  model?: ModelInput;
  provider?: string | null;
  showAll?: boolean;
  className?: string;
}

export const AIModelMeta = memo(function AIModelMeta({
  modelId,
  model,
  provider,
  showAll = false,
  className,
}: AIModelMetaProps) {
  const targetModel = modelId || model;
  const meta = normalizeModel(targetModel, provider ?? null);

  return (
    <div
      className={cn('gap-1.5 flex flex-wrap items-center text-2xs', className)}
    >
      {meta.contextWindow && meta.contextWindow !== 'N/A' && (
        <span className="px-1 py-0.2 rounded border border-border/60 bg-surface-raised font-mono text-muted-foreground">
          {meta.contextWindow}
        </span>
      )}

      {meta.capabilities?.reasoning && (
        <span className="px-1 py-0.2 rounded font-medium border border-brand/20 bg-brand/10 text-brand-text">
          Reasoning
        </span>
      )}

      {meta.capabilities?.vision && (
        <span className="px-1 py-0.2 rounded border border-info/20 bg-info/10 text-info-text">
          Vision
        </span>
      )}

      {meta.capabilities?.toolCalling && showAll && (
        <span className="px-1 py-0.2 rounded border border-border/40 bg-surface-raised text-muted-foreground">
          Tools
        </span>
      )}

      {meta.speed && showAll && (
        <span className="px-1 py-0.2 rounded border border-border/40 bg-surface-raised text-muted-foreground capitalize">
          {meta.speed}
        </span>
      )}
    </div>
  );
});

AIModelMeta.displayName = 'AIModelMeta';
