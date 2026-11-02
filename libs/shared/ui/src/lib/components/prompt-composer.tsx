import { cn } from '@org/utils';
import {
  ArrowDown,
  ArrowUp,
  CornerDownRight,
  Loader2,
  MessageSquare,
  Mic,
  Plus,
  Square,
  X,
} from 'lucide-react';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Button } from './button.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu.js';
import { Textarea } from './input.js';
import { toast } from './toaster.js';

/* Browser dictation — only offered where the Web Speech API exists. */
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((e: {
        resultIndex: number;
        results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
      }) => void)
    | null;
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
    <kbd className="h-5 min-w-5 px-1.5 font-medium inline-flex items-center justify-center rounded-md bg-surface-raised text-[11px] text-foreground">
      {children}
    </kbd>
  );
}

export interface PromptComposerAction {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
}

/** A one-click starter shown under an empty box — sends `prompt` straight away. */
export interface PromptComposerQuickAction {
  label: string;
  /** What gets sent; defaults to the label. */
  prompt?: string;
  icon?: ReactNode;
}

export interface PromptComposerProps {
  value: string;
  onChange: (value: string) => void;
  /** Called with the text being sent (the box's value, or a quick action's prompt). */
  onSubmit: (value: string) => void;
  /** Shows a spinner on the send button and locks the box. */
  busy?: boolean;
  id?: string;
  label?: string;
  /** One hint, or several that take turns while the box is empty. */
  placeholder?: string | string[];
  maxLength?: number;
  /** Starting height in lines — the box grows with what's typed. */
  rows?: number;
  /** Shown in the suggestions card while the box is focused and empty. */
  suggestions?: string[];
  /** Starter cards under the empty box (the Agent Copilot's "Quick actions"). */
  quickActions?: PromptComposerQuickAction[];
  quickActionsTitle?: string;
  /** Earlier prompts, shown as right-aligned pills above the box. */
  recent?: string[];
  /** Items in the `+` menu. */
  actions?: PromptComposerAction[];
  /** Extra controls next to the `+` menu. */
  toolbar?: ReactNode;
  /** Left side of the row under the box (a mode picker, a toggle). */
  footerStart?: ReactNode;
  /** `enter` submits on Enter (Shift+Enter = newline); `mod-enter` needs Ctrl/Cmd+Enter. */
  submitOn?: 'enter' | 'mod-enter';
  footnote?: ReactNode;
  submitLabel?: string;
  autoFocus?: boolean;
  className?: string;
}

const MIN_LENGTH = 3;

