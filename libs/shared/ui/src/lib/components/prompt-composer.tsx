import { cn } from '@org/utils';
import { ArrowDown, ArrowUp, CornerDownRight, Loader2, Mic, Plus, Square, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from './button.js';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './dropdown-menu.js';
import { Textarea } from './input.js';
import { toast } from './toaster.js';

/* Browser dictation — only offered where the Web Speech API exists. */
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}
function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-surface-raised px-1.5 text-[11px] font-medium text-foreground">
      {children}
    </kbd>
  );
}

export interface PromptComposerAction {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
}

export interface PromptComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  /** Shows a spinner on the send button and locks the box. */
  busy?: boolean;
  id?: string;
  label?: string;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
  /** Strip label on the left of the composer header. */
  statusLabel?: string;
  /** Shown in the suggestions card while the box is focused and empty. */
  suggestions?: string[];
  /** Earlier prompts, shown as right-aligned pills above the box. */
  recent?: string[];
  /** Items in the `+` menu. */
  actions?: PromptComposerAction[];
  /** Extra controls on the left of the bottom row. */
  toolbar?: ReactNode;
  /** `enter` submits on Enter (Shift+Enter = newline); `mod-enter` needs Ctrl/Cmd+Enter. */
  submitOn?: 'enter' | 'mod-enter';
  footnote?: ReactNode;
  submitLabel?: string;
  autoFocus?: boolean;
  className?: string;
}

/**
 * The chat-style prompt box: a status strip, a borderless textarea, a tool row
 * (`+` menu, dictation, round send) and a keyboard-navigable suggestions card
 * that opens while the box is focused and empty.
 */
export function PromptComposer({
  value,
  onChange,
  onSubmit,
  busy = false,
  id,
  label = 'Describe what you want',
  placeholder,
  maxLength = 4_000,
  rows = 4,
  statusLabel = 'Studio planner',
  suggestions = [],
  recent = [],
  actions = [],
  toolbar,
  submitOn = 'mod-enter',
  footnote,
  submitLabel = 'Send',
  autoFocus,
  className,
}: PromptComposerProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const ref = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [listening, setListening] = useState(false);
  const canDictate = getSpeechRecognition() !== null;

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const showSuggestions = !busy && open && value.trim() === '' && suggestions.length > 0;

  const pick = (text: string) => {
    onChange(text);
    requestAnimationFrame(() => ref.current?.focus());
  };

  const toggleDictation = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Recognition = getSpeechRecognition();
    if (!Recognition) return;
    const rec = new Recognition();
    rec.lang = navigator.language || 'en-US';
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      let heard = '';
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) heard += e.results[i][0].transcript;
      if (heard) onChange(`${value}${value && !/\s$/.test(value) ? ' ' : ''}${heard.trim()}`.slice(0, maxLength));
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => {
      setListening(false);
      toast.error('Couldn’t use the microphone. Check the browser’s microphone permission.');
    };
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!busy && value.trim().length >= 3) onSubmit();
  };

  return (
    <div className={cn('space-y-3', className)}>
      {!busy && recent.length > 0 && (
        <section aria-label="Recent prompts" className="flex flex-col items-end gap-2">
          {recent.slice(0, 3).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => pick(p)}
              title="Use this prompt again"
              className="inline-flex max-w-[85%] items-center gap-2 rounded-xl border border-border bg-surface-raised/60 px-3.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <span className="truncate">{p}</span>
              <CornerDownRight className="size-3.5 shrink-0 opacity-60" aria-hidden />
            </button>
          ))}
        </section>
      )}

      {showSuggestions && (
        // Mouse-down is swallowed so clicking the card never blurs the box (which would close it first).
        <section aria-label="Suggested prompts" onMouseDown={(e) => e.preventDefault()} className="rounded-2xl border border-border bg-surface p-2 shadow-sm">
          <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <Kbd><ArrowUp className="size-3" /></Kbd>
              <Kbd><ArrowDown className="size-3" /></Kbd>
              <span>navigate</span>
              <Kbd>Enter</Kbd>
              <span>select</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>Esc</Kbd>
              <Button type="button" variant="ghost" size="icon-xs" aria-label="Hide suggestions" onClick={() => setOpen(false)}>
                <X />
              </Button>
            </span>
          </div>
          <ul role="listbox" aria-label="Suggested prompts" className="space-y-0.5">
            {suggestions.map((s, i) => (
              <li key={s} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onClick={() => pick(s)}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                    i === active ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground hover:bg-accent/60',
                  )}
                >
                  <CornerDownRight className="size-3.5 shrink-0 opacity-60" aria-hidden />
                  <span className="truncate">{s}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form
        onSubmit={submit}
        className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-shadow focus-within:border-border-strong focus-within:shadow-md focus-within:ring-2 focus-within:ring-ring/30"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            {statusLabel}
            <span aria-hidden>•</span>
            <span className="hidden sm:inline">{submitOn === 'enter' ? 'Enter to send' : 'Ctrl + Enter to send'}</span>
          </span>
          <span className={cn('tabular-nums', value.length > maxLength * 0.9 && 'text-warning-text')}>
            {value.length.toLocaleString()} / {maxLength.toLocaleString()}
          </span>
        </div>
        <label htmlFor={fieldId} className="sr-only">
          {label}
        </label>
        <Textarea
          id={fieldId}
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            const mod = e.metaKey || e.ctrlKey;
            if (showSuggestions) {
              const count = suggestions.length;
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                return setActive((i) => (i + 1) % count);
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                return setActive((i) => (i <= 0 ? count - 1 : i - 1));
              }
              if (e.key === 'Enter' && !mod && !e.shiftKey && active >= 0) {
                e.preventDefault();
                return pick(suggestions[active]);
              }
              if (e.key === 'Escape') return setOpen(false);
            }
            if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
            if (mod || (submitOn === 'enter' && !e.shiftKey)) {
              e.preventDefault();
              submit();
            }
          }}
          disabled={busy}
          rows={rows}
          autoFocus={autoFocus}
          maxLength={maxLength}
          placeholder={placeholder}
          className="min-h-24 resize-none rounded-none border-0 bg-transparent px-4 py-3 text-sm shadow-none focus-visible:ring-0"
        />
        <div className="flex items-center justify-between gap-2 px-3 pb-3">
          <div className="flex items-center gap-1">
            {actions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="More ways to start" disabled={busy}>
                    <Plus />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {actions.map((a) => (
                    <DropdownMenuItem key={a.label} onSelect={a.onSelect}>
                      {a.icon} {a.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {toolbar}
          </div>
          <div className="flex items-center gap-1.5">
            {canDictate && (
              <Button
                type="button"
                variant={listening ? 'primary' : 'ghost'}
                size="icon-sm"
                onClick={toggleDictation}
                disabled={busy}
                aria-label={listening ? 'Stop dictation' : 'Dictate your request'}
                aria-pressed={listening}
              >
                {listening ? <Square className="animate-pulse" /> : <Mic />}
              </Button>
            )}
            <Button
              type="submit"
              size="icon-sm"
              disabled={busy || value.trim().length < 3}
              aria-label={busy ? 'Working…' : submitLabel}
              className="rounded-full"
            >
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : <ArrowUp aria-hidden />}
            </Button>
          </div>
        </div>
      </form>
      {footnote ? <p className="text-center text-[11px] text-muted-foreground">{footnote}</p> : null}
    </div>
  );
}
