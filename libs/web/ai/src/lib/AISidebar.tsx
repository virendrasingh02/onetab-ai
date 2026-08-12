import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@org/ui';
import type { AIChatMessage } from '@org/types';
import { cn } from '@org/utils';
import { Send, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AI_MODELS, useAIChat, type AIModelValue } from './use-ai.js';

export interface AISidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const WELCOME: Message = {
  id: 'welcome',
  role: 'assistant',
  text: 'Hello! I am your OneTab AI Copilot. How can I help you with your workspace today?',
};

/**
 * The workspace-wide AI copilot, opened from the shell's floating trigger.
 *
 * Built on `Sheet` (Radix Dialog) rather than a bare fixed-position div, so it
 * traps focus, closes on Escape, restores focus to the trigger and is exposed
 * to assistive technology as a dialog.
 */
export function AISidebar({ isOpen, onClose }: AISidebarProps) {
  const [input, setInput] = useState('');
  const [model, setModel] = useState<AIModelValue>('auto');
  const [messages, setMessages] = useState<Message[]>([WELCOME]);

  const chat = useAIChat();
  const pending = chat.isPending;

  const streamEndRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const handleSend = () => {
    const prompt = input.trim();
    if (!prompt || pending) return;

    const userMessage: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: prompt,
    };

    /*
     * The greeting is local scaffolding, not something the model said, so it
     * is left out of the transcript that goes up.
     */
    const transcript: AIChatMessage[] = [...messages, userMessage]
      .filter((message) => message.id !== WELCOME.id)
      .map((message) => ({ role: message.role, content: message.text }));

    setInput('');
    setMessages((prev) => [...prev, userMessage]);

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
            },
          ]);
        },
      },
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="gap-0 p-0 sm:max-w-md w-full">
        <SheetHeader className="gap-3 px-4 py-3 flex-row items-center border-b">
          <span
            aria-hidden
            className="size-8 flex shrink-0 items-center justify-center rounded-lg bg-accent-violet-soft text-accent-violet"
          >
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0">
            <SheetTitle className="text-sm">AI Copilot</SheetTitle>
            <SheetDescription className="text-xs">
              Ask about anything in this workspace
            </SheetDescription>
          </div>
        </SheetHeader>

        <div className="gap-2 px-4 py-2.5 flex items-center border-b">
          <label
            htmlFor="ai-provider"
            className="text-xs shrink-0 text-muted-foreground"
          >
            Model
          </label>
          <Select
            value={model}
            onValueChange={(value) => setModel(value as AIModelValue)}
          >
            <SelectTrigger id="ai-provider" size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AI_MODELS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/*
          `aria-live="polite"` so replies are announced as they arrive without
          interrupting whatever the user is currently doing.
        */}
        <div
          className="scrollbar-subtle min-h-0 space-y-3 p-4 flex-1 overflow-y-auto"
          aria-live="polite"
          aria-busy={pending}
        >
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'px-3 py-2 text-xs leading-relaxed w-fit max-w-[85%] rounded-lg',
                message.role === 'user'
                  ? 'ml-auto bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground',
              )}
            >
              <span className="sr-only">
                {message.role === 'user' ? 'You said: ' : 'Copilot replied: '}
              </span>
              {message.text}
            </div>
          ))}

          {pending ? (
            <p className="text-xs text-muted-foreground">
              Copilot is thinking…
            </p>
          ) : null}

          <div ref={streamEndRef} />
        </div>

        <form
          className="gap-2 p-3 flex items-center border-t"
          onSubmit={(event) => {
            event.preventDefault();
            handleSend();
          }}
        >
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask AI anything…"
            aria-label="Message the AI copilot"
            className="h-9 text-xs"
          />
          <Button
            type="submit"
            size="icon-sm"
            disabled={!input.trim() || pending}
            aria-label="Send message"
          >
            <Send />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
