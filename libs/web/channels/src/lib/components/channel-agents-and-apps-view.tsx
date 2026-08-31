import { useState } from 'react';
import type { ChannelSummary } from '@org/types';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Input,
  ScrollArea,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
  UserAvatar,
} from '@org/ui';
import { cn, formatDate } from '@org/utils';
import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  Blocks,
  ChevronDown,
  Code2,
  Copy,
  Cpu,
  ExternalLink,
  GitPullRequest,
  MessageSquare,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Terminal,
  ThumbsUp,
  Trash2,
  Workflow,
  Zap,
} from 'lucide-react';
import {
  type ChannelAIAgent,
  type ChannelConnectedApp,
  type ChannelBotMessage,
} from '../types/channel-agents-apps.js';

export interface ChannelAgentsAndAppsViewProps {
  channel: ChannelSummary;
  agents: ChannelAIAgent[];
  apps: ChannelConnectedApp[];
  messages: ChannelBotMessage[];
  onAddAgent: () => void;
  onAddApp: () => void;
  onRemoveAgent: (agentId: string) => void;
  onToggleAgent: (agentId: string) => void;
  onRemoveApp: (appId: string) => void;
  onToggleApp: (appId: string) => void;
  onSendTestMessage: (
    senderType: 'agent' | 'app',
    senderId: string,
    prompt?: string,
  ) => void;
  onClearMessages: () => void;
  onResetSampleMessages: () => void;
}

