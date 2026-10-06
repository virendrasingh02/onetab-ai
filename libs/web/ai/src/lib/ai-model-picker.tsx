import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  AIModelIcon,
} from '@org/ui';
import { ChevronDown, Sparkles } from 'lucide-react';
import { AI_MODELS, modelLabelFor, type AIModelValue } from './ai-models.js';

export interface AIModelPickerProps {
  model: AIModelValue;
  onModelChange: (model: AIModelValue) => void;
}

/**
 * The model switcher for the raw AI chat surfaces (AI Studio home, docked
 * assistant), rendered through the shared `Composer`'s `toolbarSlot`.
 * Upgraded with LobeHub brand icons and rich provider metadata.
 */
export function AIModelPicker({ model, onModelChange }: AIModelPickerProps) {
  const modelLabel = modelLabelFor(model);
  const activeOption = AI_MODELS.find((opt) => opt.value === model);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-2 px-2.5 font-medium hover:bg-surface-hover"
          aria-label={`Model: ${modelLabel}`}
        >
          {model === 'auto' ? (
            <Sparkles className="size-3.5 text-primary shrink-0" aria-hidden />
          ) : (
            <AIModelIcon
              modelId={activeOption?.model || activeOption?.value}
              provider={activeOption?.provider}
              size={15}
              className="shrink-0"
            />
          )}
          <span className="max-w-40 truncate text-xs">{modelLabel}</span>
          <ChevronDown className="size-3 text-muted-foreground shrink-0" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 p-1">
        <DropdownMenuRadioGroup
          value={model}
          onValueChange={(next) => onModelChange(next as AIModelValue)}
        >
          {AI_MODELS.map((option) => {
            const isAuto = option.value === 'auto';
            return (
              <DropdownMenuRadioItem
                key={option.value}
                value={option.value}
                className="gap-2.5 py-2 cursor-pointer"
              >
                <div className="shrink-0 flex items-center justify-center">
                  {isAuto ? (
                    <Sparkles className="size-4 text-primary" aria-hidden />
                  ) : (
                    <AIModelIcon
                      modelId={option.model || option.value}
                      provider={option.provider}
                      size={16}
                    />
                  )}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-medium text-xs truncate leading-snug">
                    {option.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate leading-snug">
                    {option.badge
                      ? `${option.category || 'AI'} · ${option.badge}`
                      : option.description || option.category || 'Platform default'}
                  </span>
                </div>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
