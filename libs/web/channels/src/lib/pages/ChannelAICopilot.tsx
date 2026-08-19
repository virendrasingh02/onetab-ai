import { agentsApi, aiApi } from '@org/api-client';
import type { ChannelSummary } from '@org/types';
import {
  Badge,
  Button,
  Hint,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import { useQuery } from '@tanstack/react-query';
import {
  Bot,
  Check,
  Copy,
  RotateCcw,
  Send,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  agentName?: string;
  isError?: boolean;
}

interface ChannelAICopilotProps {
  channel: ChannelSummary;
  workspaceId: string | undefined;
}

export function ChannelAICopilot({
  channel,
  workspaceId,
}: ChannelAICopilotProps) {
  // Load workspace agents
  const agentsQuery = useQuery({
    queryKey: ['agents', workspaceId],
    queryFn: () => agentsApi.list(workspaceId as string),
    enabled: !!workspaceId,
  });

  const agents = agentsQuery.data ?? [];
  const [selectedAgentId, setSelectedAgentId] = useState<string>('copilot');

  const activeAgent = useMemo(() => {
    if (selectedAgentId === 'copilot') return null;
    return agents.find((a) => a.id === selectedAgentId) || null;
  }, [agents, selectedAgentId]);

  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello! I'm your AI Copilot for #${channel.name}. Ask me to summarize recent discussion, extract action items, or answer questions about your workspace data.`,
      timestamp: new Date(),
      agentName: 'Channel Copilot',
    },
  ]);

  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const handleSend = useCallback(
    async (promptText?: string) => {
      const text = (promptText || input).trim();
      if (!text || isThinking) return;

      const userMsg: CopilotMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setIsThinking(true);

      try {
        if (activeAgent && workspaceId) {
          // Execute with selected custom agent
          const fullPrompt = `[Context: In channel #${channel.name} (Topic: ${channel.topic || 'General'})]\n\nUser Question: ${text}`;
          const res = await agentsApi.execute(workspaceId, activeAgent.id, fullPrompt);

          setMessages((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: 'assistant',
              content: res.result || 'Done.',
              timestamp: new Date(),
              agentName: activeAgent.name,
            },
          ]);
        } else {
          // Default AI Copilot
          const res = await aiApi.chat(workspaceId || '', {
            messages: [
              {
                role: 'system',
                content: `You are an AI assistant helping a team in channel #${channel.name}. Channel topic: ${channel.topic || 'General discussion'}. Answer clearly, concisely, and helpfully based on workspace context.`,
              },
              ...messages
                .filter((m) => m.id !== 'welcome')
                .map((m) => ({ role: m.role, content: m.content })),
              { role: 'user', content: text },
            ],
            model: 'auto',
          });

          setMessages((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: 'assistant',
              content: res.message.content,
              timestamp: new Date(),
              agentName: 'Channel Copilot',
            },
          ]);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content:
              'Sorry, I encountered an issue processing that request. Please try again.',
            timestamp: new Date(),
            isError: true,
          },
        ]);
        toast.error('AI assistant error');
      } finally {
        setIsThinking(false);
      }
    },
    [activeAgent, channel, input, isThinking, messages, workspaceId],
  );

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const channelStarters = [
    `Summarize the key topics discussed in #${channel.name}`,
    'Extract action items and assignees from recent messages',
    'Draft a concise team update based on this channel',
    'Help answer a technical question for this channel',
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-between bg-background overflow-hidden">
      {/* Sub-header inside channel copilot */}
      <div className="flex items-center justify-between border-b border-border/80 bg-surface/50 px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-accent-violet-soft text-accent-violet">
            <Sparkles className="size-3.5" />
          </span>
          <span className="font-semibold text-foreground">
            In-Channel AI Agent
          </span>
          <Badge variant="neutral" className="text-[10px] font-mono">
            #{channel.name}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-44">
            <Select
              value={selectedAgentId}
              onValueChange={(val) => setSelectedAgentId(val)}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="AI Assistant" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="copilot" className="text-xs">
                  ✨ Channel Copilot
                </SelectItem>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id} className="text-xs">
                    🤖 {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Hint label="Clear conversation">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() =>
                setMessages([
                  {
                    id: 'welcome',
                    role: 'assistant',
                    content: `Conversation reset. Ask anything about #${channel.name} or your workspace.`,
                    timestamp: new Date(),
                    agentName: activeAgent?.name || 'Channel Copilot',
                  },
                ])
              }
              aria-label="Clear chat"
              className="size-7"
            >
              <RotateCcw className="size-3.5" />
            </Button>
          </Hint>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <ScrollArea className="flex-1 min-h-0 p-4 sm:p-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {/* Quick Starter Suggestions */}
          {messages.length <= 1 ? (
            <div className="mb-6 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Channel Suggestions
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {channelStarters.map((starter, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSend(starter)}
                    className="flex items-start gap-2 rounded-lg border border-border/80 bg-surface p-2.5 text-left text-xs text-foreground transition-all hover:border-primary hover:bg-surface-raised cursor-pointer"
                  >
                    <Sparkles className="size-3.5 shrink-0 text-primary mt-0.5" />
                    <span>{starter}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Transcript */}
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={cn(
                  'flex gap-2.5 text-xs animate-in fade-in-50 duration-200',
                  isUser ? 'justify-end' : 'justify-start',
                )}
              >
                {!isUser ? (
                  <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-violet-soft text-accent-violet">
                    <Bot className="size-3.5" />
                  </div>
                ) : null}

                <div
                  className={cn(
                    'group relative max-w-[85%] rounded-xl px-3.5 py-2.5 shadow-2xs',
                    isUser
                      ? 'bg-primary text-primary-foreground rounded-br-xs'
                      : msg.isError
                      ? 'bg-destructive/10 border border-destructive/20 text-destructive rounded-bl-xs'
                      : 'bg-surface border border-border text-foreground rounded-bl-xs',
                  )}
                >
                  <div className="mb-1 flex items-center justify-between gap-3 text-[10px]">
                    <span
                      className={cn(
                        'font-semibold',
                        isUser ? 'text-primary-foreground/90' : 'text-foreground',
                      )}
                    >
                      {isUser ? 'You' : msg.agentName || 'Copilot'}
                    </span>
                    <span
                      className={cn(
                        isUser
                          ? 'text-primary-foreground/70'
                          : 'text-muted-foreground',
                      )}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className="whitespace-pre-wrap leading-relaxed">
                    {msg.content}
                  </div>

                  {!isUser ? (
                    <div className="mt-1.5 flex justify-end border-t border-border/40 pt-1.5">
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="size-3 text-success-text" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="size-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}

          {/* Thinking Indicator */}
          {isThinking ? (
            <div className="flex gap-2.5 animate-pulse">
              <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-violet-soft text-accent-violet">
                <Bot className="size-3.5" />
              </div>
              <div className="rounded-xl rounded-bl-xs border border-border bg-surface px-3.5 py-2.5 text-xs text-muted-foreground flex items-center gap-2">
                <Sparkles className="size-3 text-primary animate-spin" />
                <span>Processing with channel context...</span>
              </div>
            </div>
          ) : null}

          <div ref={scrollEndRef} />
        </div>
      </ScrollArea>

      {/* Composer */}
      <div className="border-t border-border bg-background p-3 shrink-0">
        <div className="mx-auto max-w-2xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="relative flex flex-col rounded-xl border border-border bg-surface focus-within:border-primary focus-within:ring-1 focus-within:ring-primary shadow-xs transition-all"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={`Ask AI about #${channel.name}... (Enter to send)`}
              rows={2}
              disabled={isThinking}
              className="w-full resize-none bg-transparent px-3 pt-2.5 pb-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden disabled:opacity-50"
            />

            <div className="flex items-center justify-between border-t border-border/50 px-2.5 py-1.5 bg-surface-raised/30">
              <span className="text-[10px] text-muted-foreground">
                Channel Context Active
              </span>

              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!input.trim() || isThinking}
                loading={isThinking}
                leadingIcon={<Send className="size-3.5" />}
                className="text-xs h-6 px-2.5"
              >
                Send
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