export function ChannelAgentsAndAppsView({
  channel,
  agents,
  apps,
  messages,
  onAddAgent,
  onAddApp,
  onRemoveAgent,
  onToggleAgent,
  onRemoveApp,
  onToggleApp,
  onSendTestMessage,
  onClearMessages,
  onResetSampleMessages,
}: ChannelAgentsAndAppsViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'messages' | 'agents' | 'apps'>('messages');
  const [selectedSenderId, setSelectedSenderId] = useState<string>(
    agents[0]?.id || apps[0]?.id || 'agent-copilot',
  );
  const [testPrompt, setTestPrompt] = useState('');
  const [expandedReasoningIds, setExpandedReasoningIds] = useState<Set<string>>(
    new Set([messages[0]?.id || '']),
  );
  const [filterSenderId, setFilterSenderId] = useState<string>('all');
  const [likedMessageIds, setLikedMessageIds] = useState<Set<string>>(new Set());

  const activeAgents = agents.filter((a) => a.enabled);
  const activeApps = apps.filter((a) => a.enabled);

  const toggleReasoning = (msgId: string) => {
    setExpandedReasoningIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  const toggleLikeMessage = (msgId: string) => {
    setLikedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
        toast.info('Removed feedback');
      } else {
        next.add(msgId);
        toast.success('Thank you for your feedback! 👍');
      }
      return next;
    });
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard!');
  };

  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Message copied to clipboard');
  };

  const handleSendPrompt = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!testPrompt.trim()) {
      toast.info('Please enter a test prompt');
      return;
    }

    const isAgent = agents.some((a) => a.id === selectedSenderId);
    onSendTestMessage(
      isAgent ? 'agent' : 'app',
      selectedSenderId,
      testPrompt.trim(),
    );
    setTestPrompt('');
    setActiveSubTab('messages');
  };

  const quickPrompts = [
    { label: 'Summarize sprint blockers', prompt: 'Summarize all current sprint blockers and open PRs' },
    { label: 'Review security & auth', prompt: 'Perform security analysis on channel authentication code' },
    { label: 'Trigger GitHub PR event', prompt: 'Simulate GitHub Pull Request check run passing' },
    { label: 'Simulate Sentry P0 Error', prompt: 'Simulate Sentry uncaught exception alert in API worker' },
  ];

  const filteredMessages = messages.filter((msg) => {
    if (filterSenderId === 'all') return true;
    return msg.senderId === filterSenderId;
  });

  return (
    <div className="min-h-0 flex flex-1 flex-col bg-background text-foreground">
      {/* Top Banner / Summary */}
      <div className="border-b border-border bg-surface/80 backdrop-blur-sm px-4 sm:px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                <Bot className="size-5 text-primary" />
                <span>AI Agents &amp; Apps</span>
              </h2>
              <Badge variant="primary" className="text-xs py-0 h-5 gap-1">
                <span className="size-1.5 rounded-full bg-accent-green animate-pulse" />
                <span>{activeAgents.length} Active AI Agents</span>
              </Badge>
              <Badge variant="neutral" className="text-xs py-0 h-5">
                {activeApps.length} Apps Connected
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Autonomous AI coworkers, automated webhook bots, and rich message design previews for #{channel.name}.
            </p>
            <p className="text-xs text-accent-amber mt-1.5 flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 shrink-0" />
              <span>
                Local preview only — what you add and send here stays in this
                browser and isn't visible to the rest of #{channel.name}.
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={onAddApp}
              className="h-8 text-xs gap-1.5 border-accent-violet/30 text-accent-violet hover:bg-accent-violet-soft"
            >
              <Blocks className="size-3.5" />
              <span>Connect App</span>
            </Button>
            <Button
              size="sm"
              onClick={onAddAgent}
              className="h-8 text-xs gap-1.5 shadow-xs"
            >
              <Sparkles className="size-3.5" />
              <span>Add AI Agent</span>
            </Button>
          </div>
        </div>

        {/* Quick Stat Pill Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3.5 pt-3.5 border-t border-border/60">
          <div className="p-2.5 rounded-xl border border-border/80 bg-surface flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Bot className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground font-medium truncate">AI Agents</p>
              <p className="text-sm font-bold text-foreground">
                {agents.length} <span className="text-[11px] font-normal text-muted-foreground">({activeAgents.length} active)</span>
              </p>
            </div>
          </div>

          <div className="p-2.5 rounded-xl border border-border/80 bg-surface flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-accent-violet-soft text-accent-violet flex items-center justify-center shrink-0">
              <Blocks className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground font-medium truncate">Installed Apps</p>
              <p className="text-sm font-bold text-foreground">
                {apps.length} <span className="text-[11px] font-normal text-muted-foreground">({activeApps.length} active)</span>
              </p>
            </div>
          </div>

          <div className="p-2.5 rounded-xl border border-border/80 bg-surface flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-accent-green-soft text-accent-green flex items-center justify-center shrink-0">
              <MessageSquare className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground font-medium truncate">Bot Messages</p>
              <p className="text-sm font-bold text-foreground">{messages.length} generated</p>
            </div>
          </div>

          <div className="p-2.5 rounded-xl border border-border/80 bg-surface flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-accent-amber-soft text-accent-amber flex items-center justify-center shrink-0">
              <Zap className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground font-medium truncate">Response SLA</p>
              <p className="text-sm font-bold text-foreground">~240ms <span className="text-[10px] text-accent-green">Fast</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <Tabs
        value={activeSubTab}
        onValueChange={(v) => setActiveSubTab(v as any)}
        className="min-h-0 flex flex-1 flex-col"
      >
        <div className="px-4 sm:px-6 pt-2 pb-0 flex items-center justify-between border-b border-border bg-background">
          <TabsList className="h-9">
            <TabsTrigger value="messages" className="gap-1.5 text-xs">
              <MessageSquare className="size-3.5" />
              <span>Messages Feed &amp; Design</span>
              {messages.length > 0 && (
                <Badge variant="neutral" className="ml-1 px-1 py-0 text-[10px]">
                  {messages.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="agents" className="gap-1.5 text-xs">
              <Bot className="size-3.5 text-primary" />
              <span>AI Agents ({agents.length})</span>
            </TabsTrigger>
            <TabsTrigger value="apps" className="gap-1.5 text-xs">
              <Blocks className="size-3.5 text-accent-violet" />
              <span>Connected Apps ({apps.length})</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={onResetSampleMessages}
              className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
              title="Reset sample messages feed"
            >
              <RefreshCw className="size-3" />
              <span className="hidden sm:inline">Reset Demo Feed</span>
            </Button>
          </div>
        </div>

        {/* ---------------------------------------------------- TAB 1: MESSAGES FEED & DESIGN */}
        <TabsContent
          value="messages"
          className="min-h-0 flex flex-1 flex-col overflow-hidden"
        >
          {/* Filter & Test Bar */}
          <div className="px-4 sm:px-6 py-2.5 border-b border-border/70 bg-surface/50 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-muted-foreground">Filter by Sender:</span>
              <div className="flex items-center gap-1 flex-wrap">
                <Button
                  size="sm"
                  variant={filterSenderId === 'all' ? 'primary' : 'outline'}
                  onClick={() => setFilterSenderId('all')}
                  className="h-6 text-[11px] px-2"
                >
                  All ({messages.length})
                </Button>
                {agents.map((a) => (
                  <Button
                    key={a.id}
                    size="sm"
                    variant={filterSenderId === a.id ? 'primary' : 'outline'}
                    onClick={() => setFilterSenderId(a.id)}
                    className="h-6 text-[11px] px-2 gap-1"
                  >
                    <span>{a.handle}</span>
                  </Button>
                ))}
                {apps.map((app) => (
                  <Button
                    key={app.id}
                    size="sm"
                    variant={filterSenderId === app.id ? 'primary' : 'outline'}
                    onClick={() => setFilterSenderId(app.id)}
                    className="h-6 text-[11px] px-2 gap-1 text-accent-violet"
                  >
                    <span>{app.name}</span>
                  </Button>
                ))}
              </div>
            </div>

            {messages.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onClearMessages}
                className="h-6 text-xs text-muted-foreground hover:text-destructive gap-1"
              >
                <Trash2 className="size-3" />
                <span>Clear Feed</span>
              </Button>
            )}
          </div>

          {/* Messages Scroll Area */}
          <ScrollArea
            className="min-h-0 flex-1"
            contentClassName="px-4 sm:px-6 py-4 space-y-4 max-w-4xl mx-auto w-full"
          >
            {filteredMessages.length === 0 ? (
              <EmptyState
                icon={<Bot />}
                title="No bot messages yet"
                description="Trigger an AI agent or app webhook below to see their rich messages design in action."
                action={
                  <Button size="sm" onClick={onResetSampleMessages}>
                    Load Sample Messages Feed
                  </Button>
                }
              />
            ) : (
              filteredMessages.map((msg) => {
                const isExpanded = expandedReasoningIds.has(msg.id);
                const isLiked = likedMessageIds.has(msg.id) || msg.feedback?.helpful;

                return (
                  <article
                    key={msg.id}
                    className="group relative rounded-2xl border border-border/80 bg-surface p-4 transition-all hover:border-border hover:shadow-sm"
                  >
                    {/* Header */}
                    <header className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <UserAvatar
                          name={msg.senderName}
                          seed={msg.senderAvatarSeed}
                          size="md"
                        />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-foreground">
                              {msg.senderName}
                            </span>
                            <span className="text-[11px] font-mono text-muted-foreground">
                              {msg.senderHandle}
                            </span>
                            <Badge
                              variant={
                                msg.badgeVariant === 'violet'
                                  ? 'neutral'
                                  : (msg.badgeVariant as any) || 'primary'
                              }
                              className={cn(
                                'text-[10px] py-0 h-4 uppercase font-bold tracking-wider',
                                msg.badgeVariant === 'violet' &&
                                  'bg-accent-violet-soft text-accent-violet border-accent-violet/20',
                              )}
                            >
                              {msg.badgeLabel}
                            </Badge>
                            {msg.model && (
                              <Badge
                                variant="outline"
                                className="text-[10px] py-0 h-4 font-mono text-muted-foreground"
                              >
                                {msg.model}
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-0.5">
                            <time className="text-[10px] text-muted-foreground">
                              {formatDate(msg.timestamp)}
                            </time>
                            {msg.replyToHandle && (
                              <span className="text-[10px] text-primary/80 font-medium">
                                In reply to {msg.replyToHandle}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Message actions menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="size-7 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="size-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 text-xs">
                          <DropdownMenuItem
                            onClick={() => handleCopyMessage(msg.content)}
                            className="gap-2"
                          >
                            <Copy className="size-3.5" />
                            <span>Copy Message Content</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              onSendTestMessage(
                                msg.senderType,
                                msg.senderId,
                                'Follow-up explanation for this message',
                              )
                            }
                            className="gap-2"
                          >
                            <RefreshCw className="size-3.5" />
                            <span>Regenerate Response</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              toast.success('Message pinned to channel!');
                            }}
                            className="gap-2"
                          >
                            <Sparkles className="size-3.5 text-primary" />
                            <span>Pin to Channel</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </header>

                    {/* Reasoning Section (Collapsible chain-of-thought) */}
                    {msg.reasoning && (
                      <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => toggleReasoning(msg.id)}
                          className="w-full px-3 py-2 flex items-center justify-between text-left transition-colors hover:bg-primary/10 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                            <Cpu className="size-3.5 animate-pulse" />
                            <span>Thinking Process ({msg.reasoning.durationMs}ms)</span>
                            <span className="text-[11px] font-normal text-muted-foreground truncate max-w-[280px]">
                              — {msg.reasoning.summary}
                            </span>
                          </div>
                          <ChevronDown
                            className={cn(
                              'size-3.5 text-primary transition-transform duration-200',
                              isExpanded && 'rotate-180',
                            )}
                          />
                        </button>
                        {isExpanded && (
                          <div className="px-3 py-2 text-xs text-muted-foreground border-t border-primary/15 bg-background/50 leading-relaxed font-mono whitespace-pre-wrap">
                            {msg.reasoning.details}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tool executions badges */}
                    {msg.toolsExecuted && msg.toolsExecuted.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {msg.toolsExecuted.map((tool, idx) => (
                          <div
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border bg-surface-raised text-[11px] font-mono text-foreground"
                          >
                            <Terminal className="size-3 text-accent-green" />
                            <span className="font-semibold text-primary">{tool.name}</span>
                            <span className="text-muted-foreground text-[10px]">
                              ({tool.output})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Main Content Body */}
                    <div className="mt-3 text-xs sm:text-sm text-foreground leading-relaxed whitespace-pre-line">
                      {msg.content}
                    </div>

                    {/* Code block with Diff highlighting */}
                    {msg.codeBlock && (
                      <div className="mt-3 rounded-xl border border-border bg-surface-inset text-foreground overflow-hidden font-mono text-xs shadow-md">
                        <div className="px-3 py-1.5 bg-surface-raised border-b border-border flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <Code2 className="size-3.5 text-primary" />
                            <span>{msg.codeBlock.filename || 'snippet.ts'}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(msg.codeBlock!.code)}
                            className="text-muted-foreground hover:text-foreground flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-accent"
                          >
                            <Copy className="size-3" />
                            <span>Copy</span>
                          </button>
                        </div>
                        <div className="p-3 overflow-x-auto">
                          <pre className="leading-relaxed">
                            {msg.codeBlock.code.split('\n').map((line, idx) => {
                              const isAdd = line.startsWith('+');
                              const isRem = line.startsWith('-');
                              return (
                                <div
                                  key={idx}
                                  className={cn(
                                    'px-1 rounded',
                                    isAdd && 'bg-accent-green-soft text-accent-green font-semibold',
                                    isRem && 'bg-accent-rose-soft text-accent-rose line-through opacity-80',
                                  )}
                                >
                                  {line}
                                </div>
                              );
                            })}
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* Rich Embed Card (GitHub / Linear / Sentry / Apps) */}
                    {msg.embedCard && (
                      <div
                        className="mt-3 rounded-xl border border-border bg-surface-raised p-3.5 shadow-xs relative overflow-hidden"
                        style={{ borderLeftWidth: '4px', borderLeftColor: msg.embedCard.accentColor }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1.5">
                            {msg.embedCard.type === 'github_pr' && (
                              <GitPullRequest className="size-4 text-accent-blue" />
                            )}
                            {msg.embedCard.type === 'sentry_alert' && (
                              <AlertTriangle className="size-4 text-accent-rose" />
                            )}
                            {msg.embedCard.type === 'linear_issue' && (
                              <Workflow className="size-4 text-accent-violet" />
                            )}
                            <span>{msg.embedCard.title}</span>
                          </h4>

                          {msg.embedCard.url && (
                            <a
                              href={msg.embedCard.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <ExternalLink className="size-3.5" />
                            </a>
                          )}
                        </div>

                        {/* Embed Fields */}
                        <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
                          {msg.embedCard.fields.map((f, i) => (
                            <div
                              key={i}
                              className={cn(
                                'rounded-lg bg-surface/80 p-2 border border-border/50',
                                !f.inline && 'col-span-2',
                              )}
                            >
                              <span className="text-[10px] font-medium text-muted-foreground block uppercase tracking-wider">
                                {f.label}
                              </span>
                              <span className="font-semibold text-foreground mt-0.5 block truncate">
                                {f.value}
                              </span>
                            </div>
                          ))}
                        </div>

                        {msg.embedCard.footer && (
                          <p className="text-[10px] text-muted-foreground mt-2.5 pt-2 border-t border-border/50">
                            {msg.embedCard.footer}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Interactive Action Buttons */}
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="mt-3.5 pt-3 border-t border-border/60 flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          {msg.actions.map((act) => (
                            <Button
                              key={act.id}
                              size="sm"
                              variant={act.variant === 'default' ? 'outline' : (act.variant || 'outline')}
                              onClick={() => {
                                toast.success(`Executed action: "${act.label}"`);
                              }}
                              className="h-7 text-xs gap-1.5"
                            >
                              <span>{act.label}</span>
                              <ArrowUpRight className="size-3 opacity-70" />
                            </Button>
                          ))}
                        </div>

                        {/* Feedback reaction button */}
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant={isLiked ? 'primary' : 'ghost'}
                            onClick={() => toggleLikeMessage(msg.id)}
                            className={cn(
                              'h-7 text-xs gap-1 px-2 text-muted-foreground',
                              isLiked && 'text-primary-foreground font-semibold',
                            )}
                          >
                            <ThumbsUp className="size-3" />
                            <span className="text-[11px]">
                              {(msg.feedback?.reactionCount || 0) + (isLiked ? 1 : 0)}
                            </span>
                          </Button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </ScrollArea>

          {/* Interactive Test Prompt Composer Bar at Bottom */}
          <div className="p-3 sm:p-4 border-t border-border bg-surface shadow-md">
            <div className="max-w-4xl mx-auto space-y-2">
              {/* Quick Preset Prompts */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0 mr-1">
                  ⚡ Quick Test:
                </span>
                {quickPrompts.map((qp, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setTestPrompt(qp.prompt);
                    }}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-surface-raised text-muted-foreground hover:text-foreground hover:border-primary/50 shrink-0 transition-colors cursor-pointer"
                  >
                    {qp.label}
                  </button>
                ))}
              </div>

              {/* Form Input */}
              <form onSubmit={handleSendPrompt} className="flex items-center gap-2">
                {/* Select sender */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 gap-1.5 text-xs px-2.5 shrink-0 bg-surface-raised"
                    >
                      <Bot className="size-3.5 text-primary" />
                      <span className="max-w-[120px] truncate">
                        {agents.find((a) => a.id === selectedSenderId)?.name ||
                          apps.find((a) => a.id === selectedSenderId)?.name ||
                          'Pick Sender'}
                      </span>
                      <ChevronDown className="size-3 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56 text-xs">
                    <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase">
                      AI Agents
                    </div>
                    {agents.map((a) => (
                      <DropdownMenuItem
                        key={a.id}
                        onClick={() => setSelectedSenderId(a.id)}
                        className="gap-2 cursor-pointer"
                      >
                        <UserAvatar name={a.name} seed={a.avatarSeed} size="xs" />
                        <span className="font-semibold">{a.name}</span>
                        <span className="text-muted-foreground text-[10px] ml-auto">
                          {a.handle}
                        </span>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase">
                      Connected Apps
                    </div>
                    {apps.map((app) => (
                      <DropdownMenuItem
                        key={app.id}
                        onClick={() => setSelectedSenderId(app.id)}
                        className="gap-2 cursor-pointer"
                      >
                        <UserAvatar name={app.name} seed={app.icon} size="xs" />
                        <span className="font-semibold">{app.name}</span>
                        <span className="text-accent-violet text-[10px] ml-auto">
                          {app.botHandle}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Input
                  value={testPrompt}
                  onChange={(e) => setTestPrompt(e.target.value)}
                  placeholder="Type a test prompt or command (e.g. @copilot review auth schema, /standup recap)..."
                  className="text-xs h-9"
                />

                <Button
                  type="submit"
                  size="sm"
                  className="h-9 px-3 gap-1.5 shrink-0"
                >
                  <Send className="size-3.5" />
                  <span className="hidden sm:inline">Send Test Message</span>
                </Button>
              </form>
            </div>
          </div>
        </TabsContent>

        {/* ---------------------------------------------------- TAB 2: ACTIVE AI AGENTS GRID */}
        <TabsContent
          value="agents"
          className="min-h-0 flex flex-1 flex-col p-4 sm:p-6 overflow-y-auto"
        >
          <div className="max-w-4xl mx-auto w-full space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <span>Channel AI Agents</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Autonomous agents assigned to monitor and participate in #{channel.name}.
                </p>
              </div>
              <Button size="sm" onClick={onAddAgent} className="gap-1.5 text-xs h-8">
                <Plus className="size-3.5" />
                <span>Add AI Agent</span>
              </Button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3.5">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className={cn(
                    'p-4 rounded-2xl border transition-all flex flex-col justify-between',
                    agent.enabled
                      ? 'border-border/80 bg-surface shadow-xs hover:border-primary/40'
                      : 'border-border/50 bg-muted/20 opacity-75',
                  )}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-start gap-3 min-w-0">
                        <UserAvatar
                          name={agent.name}
                          seed={agent.avatarSeed}
                          size="md"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-sm font-bold text-foreground truncate">
                              {agent.name}
                            </h4>
                            <span className="text-xs font-mono text-primary">
                              {agent.handle}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground font-medium">
                            {agent.role}
                          </p>
                        </div>
                      </div>

                      <Badge
                        variant={agent.enabled ? 'primary' : 'neutral'}
                        className="text-[10px] py-0 h-4 capitalize"
                      >
                        {agent.enabled ? 'Active' : 'Paused'}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground mt-2.5 leading-relaxed">
                      {agent.description}
                    </p>

                    {/* Capabilities */}
                    <div className="mt-3 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                        Capabilities &amp; Tools:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {agent.capabilities.map((cap, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-surface-raised border border-border/60 text-foreground font-medium"
                          >
                            {cap}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Triggers */}
                    <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
                      <span className="text-[10px] font-bold uppercase tracking-wider">Triggers:</span>
                      <div className="flex items-center gap-1 flex-wrap">
                        {agent.triggers.map((trig) => (
                          <code key={trig} className="text-primary bg-primary/10 px-1 py-0.2 rounded text-[10px]">
                            {trig}
                          </code>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => {
                          setSelectedSenderId(agent.id);
                          onSendTestMessage(
                            'agent',
                            agent.id,
                            `Demonstrate your capabilities in #${channel.name}`,
                          );
                          setActiveSubTab('messages');
                        }}
                        className="h-7 text-xs gap-1.5"
                      >
                        <Play className="size-3" />
                        <span>Test Prompt</span>
                      </Button>
                      <Button
                        size="sm"
                        variant={agent.enabled ? 'outline' : 'secondary'}
                        onClick={() => onToggleAgent(agent.id)}
                        className="h-7 text-xs"
                      >
                        {agent.enabled ? 'Pause' : 'Activate'}
                      </Button>
                    </div>

                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => onRemoveAgent(agent.id)}
                      className="size-7 text-muted-foreground hover:text-destructive"
                      title="Remove agent from channel"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ---------------------------------------------------- TAB 3: CONNECTED APPS GRID */}
        <TabsContent
          value="apps"
          className="min-h-0 flex flex-1 flex-col p-4 sm:p-6 overflow-y-auto"
        >
          <div className="max-w-4xl mx-auto w-full space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Blocks className="size-4 text-accent-violet" />
                  <span>Channel Connected Apps</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Third-party services, CI pipelines, and issue trackers streaming notifications into #{channel.name}.
                </p>
              </div>
              <Button
                size="sm"
                onClick={onAddApp}
                className="gap-1.5 text-xs h-8 bg-accent-violet hover:bg-accent-violet text-white"
              >
                <Plus className="size-3.5" />
                <span>Connect App</span>
              </Button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3.5">
              {apps.map((app) => (
                <div
                  key={app.id}
                  className={cn(
                    'p-4 rounded-2xl border transition-all flex flex-col justify-between',
                    app.enabled
                      ? 'border-border/80 bg-surface shadow-xs hover:border-accent-violet/40'
                      : 'border-border/50 bg-muted/20 opacity-75',
                  )}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-start gap-3 min-w-0">
                        <UserAvatar
                          name={app.name}
                          seed={app.icon}
                          size="md"
                        />
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-foreground truncate">
                            {app.name}
                          </h4>
                          <span className="text-xs font-mono text-accent-violet">
                            {app.botHandle}
                          </span>
                        </div>
                      </div>

                      <Badge
                        variant={app.enabled ? 'primary' : 'neutral'}
                        className={cn(
                          'text-[10px] py-0 h-4 capitalize',
                          app.enabled && 'bg-accent-violet-soft text-accent-violet border-accent-violet/20',
                        )}
                      >
                        {app.enabled ? 'Connected' : 'Muted'}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground mt-2.5 leading-relaxed">
                      {app.description}
                    </p>

                    {/* Subscribed Events */}
                    <div className="mt-3 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                        Subscribed Webhook Events ({app.events.length}):
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {app.events.map((evt, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-mono"
                          >
                            {evt}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedSenderId(app.id);
                          onSendTestMessage(
                            'app',
                            app.id,
                            `Webhook simulation for ${app.name}`,
                          );
                          setActiveSubTab('messages');
                        }}
                        className="h-7 text-xs gap-1.5 text-accent-violet border-accent-violet/30"
                      >
                        <Zap className="size-3" />
                        <span>Simulate Event</span>
                      </Button>
                      <Button
                        size="sm"
                        variant={app.enabled ? 'outline' : 'secondary'}
                        onClick={() => onToggleApp(app.id)}
                        className="h-7 text-xs"
                      >
                        {app.enabled ? 'Mute' : 'Enable'}
                      </Button>
                    </div>

                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => onRemoveApp(app.id)}
                      className="size-7 text-muted-foreground hover:text-destructive"
                      title="Disconnect app"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
