import type { AICoworkerDetail } from '@org/types';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  ScrollArea,
  Spinner,
  toast,
  type RightPanelProfile,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Activity,
  Bot,
  Brain,
  Briefcase,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Cpu,
  Edit2,
  Layers,
  MoreVertical,
  Play,
  Plug,
  Shield,
  Trash2,
  Unlink,
  UserCheck,
  X,
  Zap,
} from 'lucide-react';
import { type FC, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CoworkerAvatar } from './CoworkerAvatar.js';
import { CoworkerCreateDialog } from './CoworkerCreateDialog.js';
import { CoworkerStatusDot } from './CoworkerStatusDot.js';
import {
  useCoworker,
  useCoworkerLogs,
  useCoworkerMutations,
} from './use-coworkers.js';

export interface CoworkerProfilePanelProps {
  coworker?: AICoworkerDetail;
  coworkerId?: string;
  workspaceId: string;
  onClose?: () => void;
  onEdit?: (coworker: AICoworkerDetail) => void;
  onStartChat?: (coworker: AICoworkerDetail) => void;
  className?: string;
}

/**
 * CoworkerProfilePanel — The right-drawer summary card matching ProfileSummaryCard style.
 */
export const CoworkerProfilePanel: FC<CoworkerProfilePanelProps> = ({
  coworker: propCoworker,
  coworkerId: propCoworkerId,
  workspaceId,
  onClose,
  onEdit,
  onStartChat,
  className,
}) => {
  const effectiveId = propCoworker?.id || propCoworkerId || '';
  const { data: fetchedCoworker, isLoading: coworkerLoading } = useCoworker(
    workspaceId,
    effectiveId,
  );
  const coworker = propCoworker || fetchedCoworker;

  const { data: logs, isLoading: logsLoading } = useCoworkerLogs(
    workspaceId,
    effectiveId,
  );
  const mutations = useCoworkerMutations(workspaceId);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedHandle, setCopiedHandle] = useState(false);

  if (coworkerLoading && !coworker) {
    return (
      <aside
        className={cn(
          'flex h-full w-full flex-col items-center justify-center p-8 bg-surface text-foreground',
          className,
        )}
      >
        <Spinner className="size-6 text-primary" />
      </aside>
    );
  }

  if (!coworker) {
    return (
      <aside
        className={cn(
          'flex h-full w-full flex-col items-center justify-center p-8 bg-surface text-foreground text-center space-y-2',
          className,
        )}
      >
        <p className="text-xs text-muted-foreground">Coworker not found.</p>
        {onClose && (
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>
        )}
      </aside>
    );
  }

  const handle = `@${coworker.name.toLowerCase().replace(/\s+/g, '')}`;
  const formattedJoinedDate = coworker.createdAt
    ? new Date(coworker.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Recently';

  const handleDelete = async () => {
    if (
      !window.confirm(
        `Are you sure you want to remove AI Coworker "${coworker.name}"? This action cannot be undone.`,
      )
    ) {
      return;
    }
    try {
      await mutations.remove.mutateAsync(coworker.id);
      toast.success(`Removed coworker ${coworker.name}`);
      onClose?.();
    } catch {
      toast.error('Failed to remove coworker');
    }
  };

  const handleToggleActive = async () => {
    try {
      await mutations.update.mutateAsync({
        coworkerId: coworker.id,
        input: { isActive: !coworker.isActive },
      });
      toast.success(
        coworker.isActive ? 'Deactivated coworker' : 'Activated coworker',
      );
    } catch {
      toast.error('Failed to update coworker status');
    }
  };

  const handleCopyHandle = () => {
    navigator.clipboard.writeText(handle);
    setCopiedHandle(true);
    toast.success(`Copied handle ${handle}`);
    setTimeout(() => setCopiedHandle(false), 2000);
  };

  return (
    <aside
      className={cn(
        'flex h-full w-full flex-col bg-surface text-foreground overflow-hidden',
        className,
      )}
    >
      {/* Drawer Top Bar */}
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5 bg-muted/20 shrink-0">
        <div className="flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Coworker Profile
          </span>
        </div>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit?.(coworker)}>
                <Edit2 className="mr-2 h-3.5 w-3.5" />
                Edit Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleToggleActive}>
                <Zap className="mr-2 h-3.5 w-3.5" />
                {coworker.isActive ? 'Deactivate' : 'Activate'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete Coworker
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>

      {/* Main Body with Mini Cover and User Profile Summary Card Style */}
      <ScrollArea className="flex-1">
        {/* Mini Cover Header */}
        <div
          className="h-24 w-full relative bg-cover bg-center"
          style={{
            backgroundImage:
              'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #022c22 100%)',
          }}
        >
          <div className="absolute inset-0 bg-black/20" />
        </div>

        {/* Content Body with Overlapping Avatar */}
        <div className="px-5 pb-5 pt-0 relative">
          <div className="-mt-10 mb-3 flex items-end justify-between">
            <div className="relative">
              <CoworkerAvatar
                name={coworker.name}
                avatarUrl={coworker.avatarUrl}
                status={coworker.status}
                size="lg"
                className="size-18 rounded-full shadow-lg ring-4 ring-surface"
              />
            </div>
            <div className="flex items-center gap-1.5 pb-1">
              <Badge
                variant={coworker.isActive ? 'secondary' : 'outline'}
                className="text-[10px] px-2 py-0.5"
              >
                {coworker.isActive ? 'Active' : 'Disabled'}
              </Badge>
            </div>
          </div>

          {/* Identity */}
          <div className="space-y-0.5 mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold tracking-tight text-foreground truncate">
                {coworker.name}
              </h3>
              <Badge variant="primary" className="text-[9px] uppercase font-bold px-1.5 py-0">
                AI COWORKER
              </Badge>
            </div>
            <button
              type="button"
              onClick={handleCopyHandle}
              className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors text-left"
              title="Click to copy handle"
            >
              {handle} {copiedHandle && <Check className="size-3 inline text-success ml-1" />}
            </button>
            <p className="text-xs font-medium text-primary mt-1">{coworker.role}</p>
          </div>

          {onStartChat && (
            <Button
              size="sm"
              className="w-full mb-4 gap-2 font-medium shadow-xs"
              onClick={() => onStartChat(coworker)}
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Direct Message
            </Button>
          )}

          {/* Structured Metadata Table (Matching ProfileSummaryCard) */}
          <div className="space-y-2.5 pt-3 border-t border-border/60 text-xs">
            <div className="flex items-center justify-between py-0.5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="size-3.5" />
                <span>Joined on</span>
              </div>
              <span className="font-semibold text-foreground">{formattedJoinedDate}</span>
            </div>

            <div className="flex items-center justify-between py-0.5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Cpu className="size-3.5" />
                <span>Model & Provider</span>
              </div>
              <div className="text-right">
                <span className="font-mono font-semibold text-foreground">
                  {coworker.model || 'gpt-4o'}
                </span>
                <span className="text-[11px] text-muted-foreground block capitalize">
                  {coworker.provider || 'OpenAI'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between py-0.5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Shield className="size-3.5" />
                <span>Knowledge Access</span>
              </div>
              <Badge
                variant={coworker.permissions?.knowledgeAccess ? 'primary' : 'secondary'}
                className="text-[10px]"
              >
                {coworker.permissions?.knowledgeAccess ? 'RAG Enabled' : 'Restricted'}
              </Badge>
            </div>

            <div className="flex items-center justify-between py-0.5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Bot className="size-3.5" />
                <span>Sub-Agents</span>
              </div>
              <span className="font-semibold text-foreground">
                {coworker.agentLinks?.length ?? 0} delegated
              </span>
            </div>

            <div className="flex items-center justify-between py-0.5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Plug className="size-3.5" />
                <span>Connected Apps</span>
              </div>
              <span className="font-semibold text-foreground">
                {coworker.appLinks?.length ?? 0} active
              </span>
            </div>
          </div>

          {/* Description & Bio */}
          {coworker.description && (
            <div className="mt-4 pt-3 border-t border-border/60">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Bio &amp; Scope
              </h4>
              <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
                {coworker.description}
              </p>
            </div>
          )}

          {/* Persona Tone */}
          {coworker.personality && (
            <div className="mt-3 pt-3 border-t border-border/60">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
                <Brain className="size-3 text-primary" />
                <span>Persona &amp; Tone</span>
              </h4>
              <p className="text-xs italic text-muted-foreground rounded-lg bg-muted/40 p-2.5">
                "{coworker.personality}"
              </p>
            </div>
          )}

          {/* Execution Activity Logs */}
          <div className="mt-4 pt-3 border-t border-border/60 space-y-2 pb-6">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-primary" />
                Recent Telemetry
              </span>
              <span className="text-[10px] font-mono">{logs?.length ?? 0} runs</span>
            </div>

            {logsLoading ? (
              <div className="text-center py-4 text-xs text-muted-foreground">
                Loading telemetry...
              </div>
            ) : logs && logs.length > 0 ? (
              <div className="space-y-1.5">
                {logs.slice(0, 4).map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <div
                      key={log.id}
                      className="rounded-lg border border-border bg-card text-xs overflow-hidden"
                    >
                      <button
                        type="button"
                        className="w-full flex items-center justify-between p-2 text-left hover:bg-muted/30 transition-colors"
                        onClick={() =>
                          setExpandedLogId(isExpanded ? null : log.id)
                        }
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span
                            className={cn(
                              'h-2 w-2 rounded-full shrink-0',
                              log.status === 'COMPLETED'
                                ? 'bg-emerald-500'
                                : 'bg-rose-500',
                            )}
                          />
                          <span className="font-medium truncate max-w-[130px]">
                            {log.promptText || 'Task execution'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground shrink-0 text-[10px]">
                          <span>{new Date(log.executedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {isExpanded ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="p-2.5 bg-muted/20 border-t border-border space-y-1.5 text-[11px]">
                          <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                            {log.outputResult || 'Completed without textual output.'}
                          </p>
                          {log.tokensUsed > 0 && (
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40 font-mono">
                              <span>Tokens:</span>
                              <span>{log.tokensUsed}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic rounded-lg border border-dashed border-border p-3 text-center">
                No telemetry recorded yet.
              </p>
            )}
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
};

export interface CoworkerProfileDetailsProps {
  coworker: AICoworkerDetail;
  workspaceId: string;
  onEdit?: (coworker: AICoworkerDetail) => void;
  onStartChat?: (coworker: AICoworkerDetail) => void;
  className?: string;
}

/**
 * CoworkerProfileDetails — Full-page Profile View matching ProfileDetails style:
 * 2-column info cards, cover banner, overlapping avatar, handle, role badge, permissions, and tools.
 */
export const CoworkerProfileDetails: FC<CoworkerProfileDetailsProps> = ({
  coworker,
  workspaceId,
  onEdit,
  onStartChat,
  className,
}) => {
  const mutations = useCoworkerMutations(workspaceId);
  const { data: logs } = useCoworkerLogs(workspaceId, coworker.id);
  const [copied, setCopied] = useState(false);

  const handle = `@${coworker.name.toLowerCase().replace(/\s+/g, '')}`;
  const formattedJoinedDate = coworker.createdAt
    ? new Date(coworker.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Recently';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success('Coworker profile link copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUnlinkAgent = async (agentId: string) => {
    try {
      await mutations.unlinkAgent.mutateAsync({
        coworkerId: coworker.id,
        agentId,
      });
      toast.success('Unlinked sub-agent');
    } catch {
      toast.error('Failed to unlink agent');
    }
  };

  const handleUnlinkApp = async (integrationId: string) => {
    try {
      await mutations.unlinkApp.mutateAsync({
        coworkerId: coworker.id,
        integrationId,
      });
      toast.success('Unlinked integration');
    } catch {
      toast.error('Failed to unlink integration');
    }
  };

  return (
    <div className={cn('w-full max-w-5xl mx-auto space-y-6 pb-12', className)}>
      {/* Profile Header Card with Cover and Overlapping Avatar */}
      <div className="rounded-2xl border border-border bg-surface text-foreground shadow-xs overflow-hidden">
        {/* Cover Header Banner */}
        <div
          className="h-32 sm:h-44 w-full relative bg-cover bg-center"
          style={{
            backgroundImage:
              'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #022c22 100%)',
          }}
        >
          <div className="absolute inset-0 bg-black/25 backdrop-blur-[0.5px]" />
        </div>

        {/* Identity & Actions Bar */}
        <div className="px-6 pb-6 pt-0 relative">
          <div className="-mt-14 sm:-mt-16 mb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            {/* Avatar & Core Identity */}
            <div className="flex items-end gap-4">
              <div className="relative">
                <CoworkerAvatar
                  name={coworker.name}
                  avatarUrl={coworker.avatarUrl}
                  status={coworker.status}
                  size="xl"
                  className="size-24 sm:size-28 rounded-full shadow-xl ring-4 ring-surface"
                />
              </div>

              <div className="space-y-1 pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                    {coworker.name}
                  </h2>
                  <Badge variant="primary" className="text-[10px] uppercase font-bold tracking-wider">
                    AI COWORKER
                  </Badge>
                  <Badge
                    variant={coworker.isActive ? 'secondary' : 'outline'}
                    className="text-[10px] font-semibold"
                  >
                    {coworker.isActive ? 'Active' : 'Disabled'}
                  </Badge>
                </div>
                <p className="text-xs font-mono text-muted-foreground">{handle}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {onStartChat && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onStartChat(coworker)}
                  className="text-xs font-semibold gap-1.5 shadow-sm px-4"
                >
                  <Play className="size-3.5 fill-current" />
                  <span>Direct Message</span>
                </Button>
              )}

              {onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(coworker)}
                  className="text-xs gap-1.5 border-border bg-surface hover:bg-accent"
                >
                  <Edit2 className="size-3.5" />
                  <span>Edit Profile</span>
                </Button>
              )}

              <Button
                variant="outline"
                size="icon-sm"
                onClick={handleCopyLink}
                className="size-8 border-border bg-surface hover:bg-accent"
                title="Copy profile link"
              >
                {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
              </Button>
            </div>
          </div>

          {/* Quick Meta Chips */}
          <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-muted-foreground border-t border-border/60">
            <div className="flex items-center gap-1.5">
              <Briefcase className="size-3.5 text-primary" />
              <span className="font-medium text-foreground">{coworker.role}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Cpu className="size-3.5 text-primary" />
              <span className="font-mono">{coworker.model || 'gpt-4o'}</span>
              <span className="capitalize">({coworker.provider || 'OpenAI'})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CoworkerStatusDot status={coworker.status} showLabel />
            </div>
          </div>
        </div>
      </div>

      {/* 2-Column Grid of Structured Cards (Exact ProfileDetails Pattern) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-foreground">
        {/* Box 1: About & Bio */}
        <div className="rounded-2xl border border-border bg-surface p-5 space-y-3 shadow-xs">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <UserCheck className="size-3.5 text-primary" />
            <span>About Coworker</span>
          </h3>
          <p className="text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap">
            {coworker.description || 'Persistent AI coworker operating inside your workspace projects and channels.'}
          </p>

          {coworker.personality && (
            <div className="pt-3 border-t border-border/60">
              <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Brain className="size-3 text-primary" />
                <span>Persona &amp; Demeanor</span>
              </h4>
              <p className="text-xs italic text-muted-foreground bg-muted/40 rounded-lg p-3">
                "{coworker.personality}"
              </p>
            </div>
          )}
        </div>

        {/* Box 2: Work & Teammate Standing */}
        <div className="rounded-2xl border border-border bg-surface p-5 space-y-3 shadow-xs">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Briefcase className="size-3.5 text-primary" />
            <span>Work &amp; Organization</span>
          </h3>
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Assigned Role:</span>
              <Badge variant="primary" className="text-[10px] font-semibold">
                {coworker.role}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">System Standing:</span>
              <span className="font-mono text-muted-foreground">Autonomous AI Teammate</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Joined Workspace:</span>
              <span className="font-semibold text-foreground">{formattedJoinedDate}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Operational Status:</span>
              <div className="flex items-center gap-1 font-medium text-foreground">
                <CoworkerStatusDot status={coworker.status} showLabel />
              </div>
            </div>
          </div>
        </div>

        {/* Box 3: Permissions & Guardrails */}
        <div className="rounded-2xl border border-border bg-surface p-5 space-y-3 shadow-xs">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Shield className="size-3.5 text-primary" />
            <span>Permissions &amp; Capabilities</span>
          </h3>
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Workspace Knowledge (RAG):</span>
              <Badge
                variant={coworker.permissions?.knowledgeAccess ? 'primary' : 'secondary'}
                className="text-[10px]"
              >
                {coworker.permissions?.knowledgeAccess ? 'Enabled' : 'Restricted'}
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground block mb-1.5">Action Capabilities:</span>
              <div className="flex flex-wrap gap-1.5">
                {(coworker.permissions?.allowActions ?? ['search_docs', 'list_projects', 'list_tasks']).map(
                  (action) => (
                    <Badge key={action} variant="neutral" className="font-mono text-[10px]">
                      {action}
                    </Badge>
                  ),
                )}
              </div>
            </div>
            {coworker.matrixRoomId && (
              <div className="flex items-center justify-between pt-2 border-t border-border/60">
                <span className="text-muted-foreground">Matrix Room:</span>
                <span className="font-mono text-[11px] text-muted-foreground truncate max-w-[200px]">
                  {coworker.matrixRoomId}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Box 4: System Directives & Telemetry Summary */}
        <div className="rounded-2xl border border-border bg-surface p-5 space-y-3 shadow-xs">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Clock className="size-3.5 text-primary" />
            <span>Availability &amp; System Directives</span>
          </h3>
          <div className="p-3 rounded-xl border border-border/80 bg-surface-raised space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">Operational Availability</span>
              <Badge variant="success" className="text-[10px]">24/7 Always On</Badge>
            </div>
            <div className="text-[11px] text-muted-foreground font-mono leading-relaxed line-clamp-3">
              {coworker.systemInstructions || 'Ready for proactive collaboration on workspace deliverables.'}
            </div>
          </div>
          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-muted-foreground">Total Execution Runs:</span>
            <span className="font-semibold text-foreground">{logs?.length ?? coworker._count?.executionLogs ?? 0}</span>
          </div>
        </div>

        {/* Box 5: Delegated Sub-Agents */}
        <div className="rounded-2xl border border-border bg-surface p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Bot className="size-3.5 text-primary" />
              <span>Delegated Sub-Agents ({coworker.agentLinks?.length ?? 0})</span>
            </h3>
          </div>

          {coworker.agentLinks?.length ? (
            <div className="space-y-2">
              {coworker.agentLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface-raised px-3.5 py-2.5 text-xs"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <Bot className="size-4 text-violet-500 shrink-0" />
                    <div className="truncate">
                      <p className="font-semibold text-foreground truncate">{link.agent.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{link.agent.role}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => handleUnlinkAgent(link.agentId)}
                    title="Unlink agent"
                  >
                    <Unlink className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic rounded-xl border border-dashed border-border p-4 text-center">
              No sub-agents linked. Coworker operates independently.
            </p>
          )}
        </div>

        {/* Box 6: Connected Apps */}
        <div className="rounded-2xl border border-border bg-surface p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Plug className="size-3.5 text-primary" />
              <span>Connected Apps ({coworker.appLinks?.length ?? 0})</span>
            </h3>
          </div>

          {coworker.appLinks?.length ? (
            <div className="space-y-2">
              {coworker.appLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface-raised px-3.5 py-2.5 text-xs"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <Layers className="size-4 text-sky-500 shrink-0" />
                    <div className="truncate">
                      <p className="font-semibold text-foreground truncate capitalize">
                        {link.integration.displayName || link.integration.provider}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        Status: {link.integration.status}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => handleUnlinkApp(link.integrationId)}
                    title="Unlink integration"
                  >
                    <Unlink className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic rounded-xl border border-dashed border-border p-4 text-center">
              No apps connected. Coworker uses built-in tools.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export interface CoworkerProfileRightPanelProps {
  profile: RightPanelProfile;
  workspaceId: string;
  workspaceSlug: string;
  onClose: () => void;
}

export const CoworkerProfileRightPanel: FC<CoworkerProfileRightPanelProps> = ({
  profile,
  workspaceId,
  workspaceSlug,
  onClose,
}) => {
  const navigate = useNavigate();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const effectiveId = profile.entityId || profile.userId.replace(/^coworker-/, '');
  const coworker = profile.raw as AICoworkerDetail | undefined;

  return (
    <>
      <CoworkerProfilePanel
        coworker={coworker}
        coworkerId={effectiveId}
        workspaceId={workspaceId}
        onClose={onClose}
        onEdit={() => setEditDialogOpen(true)}
        onStartChat={() => {
          navigate(`/w/${workspaceSlug}/coworkers/${effectiveId}`);
        }}
        className="w-full border-l-0 shadow-none"
      />
      {coworker && (
        <CoworkerCreateDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          workspaceId={workspaceId}
          coworker={coworker}
        />
      )}
    </>
  );
};


