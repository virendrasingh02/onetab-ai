import { memo, type HTMLAttributes } from 'react';
import { cn } from '@org/utils';
import { Check } from 'lucide-react';
import { AIModelIcon } from './AIModelIcon.js';
import {
  normalizeModel,
  type ModelInput,
  type NormalizedModel,
} from './model-normalizer.js';

/**
 * AIModelListItem
 * Standardized row for Model Selector dropdowns, command palettes, and model lists.
 */
export interface AIModelListItemProps extends Omit<
  HTMLAttributes<HTMLButtonElement>,
  'onSelect'
> {
  modelId?: ModelInput;
  model?: ModelInput;
  provider?: string | null;
  isSelected?: boolean;
  isRecommended?: boolean;
  onSelect?: (meta: NormalizedModel) => void;
}

export const AIModelListItem = memo(function AIModelListItem({
  modelId,
  model,
  provider,
  isSelected = false,
  isRecommended = false,
  onSelect,
  className,
  ...props
}: AIModelListItemProps) {
  const targetModel = modelId || model;
  const meta = normalizeModel(targetModel, provider ?? null);

  const activeCaps: string[] = [];
  if (meta.capabilities?.reasoning) activeCaps.push('Reasoning');
  if (meta.capabilities?.vision) activeCaps.push('Vision');
  if (meta.capabilities?.toolCalling) activeCaps.push('Tools');

  return (
    <button
      type="button"
      onClick={() => onSelect?.(meta)}
      className={cn(
        'group px-2 py-1.5 text-xs flex w-full cursor-pointer items-center justify-between rounded-md text-left transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        isSelected
          ? 'font-medium bg-surface-raised text-foreground'
          : 'text-foreground/90',
        className,
      )}
      role="option"
      aria-selected={isSelected}
      {...props}
    >
      <div className="gap-2.5 min-w-0 pr-2 flex flex-1 items-center">
        <AIModelIcon
          modelId={meta.canonicalId}
          provider={meta.providerId}
          variant="color"
          size={18}
        />
        <div className="min-w-0 flex-1">
          <div className="gap-1.5 flex items-center">
            <span className="font-medium truncate text-foreground">
              {meta.displayName}
            </span>
            {isRecommended && (
              <span className="px-1 py-0.2 font-bold rounded-xs bg-brand/15 text-3xs text-brand-text">
                REC
              </span>
            )}
          </div>
          <div className="gap-1 flex items-center truncate text-meta text-muted-foreground">
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

      <div className="gap-2 flex shrink-0 items-center">
        {meta.contextWindow && meta.contextWindow !== 'N/A' && (
          <span className="px-1 py-0.5 rounded bg-surface-inset font-mono text-2xs text-muted-foreground">
            {meta.contextWindow}
          </span>
        )}
        {isSelected ? (
          <Check
            className="size-3.5 shrink-0 text-brand-text"
            aria-hidden="true"
          />
        ) : (
          <div className="size-3.5" />
        )}
      </div>
    </button>
  );
});

AIModelListItem.displayName = 'AIModelListItem';
