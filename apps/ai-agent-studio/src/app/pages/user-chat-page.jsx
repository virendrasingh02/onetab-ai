import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from '../router.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { agentsApi, aiFeedbackApi } from '@org/api-client';
import { Badge, Button, Input, LoadingState, toast } from '@org/ui';
import { cn } from '@org/utils';
import { ArrowLeft, Bot, Copy, MessageSquarePlus, Send, ThumbsDown, ThumbsUp, Trash2, User } from 'lucide-react';
import { agentService } from '../services/agentService.js';
import { useStudioSession } from '../session-guard.js';

const timeOf = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const errorText = (err) => (err instanceof Error && err.message ? err.message : 'The agent could not be reached.');

export function UserChatPage() {
  const { agentId } = useParams();
  const { activeWorkspace } = useStudioSession();
  const navigate = useNavigate();

  const queryClient = useQueryClient();
  const [conversationId, setConversationId] = useState(null);
  // Optimistic tail: what the person just sent, until the stored transcript has it.
  const [pending, setPending] = useState(null);
  const [turnError, setTurnError] = useState(null);
  const [rated, setRated] = useState({});
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);

  const { data: agent, isLoading, error } = useQuery({
    queryKey: ['agent-detail', activeWorkspace.id, agentId],
    queryFn: () => agentService.getAgentById(activeWorkspace.id, agentId),
    enabled: Boolean(agentId),
  });

  const conversationsKey = ['agent-conversations', activeWorkspace.id, agentId];
  const { data: conversations = [] } = useQuery({
    queryKey: conversationsKey,
    queryFn: () => agentsApi.listConversations(activeWorkspace.id, agentId),
    enabled: Boolean(agentId),
  });

  const { data: conversation } = useQuery({
    queryKey: ['agent-conversation', activeWorkspace.id, agentId, conversationId],
    queryFn: () => agentsApi.getConversation(activeWorkspace.id, agentId, conversationId),
    enabled: Boolean(agentId && conversationId),
  });

  const messages = [
    ...(conversation?.messages ?? []),
    ...(pending ? [{ id: 'pending', role: 'user', content: pending, at: new Date().toISOString() }] : []),
    ...(turnError ? [{ id: 'turn-error', role: 'system', content: turnError, at: new Date().toISOString() }] : []),
  ];

  const run = useMutation({
    mutationFn: (text) => agentsApi.chat(activeWorkspace.id, agentId, { message: text, conversationId: conversationId ?? undefined }),
    onMutate: (text) => {
      setPending(text);
      setTurnError(null);
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['agent-conversation', activeWorkspace.id, agentId, res.conversationId] });
      queryClient.invalidateQueries({ queryKey: conversationsKey });
      setConversationId(res.conversationId);
      setPending(null);
    },
    onError: (err) => {
      setPending(null);
      setTurnError(errorText(err));
    },
  });

  const removeConversation = useMutation({
    mutationFn: (id) => agentsApi.deleteConversation(activeWorkspace.id, agentId, id),
    onSuccess: (_r, id) => {
      if (id === conversationId) startNew();
      queryClient.invalidateQueries({ queryKey: conversationsKey });
    },
    onError: (err) => toast.error('Could not delete the conversation', { description: errorText(err) }),
  });

  const rate = useMutation({
    mutationFn: ({ msg, rating }) =>
      aiFeedbackApi.submit(activeWorkspace.id, { executionId: msg.logId, agentId, rating }),
    onSuccess: (_r, { msg, rating }) => {
      setRated((prev) => ({ ...prev, [msg.id]: rating }));
      toast.success('Feedback recorded');
    },
    onError: (err) => toast.error('Could not save feedback', { description: errorText(err) }),
  });

  const startNew = () => {
    setConversationId(null);
    setPending(null);
    setTurnError(null);
    setRated({});
  };

  const isStreaming = run.isPending;
  const starters = Array.isArray(agent?.configuration?.conversationStarters)
    ? agent.configuration.conversationStarters.filter((v) => typeof v === 'string').slice(0, 4)
    : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleSend = (textToSend = null) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isStreaming) return;
    setInputValue('');
    run.mutate(text);
  };

  if (!agentId || error) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-3 bg-background text-sm text-muted-foreground">
        <p>{agentId ? errorText(error) : 'No agent selected.'}</p>
        <Button variant="outline" size="sm" onClick={() => navigate('/agents')}>
          Back to agents
        </Button>
      </div>
    );
  }
  if (isLoading || !agent) {
    return <LoadingState label="Connecting to agent..." />;
  }

  return (
    <div className="flex h-screen w-full bg-background text-foreground">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="flex h-14 items-center justify-between border-b border-border px-3">
          <span className="text-xs font-semibold">Conversations</span>
          <Button variant="ghost" size="icon-xs" onClick={startNew} title="New chat" className="size-6">
            <MessageSquarePlus className="size-3.5" />
          </Button>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {conversations.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">No conversations yet.</p>
          )}
          {conversations.map((c) => (
            <div
              key={c.id}
              className={cn(
                'group flex items-center gap-1 rounded-md px-2 py-1.5 text-xs hover:bg-surface-raised',
                c.id === conversationId && 'bg-surface-raised font-medium',
              )}
            >
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left"
                onClick={() => {
                  setPending(null);
                  setTurnError(null);
                  setConversationId(c.id);
                }}
              >
                {c.title}
              </button>
              <button
                type="button"
                title="Delete conversation"
                className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                disabled={removeConversation.isPending}
                onClick={() => removeConversation.mutate(c.id)}
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
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
                <Badge variant={agent.status === 'published' ? 'success' : 'outline'} className="text-2xs px-1.5 py-0.2">
                  {agent.status === 'published' ? 'Live' : 'Draft'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate max-w-xs">
                {[agent.role, agent.model].filter(Boolean).join(' • ')}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={isStreaming || (!conversationId && messages.length === 0)}
            onClick={startNew}
            className="gap-1.5 text-xs text-muted-foreground"
          >
            <MessageSquarePlus className="size-3.5" />
            New chat
          </Button>
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-3xl w-full mx-auto space-y-4">
        {messages.length === 0 && (
          <p className="pt-16 text-center text-xs text-muted-foreground">
            Send a message to run {agent.name}.
          </p>
        )}
        {messages.map((msg) => {
          if (msg.role === 'system') {
            return (
              <div
                key={msg.id}
                className="my-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-center text-xs text-warning font-medium"
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
                  'rounded-xl p-4 text-xs leading-relaxed max-w-[85%] shadow-2xs',
                  isUser
                    ? 'bg-primary text-primary-foreground rounded-tr-xs'
                    : 'bg-surface border border-border text-foreground rounded-tl-xs',
                )}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* Assistant Feedback Buttons */}
                {!isUser && msg.logId && (
                  <div className="mt-2.5 flex items-center justify-between text-2xs text-muted-foreground pt-1.5 border-t border-border/40">
                    <span>{timeOf(new Date(msg.at))}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => {
                          navigator.clipboard.writeText(msg.content);
                          toast.success('Copied to clipboard');
                        }}
                        title="Copy"
                        className="size-5"
                      >
                        <Copy className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        disabled={rate.isPending || rated[msg.id] !== undefined}
                        onClick={() => rate.mutate({ msg, rating: 1 })}
                        title="Helpful"
                        className={cn('size-5 hover:text-success', rated[msg.id] === 1 && 'text-success')}
                      >
                        <ThumbsUp className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        disabled={rate.isPending || rated[msg.id] !== undefined}
                        onClick={() => rate.mutate({ msg, rating: -1 })}
                        title="Not helpful"
                        className={cn('size-5 hover:text-destructive', rated[msg.id] === -1 && 'text-destructive')}
                      >
                        <ThumbsDown className="size-3" />
                      </Button>
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
          {starters.length > 0 && messages.length === 0 && (
            <div className="flex flex-wrap gap-1.5">
              {starters.map((prompt) => (
                <Button
                  variant="outline"
                  size="xs"
                  key={prompt}
                  onClick={() => handleSend(prompt)}
                  disabled={isStreaming}
                  className="h-auto rounded-full px-3 py-1 text-xs font-normal"
                >
                  {prompt}
                </Button>
              ))}
            </div>
          )}

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
              placeholder={isStreaming ? 'Agent is working…' : 'Ask this agent a question or describe an action...'}
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
    </div>
  );
}
