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
    <div className="flex flex-col h-full min-h-[calc(100vh-5rem)] w-full items-center justify-between text-foreground">
      {/* Active Conversation Header (only when chat has messages) */}
      {!isLandingView ? (
        <div className="w-full max-w-4xl px-4 py-2 border-b border-border flex items-center justify-between shrink-0 mb-4 bg-background/80 backdrop-blur-md rounded-xl">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center font-bold text-xs">
              Logo
            </div>
            <span className="text-sm font-semibold">AI Assistant</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
              {selectedModel}
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleNewChat}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5"
          >
            <RotateCcw className="size-3.5" />
            <span>New Chat</span>
          </Button>
        </div>
      ) : null}

      {/* Main Content Area */}
      <div className="flex-1 w-full max-w-3xl px-4 flex flex-col justify-center items-center py-6">
        {isLandingView ? (
          /* Landing Screen Hero View (Matches updated layout) */
          <div className="flex flex-col items-center w-full my-auto transition-all animate-in fade-in duration-300">
            {/* Centered Circular Logo Badge */}
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-foreground text-background flex items-center justify-center shadow-elevated mb-6 hover:scale-105 transition-transform duration-200 cursor-pointer group border border-border">
              <svg
                className="w-8 h-8 transition-transform duration-200 group-hover:rotate-6"
                viewBox="0 0 100 100"
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-label="OneTab AI Logo"
              >
                <circle cx="38" cy="40" r="3.5" fill="currentColor" />
                <circle cx="62" cy="40" r="3.5" fill="currentColor" />
                <path d="M 32 28 C 36 24, 44 24, 48 28" />
                <path d="M 52 28 C 56 24, 64 24, 68 28" />
                <path d="M 50 44 Q 48 58 40 60 L 52 60" fill="none" />
              </svg>
            </div>

            {/* Headline */}
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-center text-foreground mb-8">
              How can I help you today?
            </h1>

            {/* Main AI Input Card */}
            <div className="w-full max-w-2xl bg-surface-raised text-foreground border border-border rounded-2xl p-4 shadow-elevated transition-all duration-200 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/40">
              {/* Textarea Input */}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Do anything with AI..."
                rows={2}
                aria-label="Do anything with AI"
                className="w-full bg-transparent border-none text-base placeholder:text-subtle text-foreground outline-none resize-none min-h-[56px] leading-relaxed"
              />

              {/* Action Controls Row */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-1.5">
                  <Hint label="Add attachments or context">
                    <button
                      type="button"
                      aria-label="Add attachment"
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    >
                      <Plus className="size-4" />
                    </button>
                  </Hint>

                  <Hint label="AI Parameters & Options">
                    <button
                      type="button"
                      aria-label="AI parameters"
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    >
                      <SlidersHorizontal className="size-4" />
                    </button>
                  </Hint>
                </div>

                <div className="flex items-center gap-2">
                  {/* Model Selector Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Selected AI Model: ${modelLabel}`}
                        className="px-3 py-1 rounded-full bg-accent hover:bg-selected text-foreground text-xs font-medium flex items-center gap-1.5 transition-colors border border-border"
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
                          ? 'bg-destructive/20 text-destructive animate-pulse'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent',
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
                      'size-8 rounded-full flex items-center justify-center transition-all duration-200',
                      input.trim() && !isPending
                        ? 'bg-primary text-primary-foreground hover:bg-primary-hover shadow-md cursor-pointer'
                        : 'bg-muted text-disabled cursor-not-allowed',
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
          <div className="w-full flex-1 flex flex-col space-y-4 overflow-y-auto scrollbar-subtle pr-2 min-h-0">
            {messages.map((message) => (
              <article
                key={message.id}
                className={cn(
                  'p-4 rounded-2xl max-w-2xl text-sm leading-relaxed space-y-1.5 shadow-sm transition-all',
                  message.role === 'user'
                    ? 'ml-auto bg-primary text-primary-foreground font-medium'
                    : 'mr-auto bg-surface-raised text-foreground border border-border',
                )}
              >
                <div className="flex items-center justify-between gap-4 text-xs opacity-75 pb-1 border-b border-current/10">
                  <span className="font-semibold flex items-center gap-1.5">
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
              <div className="mr-auto bg-surface-raised text-muted-foreground border border-border p-3 rounded-2xl text-xs flex items-center gap-2 animate-pulse">
                <Sparkles className="size-4 text-accent-violet animate-spin" />
                <span>Synthesis in progress…</span>
              </div>
            ) : null}

            {chat.isError ? (
              <div className="mr-auto gap-2 p-3 text-xs flex items-start rounded-2xl border border-destructive/40 bg-destructive/10 text-destructive">
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
        <div className="w-full max-w-2xl px-4 pb-4 pt-2 shrink-0">
          <div className="w-full bg-surface-raised text-foreground border border-border rounded-2xl p-3 shadow-elevated flex items-center gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a follow-up question..."
              rows={1}
              aria-label="Ask a follow-up question"
              className="w-full bg-transparent border-none text-sm text-foreground placeholder:text-subtle outline-none resize-none"
            />
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={!input.trim() || isPending}
              aria-label="Send follow-up"
              className={cn(
                'size-8 rounded-full flex items-center justify-center shrink-0 transition-colors',
                input.trim() && !isPending
                  ? 'bg-primary text-primary-foreground hover:bg-primary-hover cursor-pointer'
                  : 'bg-muted text-disabled cursor-not-allowed',
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


