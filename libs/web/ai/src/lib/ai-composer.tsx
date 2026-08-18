import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Hint,
  Popover,
  PopoverAnchor,
  PopoverContent,
  ScrollArea,
} from '@org/ui';
import { cn } from '@org/utils';
import { ArrowUp, AtSign, ChevronDown, SquareSlash } from 'lucide-react';
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
} from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import {
  applySuggestion,
  filterCommands,
  filterMentions,
  readSuggestionTrigger,
  type SuggestionTrigger,
} from './ai-suggestions.js';
import {
  AI_MODELS,
  modelLabelFor,
  type AIModelValue,
} from './ai-models.js';

/** One row of the `@`/`/` menu, flattened so both kinds render identically. */
interface SuggestionOption {
  id: string;
  /** The `@handle` or `/name` shown in the mono chip. */
  token: string;
  label: string;
  /** Text that replaces the typed trigger. */
  insert: string;
  /** Mentions also switch the model for the turn. */
  model?: AIModelValue;
}

export interface AIComposerProps {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  model: AIModelValue;
  onModelChange: (model: AIModelValue) => void;
  /** A turn is in flight: the send button spins and submission is blocked. */
  isBusy?: boolean;
  placeholder?: string;
  /**
   * `hero` is the roomy card the home page centres on an empty conversation;
   * `docked` is the compact bar pinned to the bottom of a column. Same
   * anatomy, same tokens — only the scale differs.
   */
  variant?: 'hero' | 'docked';
  autoFocus?: boolean;
  ref?: Ref<HTMLTextAreaElement>;
  className?: string;
}

/**
 * The one composer behind both AI surfaces.
 *
 * Home and the docked assistant had grown two hand-rolled versions of this —
 * different paddings, different radii, a model picker that was a menu on one
 * side and a bare styled button on the other, and `@`/`/` advertised in the
 * placeholder on home while nothing listened for either key.
 */
