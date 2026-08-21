import type {
  AIAgentMessageContent,
  Message,
  StructuredMessageAction,
} from '@org/types';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Hint,
  toast,
  UserAvatar,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  FileCode,
  FileText,
  HelpCircle,
  ImageIcon,
  Link2,
  Loader2,
  MoreHorizontal,
  Pause,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Terminal,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { MarkdownMessage } from '../markdown-message.js';
import { executeStructuredAction } from './action-handler.js';
import { useAICardPreferencesStore } from './card-preferences-store.js';
import { CardSettingsDialog } from './card-settings-dialog.js';

export interface AgentMessageCardProps {
  message: Message;
  event: AIAgentMessageContent;
  isOwn?: boolean;
  isHighlighted?: boolean;
  onAction?: (action: StructuredMessageAction) => void | Promise<void>;
  onRetry?: () => void;
  onOpenThread?: () => void;
  onToggleSave?: () => void;
  isSaved?: boolean;
}

export function formatDuration(durationMs?: number): string {
  if (durationMs === undefined || durationMs === null) return '';
  if (durationMs < 1000) return `${durationMs}ms`;
  const seconds = (durationMs / 1000).toFixed(1);
  return `${seconds}s`;
}

export function AgentMessageCard({
  message,
  event,
  isOwn: _isOwn = false,
  isHighlighted = false,
  onAction,
  onRetry,
  onOpenThread,
  onToggleSave,
  isSaved = false,
}: AgentMessageCardProps) {
  const prefs = useAICardPreferencesStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [debugModalOpen, setDebugModalOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Progressive disclosure section states
  const [toolsExpanded, setToolsExpanded] = useState(!prefs.collapseToolCalls);
  const [sourcesExpanded, setSourcesExpanded] = useState(!prefs.collapseSources);
  const [reasoningExpanded, setReasoningExpanded] = useState(false);
  const [expandedToolIds, setExpandedToolIds] = useState<Set<string>>(new Set());

  const density = prefs.density;
  const isRunning = event.status === 'running' || event.status === 'starting';
  const isFailed = event.status === 'failed';
  const isWaitingApproval = event.status === 'waiting_for_approval';

  const statusConfig = useMemo(() => {
    switch (event.status) {
      case 'queued':
        return {
          label: 'Queued',
          variant: 'neutral' as const,
          icon: <Clock className="size-3 text-muted-foreground" />,
          color: 'text-muted-foreground',
          border: 'border-border',
        };
      case 'starting':
        return {
          label: 'Starting',
          variant: 'primary' as const,
          icon: <Loader2 className="size-3 animate-spin text-primary" />,
          color: 'text-primary',
          border: 'border-primary/40',
        };
      case 'running':
        return {
          label: 'Running',
          variant: 'primary' as const,
          icon: <Loader2 className="size-3 animate-spin text-primary" />,
          color: 'text-primary',
          border: 'border-primary shadow-sm shadow-primary/10',
        };
      case 'waiting':
        return {
          label: 'Waiting',
          variant: 'warning' as const,
          icon: <Pause className="size-3 text-warning-text" />,
          color: 'text-warning-text',
          border: 'border-warning/50',
        };
      case 'waiting_for_approval':
        return {
          label: 'Approval Required',
          variant: 'warning' as const,
          icon: <ShieldAlert className="size-3 text-amber-500 animate-bounce" />,
          color: 'text-amber-500',
          border: 'border-amber-500/60 shadow-sm shadow-amber-500/10',
        };
      case 'completed':
        return {
          label: 'Completed',
          variant: 'success' as const,
          icon: <CheckCircle2 className="size-3 text-emerald-500" />,
          color: 'text-emerald-600 dark:text-emerald-400',
          border: 'border-border',
        };
      case 'failed':
        return {
          label: 'Failed',
          variant: 'destructive' as const,
          icon: <AlertTriangle className="size-3 text-destructive" />,
          color: 'text-destructive',
          border: 'border-destructive/60 bg-destructive/5',
        };
      case 'cancelled':
        return {
          label: 'Cancelled',
          variant: 'neutral' as const,
          icon: <XCircle className="size-3 text-muted-foreground" />,
          color: 'text-muted-foreground',
          border: 'border-border',
        };
      case 'paused':
        return {
          label: 'Paused',
          variant: 'neutral' as const,
          icon: <Pause className="size-3 text-muted-foreground" />,
          color: 'text-muted-foreground',
          border: 'border-border',
        };
      default:
        return {
          label: 'Unknown',
          variant: 'neutral' as const,
          icon: <HelpCircle className="size-3 text-muted-foreground" />,
          color: 'text-muted-foreground',
          border: 'border-border',
        };
    }
  }, [event.status]);

  const toggleToolDetails = (toolKey: string) => {
    setExpandedToolIds((prev) => {
      const next = new Set(prev);
      if (next.has(toolKey)) next.delete(toolKey);
      else next.add(toolKey);
      return next;
    });
  };

  const handleActionClick = async (action: StructuredMessageAction) => {
    if (onAction) {
      await onAction(action);
      return;
    }
    await executeStructuredAction(action, {
      roomId: message.roomId,
      messageId: message.id,
      agentId: event.agentId,
    });
  };

  const handleCopyText = () => {
    const textToCopy = event.responseText || event.summary || message.body;
    navigator.clipboard?.writeText(textToCopy);
    toast.success('Agent response copied to clipboard');
  };

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(
      `${window.location.origin}${window.location.pathname}#${message.id}`,
    );
    toast.success('Link copied to clipboard');
  };

  // Compact Mode Rendering
  if (density === 'compact') {
    return (
      <article
        data-message-id={message.id}
        className={cn(
          'group/card relative my-1.5 rounded-xl border border-border/80 bg-surface p-3 transition-colors hover:border-border',
          isHighlighted && 'ring-2 ring-primary/60',
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <UserAvatar
              name={event.agentName || message.senderName}
              seed={event.agentAvatarSeed || event.agentId}
              src={event.agentAvatarUrl || message.senderAvatarUrl}
              size="sm"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-foreground truncate">
                  {event.agentName || message.senderName}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {event.model}
                </span>
                <Badge
                  variant={statusConfig.variant}
                  className="text-[9px] py-0 h-4 gap-1"
                >
                  {statusConfig.icon}
                  <span>{statusConfig.label}</span>
                </Badge>
              </div>
              <p className="text-xs text-foreground/90 truncate mt-0.5 max-w-md">
                {event.summary || event.responseText || message.body}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {event.durationMs !== undefined && (
              <span className="text-[10px] font-mono text-muted-foreground">
                {formatDuration(event.durationMs)}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => prefs.setDensity('comfortable')}
              className="h-6 text-[10px] px-2"
            >
              Open
            </Button>
          </div>
        </div>
      </article>
    );
  }

  // Standard (Comfortable) & Expanded Card Rendering
  return (
    <article
      data-message-id={message.id}
      className={cn(
        'group/card relative my-2 rounded-2xl border bg-surface/90 backdrop-blur-sm p-4 transition-all duration-200 shadow-xs hover:shadow-md',
        statusConfig.border,
        isHighlighted && 'ring-2 ring-primary/60',
        isRunning && 'ring-1 ring-primary/40 animate-pulse-subtle',
      )}
    >
      {/* 1. AGENT CARD HEADER */}
      <header className="flex items-start justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="relative">
            <UserAvatar
              name={event.agentName || message.senderName}
              seed={event.agentAvatarSeed || event.agentId}
              src={event.agentAvatarUrl || message.senderAvatarUrl}
              size="md"
              className={cn(
                'size-10 rounded-xl shadow-xs ring-2',
                isRunning ? 'ring-primary' : 'ring-border',
              )}
            />
            {isRunning && (
              <span className="absolute -bottom-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-primary text-[8px] text-primary-foreground animate-spin">
                ◌
              </span>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-foreground tracking-tight">
                {event.agentName || message.senderName}
              </span>

              {event.agentHandle && (
                <span className="text-[11px] font-mono text-muted-foreground">
                  {event.agentHandle}
                </span>
              )}

              <Badge
                variant="primary"
                className="text-[9px] py-0 h-4 uppercase font-bold tracking-wider gap-0.5"
              >
                <Sparkles className="size-2.5" />
                <span>{event.agentRole || 'AI Agent'}</span>
              </Badge>

              {prefs.showModel && event.model && (
                <Badge
                  variant="outline"
                  className="text-[10px] py-0 h-4 font-mono font-medium text-muted-foreground"
                >
                  {event.model}
                </Badge>
              )}

              {/* Status Pill */}
              <Badge
                variant={statusConfig.variant}
                className={cn('text-[10px] py-0 h-4 gap-1 font-semibold', statusConfig.color)}
              >
                {statusConfig.icon}
                <span>{statusConfig.label}</span>
                {prefs.showDuration && event.durationMs !== undefined && (
                  <span className="opacity-75 font-mono ml-0.5">
                    · {formatDuration(event.durationMs)}
                  </span>
                )}
              </Badge>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
              <time dateTime={new Date(message.timestamp).toISOString()}>
                {new Date(message.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
              {event.teamName && (
                <>
                  <span>•</span>
                  <span>{event.teamName}</span>
                </>
              )}
              {event.agentDescription && (
                <>
                  <span className="hidden sm:inline">•</span>
                  <span className="hidden sm:inline truncate max-w-xs">
                    {event.agentDescription}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Top-Right Card Actions */}
        <div className="flex items-center gap-1">
          {prefs.showSaveAction && onToggleSave && (
            <Hint label={isSaved ? 'Remove from saved' : 'Save for later'}>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={onToggleSave}
                aria-label="Save card"
                className={cn(
                  'size-7 text-muted-foreground hover:text-foreground',
                  isSaved && 'text-primary',
                )}
              >
                <Bookmark className={cn('size-3.5', isSaved && 'fill-current')} />
              </Button>
            </Hint>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="More agent options"
                className="size-7 text-muted-foreground hover:text-foreground"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 text-xs">
              <DropdownMenuItem onClick={handleCopyText} className="gap-2">
                <Copy className="size-3.5" />
                <span>Copy Response</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyLink} className="gap-2">
                <Link2 className="size-3.5" />
                <span>Copy Message Link</span>
              </DropdownMenuItem>

              {onOpenThread && (
                <DropdownMenuItem onClick={onOpenThread} className="gap-2">
                  <ArrowRight className="size-3.5" />
                  <span>Reply in Thread</span>
                </DropdownMenuItem>
              )}

              {onRetry && (
                <DropdownMenuItem onClick={onRetry} className="gap-2">
                  <RefreshCw className="size-3.5" />
                  <span>Run Again</span>
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => setSettingsOpen(true)}
                className="gap-2"
              >
                <Settings className="size-3.5" />
                <span>Display Settings</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => setDebugModalOpen(true)}
                className="gap-2 font-mono text-[11px]"
              >
                <Terminal className="size-3.5 text-primary" />
                <span>View Event Debug JSON</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* 2. LIVE / STREAMING EXECUTION PROGRESS */}
      {isRunning && (
        <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-primary flex items-center gap-1.5">
              <Loader2 className="size-3.5 animate-spin" />
              <span>Executing Autonomous Plan…</span>
            </span>
            <span className="text-[10px] font-mono text-muted-foreground animate-pulse">
              Live Stream Active
            </span>
          </div>

          {/* Step Progression checklist */}
          <div className="space-y-1.5 font-mono text-[11px]">
            {event.tools && event.tools.length > 0 ? (
              event.tools.map((t, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  {t.status === 'success' ? (
                    <Check className="size-3 text-emerald-500" />
                  ) : t.status === 'running' ? (
                    <Loader2 className="size-3 animate-spin text-primary" />
                  ) : t.status === 'failed' ? (
                    <XCircle className="size-3 text-destructive" />
                  ) : (
                    <span className="size-3 rounded-full border border-border text-center text-[9px] leading-none">
                      ○
                    </span>
                  )}
                  <span className={cn(t.status === 'running' && 'font-bold text-primary')}>
                    {t.name}
                  </span>
                  {t.durationMs !== undefined && (
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {formatDuration(t.durationMs)}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="size-2 rounded-full bg-primary animate-ping" />
                <span>Analyzing prompt parameters &amp; gathering context…</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. APPROVAL REQUIRED STATE BANNER */}
      {isWaitingApproval && (
        <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-foreground">
          <div className="flex items-center gap-2 font-bold text-amber-600 dark:text-amber-400">
            <ShieldAlert className="size-4" />
            <span>Approval Required for Execution</span>
          </div>
          <p className="mt-1 text-muted-foreground">
            This agent requires authorization before executing side-effecting operations.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              variant="primary"
              onClick={() =>
                handleActionClick({
                  id: 'approve',
                  label: 'Approve & Continue',
                  variant: 'primary',
                })
              }
              className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                handleActionClick({
                  id: 'reject',
                  label: 'Reject Action',
                  variant: 'destructive',
                })
              }
              className="h-7 text-xs border-amber-500/30 text-amber-600 dark:text-amber-400"
            >
              Reject
            </Button>
          </div>
        </div>
      )}

      {/* 4. FAILED STATE BANNER */}
      {isFailed && (
        <div className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          <div className="flex items-center justify-between">
            <span className="font-semibold flex items-center gap-1.5">
              <AlertTriangle className="size-4" />
              <span>{event.errorMessage || 'Execution encountered an unrecoverable error.'}</span>
            </span>
            {onRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={onRetry}
                className="h-6 text-[11px] border-destructive/30 text-destructive hover:bg-destructive/10"
              >
                Retry
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 5. SUMMARY (If distinct from main response) */}
      {event.summary && event.responseText && (
        <div className="mt-3 rounded-xl bg-surface-raised/80 p-3 border border-border/50 text-xs leading-relaxed">
          <span className="font-bold text-foreground block mb-1">Summary</span>
          <p className="text-muted-foreground">{event.summary}</p>
        </div>
      )}

      {/* 6. REASONING / THINKING PROCESS (Collapsible) */}
      {event.reasoning && (
        <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
          <button
            type="button"
            onClick={() => setReasoningExpanded((prev) => !prev)}
            className="w-full px-3 py-2 flex items-center justify-between text-left transition-colors hover:bg-primary/10 cursor-pointer"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <Cpu className="size-3.5 animate-pulse" />
              <span>
                Reasoning &amp; Chain-of-Thought{' '}
                {event.reasoning.durationMs && `(${formatDuration(event.reasoning.durationMs)})`}
              </span>
              {event.reasoning.summary && (
                <span className="text-[11px] font-normal text-muted-foreground truncate max-w-xs">
                  — {event.reasoning.summary}
                </span>
              )}
            </div>
            <ChevronDown
              className={cn(
                'size-3.5 text-primary transition-transform duration-200',
                reasoningExpanded && 'rotate-180',
              )}
            />
          </button>
          {reasoningExpanded && event.reasoning.details && (
            <div className="px-3 py-2.5 text-xs text-muted-foreground border-t border-primary/15 bg-background/50 leading-relaxed font-mono whitespace-pre-wrap">
              {event.reasoning.details}
            </div>
          )}
        </div>
      )}

      {/* 7. MAIN AGENT RESPONSE BODY */}
      {(event.responseText || event.summary || message.body) && (
        <div className="mt-3 text-xs sm:text-sm text-foreground leading-relaxed">
          <MarkdownMessage text={event.responseText || event.summary || message.body} />
        </div>
      )}

      {/* 8. KEY FINDINGS / ACTIONS TAKEN (Bullet cards) */}
      {event.keyFindings && event.keyFindings.length > 0 && (
        <div className="mt-3.5 space-y-1.5">
          <span className="text-[11px] font-bold text-foreground block uppercase tracking-wider">
            Key Findings
          </span>
          <div className="grid sm:grid-cols-2 gap-2">
            {event.keyFindings.map((finding, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg border border-border/80 bg-surface-raised text-xs text-foreground flex items-start gap-2"
              >
                <Check className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>{finding}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 9. TOOL EXECUTIONS ACCORDION */}
      {prefs.showTools && event.tools && event.tools.length > 0 && (
        <div className="mt-3.5 rounded-xl border border-border/80 bg-surface-raised overflow-hidden">
          <button
            type="button"
            onClick={() => setToolsExpanded((prev) => !prev)}
            className="w-full px-3 py-2.5 flex items-center justify-between text-left transition-colors hover:bg-accent cursor-pointer"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <Terminal className="size-3.5 text-primary" />
              <span>Tool Executions ({event.tools.length})</span>
            </div>
            <ChevronDown
              className={cn(
                'size-3.5 text-muted-foreground transition-transform duration-200',
                toolsExpanded && 'rotate-180',
              )}
            />
          </button>

          {toolsExpanded && (
            <div className="p-3 border-t border-border space-y-2">
              {event.tools.map((tool, idx) => {
                const toolKey = tool.id || `tool-${idx}`;
                const isDetailOpen = expandedToolIds.has(toolKey);

                return (
                  <div
                    key={toolKey}
                    className="rounded-lg border border-border bg-surface p-2.5 text-xs font-mono"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {tool.status === 'success' ? (
                          <Check className="size-3 text-emerald-500 shrink-0" />
                        ) : tool.status === 'running' ? (
                          <Loader2 className="size-3 animate-spin text-primary shrink-0" />
                        ) : (
                          <XCircle className="size-3 text-destructive shrink-0" />
                        )}
                        <span className="font-semibold text-foreground truncate">
                          {tool.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {tool.durationMs !== undefined && (
                          <span className="text-[10px] text-muted-foreground">
                            {formatDuration(tool.durationMs)}
                          </span>
                        )}
                        {(tool.input || tool.output || tool.error) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleToolDetails(toolKey)}
                            className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                          >
                            {isDetailOpen ? 'Hide' : 'Inspect'}
                          </Button>
                        )}
                      </div>
                    </div>

                    {isDetailOpen && (
                      <div className="mt-2 pt-2 border-t border-border/60 space-y-2 text-[11px]">
                        {Boolean(tool.input) && (
                          <div>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase block">
                              Input
                            </span>
                            <pre className="p-2 rounded bg-surface-inset text-foreground/90 overflow-x-auto mt-0.5">
                              {typeof tool.input === 'string'
                                ? tool.input
                                : JSON.stringify(tool.input, null, 2)}
                            </pre>
                          </div>
                        )}

                        {Boolean(tool.output) && (
                          <div>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase block">
                              Output
                            </span>
                            <pre className="p-2 rounded bg-surface-inset text-emerald-600 dark:text-emerald-400 overflow-x-auto mt-0.5">
                              {typeof tool.output === 'string'
                                ? tool.output
                                : JSON.stringify(tool.output, null, 2)}
                            </pre>
                          </div>
                        )}

                        {tool.error && (
                          <div className="text-destructive font-sans">
                            <span className="text-[10px] font-bold uppercase block">
                              Error
                            </span>
                            <p className="mt-0.5">{tool.error}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 10. SOURCES SECTION ("N Sources ▾") */}
      {prefs.showSources && event.sources && event.sources.length > 0 && (
        <div className="mt-3.5">
          <button
            type="button"
            onClick={() => setSourcesExpanded((prev) => !prev)}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <Search className="size-3.5 text-primary" />
            <span>{event.sources.length} Sources &amp; Citations</span>
            <ChevronDown
              className={cn(
                'size-3.5 transition-transform duration-200',
                sourcesExpanded && 'rotate-180',
              )}
            />
          </button>

          {sourcesExpanded && (
            <div className="mt-2 grid sm:grid-cols-2 gap-2">
              {event.sources.map((src, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl border border-border bg-surface-raised hover:bg-accent/40 transition-colors flex items-start justify-between gap-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-foreground hover:underline truncate block"
                    >
                      {src.title}
                    </a>
                    <span className="text-[10px] text-muted-foreground block truncate mt-0.5">
                      {src.domain || src.url}
                    </span>
                    {src.description && (
                      <p className="text-[11px] text-muted-foreground/80 line-clamp-2 mt-1">
                        {src.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Hint label="Open source link">
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    </Hint>
                    <Hint label="Copy link">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(src.url);
                          toast.success('Source link copied');
                        }}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent"
                      >
                        <Copy className="size-3.5" />
                      </button>
                    </Hint>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 11. GENERATED FILES & CODE OUTPUT */}
      {event.files && event.files.length > 0 && (
        <div className="mt-3.5 space-y-2">
          <span className="text-[11px] font-bold text-foreground block uppercase tracking-wider">
            Generated Outputs &amp; Files
          </span>
          <div className="grid sm:grid-cols-2 gap-2">
            {event.files.map((file, idx) => {
              const isImage = file.mimeType.startsWith('image/');
              return (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-border bg-surface-raised flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      {isImage ? (
                        <ImageIcon className="size-4" />
                      ) : file.codeSnippet ? (
                        <FileCode className="size-4" />
                      ) : (
                        <FileText className="size-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-foreground truncate block">
                        {file.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground block">
                        {file.mimeType} {file.size ? `· ${(file.size / 1024).toFixed(1)} KB` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isImage && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPreviewImage(file.url)}
                        className="h-7 text-xs px-2"
                      >
                        Preview
                      </Button>
                    )}
                    <a
                      href={file.url}
                      download={file.name}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border bg-surface text-xs font-semibold text-foreground hover:bg-accent transition-colors"
                    >
                      <Download className="size-3" />
                      <span>Download</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 12. DYNAMIC SUGGESTED ACTIONS BAR */}
      {event.suggestedActions && event.suggestedActions.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border/60">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">
            ⚡ Suggested Follow-up Actions
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {event.suggestedActions.map((act) => {
              const btnVariant =
                act.variant === 'default' ? 'primary' : act.variant || 'outline';
              return (
                <Button
                  key={act.id}
                  size="sm"
                  variant={btnVariant}
                  onClick={() => handleActionClick(act)}
                  className="h-7 text-xs gap-1.5 shadow-2xs"
                >
                  <span>{act.label}</span>
                  <ArrowUpRight className="size-3 opacity-70" />
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* 13. TECHNICAL METADATA (Debug Drawer) */}
      {prefs.showTechnicalMetadata && (
        <div className="mt-3.5 rounded-xl border border-border/80 bg-surface-inset p-3 text-[11px] font-mono text-muted-foreground">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-bold text-foreground">Technical Audit Metadata</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDebugModalOpen(true)}
              className="h-5 px-1 text-[10px]"
            >
              Full JSON
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div>Agent ID: {event.agentId}</div>
            <div>Execution ID: {event.executionId || 'N/A'}</div>
            <div>Message Event ID: {message.id}</div>
            <div>Latency: {formatDuration(event.durationMs)}</div>
          </div>
        </div>
      )}

      {/* Image Preview Lightbox */}
      {previewImage && (
        <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
          <DialogContent className="max-w-2xl bg-surface p-2 border-border">
            <img
              src={previewImage}
              alt="Generated preview"
              className="w-full rounded-lg max-h-[80vh] object-contain"
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Raw Event Debug Modal */}
      {debugModalOpen && (
        <Dialog open={debugModalOpen} onOpenChange={setDebugModalOpen}>
          <DialogContent className="max-w-2xl bg-surface border-border">
            <DialogHeader>
              <DialogTitle className="text-sm font-mono flex items-center gap-2">
                <Terminal className="size-4 text-primary" />
                <span>Raw Event Payload: {message.id}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto p-3 rounded-lg bg-surface-inset font-mono text-xs text-foreground">
              <pre>{JSON.stringify(event, null, 2)}</pre>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Card Settings Dialog */}
      <CardSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </article>
  );
}
