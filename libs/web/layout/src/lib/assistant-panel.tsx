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
import type { AIChatMessage } from '@org/types';
import { cn } from '@org/utils';
import { AI_MODELS, useAIChat, type AIModelValue } from '@org/web-ai';
import { ArrowUp, ChevronDown, RotateCcw, Sparkles, User, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';

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
  const [model, setModel] = useState<AIModelValue>('auto');
  const [messages, setMessages] = useState<ChatMessage[]>(() => [welcomeMessage()]);

  const chat = useAIChat();
  const isThinking = chat.isPending;

  const modelLabel =
    AI_MODELS.find((option) => option.value === model)?.label ?? 'Auto';

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

  const send = () => {
    const query = prompt.trim();
    if (!query || isThinking) return;

    const now = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: query,
      at: now,
    };

    /*
     * The API holds no conversation state, so the transcript goes up in full
     * each turn. The local greeting is dropped — the model never said it.
     */
    const transcript: AIChatMessage[] = [...messages, userMessage]
      .filter((message) => !message.id.startsWith('welcome-'))
      .map((message) => ({ role: message.role, content: message.text }));

    setMessages((prev) => [...prev, userMessage]);
    setPrompt('');

    chat.mutate(
      { messages: transcript, model },
      {
        onSuccess: (response) => {
          setMessages((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: 'assistant',
              text: response.message.content,
              at: new Date().toISOString(),
            },
          ]);
        },
        onError: (error) => {
          setMessages((prev) => [
            ...prev,
            {
              id: `e-${Date.now()}`,
              role: 'assistant',
              text:
                error instanceof Error
                  ? `Sorry — ${error.message}`
                  : 'Sorry, I could not reach the model.',
              at: new Date().toISOString(),
            },
          ]);
        },
      },
    );
  };

  const reset = () => {
    setMessages([welcomeMessage()]);
    setPrompt('');
    composerRef.current?.focus();
  };

  return (
    /* Surface comes from the host — the rail `aside` on desktop, the sheet on
       mobile — so the panel never paints a second tone over it. */
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
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
          {/* A "Chat history" button sat here with no handler. There is no
              transcript store behind it yet, so it advertised a feature that
              could not be reached — better absent than inert. */}
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

      <ScrollArea className="min-h-0 flex-1">
        <div
          className="space-y-3 p-3"
          role="log"
          aria-live="polite"
          aria-label="Conversation"
        >
          {/* A hardcoded "Recent chat — Workspace research & step parameters"
              card used to sit here, inside the live transcript and inside the
              `log` region, so screen readers announced it as part of the
              conversation. It was never wired to anything. */}
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
          <TextareaAutosize
            ref={composerRef}
            value={prompt}
            onChange={(event) => {
              setPrompt(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            placeholder="Ask AI anything…"
            minRows={2}
            maxRows={8}
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
                  aria-label={`Model: ${modelLabel}`}
                >
                  <span>{modelLabel}</span>
                  <ChevronDown className="size-3" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuRadioGroup
                  value={model}
                  onValueChange={(value) => setModel(value as AIModelValue)}
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

            {/* "About this assistant" and "Voice input" buttons lived here
                without handlers. Voice capture is not implemented at all, so
                the mic was a promise the composer could not keep. */}
            <div className="flex items-center gap-0.5">
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
