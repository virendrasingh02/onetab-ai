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
import { cn } from '@org/utils';
import { Send, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export interface AISidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const PROVIDERS = [
  { value: 'ollama', label: 'Ollama (local)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Google Gemini' },
] as const;

type Provider = (typeof PROVIDERS)[number]['value'];

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

/**
 * The workspace-wide AI copilot, opened from the shell's floating trigger.
 *
 * Built on `Sheet` (Radix Dialog) rather than a bare fixed-position div, so it
 * traps focus, closes on Escape, restores focus to the trigger and is exposed
 * to assistive technology as a dialog.
 */
export function AISidebar({ isOpen, onClose }: AISidebarProps) {
  const [input, setInput] = useState('');
  const [provider, setProvider] = useState<Provider>('ollama');
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hello! I am your OneTab AI Copilot. How can I help you with your workspace today?',
    },
  ]);

  const streamEndRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const handleSend = () => {
    const prompt = input.trim();
    if (!prompt || pending) return;

    setInput('');
    setPending(true);
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', text: prompt },
    ]);

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: `[Copilot via ${provider}] I processed your request: "${prompt}". Here is the workspace synthesis.`,
        },
      ]);
      setPending(false);
    }, 600);
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
            value={provider}
            onValueChange={(value) => setProvider(value as Provider)}
          >
            <SelectTrigger id="ai-provider" size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVIDERS.map((option) => (
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
