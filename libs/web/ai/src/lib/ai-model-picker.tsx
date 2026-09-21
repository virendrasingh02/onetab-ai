import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@org/ui';
import { ChevronDown } from 'lucide-react';
import { AI_MODELS, modelLabelFor, type AIModelValue } from './ai-models.js';

export interface AIModelPickerProps {
  model: AIModelValue;
  onModelChange: (model: AIModelValue) => void;
}

/**
 * The model switcher for the raw AI chat surfaces (AI Studio home, docked
 * assistant), rendered through the shared `Composer`'s `toolbarSlot` — a real
 * menu button rather than a bare styled `<button>`, so the radio group reports
 * the current model to assistive tech and shows a check beside it.
 *
 * Previously this lived inside a bespoke `AIComposer`, reached by typing `@`
 * in the text itself. A visible control is strictly more discoverable, and it
 * frees `@` from meaning "pick a model" now that the shared composer's `@`
 * menu means "mention someone/something" everywhere else it's used.
 */
export function AIModelPicker({ model, onModelChange }: AIModelPickerProps) {
  const modelLabel = modelLabelFor(model);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1 px-2 font-medium"
          aria-label={`Model: ${modelLabel}`}
        >
          <span className="max-w-40 truncate">{modelLabel}</span>
          <ChevronDown className="size-3" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuRadioGroup
          value={model}
          onValueChange={(next) => onModelChange(next as AIModelValue)}
        >
          {AI_MODELS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
