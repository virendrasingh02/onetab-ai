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
  User,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const MODELS = [
  { value: 'Auto', label: 'Auto (Recommended)' },
  { value: 'GPT-4o', label: 'OpenAI GPT-4o' },
  { value: 'Claude 3.5 Sonnet', label: 'Claude 3.5 Sonnet' },
  { value: 'Gemini 1.5 Pro', label: 'Google Gemini 1.5 Pro' },
  { value: 'Ollama Llama 3', label: 'Ollama Llama 3 (Local)' },
] as const;

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export function AIChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>('Auto');
  const [isPending, setIsPending] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);

  const streamEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPending]);

  const handleSend = (textToSend?: string) => {
    const text = (textToSend ?? input).trim();
    if (!text || isPending) return;

    const timeStr = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: timeStr,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsPending(true);

    setTimeout(() => {
      const assistantMessage: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: `[${selectedModel}] I have processed your request: "${text}". Here is the synthesis based on your connected workspace apps and memory vectors.`,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsPending(false);
    }, 750);
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
    setIsPending(false);
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
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white text-black flex items-center justify-center shadow-xl mb-6 hover:scale-105 transition-transform duration-200 cursor-pointer group border border-black/10">
              <svg
                className="w-8 h-8 text-black transition-transform duration-200 group-hover:rotate-6"
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

            {/* Main Dark AI Input Card */}
            <div className="w-full max-w-2xl bg-[#1c1c1e] text-white border border-white/10 rounded-2xl p-4 shadow-2xl transition-all duration-200 focus-within:border-white/20 focus-within:ring-1 focus-within:ring-white/20">
              {/* Textarea Input */}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Do anything with AI..."
                rows={2}
                aria-label="Do anything with AI"
                className="w-full bg-transparent border-none text-base placeholder:text-zinc-500 text-white outline-none resize-none min-h-[56px] leading-relaxed"
              />

              {/* Action Controls Row */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-1.5">
                  <Hint label="Add attachments or context">
                    <button
                      type="button"
                      aria-label="Add attachment"
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                    >
                      <Plus className="size-4" />
                    </button>
                  </Hint>

                  <Hint label="AI Parameters & Options">
                    <button
                      type="button"
                      aria-label="AI parameters"
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
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
                        aria-label={`Selected AI Model: ${selectedModel}`}
                        className="px-3 py-1 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 text-xs font-medium flex items-center gap-1.5 transition-colors border border-white/5"
                      >
                        <span>{selectedModel}</span>
                        <ChevronDown className="size-3 text-zinc-400" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-[#242426] border-zinc-700 text-white text-xs">
                      {MODELS.map((model) => (
                        <DropdownMenuItem
                          key={model.value}
                          onClick={() => setSelectedModel(model.value)}
                          className="hover:bg-zinc-700 cursor-pointer"
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
                          ? 'bg-red-500/20 text-red-400 animate-pulse'
                          : 'text-zinc-400 hover:text-white hover:bg-zinc-800',
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
                        ? 'bg-white text-black hover:bg-zinc-200 shadow-md cursor-pointer'
                        : 'bg-zinc-800 text-zinc-500 cursor-not-allowed',
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
                    : 'mr-auto bg-[#1c1c1e] text-white border border-white/10',
                )}
              >
                <div className="flex items-center justify-between gap-4 text-xs opacity-75 pb-1 border-b border-current/10">
                  <span className="font-semibold flex items-center gap-1.5">
                    {message.role === 'user' ? (
                      <User className="size-3.5" />
                    ) : (
                      <Bot className="size-3.5 text-violet-400" />
                    )}
                    {message.role === 'user' ? 'You' : `${selectedModel} Copilot`}
                  </span>
                  <span className="text-[10px]">{message.timestamp}</span>
                </div>
                <p className="whitespace-pre-wrap">{message.content}</p>
              </article>
            ))}

            {isPending ? (
              <div className="mr-auto bg-[#1c1c1e] text-zinc-400 border border-white/10 p-3 rounded-2xl text-xs flex items-center gap-2 animate-pulse">
                <Sparkles className="size-4 text-violet-400 animate-spin" />
                <span>Synthesis in progress…</span>
              </div>
            ) : null}

            <div ref={streamEndRef} />
          </div>
        )}
      </div>

      {/* Bottom Floating Prompt Card when chat is active */}
      {!isLandingView ? (
        <div className="w-full max-w-2xl px-4 pb-4 pt-2 shrink-0">
          <div className="w-full bg-[#1c1c1e] text-white border border-white/10 rounded-2xl p-3 shadow-xl flex items-center gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a follow-up question..."
              rows={1}
              aria-label="Ask a follow-up question"
              className="w-full bg-transparent border-none text-sm text-white placeholder:text-zinc-500 outline-none resize-none"
            />
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={!input.trim() || isPending}
              aria-label="Send follow-up"
              className={cn(
                'size-8 rounded-full flex items-center justify-center shrink-0 transition-colors',
                input.trim() && !isPending
                  ? 'bg-white text-black hover:bg-zinc-200 cursor-pointer'
                  : 'bg-zinc-800 text-zinc-600 cursor-not-allowed',
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


