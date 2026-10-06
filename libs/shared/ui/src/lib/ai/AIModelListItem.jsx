import React, { memo } from 'react';
import { cn } from '@org/utils';
import { Check } from 'lucide-react';
import { AIModelIcon } from './AIModelIcon.jsx';
import { normalizeModel } from './model-normalizer.js';

/**
 * AIModelListItem
 * Standardized row for Model Selector dropdowns, command palettes, and model lists.
 */
export const AIModelListItem = memo(function AIModelListItem({
  modelId,
  model,
  provider,
  isSelected = false,
  isRecommended = false,
  onSelect,
  className,
  ...props
}) {
  const targetModel = modelId || model;
  const meta = normalizeModel(targetModel, provider);

  const activeCaps = [];
  if (meta.capabilities?.reasoning) activeCaps.push('Reasoning');
  if (meta.capabilities?.vision) activeCaps.push('Vision');
  if (meta.capabilities?.toolCalling) activeCaps.push('Tools');

  return (
    <button
      type="button"
      onClick={() => onSelect?.(meta)}
      className={cn(
        'group flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors cursor-pointer',
        'hover:bg-accent hover:text-accent-foreground',
        isSelected ? 'bg-surface-raised font-medium text-foreground' : 'text-foreground/90',
        className
      )}
      role="option"
      aria-selected={isSelected}
      {...props}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
        <AIModelIcon
          modelId={meta.canonicalId}
          provider={meta.providerId}
          variant="color"
          size={18}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-medium text-foreground">{meta.displayName}</span>
            {isRecommended && (
              <span className="rounded-xs bg-primary/15 text-primary-text px-1 py-0.2 text-[9px] font-bold">
                REC
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
            <span>{meta.providerName}</span>
            {activeCaps.length > 0 && (
              <>
                <span className="opacity-40">·</span>
                <span>{activeCaps.join(' · ')}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {meta.contextWindow && meta.contextWindow !== 'N/A' && (
          <span className="font-mono text-[10px] text-muted-foreground px-1 py-0.5 rounded bg-surface-inset">
            {meta.contextWindow}
          </span>
        )}
        {isSelected ? (
          <Check className="size-3.5 text-primary shrink-0" aria-hidden="true" />
        ) : (
          <div className="size-3.5" />
        )}
      </div>
    </button>
  );
});

AIModelListItem.displayName = 'AIModelListItem';