export function AIComposer({
  value,
  onValueChange,
  onSubmit,
  model,
  onModelChange,
  isBusy = false,
  placeholder = 'Ask anything — @ for a model, / for a command…',
  variant = 'docked',
  autoFocus,
  ref,
  className,
}: AIComposerProps) {
  const isHero = variant === 'hero';

  const fieldRef = useRef<HTMLTextAreaElement | null>(null);
  const [trigger, setTrigger] = useState<SuggestionTrigger | null>(null);
  const [highlight, setHighlight] = useState(0);

  /*
   * The value is the caller's, so a replacement cannot move the caret in the
   * same tick — the DOM has not taken the new text yet. Parked here and applied
   * once React has committed it.
   */
  const pendingCaret = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (pendingCaret.current === null) return;
    const caret = pendingCaret.current;
    pendingCaret.current = null;

    const field = fieldRef.current;
    if (!field) return;
    field.focus();
    field.setSelectionRange(caret, caret);
  }, [value]);

  const suggestions = useMemo<SuggestionOption[]>(() => {
    if (!trigger) return [];

    if (trigger.kind === 'mention') {
      return filterMentions(trigger.query).map((mention) => ({
        id: mention.handle,
        token: `@${mention.handle}`,
        label: mention.label,
        insert: `@${mention.handle}`,
        model: mention.model,
      }));
    }

    return filterCommands(trigger.query).map((command) => ({
      id: command.name,
      token: `/${command.name}`,
      label: command.hint,
      insert: command.prompt,
    }));
  }, [trigger]);

  const isMenuOpen = trigger !== null && suggestions.length > 0;
  // Filtering can shrink the list out from under the cursor.
  const active = Math.min(highlight, suggestions.length - 1);

  const attachRef = (node: HTMLTextAreaElement | null) => {
    fieldRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) (ref as { current: HTMLTextAreaElement | null }).current = node;
  };

  const choose = (option: SuggestionOption) => {
    if (!trigger) return;

    if (option.model) onModelChange(option.model);

    const next = applySuggestion(value, trigger, option.insert);
    onValueChange(next.value);
    pendingCaret.current = next.caret;
    setTrigger(null);
  };

  /** Drops a `@` or `/` at the caret and opens the matching menu. */
  const openMenu = (symbol: '@' | '/') => {
    const field = fieldRef.current;
    const caret = field?.selectionStart ?? value.length;

    const before = value.slice(0, caret);
    const after = value.slice(caret);
    const inserted = before && !/\s$/.test(before) ? ` ${symbol}` : symbol;
    const nextValue = `${before}${inserted}${after}`;
    const nextCaret = before.length + inserted.length;

    onValueChange(nextValue);
    pendingCaret.current = nextCaret;
    setHighlight(0);
    setTrigger(readSuggestionTrigger(nextValue, nextCaret));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (isMenuOpen) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlight((current) => (current + 1) % suggestions.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlight(
          (current) =>
            (current - 1 + suggestions.length) % suggestions.length,
        );
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        choose(suggestions[active]);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setTrigger(null);
        return;
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSubmit();
    }
  };

  const modelLabel = modelLabelFor(model);

  return (
    <Popover
      open={isMenuOpen}
      onOpenChange={(open) => {
        if (!open) setTrigger(null);
      }}
    >
      <PopoverAnchor asChild>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
          className={cn(
            'w-full rounded-card border border-border bg-surface text-foreground',
            'transition-[border-color,box-shadow] duration-(--duration-fast) ease-standard',
            'focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20',
            isHero ? 'bg-surface-raised p-3 shadow-elevated' : 'p-2',
            className,
          )}
        >
          <TextareaAutosize
            ref={attachRef}
            value={value}
            autoFocus={autoFocus}
            onChange={(event) => {
              const next = event.target.value;
              onValueChange(next);
              setHighlight(0);
              setTrigger(
                readSuggestionTrigger(
                  next,
                  event.target.selectionStart ?? next.length,
                ),
              );
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            minRows={isHero ? 2 : 1}
            maxRows={isHero ? 10 : 6}
            aria-label={placeholder}
            className={cn(
              'w-full resize-none border-none bg-transparent px-1 outline-none',
              'leading-relaxed text-foreground placeholder:text-subtle',
              isHero ? 'text-sm' : 'text-xs',
            )}
          />

          <div
            className={cn(
              'gap-2 flex items-center justify-between',
              isHero ? 'pt-2' : 'pt-1.5',
            )}
          >
            <div className="gap-0.5 flex items-center">
              <Hint label="Mention a model">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => openMenu('@')}
                  aria-label="Mention a model"
                >
                  <AtSign className="size-3.5" />
                </Button>
              </Hint>

              <Hint label="Insert a command">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => openMenu('/')}
                  aria-label="Insert a command"
                >
                  <SquareSlash className="size-3.5" />
                </Button>
              </Hint>

              {/*
                A real menu button rather than a bare styled `<button>`: the
                radio group reports the current model to assistive tech and
                shows a check beside it.
              */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1 px-2 font-medium text-[11px]"
                    aria-label={`Model: ${modelLabel}`}
                  >
                    <span className="max-w-40 truncate">{modelLabel}</span>
                    <ChevronDown className="size-3" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  <DropdownMenuRadioGroup
                    value={model}
                    onValueChange={(next) => onModelChange(next as AIModelValue)}
                  >
                    {AI_MODELS.map((option) => (
                      <DropdownMenuRadioItem
                        key={option.value}
                        value={option.value}
                        className="text-xs"
                      >
                        {option.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <Button
              type="submit"
              size="icon-sm"
              loading={isBusy}
              disabled={!value.trim() || isBusy}
              aria-label="Send message"
              className="rounded-full"
            >
              <ArrowUp className="size-3.5" />
            </Button>
          </div>
        </form>
      </PopoverAnchor>

      {/*
        Focus stays in the textarea the whole time the menu is open — the list
        is driven from the field's own arrow keys, so handing it focus would
        break typing mid-filter.
      */}
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-(--radix-popover-trigger-width) rounded-popup p-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <p className="px-3 py-1.5 font-medium tracking-wide text-[10px] border-b border-border text-subtle uppercase">
          {trigger?.kind === 'mention' ? 'Models' : 'Commands'}
        </p>

        <ScrollArea className="max-h-56" contentClassName="p-1">
          {suggestions.map((option, index) => (
            <button
              key={option.id}
              type="button"
              onMouseEnter={() => setHighlight(index)}
              onClick={() => choose(option)}
              className={cn(
                'w-full gap-2 px-2 py-1.5 text-xs flex items-center rounded-btn text-left',
                'transition-colors duration-(--duration-fast) ease-standard',
                index === active
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground',
              )}
            >
              <span className="font-mono shrink-0 font-medium text-primary">
                {option.token}
              </span>
              <span className="truncate">{option.label}</span>
            </button>
          ))}
        </ScrollArea>

        <p className="px-3 py-1.5 text-[10px] border-t border-border text-subtle">
          ↑↓ to browse · Enter to insert · Esc to dismiss
        </p>
      </PopoverContent>
    </Popover>
  );
}
