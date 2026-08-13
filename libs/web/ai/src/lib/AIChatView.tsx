import type { AIChatMessage } from '@org/types';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Hint,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  ArrowUp,
  Bot,
  ChevronDown,
  Mic,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  TriangleAlert,
  User,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AI_MODELS, useAIChat, type AIModelValue } from './use-ai.js';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

function nowLabel() {
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AIChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState<AIModelValue>('auto');
  const [isVoiceActive, setIsVoiceActive] = useState(false);

  const chat = useAIChat();
  const isPending = chat.isPending;

  const streamEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const modelLabel =
    AI_MODELS.find((option) => option.value === selectedModel)?.label ?? 'Auto';

  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPending]);

  const handleSend = (textToSend?: string) => {
    const text = (textToSend ?? input).trim();
    if (!text || isPending) return;

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: nowLabel(),
    };

    /*
     * The API is stateless, so the whole transcript goes up each turn. Built
     * from the pre-append array plus this message rather than from state,
     * which has not re-rendered yet.
     */
    const transcript: AIChatMessage[] = [...messages, userMessage].map(
      ({ role, content }) => ({ role, content }),
    );

    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    chat.mutate(
      { messages: transcript, model: selectedModel },
      {
        onSuccess: (response) => {
          setMessages((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: 'assistant',
              content: response.message.content,
              timestamp: nowLabel(),
            },
          ]);
        },
      },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setInput('');
    chat.reset();
  };

  const isLandingView = messages.length === 0;

  return (
    <div className="flex h-full min-h-[calc(100vh-5rem)] w-full flex-col items-center justify-between text-foreground">
      {/* Active Conversation Header (only when chat has messages) */}
      {!isLandingView ? (
        <div className="max-w-4xl px-4 py-2 mb-4 backdrop-blur-md flex w-full shrink-0 items-center justify-between rounded-xl border-b border-border bg-background/80">
          <div className="gap-2 flex items-center">
            <div className="w-7 h-7 font-bold text-xs flex items-center justify-center rounded-full bg-foreground text-background">
              Logo
            </div>
            <span className="text-sm font-semibold">AI Assistant</span>
            <span className="text-xs px-2 py-0.5 font-medium rounded-full border border-primary/20 bg-primary/10 text-primary">
              {selectedModel}
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleNewChat}
            className="text-xs gap-1.5 flex items-center text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
            <span>New Chat</span>
          </Button>
        </div>
      ) : null}

      {/* Main Content Area */}
      <div className="max-w-3xl px-4 py-6 flex w-full flex-1 flex-col items-center justify-center">
        {isLandingView ? (
          /* Landing Screen Hero View (Matches updated layout) */
          <div className="animate-in fade-in my-auto flex w-full flex-col items-center transition-all duration-300">
            {/* Headline */}
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight mb-8 text-center text-foreground">
              How can I help you today?
            </h1>

            {/* Main AI Input Card */}
            <div className="max-w-2xl rounded-2xl p-4 w-full border border-border bg-surface-raised text-foreground shadow-elevated transition-all duration-200 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/40">
              {/* Textarea Input */}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Do anything with AI..."
                rows={2}
                aria-label="Ask anything and @mention the AI model if you want to use a specific one"
                className="text-base leading-relaxed min-h-[56px] w-full resize-none border-none bg-transparent text-foreground outline-none placeholder:text-subtle"
              />

              {/* Action Controls Row */}
              <div className="pt-2 flex items-center justify-between">
                <div className="gap-1.5 flex items-center">
                  <Hint label="Add attachments or context">
                    <button
                      type="button"
                      aria-label="Add attachment"
                      className="p-1.5 rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <Plus className="size-4" />
                    </button>
                  </Hint>
                </div>

                <div className="gap-2 flex items-center">
                  {/* Model Selector Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Selected AI Model: ${modelLabel}`}
                        className="px-3 py-1 text-xs font-medium gap-1.5 flex items-center rounded-full border border-border bg-accent text-foreground transition-colors hover:bg-selected"
                      >
                        <span>{modelLabel}</span>
                        <ChevronDown className="size-3 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 text-xs">
                      {AI_MODELS.map((model) => (
                        <DropdownMenuItem
                          key={model.value}
                          onClick={() => setSelectedModel(model.value)}
                          className="cursor-pointer"
                        >
                          {model.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Mic Voice Input */}
                  <Hint label={isVoiceActive ? 'Listening...' : 'Voice Input'}>
                    <button
                      type="button"
                      onClick={() => setIsVoiceActive((prev) => !prev)}
                      aria-label="Voice input"
                      className={cn(
                        'p-2 rounded-full transition-colors',
                        isVoiceActive
                          ? 'animate-pulse bg-destructive/20 text-destructive'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                      )}
                    >
                      <Mic className="size-4" />
                    </button>
                  </Hint>

                  {/* Send Button */}
                  <button
                    type="button"
                    onClick={() => handleSend()}
                    disabled={!input.trim() || isPending}
                    aria-label="Send message"
                    className={cn(
                      'size-8 flex items-center justify-center rounded-full transition-all duration-200',
                      input.trim() && !isPending
                        ? 'shadow-md cursor-pointer bg-primary text-primary-foreground hover:bg-primary-hover'
                        : 'cursor-not-allowed bg-muted text-disabled',
                    )}
                  >
                    <ArrowUp className="size-4 stroke-[2.5]" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Active Chat Thread View */
          <div className="space-y-4 scrollbar-subtle pr-2 min-h-0 flex w-full flex-1 flex-col overflow-y-auto">
            {messages.map((message) => (
              <article
                key={message.id}
                className={cn(
                  'p-4 rounded-2xl max-w-2xl text-sm leading-relaxed space-y-1.5 shadow-sm transition-all',
                  message.role === 'user'
                    ? 'font-medium ml-auto bg-primary text-primary-foreground'
                    : 'mr-auto border border-border bg-surface-raised text-foreground',
                )}
              >
                <div className="gap-4 text-xs pb-1 flex items-center justify-between border-b border-current/10 opacity-75">
                  <span className="font-semibold gap-1.5 flex items-center">
                    {message.role === 'user' ? (
                      <User className="size-3.5" />
                    ) : (
                      <Bot className="size-3.5 text-accent-violet" />
                    )}
                    {message.role === 'user' ? 'You' : `${modelLabel} Copilot`}
                  </span>
                  <span className="text-[10px]">{message.timestamp}</span>
                </div>
                <p className="whitespace-pre-wrap">{message.content}</p>
              </article>
            ))}

            {isPending ? (
              <div className="p-3 rounded-2xl text-xs gap-2 animate-pulse mr-auto flex items-center border border-border bg-surface-raised text-muted-foreground">
                <Sparkles className="size-4 animate-spin text-accent-violet" />
                <span>Synthesis in progress…</span>
              </div>
            ) : null}

            {chat.isError ? (
              <div className="gap-2 p-3 text-xs rounded-2xl mr-auto flex items-start border border-destructive/40 bg-destructive/10 text-destructive">
                <TriangleAlert className="size-4 shrink-0" aria-hidden />
                <div className="space-y-1.5">
                  <p>
                    {chat.error instanceof Error
                      ? chat.error.message
                      : 'The assistant could not respond.'}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[11px]"
                    onClick={() => {
                      // The failed turn's prompt is still the last user message.
                      const lastUser = [...messages]
                        .reverse()
                        .find((entry) => entry.role === 'user');
                      if (!lastUser) return;
                      setMessages((prev) =>
                        prev.filter((entry) => entry.id !== lastUser.id),
                      );
                      handleSend(lastUser.content);
                    }}
                  >
                    Retry
                  </Button>
                </div>
              </div>
            ) : null}

            <div ref={streamEndRef} />
          </div>
        )}
      </div>

      {/* Bottom Floating Prompt Card when chat is active */}
      {!isLandingView ? (
        <div className="max-w-2xl px-4 pb-4 pt-2 w-full shrink-0">
          <div className="rounded-2xl p-3 gap-2 flex w-full items-center border border-border bg-surface-raised text-foreground shadow-elevated">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a follow-up question..."
              rows={1}
              aria-label="Ask a follow-up question"
              className="text-sm w-full resize-none border-none bg-transparent text-foreground outline-none placeholder:text-subtle"
            />
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={!input.trim() || isPending}
              aria-label="Send follow-up"
              className={cn(
                'size-8 flex shrink-0 items-center justify-center rounded-full transition-colors',
                input.trim() && !isPending
                  ? 'cursor-pointer bg-primary text-primary-foreground hover:bg-primary-hover'
                  : 'cursor-not-allowed bg-muted text-disabled',
              )}
            >
              <ArrowUp className="size-4 stroke-[2.5]" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