/**
 * The chat-style prompt box shared by Studio Home, the create page and the
 * Agent Copilot look: a borderless auto-growing textarea, a tool row (`+` menu,
 * dictation, round send), a hint row underneath, starter cards while empty and
 * a keyboard-navigable suggestions card while focused and empty.
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
  rows = 2,
  suggestions = [],
  quickActions = [],
  quickActionsTitle = 'Quick actions',
  recent = [],
  actions = [],
  toolbar,
  footerStart,
  submitOn = 'mod-enter',
  footnote,
  submitLabel = 'Send',
  autoFocus,
  className,
}: PromptComposerProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const hintId = `${fieldId}-hint`;
  const footnoteId = `${fieldId}-footnote`;
  const ref = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [listening, setListening] = useState(false);
  const [hintTick, setHintTick] = useState(0);
  const canDictate = getSpeechRecognition() !== null;

  useEffect(() => () => recognitionRef.current?.stop(), []);

  // Rotating hints, like the Copilot — only while there's nothing typed to compete with.
  const hints = Array.isArray(placeholder)
    ? placeholder
    : placeholder
      ? [placeholder]
      : [];
  const rotate = hints.length > 1 && value === '';
  useEffect(() => {
    if (!rotate) return;
    const t = setInterval(() => setHintTick((n) => n + 1), 4000);
    return () => clearInterval(t);
  }, [rotate]);
  const activeHint = listening
    ? 'Listening…'
    : hints[hintTick % Math.max(hints.length, 1)];

  // Grow with the text up to ~10 lines, then scroll.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [value]);

  const showSuggestions =
    !busy && open && value.trim() === '' && suggestions.length > 0;
  const showQuickActions =
    !busy && value.trim() === '' && quickActions.length > 0;
  const nearLimit = value.length > maxLength * 0.8;
  const canSend = !busy && value.trim().length >= MIN_LENGTH;

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
      for (let i = e.resultIndex; i < e.results.length; i++)
        if (e.results[i].isFinal) heard += e.results[i][0].transcript;
      if (heard)
        onChange(
          `${value}${value && !/\s$/.test(value) ? ' ' : ''}${heard.trim()}`.slice(
            0,
            maxLength,
          ),
        );
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => {
      setListening(false);
      toast.error(
        'Couldn’t use the microphone. Check the browser’s microphone permission.',
      );
    };
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (listening) recognitionRef.current?.stop();
    if (canSend) onSubmit(value.trim());
  };

  const runQuickAction = (a: PromptComposerQuickAction) => {
    const text = a.prompt ?? a.label;
    onChange(text);
    onSubmit(text);
  };

  return (
    <div className={cn('space-y-3', className)}>
      {!busy && recent.length > 0 && (
        <section
          aria-label="Recent prompts"
          className="gap-2 flex flex-col items-end"
        >
          {recent.slice(0, 3).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => pick(p)}
              title="Use this prompt again"
              className="gap-2 px-3.5 py-2 text-sm inline-flex max-w-[85%] cursor-pointer items-center rounded-xl border border-border bg-surface-raised/40 text-left text-muted-foreground transition-colors hover:border-border-strong hover:bg-surface-raised hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="truncate">{p}</span>
              <CornerDownRight
                className="size-3.5 shrink-0 opacity-60"
                aria-hidden
              />
            </button>
          ))}
        </section>
      )}

      {showSuggestions && (
        // Mouse-down is swallowed so clicking the card never blurs the box (which would close it first).
        <section
          aria-label="Suggested prompts"
          onMouseDown={(e) => e.preventDefault()}
          className="p-2 rounded-xl border border-border bg-surface shadow-sm"
        >
          <div className="gap-2 px-2 py-1.5 text-xs flex items-center justify-between text-muted-foreground">
            <span className="gap-2 flex items-center">
              <Kbd>
                <ArrowUp className="size-3" />
              </Kbd>
              <Kbd>
                <ArrowDown className="size-3" />
              </Kbd>
              <span>navigate</span>
              <Kbd>Enter</Kbd>
              <span>select</span>
            </span>
            <span className="gap-1.5 flex items-center">
              <Kbd>Esc</Kbd>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Hide suggestions"
                onClick={() => setOpen(false)}
              >
                <X />
              </Button>
            </span>
          </div>
          <ul
            role="listbox"
            id={`${fieldId}-suggestions`}
            aria-label="Suggested prompts"
            className="space-y-0.5"
          >
            {suggestions.map((s, i) => (
              <li
                key={s}
                id={`${fieldId}-suggestion-${i}`}
                role="option"
                aria-selected={i === active}
              >
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => pick(s)}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    'gap-2.5 px-3 py-2 text-sm flex w-full cursor-pointer items-center rounded-lg text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
                    i === active
                      ? 'font-medium bg-accent text-foreground'
                      : 'text-muted-foreground hover:bg-accent/60',
                  )}
                >
                  <CornerDownRight
                    className="size-3.5 shrink-0 opacity-60"
                    aria-hidden
                  />
                  <span className="truncate">{s}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div>
        <form
          onSubmit={submit}
          aria-busy={busy || undefined}
          className="px-2 py-1.5 rounded-xl border border-border bg-background shadow-sm transition-colors focus-within:border-ring"
        >
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
            readOnly={listening}
            rows={rows}
            autoFocus={autoFocus}
            maxLength={maxLength}
            placeholder={activeHint}
            aria-describedby={cn(hintId, footnote && footnoteId) || undefined}
            aria-controls={
              showSuggestions ? `${fieldId}-suggestions` : undefined
            }
            aria-activedescendant={
              showSuggestions && active >= 0
                ? `${fieldId}-suggestion-${active}`
                : undefined
            }
            className="max-h-60 min-h-10 px-2 py-2 text-sm resize-none rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          <div className="gap-2 flex items-center justify-between">
            <div className="min-w-0 gap-1 flex items-center">
              {actions.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="More ways to start"
                      title="More ways to start"
                      disabled={busy}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Plus className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    side="top"
                    className="w-56"
                  >
                    {actions.map((a) => (
                      <DropdownMenuItem
                        key={a.label}
                        onSelect={a.onSelect}
                        className="gap-2 text-xs"
                      >
                        {a.icon} {a.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {toolbar}
            </div>
            <div className="gap-1 flex items-center">
              {canDictate && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={toggleDictation}
                  disabled={busy}
                  className={cn(
                    'text-muted-foreground hover:text-foreground',
                    listening &&
                      'bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive',
                  )}
                  aria-label={listening ? 'Stop dictation' : 'Dictate'}
                  aria-pressed={listening}
                  title={listening ? 'Stop dictation' : 'Dictate'}
                >
                  {listening ? (
                    <Square className="size-3 fill-current" />
                  ) : (
                    <Mic className="size-4" />
                  )}
                </Button>
              )}
              <button
                type="submit"
                disabled={!canSend}
                aria-label={busy ? 'Working…' : submitLabel}
                title={`${submitLabel} (${submitOn === 'enter' ? 'Enter' : 'Ctrl + Enter'})`}
                className="size-8 flex cursor-pointer items-center justify-center rounded-full bg-foreground text-background shadow-sm transition-all hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-95 disabled:cursor-not-allowed disabled:bg-surface-raised disabled:text-muted-foreground disabled:opacity-100 disabled:shadow-none"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <ArrowUp className="size-4" aria-hidden />
                )}
              </button>
            </div>
          </div>
        </form>
        <div className="mt-2 min-h-6 gap-2 px-1 text-xs flex items-center justify-between text-muted-foreground">
          <div className="min-w-0 gap-1 flex items-center">{footerStart}</div>
          <span id={hintId} className="gap-2 flex items-center">
            {nearLimit ? (
              <span
                className={cn(
                  'tabular-nums',
                  value.length > maxLength * 0.95 && 'text-warning-text',
                )}
                aria-live="polite"
              >
                {value.length.toLocaleString()} / {maxLength.toLocaleString()}
              </span>
            ) : (
              <span className="sm:inline hidden">
                {submitOn === 'enter'
                  ? 'Enter to send · Shift + Enter for a new line'
                  : 'Ctrl + Enter to send'}
              </span>
            )}
          </span>
        </div>
      </div>

      {showQuickActions && (
        <section aria-labelledby={`${fieldId}-quick`} className="space-y-1.5">
          <p
            id={`${fieldId}-quick`}
            className="px-1 text-xs font-medium text-muted-foreground"
          >
            {quickActionsTitle}
          </p>
          <ul className="gap-1.5 sm:grid-cols-2 grid">
            {quickActions.map((a) => (
              <li key={a.label}>
                <button
                  type="button"
                  onClick={() => runQuickAction(a)}
                  className="gap-2.5 px-3 py-2.5 text-sm font-medium [&_svg]:size-4 flex w-full cursor-pointer items-center rounded-xl border border-border bg-surface-raised/40 text-left text-foreground transition-colors hover:border-border-strong hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none [&_svg]:shrink-0 [&_svg]:text-muted-foreground"
                >
                  {a.icon}
                  <span className="min-w-0 flex-1 truncate">{a.label}</span>
                  <MessageSquare
                    className="!size-3.5 !text-muted-foreground/50"
                    aria-hidden
                  />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {footnote ? (
        <p
          id={footnoteId}
          className="text-center text-[11px] text-muted-foreground"
        >
          {footnote}
        </p>
      ) : null}
    </div>
  );
}
