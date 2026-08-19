import {
  Badge,
  Button,
  Hint,
  Page,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SkeletonList,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  Activity,
  ArrowLeft,
  Bot,
  Brain,
  Check,
  Copy,
  Cpu,
  PanelRight,
  PanelRightClose,
  Pencil,
  RotateCcw,
  Send,
  Shield,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AgentAvatar } from './AgentMarketplaceView.js';
import { useAgentMutations, useAgents } from './use-agents.js';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolCalls?: string[];
  isError?: boolean;
}

export function AgentChatView() {
  const { agentId: paramAgentId } = useParams<{ agentId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryAgentId = searchParams.get('id') || paramAgentId;

  const { workspaceId, slug } = useCurrentWorkspace();
  const agentsQuery = useAgents(workspaceId);
  const { execute } = useAgentMutations(workspaceId);
  const navigate = useNavigate();

  const agents = agentsQuery.data ?? [];

  // Active agent selection
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(
    queryAgentId || agents[0]?.id || null,
  );

  useEffect(() => {
    if (queryAgentId && queryAgentId !== selectedAgentId) {
      setSelectedAgentId(queryAgentId);
    } else if (!selectedAgentId && agents.length > 0) {
      setSelectedAgentId(agents[0].id);
    }
  }, [queryAgentId, agents, selectedAgentId]);

  const activeAgent = useMemo(() => {
    return agents.find((a) => a.id === selectedAgentId) || agents[0] || null;
  }, [agents, selectedAgentId]);

  // Messages per agent
  const [messagesByAgent, setMessagesByAgent] = useState<
    Record<string, ChatMessage[]>
  >({});
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeMessages = useMemo(() => {
    if (!activeAgent) return [];
    return messagesByAgent[activeAgent.id] ?? [];
  }, [activeAgent, messagesByAgent]);

  const scrollEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages, isThinking]);

  const handleSelectAgent = (agentId: string) => {
    setSelectedAgentId(agentId);
    setSearchParams({ id: agentId });
  };

  const handleSendMessage = useCallback(
    (promptText?: string) => {
      const text = (promptText || input).trim();
      if (!text || !activeAgent || isThinking) return;

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: new Date(),
      };

      setMessagesByAgent((prev) => ({
        ...prev,
        [activeAgent.id]: [...(prev[activeAgent.id] || []), userMsg],
      }));

      setInput('');
      setIsThinking(true);

      execute.mutate(
        {
          agentId: activeAgent.id,
          promptText: text,
        },
        {
          onSuccess: (data) => {
            setIsThinking(false);
            const assistantMsg: ChatMessage = {
              id: `a-${Date.now()}`,
              role: 'assistant',
              content: data.result || 'Task completed successfully.',
              timestamp: new Date(),
              toolCalls: activeAgent.tools
                ? (() => {
                    try {
                      return JSON.parse(activeAgent.tools);
                    } catch {
                      return [];
                    }
                  })()
                : undefined,
            };

            setMessagesByAgent((prev) => ({
              ...prev,
              [activeAgent.id]: [...(prev[activeAgent.id] || []), assistantMsg],
            }));
          },
          onError: () => {
            setIsThinking(false);
            const errorMsg: ChatMessage = {
              id: `err-${Date.now()}`,
              role: 'assistant',
              content:
                'I encountered an issue executing this instruction. Please check workspace permissions and try again.',
              timestamp: new Date(),
              isError: true,
            };

            setMessagesByAgent((prev) => ({
              ...prev,
              [activeAgent.id]: [...(prev[activeAgent.id] || []), errorMsg],
            }));
            toast.error('Agent failed to execute prompt');
          },
        },
      );
    },
    [activeAgent, execute, input, isThinking],
  );

  const handleClearHistory = () => {
    if (!activeAgent) return;
    setMessagesByAgent((prev) => ({
      ...prev,
      [activeAgent.id]: [],
    }));
    toast.info('Conversation cleared');
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Response copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Suggested prompt starters tailored to the agent's role
  const suggestedPrompts = useMemo(() => {
    if (!activeAgent) return [];
    const role = (activeAgent.role || '').toLowerCase();
    if (role.includes('code') || role.includes('engineer')) {
      return [
        'Analyze our recent pull request changes for safety',
        'Help refactor this component for maximum performance',
        'Draft automated unit tests for our authentication service',
      ];
    }
    if (role.includes('support') || role.includes('triage')) {
      return [
        'Summarize open customer support tickets',
        'Draft response template for login authentication issue',
        'Search knowledge base for billing refund policy',
      ];
    }
    if (role.includes('research')) {
      return [
        'Extract insights and summarize workspace documentation',
        'Research best practices for multi-tenant database scaling',
        'Format a structured competitive analysis report',
      ];
    }
    return [
      'What actions can you perform in this workspace?',
      'Summarize recent discussions across our team channels',
      'Help organize and draft our weekly sprint update',
    ];
  }, [activeAgent]);

  if (agentsQuery.isLoading) {
    return (
      <Page>
        <SkeletonList rows={5} />
      </Page>
    );
  }

  if (agents.length === 0) {
    return (
      <Page>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-accent-violet-soft text-accent-violet mb-4 shadow-sm">
            <Bot className="size-8" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">
            No AI Agents available
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mb-6">
            Create an agent or deploy a template to start chatting and automating workspace tasks.
          </p>
          <Button
            variant="primary"
            onClick={() => navigate(`/w/${slug}/agents`)}
            leadingIcon={<Sparkles className="size-4" />}
          >
            Deploy AI Agent
          </Button>
        </div>
      </Page>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full flex-col bg-background overflow-hidden text-foreground">
      {/* Channel-Style Top Header Bar */}
      <div className="border-b border-border bg-background shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 sm:px-6 py-2.5">
          {/* Left: Back button + Agent Avatar & Name + Status */}
          <div className="flex min-w-0 items-center gap-2">
            <Hint label="Back to AI Agents">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => navigate(`/w/${slug}/agents`)}
                aria-label="Back to AI Agents"
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                <ArrowLeft className="size-4" />
              </Button>
            </Hint>

            <div className="h-4 w-px bg-border shrink-0" />

            {activeAgent ? (
              <div className="flex min-w-0 items-center gap-2.5">
                <AgentAvatar
                  avatarUrl={activeAgent.avatarUrl}
                  name={activeAgent.name}
                  size="sm"
                />

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
                      {activeAgent.name}
                    </h2>
                    <Badge
                      variant="neutral"
                      className="px-1.5 py-0 text-[10px] font-mono shrink-0"
                    >
                      {activeAgent.model || 'gpt-4o'}
                    </Badge>
                    <span
                      className={cn(
                        'flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border',
                        activeAgent.isActive
                          ? 'bg-success/10 text-success-text border-success/20'
                          : 'bg-muted text-muted-foreground border-border',
                      )}
                    >
                      <span
                        className={cn(
                          'size-1.5 rounded-full',
                          activeAgent.isActive ? 'bg-success' : 'bg-muted-foreground',
                        )}
                      />
                      {activeAgent.isActive ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {activeAgent.role || 'Autonomous Workspace Agent'}
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          {/* Right: Switch Agent dropdown + Actions */}
          <div className="flex items-center gap-2">
            {agents.length > 1 ? (
              <div className="hidden md:block w-48">
                <Select
                  value={activeAgent?.id || ''}
                  onValueChange={handleSelectAgent}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Switch Agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id} className="text-xs">
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <Hint label="Clear conversation">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleClearHistory}
                aria-label="Clear chat history"
                className="text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="size-4" />
              </Button>
            </Hint>

            <Hint label="Open in visual builder">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  navigate(`/w/${slug}/agents/builder?agentId=${activeAgent?.id}`)
                }
                leadingIcon={<Wrench className="size-3.5" />}
                className="text-xs hidden sm:flex"
              >
                Builder
              </Button>
            </Hint>

            <div className="h-4 w-px bg-border shrink-0" />

            <Hint label={showInfoPanel ? 'Hide agent panel' : 'Show agent panel'}>
              <Button
                variant={showInfoPanel ? 'subtle' : 'outline'}
                size="icon-sm"
                onClick={() => setShowInfoPanel(!showInfoPanel)}
                aria-label="Toggle agent details panel"
                className="text-muted-foreground hover:text-foreground"
              >
                {showInfoPanel ? (
                  <PanelRightClose className="size-4" />
                ) : (
                  <PanelRight className="size-4" />
                )}
              </Button>
            </Hint>
          </div>
        </div>
      </div>

      {/* Main Chat Body (Split View with Info Panel) */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left/Middle: Messages Stream and Composer */}
        <div className="flex min-h-0 flex-1 flex-col justify-between overflow-hidden">
          {/* Messages Scroll Area */}
          <ScrollArea className="flex-1 min-h-0 p-4 sm:p-6">
            <div className="mx-auto max-w-3xl space-y-6">
              {/* Empty / Welcome Hero State */}
              {activeMessages.length === 0 ? (
                <div className="py-10 text-center animate-in fade-in duration-300">
                  <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl shadow-sm bg-accent-violet-soft text-accent-violet">
                    <Bot className="size-8" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">
                    Chat with {activeAgent?.name}
                  </h3>
                  <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground">
                    {activeAgent?.description ||
                      activeAgent?.systemPrompt ||
                      'Ask questions, request actions, or analyze workspace data with this autonomous agent.'}
                  </p>

                  {/* Suggested Quick Prompt Starters */}
                  <div className="mt-8 space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Suggested Prompts
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left max-w-xl mx-auto">
                      {suggestedPrompts.map((prompt, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSendMessage(prompt)}
                          className="flex items-start gap-2.5 rounded-xl border border-border/80 bg-surface p-3 text-xs text-foreground transition-all hover:border-primary hover:bg-surface-raised hover:shadow-xs text-left cursor-pointer"
                        >
                          <Sparkles className="size-4 shrink-0 text-primary mt-0.5" />
                          <span>{prompt}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Chat Messages History */
                activeMessages.map((msg) => {
                  const isUser = msg.role === 'user';
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        'flex gap-3 text-xs animate-in fade-in-50 duration-200',
                        isUser ? 'justify-end' : 'justify-start',
                      )}
                    >
                      {!isUser ? (
                        <AgentAvatar
                          avatarUrl={activeAgent?.avatarUrl}
                          name={activeAgent?.name || 'Agent'}
                          size="sm"
                          className="mt-1"
                        />
                      ) : null}

                      <div
                        className={cn(
                          'group relative max-w-[85%] rounded-2xl px-4 py-3 shadow-2xs',
                          isUser
                            ? 'bg-primary text-primary-foreground rounded-br-xs'
                            : msg.isError
                            ? 'bg-destructive/10 border border-destructive/20 text-destructive rounded-bl-xs'
                            : 'bg-surface border border-border text-foreground rounded-bl-xs',
                        )}
                      >
                        {/* Agent Label & Timestamp */}
                        <div className="mb-1 flex items-center justify-between gap-3 text-[10px]">
                          <span
                            className={cn(
                              'font-semibold',
                              isUser ? 'text-primary-foreground/90' : 'text-foreground',
                            )}
                          >
                            {isUser ? 'You' : activeAgent?.name}
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

                        {/* Content text */}
                        <div className="whitespace-pre-wrap leading-relaxed">
                          {msg.content}
                        </div>

                        {/* Copy button on hover for assistant messages */}
                        {!isUser ? (
                          <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1 font-mono text-[10px]">
                              <Cpu className="size-3 text-primary" />
                              {activeAgent?.model || 'gpt-4o'}
                            </span>

                            <button
                              type="button"
                              onClick={() => handleCopyMessage(msg.id, msg.content)}
                              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors p-1"
                              title="Copy message"
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
                })
              )}

              {/* Live Thinking / Generating Indicator */}
              {isThinking ? (
                <div className="flex gap-3 animate-pulse">
                  <AgentAvatar
                    avatarUrl={activeAgent?.avatarUrl}
                    name={activeAgent?.name || 'Agent'}
                    size="sm"
                    className="mt-1"
                  />
                  <div className="rounded-2xl rounded-bl-xs border border-border bg-surface px-4 py-3 text-xs text-muted-foreground shadow-2xs flex items-center gap-2">
                    <Sparkles className="size-3.5 text-primary animate-spin" />
                    <span>{activeAgent?.name} is thinking and processing tools...</span>
                  </div>
                </div>
              ) : null}

              <div ref={scrollEndRef} />
            </div>
          </ScrollArea>

          {/* Composer Input Area */}
          <div className="border-t border-border bg-background p-3 sm:p-4 shrink-0">
            <div className="mx-auto max-w-3xl">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
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
                      handleSendMessage();
                    }
                  }}
                  placeholder={`Ask ${activeAgent?.name || 'AI agent'} anything... (Enter to send, Shift+Enter for new line)`}
                  rows={2}
                  disabled={isThinking}
                  className="w-full resize-none bg-transparent px-3.5 pt-3 pb-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden disabled:opacity-50"
                />

                <div className="flex items-center justify-between border-t border-border/50 px-3 py-2 bg-surface-raised/30">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Badge variant="neutral" className="text-[10px] font-mono px-1.5 py-0">
                      @{activeAgent?.name}
                    </Badge>
                    <span className="hidden sm:inline-block text-subtle text-[10px]">
                      Press Enter ↵ to send
                    </span>
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={!input.trim() || isThinking}
                    loading={isThinking}
                    leadingIcon={<Send className="size-3.5" />}
                    className="text-xs h-7 px-3"
                  >
                    Send
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Right: Collapsible Agent Details & Workspace Context Side Panel */}
        {showInfoPanel && activeAgent ? (
          <div className="w-80 border-l border-border bg-surface p-4 shrink-0 overflow-y-auto hidden lg:flex flex-col justify-between">
            <div className="space-y-5">
              {/* Agent Profile Summary */}
              <div className="text-center pb-4 border-b border-border/80">
                <div className="mx-auto mb-3 flex justify-center">
                  <AgentAvatar
                    avatarUrl={activeAgent.avatarUrl}
                    name={activeAgent.name}
                    size="lg"
                  />
                </div>
                <h3 className="font-semibold text-sm text-foreground">
                  {activeAgent.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {activeAgent.role || 'Assistant'}
                </p>

                <div className="mt-2.5 flex items-center justify-center gap-1.5">
                  <Badge variant="neutral" className="font-mono text-[10px]">
                    {activeAgent.model || 'gpt-4o'}
                  </Badge>
                  <Badge
                    variant={activeAgent.isMarketplace ? 'neutral' : 'primary'}
                    className="text-[10px]"
                  >
                    {activeAgent.isMarketplace ? 'Template' : 'Custom'}
                  </Badge>
                </div>
              </div>

              {/* Instructions / System Prompt */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Brain className="size-3.5 text-primary" />
                  System Instructions
                </span>
                <p className="text-xs text-muted-foreground leading-relaxed rounded-lg border border-border/80 bg-surface-raised p-2.5 max-h-36 overflow-y-auto">
                  {activeAgent.systemPrompt || 'Autonomous workspace employee.'}
                </p>
              </div>

              {/* Connected Capabilities & Tools */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Wrench className="size-3.5 text-accent-amber" />
                  Tools & Capabilities
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(() => {
                    try {
                      const tools: string[] = JSON.parse(activeAgent.tools || '[]');
                      if (tools.length === 0) {
                        return (
                          <span className="text-xs text-muted-foreground italic">
                            Workspace knowledge & search
                          </span>
                        );
                      }
                      return tools.map((tool) => (
                        <Badge
                          key={tool}
                          variant="neutral"
                          className="text-[10px] font-mono"
                        >
                          {tool}
                        </Badge>
                      ));
                    } catch {
                      return (
                        <Badge variant="neutral" className="text-[10px]">
                          Workspace Context
                        </Badge>
                      );
                    }
                  })()}
                </div>
              </div>

              {/* Workspace Context Access */}
              <div className="rounded-lg border border-border/80 bg-surface-raised/60 p-3 space-y-1.5">
                <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                  <Shield className="size-3.5 text-success-text" />
                  Workspace Data Access
                </span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  This agent is authorized to read workspace channels, discussions, document knowledge, and execute verified tasks.
                </p>
              </div>
            </div>

            {/* Bottom Panel Actions */}
            <div className="pt-4 border-t border-border/80 space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() =>
                  navigate(`/w/${slug}/agents/builder?agentId=${activeAgent.id}`)
                }
                leadingIcon={<Pencil className="size-3.5" />}
              >
                Edit Agent in Builder
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={() => navigate(`/w/${slug}/agents/logs`)}
                leadingIcon={<Activity className="size-3.5" />}
              >
                View Activity Logs
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
