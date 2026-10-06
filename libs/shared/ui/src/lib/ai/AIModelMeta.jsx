import React, { memo } from 'react';
import { cn } from '@org/utils';
import { normalizeModel } from './model-normalizer.js';

/**
 * AIModelMeta
 * Renders badges / chips for model specs (Context Window, Reasoning, Vision, Speed, Cost)
 */
export const AIModelMeta = memo(function AIModelMeta({
  modelId,
  model,
  provider,
  showAll = false,
  className,
}) {
  const targetModel = modelId || model;
  const meta = normalizeModel(targetModel, provider);

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5 text-[10px]', className)}>
      {meta.contextWindow && meta.contextWindow !== 'N/A' && (
        <span className="font-mono px-1 py-0.2 rounded bg-surface-raised border border-border/60 text-muted-foreground">
          {meta.contextWindow}
        </span>
      )}

      {meta.capabilities?.reasoning && (
        <span className="px-1 py-0.2 rounded bg-primary/10 border border-primary/20 text-primary font-medium">
          Reasoning
        </span>
      )}

      {meta.capabilities?.vision && (
        <span className="px-1 py-0.2 rounded bg-info/10 border border-info/20 text-info-text">
          Vision
        </span>
      )}

      {meta.capabilities?.toolCalling && showAll && (
        <span className="px-1 py-0.2 rounded bg-surface-raised border border-border/40 text-muted-foreground">
          Tools
        </span>
      )}

      {meta.speed && showAll && (
        <span className="capitalize px-1 py-0.2 rounded bg-surface-raised border border-border/40 text-muted-foreground">
          {meta.speed}
        </span>
      )}
    </div>
  );
});

AIModelMeta.displayName = 'AIModelMeta';
