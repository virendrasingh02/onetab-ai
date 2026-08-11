import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Hint,
  ScrollArea,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  ArrowUp,
  ChevronDown,
  Clock,
  History,
  Info,
  Mic,
  RotateCcw,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const MODELS = [
  'Auto',
  'Google Gemini',
  'OpenAI GPT-4',
  'Claude 3.5',
  'Ollama Local',
] as const;

type Model = (typeof MODELS)[number];

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** Stored as an ISO timestamp and formatted at render, not at creation. */
  at: string;
}

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** "Good morning" at 3am was a bad look — the greeting now follows the clock. */
function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function welcomeMessage(): ChatMessage {
  return {
    id: `welcome-${Date.now()}`,
    role: 'assistant',
    text: `${greeting()}! How can I assist you with your workspace tasks, channels, or research today?`,
    at: new Date().toISOString(),
  };
}

export interface AssistantPanelProps {
  onClose: () => void;
  className?: string;
}

/**
 * The shell's right-hand copilot column.
 *
 * Lives here rather than inside `AppShell` so the shell stays a layout concern:
 * previously ~300 lines of chat state and markup sat in the middle of the
 * grid definition, and every keystroke in the composer re-rendered the entire
 * application frame including the router `Outlet`.
 */
export function AssistantPanel({ onClose, className }: AssistantPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<Model>('Auto');
  const [isThinking, setIsThinking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [welcomeMessage()]);

  const endRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  /*
   * `block: 'nearest'` keeps the scroll inside the message list. The previous
   * `scrollIntoView({ behavior: 'smooth' })` scrolled the nearest scrollable
   * ancestor too, which yanked the main content area on first paint.
   */
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages, isThinking]);

  /* Grow the composer with its content, up to a ceiling, instead of a fixed
     two rows that hid anything longer. */
  const autoSize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const send = () => {
    const query = prompt.trim();
    if (!query || isThinking) return;

    const now = new Date().toISOString();
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', text: query, at: now },
    ]);
    setPrompt('');
    setIsThinking(true);
    requestAnimationFrame(() => autoSize(composerRef.current));

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: `[${model}] Processed request: "${query}". I analyzed your workspace channels and tasks to synthesize this report.`,
          at: new Date().toISOString(),
        },
      ]);
      setIsThinking(false);
    }, 700);
  };

  const reset = () => {
    setMessages([welcomeMessage()]);
    setPrompt('');
    composerRef.current?.focus();
  };

  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-background', className)}>
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
          <Sparkles className="size-4 text-primary" aria-hidden />
          <span>AI Assistant</span>
        </span>

        <div className="flex items-center gap-0.5">
          <Hint label="New chat">
            <Button variant="ghost" size="icon-sm" onClick={reset} aria-label="New chat">
              <RotateCcw className="size-4" />
            </Button>
          </Hint>
          <Hint label="Chat history">
            <Button variant="ghost" size="icon-sm" aria-label="Chat history">
              <History className="size-4" />
            </Button>
          </Hint>
          <Hint label="Close assistant">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Close assistant"
            >
              <X className="size-4" />
            </Button>
          </Hint>
        </div>
      </div>

      <ScrollArea className="scrollbar-subtle min-h-0 flex-1">
        <div
          className="space-y-3 p-3"
          role="log"
          aria-live="polite"
          aria-label="Conversation"
        >
          <div className="flex items-center gap-2 rounded-card border border-border bg-surface p-2.5 text-xs text-muted-foreground">
            <Clock className="size-3.5 shrink-0 text-subtle" aria-hidden />
            <span className="truncate">
              Recent chat — Workspace research &amp; step parameters
            </span>
          </div>

          {messages.map((message) => {
            const isUser = message.role === 'user';
            return (
              <div
                key={message.id}
                className={cn(
                  'max-w-[90%] space-y-1 rounded-card p-3 text-xs leading-relaxed',
                  isUser
                    ? 'ml-auto bg-primary text-primary-foreground'
                    : 'bg-surface-raised text-foreground',
                )}
              >
                <div className="flex items-center justify-between gap-2 text-[10px] opacity-70">
                  <span className="flex items-center gap-1 font-medium">
                    {isUser ? (
                      <User className="size-3" aria-hidden />
                    ) : (
                      <Sparkles className="size-3" aria-hidden />
                    )}
                    {isUser ? 'You' : 'Copilot'}
                  </span>
                  <time dateTime={message.at}>{timeLabel(message.at)}</time>
                </div>
                <p className="whitespace-pre-wrap">{message.text}</p>
              </div>
            );
          })}

          {isThinking ? (
            <p
              className="w-fit rounded-card bg-surface-raised p-3 text-xs text-muted-foreground"
              role="status"
            >
              Copilot is thinking…
            </p>
          ) : null}

          <div ref={endRef} />
        </div>
      </ScrollArea>

      <div className="shrink-0 border-t border-border p-3">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
          className={cn(
            'space-y-2 rounded-card border border-border bg-surface p-3',
            'transition-colors duration-(--duration-fast) ease-standard',
            'focus-within:border-ring/60',
          )}
        >
          <textarea
            ref={composerRef}
            value={prompt}
            onChange={(event) => {
              setPrompt(event.target.value);
              autoSize(event.target);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            placeholder="Ask AI anything…"
            rows={2}
            aria-label="Ask AI anything"
            className={cn(
              'w-full resize-none border-none bg-transparent text-xs outline-none',
              'text-foreground placeholder:text-subtle',
            )}
          />

          <div className="flex items-center justify-between pt-1">
            {/*
              A real menu button rather than a bare styled `<button>`: the
              radio group reports the current model to assistive tech and shows
              a check beside it, which the old plain items never did.
            */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-2 text-[11px] font-medium text-muted-foreground"
                  aria-label={`Model: ${model}`}
                >
                  <span>{model}</span>
                  <ChevronDown className="size-3" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuRadioGroup
                  value={model}
                  onValueChange={(value) => setModel(value as Model)}
                >
                  {MODELS.map((option) => (
                    <DropdownMenuRadioItem
                      key={option}
                      value={option}
                      className="text-xs"
                    >
                      {option}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex items-center gap-0.5">
              <Hint label="About this assistant">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="About this assistant"
                >
                  <Info className="size-3.5" />
                </Button>
              </Hint>
              <Hint label="Voice input">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Voice input"
                >
                  <Mic className="size-3.5" />
                </Button>
              </Hint>
              <Button
                type="submit"
                size="icon-sm"
                disabled={!prompt.trim() || isThinking}
                aria-label="Send message"
                className="rounded-full"
              >
                <ArrowUp className="size-3.5" />
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
