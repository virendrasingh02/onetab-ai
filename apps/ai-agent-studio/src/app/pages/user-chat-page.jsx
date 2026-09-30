import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Badge, Button, Input, LoadingState, toast } from '@org/ui';
import { cn } from '@org/utils';
import {
  ArrowLeft,
  Bot,
  Copy,
  ExternalLink,
  LifeBuoy,
  RefreshCw,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  User,
} from 'lucide-react';
import { agentService } from '../services/agentService.js';
import { useStudioSession } from '../session-guard.js';

export function UserChatPage() {
  const { agentId } = useParams();
  const { activeWorkspace } = useStudioSession();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([
    {
      id: 'msg-welcome',
      role: 'assistant',
      content: 'Hello! I am your autonomous AI assistant. How can I help you today?',
      citations: [],
      timestamp: 'Just now',
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [humanHandedOver, setHumanHandedOver] = useState(false);
  const messagesEndRef = useRef(null);

  const { data: agent, isLoading } = useQuery({
    queryKey: ['agent-detail', activeWorkspace.id, agentId],
    queryFn: () => agentService.getAgentById(activeWorkspace.id, agentId || 'agent-support-pro'),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleSend = async (textToSend = null) => {
    const text = textToSend || inputValue;
    if (!text.trim() || isStreaming) return;

    const userMsg = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: 'Just now',
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsStreaming(true);

    const botMsgId = `bot-${Date.now()}`;
    const botMsg = {
      id: botMsgId,
      role: 'assistant',
      content: '',
      citations: [
        { title: 'OneTab Security Handbook (SAML SSO)', url: 'https://docs.onetab.ai/sso' },
      ],
      timestamp: 'Just now',
    };

    setMessages((prev) => [...prev, botMsg]);

    // Stream chunks
    const simulatedResponse = `I've analyzed your inquiry regarding "${text}".\n\nBased on the indexed enterprise documentation in ${activeWorkspace.name}, here is the recommended resolution:\n\n1. Open **Workspace Settings > Security**.\n2. In the **SAML 2.0 / Okta** section, copy the ACS URL and Entity ID.\n3. Configure your Identity Provider metadata file.\n\nWould you like me to guide you through creating an automated test run?`;

    let currentLength = 0;
    const interval = setInterval(() => {
      currentLength += 8;
      const slice = simulatedResponse.slice(0, currentLength);
      setMessages((prev) =>
        prev.map((m) => (m.id === botMsgId ? { ...m, content: slice } : m)),
      );

      if (currentLength >= simulatedResponse.length) {
        clearInterval(interval);
        setIsStreaming(false);
      }
    }, 25);
  };

  const handleEscalateToHuman = () => {
    setHumanHandedOver(true);
    setMessages((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}`,
        role: 'system',
        content: 'Conversation has been escalated to a Human Support Specialist. Elena Rostova (Staff Specialist) will join shortly.',
        timestamp: 'Just now',
      },
    ]);
    toast.info('Support specialist notified and assigned');
  };

  if (isLoading || !agent) {
    return <LoadingState label="Connecting to autonomous agent chat..." />;
  }

  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/agents')}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </Button>

          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bot className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">{agent.name}</span>
                <Badge variant="success" className="text-[10px] px-1.5 py-0.2">
                  Live
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground truncate max-w-xs">
                {agent.role} • {agent.model || 'gpt-4o'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!humanHandedOver ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleEscalateToHuman}
              className="gap-1.5 text-xs text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
            >
              <LifeBuoy className="size-3.5" />
              Human Takeover
            </Button>
          ) : (
            <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/30">
              Human In Loop Active
            </Badge>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setMessages([
                {
                  id: 'msg-welcome',
                  role: 'assistant',
                  content: 'Conversation reset. How can I help you today?',
                  timestamp: 'Just now',
                },
              ]);
              setHumanHandedOver(false);
              toast.success('Chat history cleared');
            }}
            className="gap-1.5 text-xs text-muted-foreground"
          >
            <RefreshCw className="size-3.5" />
            Reset
          </Button>
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-3xl w-full mx-auto space-y-4">
        {messages.map((msg) => {
          if (msg.role === 'system') {
            return (
              <div
                key={msg.id}
                className="my-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-center text-xs text-amber-500 font-medium"
              >
                {msg.content}
              </div>
            );
          }

          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={cn('flex items-start gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}
            >
              <div
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                  isUser ? 'bg-primary text-primary-foreground' : 'bg-surface-raised border border-border text-primary',
                )}
              >
                {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
              </div>

              <div
                className={cn(
                  'rounded-2xl p-4 text-xs leading-relaxed max-w-[85%] shadow-2xs',
                  isUser
                    ? 'bg-primary text-primary-foreground rounded-tr-xs'
                    : 'bg-surface border border-border text-foreground rounded-tl-xs',
                )}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* Citations badges */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-border/60 space-y-1">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase">
                      Sources & Citations:
                    </div>
                    {msg.citations.map((c, i) => (
                      <a
                        key={i}
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded bg-surface-raised px-2 py-0.5 text-[10px] text-primary hover:underline mr-1"
                      >
                        <span>{c.title}</span>
                        <ExternalLink className="size-2.5" />
                      </a>
                    ))}
                  </div>
                )}

                {/* Assistant Feedback Buttons */}
                {!isUser && msg.content && (
                  <div className="mt-2.5 flex items-center justify-between text-[10px] text-muted-foreground pt-1.5 border-t border-border/40">
                    <span>{msg.timestamp}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(msg.content);
                          toast.success('Copied to clipboard');
                        }}
                        className="p-1 hover:text-foreground"
                        title="Copy"
                      >
                        <Copy className="size-3" />
                      </button>
                      <button
                        onClick={() => toast.success('Thanks for your feedback!')}
                        className="p-1 hover:text-emerald-500"
                        title="Helpful"
                      >
                        <ThumbsUp className="size-3" />
                      </button>
                      <button
                        onClick={() => toast.info('Feedback recorded for agent prompt tuning')}
                        className="p-1 hover:text-rose-500"
                        title="Not helpful"
                      >
                        <ThumbsDown className="size-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box & Suggested Prompts */}
      <div className="border-t border-border bg-surface p-4">
        <div className="max-w-3xl mx-auto space-y-2">
          {/* Suggested Prompts */}
          <div className="flex flex-wrap gap-1.5">
            {[
              'How do I configure Single Sign-On?',
              'What are the API rate limits?',
              'Check status of invoice #INV-9921',
            ].map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleSend(prompt)}
                disabled={isStreaming}
                className="rounded-full border border-border bg-surface-raised px-3 py-1 text-[11px] text-muted-foreground hover:bg-surface hover:text-foreground transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask this agent a question or describe an action..."
              className="text-xs"
              disabled={isStreaming}
            />
            <Button
              type="submit"
              size="sm"
              disabled={isStreaming || !inputValue.trim()}
              className="gap-1.5 shrink-0 font-semibold"
            >
              <Send className="size-3.5" />
              Send
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
