import {
  Button,
  Input,
  Page,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@org/ui';
import { cn } from '@org/utils';
import { Bot, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const PROVIDERS = [
  { value: 'ollama', label: 'Ollama (local Llama 3)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Google Gemini' },
] as const;

type Provider = (typeof PROVIDERS)[number]['value'];

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export function AIChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Welcome to OneTab AI Chat. Ask me to write code, summarise documents, plan sprints, or query vector memories.',
    },
  ]);
  const [input, setInput] = useState('');
  const [provider, setProvider] = useState<Provider>('ollama');
  const [pending, setPending] = useState(false);

  const streamEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const providerLabel =
    PROVIDERS.find((option) => option.value === provider)?.label ?? provider;

  const handleSend = () => {
    const text = input.trim();
    if (!text || pending) return;

    setInput('');
    setPending(true);
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', content: text },
    ]);

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: `[Response from ${providerLabel}] I have processed your input: "${text}". Here is the structured AI synthesis.`,
        },
      ]);
      setPending(false);
    }, 500);
  };

  return (
    <Page className="h-full">
      <PageHeader
        title="AI chat"
        description="Multi-provider conversational AI over your workspace."
        icon={<Sparkles />}
        accent="violet"
        actions={
          <Select
            value={provider}
            onValueChange={(value) => setProvider(value as Provider)}
          >
            <SelectTrigger aria-label="AI provider" className="w-56">
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
        }
      />

      <div className="min-h-96 flex flex-1 flex-col rounded-xl border bg-surface">
        <div
          className="scrollbar-subtle min-h-0 space-y-4 p-4 flex-1 overflow-y-auto"
          aria-live="polite"
          aria-busy={pending}
        >
          {messages.map((message) => (
            <article
              key={message.id}
              className={cn(
                'max-w-2xl px-4 py-3 text-sm leading-relaxed rounded-xl',
                message.role === 'user'
                  ? 'ml-auto bg-primary text-primary-foreground'
                  : 'border bg-surface-raised',
              )}
            >
              <p
                className={cn(
                  'mb-1 gap-2 text-xs font-medium flex items-center',
                  message.role === 'user'
                    ? 'text-primary-foreground/80'
                    : 'text-muted-foreground',
                )}
              >
                {message.role === 'assistant' ? (
                  <Bot className="size-4 text-accent-violet" aria-hidden />
                ) : null}
                {message.role === 'user' ? 'You' : providerLabel}
              </p>
              <p>{message.content}</p>
            </article>
          ))}

          {pending ? (
            <p className="text-sm text-muted-foreground">Thinking…</p>
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
            placeholder="Type a message or prompt…"
            aria-label="Message"
          />
          <Button type="submit" disabled={!input.trim() || pending}>
            Send
          </Button>
        </form>
      </div>
    </Page>
  );
}
